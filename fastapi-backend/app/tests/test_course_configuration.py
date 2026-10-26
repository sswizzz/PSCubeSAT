import unittest
from copy import deepcopy
from unittest.mock import AsyncMock, patch

from sqlalchemy import func, select

from app.models import quiz
from app.models.curriculum import (
    ClassCourseVersion,
    ClassLessonSetting,
    Course,
    CourseVersion,
    Lab,
    Lesson,
)
from app.models.learning import (
    CompletionOverride,
    LessonProgress,
    PracticeSubmission,
    Prerequisite,
    ProgressEvent,
)
from app.services.course_configuration import validate_configuration
from app.services.curriculum_seed import read_seed, seed_curriculum
from app.tests import test_classes as fixtures

QUIZ_TABLES = {
    value.__tablename__
    for value in vars(quiz).values()
    if isinstance(value, type)
    and value.__module__ == quiz.__name__
    and hasattr(value, "__tablename__")
}


def settings_payload(config):
    return {
        "course_version_id": config["course_version_id"],
        "expected_version": config["version"],
        "labs": [
            {"lab_id": lab["id"], "enabled": lab["enabled"], "prerequisites": lab["prerequisites"]}
            for lab in config["labs"]
        ],
        "lessons": [
            {
                "lesson_id": item["id"],
                **{key: item[key] for key in ("enabled", "required", "order_no", "params")},
            }
            for lab in config["labs"]
            for item in lab["lessons"]
        ],
    }


class CurriculumAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = fixtures.ClassAPITests()
        await self.fixture.asyncSetUp()
        self.client = self.fixture.client
        self.sessions = self.fixture.sessions
        self.class_a = self.fixture.class_a
        self.class_b = self.fixture.class_b
        async with self.fixture.engine.begin() as conn:
            await conn.run_sync(
                lambda sync: Course.metadata.create_all(
                    sync,
                    tables=[
                        Course.__table__,
                        CourseVersion.__table__,
                        Lab.__table__,
                        Lesson.__table__,
                        ClassCourseVersion.__table__,
                        ClassLessonSetting.__table__,
                        Prerequisite.__table__,
                        LessonProgress.__table__,
                        ProgressEvent.__table__,
                        CompletionOverride.__table__,
                        PracticeSubmission.__table__,
                        *[
                            table
                            for table in quiz.Base.metadata.sorted_tables
                            if table.name in QUIZ_TABLES
                        ],
                    ],
                )
            )
        async with self.sessions() as db:
            self.report = await seed_curriculum(db)
            await db.commit()
        await self.fixture.add_student()

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def call(self, user, method, path, body=None):
        return await self.fixture.call(user, method, path, body)

    async def draft(self):
        result = await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def save(self, body):
        return await self.call(2, "PUT", f"/api/classes/{self.class_a}/settings", body)

    async def publish(self, version, dry_run=False):
        return await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/publish?dry_run={str(dry_run).lower()}",
            {"expected_version": version},
        )

    async def published_config(self):
        body = settings_payload(await self.draft())
        body["labs"][0]["enabled"] = False  # Lab0 docs are explicitly TODO; no fabricated content.
        for lab in body["labs"]:
            lab[
                "prerequisites"
            ] = []  # These tests isolate publication; path rules are tested separately.
        result = await self.save(body)
        self.assertEqual(result.status_code, 200, result.text)
        version = result.json()["version"]
        result = await self.publish(version)
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def test_seed_idempotent_exact_ids_and_26_practices(self):
        async with self.sessions() as db:
            second = await seed_curriculum(db)
            await db.commit()
            self.assertEqual(second, self.report)
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(CourseVersion))).scalar_one(), 1
            )
            lessons = list((await db.execute(select(Lesson))).scalars())
            self.assertEqual(len(lessons), 93)
            original = {item["id"] for lab in read_seed()["legacy"] for item in lab["lessons"]}
            self.assertEqual(
                {item.id for item in lessons}, original | {f"labtest-{i}" for i in range(9)}
            )
            self.assertEqual(
                len([item for item in lessons if item.type == "practice" and item.lab_id >= 2]), 26
            )
            self.assertEqual(
                next(item for item in lessons if item.id == "summary-2").type, "document"
            )
            self.assertEqual(
                next(item for item in lessons if item.id == "components").type, "practice"
            )

    async def test_publish_collects_all_three_required_errors(self):
        config = await self.draft()
        body = settings_payload(config)
        body["labs"][2]["enabled"] = False
        body["labs"][3]["prerequisites"] = [2]
        for item in body["lessons"]:
            if item["lesson_id"] == "video-1-1":
                item.update(enabled=True, required=True)
            if item["lesson_id"].startswith("document-4-") or item["lesson_id"] == "summary-4":
                item["required"] = False
        saved = await self.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        result = await self.publish(saved.json()["version"], True)
        self.assertEqual(result.status_code, 422)
        self.assertEqual(result.json()["code"], "CONFIG_INVALID")
        codes = {item["code"] for item in result.json()["details"]["errors"]}
        self.assertTrue({"CONTENT_MISSING", "NO_REQUIRED_LESSON", "DISABLED_PREREQUISITE"} <= codes)

    async def test_disabled_filtered_and_draft_isolation_dry_run(self):
        await self.published_config()
        before = (await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum")).json()
        body = settings_payload(await self.draft())
        for item in body["lessons"]:
            if item["lesson_id"] in ("document-2-1", "Lab2-01a_Battery_GPIO"):
                item.update(enabled=False, required=False)
        saved = await self.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        version = saved.json()["version"]
        unchanged = (await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum")).json()
        self.assertEqual(before, unchanged)
        dry = await self.publish(version, True)
        self.assertEqual(dry.status_code, 200, dry.text)
        self.assertEqual(dry.json()["affected_students"], 1)
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum")).json(), before
        )
        self.assertEqual((await self.publish(version)).status_code, 200)
        after = (await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum")).json()
        ids = {item["id"] for lab in after["labs"] for item in lab["lessons"]}
        self.assertNotIn("document-2-1", ids)
        self.assertNotIn("Lab2-01a_Battery_GPIO", ids)
        source = f"/api/curriculum/exercises/Lab2-01a_Battery_GPIO/source?class_id={self.class_a}"
        self.assertEqual((await self.call(4, "GET", source)).status_code, 403)
        self.assertNotIn("labtest-2", ids)
        self.assertNotIn(0, {lab["id"] for lab in after["labs"]})

    async def test_no_membership_legacy_source_and_preview_boundaries(self):
        await self.published_config()
        preview = await self.call(3, "GET", "/api/curriculum/preview")
        ids = {item["id"] for lab in preview.json()["labs"] for item in lab["lessons"]}
        self.assertEqual(ids, {"components"})
        for path in [
            "/api/curriculum/legacy",
            "/api/curriculum/exercises/Lab2-01a_Battery_GPIO/source",
            "/api/labs/1/template",
        ]:
            # Pilot student: legacy path cannot bypass class locks. Non-pilot user keeps it.
            self.assertEqual((await self.call(4, "GET", path)).status_code, 403, path)
            self.assertEqual((await self.call(3, "GET", path)).status_code, 200, path)
        source = f"/api/curriculum/exercises/Lab2-01a_Battery_GPIO/source?class_id={self.class_a}"
        self.assertEqual((await self.call(4, "GET", source)).status_code, 403)
        self.assertEqual((await self.call(3, "GET", source)).status_code, 403)
        await self.call(2, "DELETE", f"/api/classes/{self.class_a}/members", {"user_id": 4})
        self.assertEqual((await self.call(4, "GET", source)).status_code, 403)
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum")).status_code, 403
        )
        self.assertEqual((await self.call(4, "GET", "/api/curriculum/preview")).status_code, 200)

    async def test_student_cannot_get_draft_edit_or_publish(self):
        body = settings_payload(await self.draft())
        for user in (3, 4):
            self.assertEqual(
                (
                    await self.call(
                        user, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true"
                    )
                ).status_code,
                403,
            )
            self.assertEqual(
                (
                    await self.call(user, "PUT", f"/api/classes/{self.class_a}/settings", body)
                ).status_code,
                403,
            )
            self.assertEqual(
                (
                    await self.call(
                        user,
                        "POST",
                        f"/api/classes/{self.class_a}/publish",
                        {"expected_version": 1},
                    )
                ).status_code,
                403,
            )

    async def test_stale_draft_and_untrusted_params_rejected(self):
        body = settings_payload(await self.draft())
        self.assertEqual((await self.save(body)).status_code, 200)
        self.assertEqual((await self.save(body)).status_code, 409)
        body = settings_payload(await self.draft())
        body["lessons"][0]["params"] = {"answers": ["secret"], "url": "javascript:alert(1)"}
        result = await self.save(body)
        self.assertEqual(result.status_code, 422)

    async def test_compile_requires_enabled_membership_and_never_completes(self):
        await self.published_config()
        with (
            patch(
                "app.services.compiler_svc.compile_code", AsyncMock(return_value={"success": True})
            ),
            patch("app.routers.compiler.ProgressService") as progress,
        ):
            payload = {"code": "void loop() {}", "lab_id": 2}
            self.assertEqual((await self.call(4, "POST", "/api/compile", payload)).status_code, 403)
            payload.update(class_id=self.class_a, lesson_id="Lab2-01a_Battery_GPIO")
            result = await self.call(4, "POST", "/api/compile", payload)
            self.assertEqual(result.status_code, 403, result.text)
            progress.assert_not_called()
            lower_case_auth = await self.client.post(
                "/api/compile",
                json=payload,
                headers={"Authorization": "bearer " + self.fixture.tokens[4]},
            )
            self.assertEqual(lower_case_auth.status_code, 403, lower_case_auth.text)
            self.assertEqual((await self.call(3, "POST", "/api/compile", payload)).status_code, 403)


class ConfigurationRulesTests(unittest.TestCase):
    def test_cycles_and_empty_labs_are_invalid(self):
        config = {
            "labs": [
                {"id": 1, "enabled": True, "prerequisites": [2], "lessons": []},
                {"id": 2, "enabled": True, "prerequisites": [1], "lessons": []},
            ]
        }
        codes = {item["code"] for item in validate_configuration(deepcopy(config))}
        self.assertIn("PREREQUISITE_CYCLE", codes)
        self.assertIn("NO_REQUIRED_LESSON", codes)
