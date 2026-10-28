"""Real auth and API permissions against a database, not dependency overrides."""

import re
import unittest
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, Integer, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application import create_app
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password
from app.db import get_db
from app.models.tables import (
    AuditLog,
    Base,
    ClassMembership,
    Classroom,
    GoogleIdentity,
    RevokedToken,
    User,
)
from app.schemas.classes import ClassCreate


class ClassPolicyTests(unittest.TestCase):
    def test_flag_default_and_normalization(self):
        self.assertFalse(Settings(_env_file=None).lms_class_mode)
        self.assertEqual(ClassCreate(code=" abc-1 ", name=" Lớp A ").code, "ABC-1")


class ClassAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        tables = [
            User.__table__,
            GoogleIdentity.__table__,
            RevokedToken.__table__,
            Classroom.__table__,
            ClassMembership.__table__,
            AuditLog.__table__,
        ]
        self.original_types = []
        for table in (
            User.__table__,
            Classroom.__table__,
            ClassMembership.__table__,
            AuditLog.__table__,
        ):
            column = table.c.id
            self.original_types.append((column, column.type))
            column.type = column.type.with_variant(Integer(), "sqlite")
        for column in (AuditLog.__table__.c.before, AuditLog.__table__.c.after):
            self.original_types.append((column, column.type))
            column.type = column.type.with_variant(JSON(), "sqlite")
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        await self.setup_client()

    async def setup_client(self):
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.app = create_app()

        async def test_db():
            async with self.sessions() as db:
                yield db

        self.app.dependency_overrides[get_db] = test_db
        self.redis_patch = patch("app.services.auth.get_redis", return_value=None)
        self.redis_patch.start()
        self.flag_patch = patch.object(get_settings(), "lms_class_mode", True)
        self.flag_patch.start()
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")
        async with self.sessions() as db:
            password = hash_password("secret123")
            for uid, role in ((1, "admin"), (2, "teacher"), (3, "teacher"), (4, "user")):
                db.add(
                    User(
                        id=uid,
                        email=f"user{uid}@example.com",
                        full_name=f"Người dùng {uid}",
                        password_hash=password,
                        role=role,
                    )
                )
            await db.commit()
        self.tokens = {
            uid: create_access_token({"sub": str(uid), "role": "admin"}) for uid in range(1, 5)
        }
        # Deliberately misleading claims: authorization must use persisted roles.
        self.class_a = (
            await self.call(
                2,
                "POST",
                "/api/classes",
                {
                    "code": "A",
                    "name": "Lớp A",
                    "status": "active",
                },
            )
        ).json()["id"]
        self.class_b = (
            await self.call(
                3,
                "POST",
                "/api/classes",
                {
                    "code": "B",
                    "name": "Lớp B",
                    "status": "active",
                },
            )
        ).json()["id"]

    async def asyncTearDown(self):
        await self.client.aclose()
        self.redis_patch.stop()
        self.flag_patch.stop()
        await self.engine.dispose()
        for column, original in self.original_types:
            column.type = original

    async def call(self, uid, method, path, body=None):
        return await self.client.request(
            method, path, json=body, headers={"Authorization": f"Bearer {self.tokens[uid]}"}
        )

    async def add_student(self):
        response = await self.call(
            2, "POST", f"/api/classes/{self.class_a}/members", {"email": " USER4@example.com "}
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def test_register_rejects_role_and_status(self):
        for extra in ({"role": "admin"}, {"role": "teacher"}, {"status": "active"}):
            result = await self.client.post(
                "/api/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "secret123",
                    **extra,
                },
            )
            self.assertEqual(result.status_code, 422)
        result = await self.client.post(
            "/api/auth/register",
            json={
                "email": "new@example.com",
                "password": "secret123",
            },
        )
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()["user"]["role"], "user")

    async def test_teacher_cannot_read_or_write_another_class(self):
        base = f"/api/classes/{self.class_b}"
        for method, url, body in [
            ("GET", base, None),
            ("PATCH", base, {"name": "Hacked"}),
            ("DELETE", base, None),
            ("GET", base + "/members", None),
            ("POST", base + "/members", {"email": "user4@example.com"}),
            ("DELETE", base + "/members", {"user_id": 4}),
        ]:
            result = await self.call(2, method, url, body)
            self.assertEqual(result.status_code, 403, result.text)
            self.assertEqual(result.json()["code"], "MEMBERSHIP_REQUIRED")
        listed = (await self.call(2, "GET", "/api/classes")).json()
        self.assertEqual([row["id"] for row in listed["items"]], [self.class_a])

    async def test_membership_idempotency_removal_old_token_and_restore(self):
        first = await self.add_student()
        second = await self.add_student()
        self.assertEqual(first, second)
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )
        for _ in range(2):
            result = await self.call(
                2, "DELETE", f"/api/classes/{self.class_a}/members", {"user_id": 4}
            )
            self.assertEqual(result.status_code, 204, result.text)
        result = await self.call(4, "GET", f"/api/classes/{self.class_a}")
        self.assertEqual(result.status_code, 403)
        self.assertEqual((await self.call(4, "GET", "/api/classes")).json()["items"], [])
        async with self.sessions() as db:
            row = (
                await db.execute(select(ClassMembership).where(ClassMembership.user_id == 4))
            ).scalar_one()
            self.assertEqual(row.status, "removed")
            self.assertIsNotNone(row.removed_at)
        restored = await self.add_student()
        self.assertEqual(restored["id"], first["id"])
        self.assertIsNone(restored["removed_at"])
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )
        async with self.sessions() as db:
            count = (
                await db.execute(
                    select(func.count())
                    .select_from(ClassMembership)
                    .where(
                        ClassMembership.user_id == 4,
                    )
                )
            ).scalar_one()
            self.assertEqual(count, 1)

    async def test_locked_user_rejected_by_all_authenticated_http_routes(self):
        await self.add_student()
        result = await self.call(1, "PATCH", "/api/admin/users", {"user_id": 4, "status": "locked"})
        self.assertEqual(result.status_code, 200, result.text)
        public = {
            "/",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/google",
            "/api/auth/google/config",
            "/api/curriculum/preview",
        }
        tested = []
        routes = []
        pending = list(self.app.routes)
        while pending:
            route = pending.pop()
            original_router = getattr(route, "original_router", None)
            if original_router is not None:
                pending.extend(original_router.routes)
            else:
                routes.append(route)
        for route in routes:
            if (
                not hasattr(route, "dependant")
                or not hasattr(route, "methods")
                or route.path in public
            ):
                continue
            path = re.sub(r"\{[^}]+\}", "1", route.path)
            for method in route.methods:
                result = await self.call(4, method, path, {})
                self.assertEqual(result.status_code, 401, f"{method} {path}: {result.text}")
                tested.append((method, path))
        self.assertGreater(len(tested), 25)
        result = await self.client.post(
            "/api/auth/login", json={"email": "user4@example.com", "password": "secret123"}
        )
        self.assertEqual(result.status_code, 401)
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "active"})
        self.assertEqual((await self.call(4, "GET", "/api/auth/me")).status_code, 200)

    async def test_google_and_socket_reject_locked_account(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "locked"})
        claims = {"sub": "g4", "email": "user4@example.com", "hd": "example.com"}
        with patch("app.routers.auth.verify_google_credential", AsyncMock(return_value=claims)):
            self.assertEqual(
                (await self.client.post("/api/auth/google", json={"credential": "x"})).status_code,
                401,
            )
        from app.websocket.routes import authorize_telemetry_socket

        with patch("app.db.database.get_session_maker", return_value=self.sessions):
            self.assertFalse(await authorize_telemetry_socket(self.tokens[4], "any-device"))

    async def test_role_claim_cannot_grant_admin_and_demotion_is_immediate(self):
        self.assertEqual((await self.call(4, "GET", "/api/admin/users")).status_code, 403)
        self.assertEqual(
            (await self.call(2, "PATCH", "/api/admin/users/4", {"role": "teacher"})).status_code,
            403,
        )
        result = await self.call(1, "PATCH", "/api/admin/users", {"user_id": 2, "role": "user"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            (
                await self.call(2, "PATCH", f"/api/classes/{self.class_a}", {"name": "Bad"})
            ).status_code,
            403,
        )
        self.assertEqual(
            (await self.call(2, "GET", f"/api/classes/{self.class_a}")).status_code, 403
        )
        self.assertEqual((await self.call(2, "GET", "/api/classes")).json()["items"], [])
        await self.call(1, "PATCH", "/api/admin/users/2", {"role": "teacher"})
        self.assertEqual(
            (await self.call(2, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )

    async def test_admin_filters_pagination_and_audit(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"role": "teacher", "status": "locked"})
        result = (
            await self.call(
                1, "GET", "/api/admin/users?search=USER4&role=teacher&status=locked&page_size=1"
            )
        ).json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], 4)
        self.assertNotIn("password_hash", str(result))
        self.assertEqual(
            (await self.call(1, "GET", "/api/admin/users?page_size=101")).status_code, 422
        )
        async with self.sessions() as db:
            log = (
                await db.execute(select(AuditLog).where(AuditLog.action == "user.update"))
            ).scalar_one()
            self.assertEqual(log.actor, 1)
            self.assertEqual(log.target, "user:4")
            self.assertEqual(log.before, {"role": "user", "status": "active"})
            self.assertEqual(log.after, {"role": "teacher", "status": "locked"})

    async def test_student_cannot_manage_or_list_other_students(self):
        await self.add_student()
        for method, url, body in [
            ("POST", "/api/classes", {"code": "S", "name": "Bad"}),
            ("GET", f"/api/classes/{self.class_a}/members", None),
            ("POST", f"/api/classes/{self.class_a}/members", {"email": "user3@example.com"}),
        ]:
            self.assertEqual((await self.call(4, method, url, body)).status_code, 403)

    async def test_draft_archive_and_unique_code(self):
        result = await self.call(2, "POST", "/api/classes", {"code": " a ", "name": "Duplicate"})
        self.assertEqual(result.status_code, 409, result.text)
        draft = (await self.call(2, "POST", "/api/classes", {"code": "D", "name": "Draft"})).json()[
            "id"
        ]
        await self.call(2, "POST", f"/api/classes/{draft}/members", {"email": "user4@example.com"})
        self.assertEqual((await self.call(4, "GET", f"/api/classes/{draft}")).status_code, 403)
        await self.call(2, "PATCH", f"/api/classes/{draft}", {"status": "active", "name": "Open"})
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{draft}")).json()["name"], "Open"
        )
        await self.call(2, "DELETE", f"/api/classes/{draft}")
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{draft}")).json()["status"], "archived"
        )
        self.assertEqual(
            (
                await self.call(2, "DELETE", f"/api/classes/{draft}/members", {"user_id": 4})
            ).status_code,
            409,
        )

    async def test_admin_creation_and_protected_admin(self):
        invalid = await self.call(1, "POST", "/api/classes", {"code": "ADM", "name": "Admin class"})
        self.assertEqual(invalid.status_code, 422)
        created = await self.call(
            1, "POST", "/api/classes", {"code": "ADM", "name": "Admin class", "teacher_id": 2}
        )
        self.assertEqual(created.status_code, 201)
        for payload in ({"status": "locked"}, {"role": "user"}):
            self.assertEqual(
                (await self.call(1, "PATCH", "/api/admin/users/1", payload)).status_code, 403
            )
        promoted = await self.call(1, "PATCH", "/api/admin/users/4", {"role": "admin"})
        self.assertEqual(promoted.status_code, 200, promoted.text)
        self.assertEqual(promoted.json()["role"], "admin")

    async def test_flag_off_hides_new_apis_but_still_locks_accounts(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "locked"})
        with patch.object(get_settings(), "lms_class_mode", False):
            self.assertEqual(
                (await self.call(1, "GET", "/api/lms/config")).json(),
                {"class_mode": False, "legacy_allowed": True},
            )
            self.assertEqual((await self.call(1, "GET", "/api/classes")).status_code, 404)
            self.assertEqual((await self.call(1, "GET", "/api/admin/users")).status_code, 404)
            self.assertEqual((await self.call(4, "GET", "/api/boards")).status_code, 401)
