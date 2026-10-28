"""Run: python -m unittest app.tests.test_auth (requires aiosqlite)."""

import io
import unittest
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Integer, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.google_auth import verify_google_credential
from app.core.logging import configure_console_encoding
from app.core.security import create_access_token
from app.db import get_db
from app.models.db_models import Base, GoogleIdentity, RevokedToken, User
from app.routers import compiler, curriculum, health
from app.routers.admin import router as admin_router
from app.routers.auth import router


class AuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.original_id_type = User.__table__.c.id.type
        User.__table__.c.id.type = self.original_id_type.with_variant(Integer(), "sqlite")
        async with self.engine.begin() as conn:
            await conn.run_sync(
                lambda c: Base.metadata.create_all(
                    c, tables=[User.__table__, GoogleIdentity.__table__, RevokedToken.__table__]
                )
            )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)
        for service_router in [compiler.router, curriculum.router, health.router]:
            app.include_router(service_router)
        register_exception_handlers(app)

        async def test_db():
            async with self.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.redis_patch = patch("app.services.auth.get_redis", return_value=None)
        self.redis_patch.start()
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        self.redis_patch.stop()
        await self.engine.dispose()
        User.__table__.c.id.type = self.original_id_type

    async def register(self, email="student@gmail.com", password="secret123"):
        return await self.client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "full_name": "Nguyễn Văn A"},
        )

    async def google(self, **overrides):
        claims = {
            "sub": "google-123",
            "email": "student@gmail.com",
            "email_verified": True,
            "name": "Google User",
            **overrides,
        }
        with patch("app.routers.auth.verify_google_credential", AsyncMock(return_value=claims)):
            return await self.client.post("/api/auth/google", json={"credential": "test-token"})

    async def test_register_login_and_me(self):
        registered = await self.register("Student@gmail.com")
        self.assertEqual(registered.status_code, 201, registered.text)
        data = registered.json()
        self.assertEqual(data["user"]["email"], "student@gmail.com")
        logged_in = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "secret123"}
        )
        self.assertEqual(logged_in.status_code, 200, logged_in.text)
        self.assertNotEqual(data["access_token"], logged_in.json()["access_token"])
        me = await self.client.get(
            "/api/auth/me", headers={"Authorization": "Bearer " + data["access_token"]}
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["full_name"], "Nguyễn Văn A")
    async def test_admin_login_requires_admin_route(self):
        signup = await self.client.post(
            "/api/admin/signup",
            json={
                "email": "admin@ptit.edu.vn",
                "password": "secret123",
                "full_name": "Administrator",
            },
        )
        self.assertEqual(signup.status_code, 201, signup.text)
        self.assertEqual(signup.json()["user"]["role"], "admin")

        response = await self.client.post(
            "/api/auth/login", json={"email": "admin@ptit.edu.vn", "password": "secret123"}
        )
        self.assertEqual(response.status_code, 401, response.text)
        self.assertIn("quản trị", response.json()["message"].lower())

        admin_login = await self.client.post(
            "/api/admin/login", json={"email": "admin@ptit.edu.vn", "password": "secret123"}
        )
        self.assertEqual(admin_login.status_code, 200, admin_login.text)
        self.assertEqual(admin_login.json()["user"]["role"], "admin")

    async def test_duplicate_and_deleted_email(self):
        await self.register()
        self.assertEqual((await self.register()).status_code, 400)
        from datetime import datetime, timezone

        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            user.deleted_at = datetime.now(timezone.utc)
            await db.commit()
        self.assertEqual((await self.register()).status_code, 400)
        self.assertEqual((await self.google()).status_code, 401)

    async def test_wrong_password_and_invalid_token(self):
        await self.register()
        response = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "wrong"}
        )
        self.assertEqual(response.status_code, 401)
        me = await self.client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
        self.assertEqual(me.status_code, 401)
        self.assertEqual(me.headers["www-authenticate"], "Bearer")

    async def test_persisted_hash_and_legacy_email_case(self):
        from sqlalchemy.exc import IntegrityError

        from app.core.security import verify_password

        response = await self.register("  Student@GMAIL.com  ")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertNotIn("password_hash", response.text)
        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            self.assertEqual(user.email, "student@gmail.com")
            self.assertEqual(user.full_name, "Nguyễn Văn A")
            self.assertEqual(user.role.value, "user")
            self.assertNotEqual(user.password_hash, "secret123")
            self.assertTrue(verify_password("secret123", user.password_hash))
            user.email = "Student@Gmail.com"
            await db.commit()
        login = await self.client.post(
            "/api/auth/login", json={"email": " STUDENT@gmail.com ", "password": "secret123"}
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual((await self.register()).status_code, 400)
        async with self.sessions() as db:
            db.add(User(email="STUDENT@gmail.com", password_hash="unused", role="user"))
            with self.assertRaises(IntegrityError):
                await db.commit()
            await db.rollback()

    async def test_password_limits_and_validation_response(self):
        for password in ("short", "x" * 73, "ế" * 25):
            result = await self.register(password=password)
            self.assertEqual(result.status_code, 422, result.text)
        self.assertEqual((await self.register(password="x" * 72)).status_code, 201)

    async def test_change_password(self):
        data = (await self.register()).json()
        response = await self.client.patch(
            "/api/auth/password",
            json={"current_password": "secret123", "new_password": "newsecret123"},
            headers={"Authorization": "Bearer " + data["access_token"]},
        )
        self.assertEqual(response.status_code, 200, response.text)
        login = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "newsecret123"}
        )
        self.assertEqual(login.status_code, 200)

    async def test_google_create_and_repeat_uses_subject(self):
        first = await self.google()
        self.assertEqual(first.status_code, 200, first.text)
        second = await self.google(email="renamed@gmail.com")
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["user"]["id"], second.json()["user"]["id"])
        async with self.sessions() as db:
            self.assertEqual(len((await db.execute(select(User))).scalars().all()), 1)
            self.assertEqual(len((await db.execute(select(GoogleIdentity))).scalars().all()), 1)

    async def test_google_links_authoritative_email(self):
        user_id = (await self.register()).json()["user"]["id"]
        google = await self.google()
        self.assertEqual(google.status_code, 200, google.text)
        self.assertEqual(google.json()["user"]["id"], user_id)

    async def test_google_rejects_untrusted_email_link(self):
        await self.register("person@example.com")
        response = await self.google(email="person@example.com")
        self.assertEqual(response.status_code, 401)

    async def test_google_rejects_deleted_identity(self):
        await self.google()
        from datetime import datetime, timezone

        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            user.deleted_at = datetime.now(timezone.utc)
            await db.commit()
        self.assertEqual((await self.google()).status_code, 401)

    async def test_logout_revokes_only_current_session(self):
        token = (await self.register()).json()["access_token"]
        redis = AsyncMock()
        redis.exists.return_value = False
        with patch("app.services.auth.get_redis", return_value=redis):
            response = await self.client.post(
                "/api/auth/logout", headers={"Authorization": "Bearer " + token}
            )
            self.assertEqual(response.status_code, 200)
            redis.setex.assert_awaited_once()
            redis.exists.return_value = True
            me = await self.client.get("/api/auth/me", headers={"Authorization": "Bearer " + token})
            self.assertEqual(me.status_code, 401)

    async def test_logout_without_redis_rejects_reused_token(self):
        token = (await self.register()).json()["access_token"]
        headers = {"Authorization": "Bearer " + token}
        self.assertEqual(
            (await self.client.post("/api/auth/logout", headers=headers)).status_code, 200
        )
        self.assertEqual((await self.client.get("/api/auth/me", headers=headers)).status_code, 401)
        login = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "secret123"}
        )
        self.assertEqual(login.status_code, 200)
        new_headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        self.assertEqual(
            (await self.client.get("/api/auth/me", headers=new_headers)).status_code, 200
        )

    async def test_services_reject_guests_invalid_expired_and_revoked_sessions(self):
        registered = (await self.register()).json()
        token = registered["access_token"]
        expired = create_access_token(
            {"sub": str(registered["user"]["id"])}, expires_delta=timedelta(seconds=-5)
        )
        urls = [
            "/api/boards",
            "/api/labs/1/template",
            "/api/health",
            "/api/curriculum/exercises",
            "/api/curriculum/exercises/Lab1-01_Blink_LED/source",
            "/api/artifacts/missing",
            "/api/artifacts/missing/files/firmware.bin",
        ]
        with patch("app.services.compiler_svc.compile_code", AsyncMock()) as worker:
            for headers in [
                {},
                {"Authorization": "Bearer invalid"},
                {"Authorization": "Bearer " + expired},
            ]:
                for url in urls:
                    self.assertEqual(
                        (await self.client.get(url, headers=headers)).status_code, 401, url
                    )
                self.assertEqual(
                    (
                        await self.client.post(
                            "/api/compile", json={"code": "void loop() {}"}, headers=headers
                        )
                    ).status_code,
                    401,
                )
            headers = {"Authorization": "Bearer " + token}
            self.assertEqual(
                (await self.client.get("/api/boards", headers=headers)).status_code, 200
            )
            self.assertEqual(
                (await self.client.get("/api/curriculum/exercises", headers=headers)).status_code,
                200,
            )
            await self.client.post("/api/auth/logout", headers=headers)
            for url in urls:
                self.assertEqual(
                    (await self.client.get(url, headers=headers)).status_code, 401, url
                )
            worker.assert_not_awaited()


class GoogleVerificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_config_missing(self):
        with patch.object(get_settings(), "google_client_id", ""):
            with self.assertRaises(Exception) as context:
                await verify_google_credential("bad")
        self.assertEqual(context.exception.status_code, 503)

    async def test_invalid_or_unverified_token(self):
        with patch.object(get_settings(), "google_client_id", "test-client"):
            for result in (
                ValueError("expired/wrong audience"),
                {
                    "sub": "123",
                    "email": "a@gmail.com",
                    "email_verified": False,
                    "iss": "accounts.google.com",
                },
            ):
                kwargs = (
                    {"side_effect": result}
                    if isinstance(result, Exception)
                    else {"return_value": result}
                )
                with patch("app.core.google_auth.id_token.verify_oauth2_token", **kwargs):
                    with self.assertRaises(Exception) as context:
                        await verify_google_credential("bad")
                    self.assertEqual(context.exception.status_code, 401)

    async def test_verifier_receives_server_audience(self):
        claims = {
            "sub": "123",
            "email": "a@gmail.com",
            "email_verified": True,
            "iss": "https://accounts.google.com",
        }
        with patch.object(get_settings(), "google_client_id", "server-client"):
            with patch(
                "app.core.google_auth.id_token.verify_oauth2_token", return_value=claims
            ) as verify:
                self.assertEqual(await verify_google_credential("signed"), claims)
                self.assertEqual(verify.call_args.args[2], "server-client")

    async def test_invalid_issuer_returns_401(self):
        from google.auth.exceptions import GoogleAuthError

        with patch.object(get_settings(), "google_client_id", "server-client"):
            for result in (GoogleAuthError("Wrong issuer"), {"iss": "https://untrusted.example"}):
                kwargs = (
                    {"side_effect": result}
                    if isinstance(result, Exception)
                    else {"return_value": result}
                )
                with patch("app.core.google_auth.id_token.verify_oauth2_token", **kwargs):
                    with self.assertRaises(Exception) as context:
                        await verify_google_credential("bad")
                    self.assertEqual(context.exception.status_code, 401)


class ConsoleTests(unittest.TestCase):
    def test_windows_console_supports_vietnamese(self):
        output = io.BytesIO()
        stream = io.TextIOWrapper(output, encoding="cp1252")
        with patch("sys.stdout", stream), patch("sys.stderr", stream):
            configure_console_encoding()
            stream.write("Kết nối → localhost")
            stream.flush()
        self.assertEqual(output.getvalue().decode("utf-8"), "Kết nối → localhost")


if __name__ == "__main__":
    unittest.main()
