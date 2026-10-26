import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from sqlalchemy import func, select

from app.models.learning import ProgressEvent
from app.models.tables import UserRole
from app.services.learning_rules import (
    BRANCHING,
    learning_path,
    merge_segments,
    path_template,
    video_complete,
    watched_seconds,
)
from app.services.progress import ProgressService
from app.tests import test_course_configuration as fixtures


def small_config():
    return {
        "course_version_id": "v1",
        "labs": [
            {
                "id": i,
                "title": f"Lab {i}",
                "enabled": True,
                "prerequisites": deps,
                "lessons": [
                    {
                        "id": f"doc-{i}",
                        "title": "Document",
                        "type": "document",
                        "enabled": True,
                        "required": True,
                    }
                ],
            }
            for i, deps in BRANCHING.items()
        ],
    }


class LearningRulesTests(unittest.TestCase):
    def test_branching_and_AND_gates(self):
        config = small_config()
        self.assertEqual(learning_path(config, {})["labs"][1]["access"], "locked")
        path = learning_path(config, {"doc-0": "completed"})
        self.assertEqual([path["labs"][i]["access"] for i in (1, 2)], ["available", "available"])
        for states in ({2}, {2, 3}, {3, 4}):
            result = learning_path(config, {f"doc-{i}": "completed" for i in states})
            self.assertEqual(result["labs"][6]["access"], "locked")
        self.assertEqual(
            learning_path(config, {f"doc-{i}": "completed" for i in (2, 3, 4)})["labs"][6][
                "access"
            ],
            "available",
        )
        self.assertEqual(path_template("sequential", [0, 1, 2]), {0: [], 1: [0], 2: [1]})

    def test_required_enabled_pending_waivers_and_rounding(self):
        config = small_config()
        config["labs"][0]["lessons"] += [
            {
                "id": "optional",
                "title": "Optional",
                "type": "practice",
                "enabled": True,
                "required": False,
            },
            {
                "id": "disabled",
                "title": "Disabled",
                "type": "practice",
                "enabled": False,
                "required": True,
            },
        ]
        self.assertEqual(
            learning_path(config, {"doc-0": "pending_review"})["labs"][0]["percent"], 0
        )
        self.assertEqual(learning_path(config, {"doc-0": "waived"})["labs"][0]["percent"], 100)
        self.assertEqual(
            learning_path(config, {"doc-0": "waived"}, allow_waivers=False)["labs"][0]["percent"], 0
        )
        self.assertEqual(
            learning_path(config, {"doc-0": "completed"})["continue_lesson_id"], "doc-1"
        )
        self.assertEqual(
            learning_path(config, {"doc-0": "completed"}, last_lesson="optional")[
                "continue_lesson_id"
            ],
            "optional",
        )
        huge = deepcopy(config)
        huge["labs"][0]["lessons"] = [
            {"id": str(i), "title": "Part", "type": "document", "enabled": True, "required": True}
            for i in range(20001)
        ]
        path = learning_path(huge, {str(i): "completed" for i in range(20000)})
        self.assertEqual(path["labs"][0]["percent"], 100)  # Display rounding must not unlock.
        self.assertFalse(path["labs"][0]["completed"])
        self.assertEqual(path["labs"][1]["access"], "locked")

    def test_segments_union_threshold_and_invalid_ranges(self):
        segments = merge_segments([], 0, 40, 100)
        segments = merge_segments(segments, 20, 60, 100)
        segments = merge_segments(segments, 50, 89, 100)
        self.assertEqual(watched_seconds(segments), 89)
        self.assertFalse(video_complete(segments, 100))
        segments = merge_segments(segments, 80, 90, 100)
        self.assertTrue(video_complete(segments, 100))
        self.assertEqual(merge_segments(segments, 80, 90, 100), segments)
        for start, end in ((-1, 2), (0, 101), (2, 2), (0, 61), (float("nan"), 2)):
            with self.assertRaises(ValueError):
                merge_segments([], start, end, 100)

    def test_unlock_not_completion_and_disabled_recalculates(self):
        config = small_config()
        path = learning_path(config, {}, unlocked={6})
        self.assertEqual(path["labs"][6]["access"], "available")
        self.assertFalse(path["labs"][6]["completed"])
        config["labs"][0]["lessons"].append(
            {"id": "extra", "title": "Extra", "type": "document", "required": True, "enabled": True}
        )
        self.assertEqual(learning_path(config, {"doc-0": "completed"})["labs"][0]["percent"], 50)
        config["labs"][0]["lessons"][1]["enabled"] = False
        self.assertEqual(learning_path(config, {"doc-0": "completed"})["labs"][0]["percent"], 100)
        self.assertEqual(
            learning_path(config, {"doc-0": "in_progress"}, last_lesson="doc-0")[
                "continue_lesson_id"
            ],
            "doc-0",
        )

    def test_lessons_unlock_in_one_course_sequence(self):
        config = small_config()
        initial = learning_path(config, {})
        self.assertEqual(initial["labs"][0]["lessons"][0]["access"], "available")
        self.assertEqual(initial["labs"][1]["access"], "locked")
        self.assertEqual(initial["labs"][1]["lessons"][0]["access"], "locked")

        after_first = learning_path(config, {"doc-0": "completed"})
        self.assertEqual(after_first["labs"][1]["access"], "available")
        self.assertEqual(after_first["labs"][1]["lessons"][0]["access"], "available")
        self.assertEqual(after_first["labs"][2]["lessons"][0]["access"], "locked")


class LegacyProgressTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = SimpleNamespace(
            commit=AsyncMock(),
            refresh=AsyncMock(),
        )
        self.progress = SimpleNamespace(
            lab_id=0,
            video_watched=False,
            doc_viewed=False,
            compiled_at=None,
            completed_at=None,
            lesson_progress={},
        )
        self.user = SimpleNamespace(id=7, role=UserRole.user)
        self.service = ProgressService(self.db)
        self.service.repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=self.progress),
            list_by_user=AsyncMock(),
        )
        self.seed = {
            "legacy": [
                {
                    "id": 0,
                    "lessons": [
                        {"id": "first"},
                        {"id": "second"},
                    ],
                }
            ]
        }

    async def test_start_lesson_persists_started_at(self):
        with patch("app.services.progress.read_seed", return_value=self.seed):
            result = await self.service.start_lesson(self.user, 0, "first")

        self.assertIn("first", result.lessons)
        self.assertFalse(result.lessons["first"]["completed"])
        self.assertIsNotNone(result.lessons["first"]["started_at"])
        self.db.commit.assert_awaited_once()

    async def test_completion_before_one_minute_is_rejected(self):
        self.progress.lesson_progress = {
            "first": {
                "started_at": (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat(),
                "completed": False,
            }
        }

        with patch("app.services.progress.read_seed", return_value=self.seed):
            with self.assertRaises(Exception) as context:
                await self.service.complete_lesson(self.user, 0, "first")

        self.assertEqual(context.exception.code, "MINIMUM_LEARNING_TIME")
        self.assertFalse(self.progress.lesson_progress["first"]["completed"])
        self.db.commit.assert_not_awaited()

    async def test_previous_lesson_is_required(self):
        self.progress.lesson_progress = {
            "first": {
                "started_at": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(),
                "completed": False,
            },
            "second": {
                "started_at": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(),
                "completed": False,
            },
        }

        with patch("app.services.progress.read_seed", return_value=self.seed):
            with self.assertRaises(Exception) as context:
                await self.service.complete_lesson(self.user, 0, "second")

        self.assertEqual(context.exception.code, "PREREQUISITE_NOT_MET")
        self.db.commit.assert_not_awaited()

    async def test_final_lesson_marks_lab_complete(self):
        old = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
        self.progress.lesson_progress = {
            "first": {"started_at": old, "completed": True},
            "second": {"started_at": old, "completed": False},
        }

        with patch("app.services.progress.read_seed", return_value=self.seed):
            result = await self.service.complete_lesson(self.user, 0, "second")

        self.assertTrue(result.lessons["second"]["completed"])
        self.assertIsNotNone(result.completed_at)
        self.db.commit.assert_awaited_once()

    async def test_teacher_can_complete_without_waiting(self):
        self.user.role = UserRole.teacher
        self.progress.lesson_progress = {
            "first": {
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed": False,
            }
        }

        with patch("app.services.progress.read_seed", return_value=self.seed):
            result = await self.service.complete_lesson(self.user, 0, "first")

        self.assertTrue(result.lessons["first"]["completed"])
        self.db.commit.assert_awaited_once()


class LearningAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = fixtures.CurriculumAPITests()
        await self.fixture.asyncSetUp()
        self.class_a = self.fixture.class_a
        self.sessions = self.fixture.sessions
        self.base = f"/api/classes/{self.class_a}"
        self.body = fixtures.settings_payload(await self.fixture.draft())
        for item in self.body["lessons"]:
            item["required"] = item["lesson_id"] == "document" or item["lesson_id"].startswith(
                "summary-"
            )
            if item["lesson_id"] == "document":
                item["params"] = {"markdown": "Hướng dẫn định hướng trong dữ liệu kiểm thử."}
        await self.apply(self.body)

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def call(self, user, method, path, body=None):
        return await self.fixture.call(user, method, path, body)

    async def apply(self, body):
        result = await self.fixture.save(body)
        self.assertEqual(result.status_code, 200, result.text)
        self.body = fixtures.settings_payload(result.json())
        result = await self.fixture.publish(self.body["expected_version"])
        self.assertEqual(result.status_code, 200, result.text)

    async def event(self, lesson, kind="document_read", **values):
        return await self.call(
            4,
            "POST",
            f"{self.base}/lessons/{lesson}/events",
            {"idempotency_key": str(uuid4()), "kind": kind, **values},
        )

    async def complete(self, lab):
        result = await self.event("document" if lab == 0 else f"summary-{lab}")
        self.assertEqual(result.status_code, 200, result.text)

    async def path(self):
        result = await self.call(4, "GET", self.base + "/learning-path")
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def test_default_path_and_content_source_compile_gates(self):
        initial_path = await self.path()
        self.assertEqual(initial_path["labs"][0]["lessons"][0]["access"], "available")
        self.assertEqual(initial_path["labs"][1]["access"], "locked")
        content = (await self.call(4, "GET", self.base + "/curriculum")).json()
        self.assertNotIn("content", content["labs"][1]["lessons"][0])
        locked_event = await self.event("summary-1")
        self.assertEqual(locked_event.status_code, 403)
        self.assertEqual(
            locked_event.json()["message"],
            "Bạn cần hoàn thành bài học trước để mở khóa bài này.",
        )
        source = f"/api/curriculum/exercises/Lab2-01a_Battery_GPIO/source?class_id={self.class_a}"
        self.assertEqual((await self.call(4, "GET", source)).status_code, 403)
        with patch(
            "app.services.compiler_svc.compile_code", AsyncMock(return_value={"success": True})
        ) as build:
            payload = {
                "code": "void setup() {} void loop() {}",
                "lab_id": 2,
                "class_id": self.class_a,
                "lesson_id": "Lab2-01a_Battery_GPIO",
            }
            self.assertEqual((await self.call(4, "POST", "/api/compile", payload)).status_code, 403)
            build.assert_not_called()
            await self.complete(0)
            path = await self.path()
            self.assertEqual(
                [path["labs"][i]["access"] for i in (1, 2)], ["available", "available"]
            )
            self.assertEqual((await self.call(4, "POST", "/api/compile", payload)).status_code, 403)
            await self.complete(1)
            self.assertEqual((await self.call(4, "POST", "/api/compile", payload)).status_code, 200)
            self.assertFalse((await self.path())["labs"][2]["completed"])
        await self.complete(2)
        await self.complete(3)
        self.assertEqual((await self.path())["labs"][6]["access"], "locked")
        await self.complete(4)
        self.assertEqual((await self.path())["labs"][6]["access"], "available")

    async def test_document_open_event_idempotency_and_legacy_block(self):
        opened = await self.event("document", "opened")
        self.assertEqual(opened.json()["status"], "in_progress")
        payload = {"idempotency_key": "read-document-unique", "kind": "document_read"}
        first = await self.call(4, "POST", self.base + "/lessons/document/events", payload)
        second = await self.call(4, "POST", self.base + "/lessons/document/events", payload)
        self.assertEqual(first.json(), second.json())
        async with self.sessions() as db:
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(ProgressEvent))).scalar_one(), 2
            )
        payload["kind"] = "opened"
        self.assertEqual(
            (
                await self.call(4, "POST", self.base + "/lessons/document/events", payload)
            ).status_code,
            409,
        )
        for path in (
            "/api/progress",
            "/api/progress/0/doc-viewed",
            "/api/progress/0/video-watched",
        ):
            self.assertEqual(
                (
                    await self.call(4, "GET" if path == "/api/progress" else "POST", path)
                ).status_code,
                403,
            )
        self.assertEqual(
            (
                await self.call(
                    4,
                    "POST",
                    self.base + "/lessons/document/events",
                    {
                        "idempotency_key": "forged-completion",
                        "kind": "opened",
                        "status": "completed",
                    },
                )
            ).status_code,
            422,
        )

    async def test_video_open_union_and_manual_policy(self):
        body = deepcopy(self.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "overview":
                item.update(
                    enabled=True,
                    required=True,
                    params={
                        "url": "https://example.com/lesson.mp4",
                        "duration_seconds": 100,
                        "watch_ratio": 0.9,
                    },
                )
        await self.apply(body)
        self.assertEqual((await self.event("overview", "opened")).json()["status"], "in_progress")
        self.assertEqual((await self.event("overview", "video_confirmed")).status_code, 403)
        await self.event("overview", "video_segment", start=0, end=50, position=50)
        result = await self.event("overview", "video_segment", start=20, end=60, position=60)
        self.assertEqual(result.json()["watched_seconds"], 60)
        self.assertEqual(result.json()["last_position"], 60)
        self.assertEqual(result.json()["status"], "in_progress")
        result = await self.event("overview", "video_segment", start=60, end=90, position=90)
        self.assertEqual(result.json()["status"], "completed")
        self.assertEqual(
            (
                await self.event("overview", "video_segment", start=90, end=101, position=101)
            ).status_code,
            422,
        )
        # Confirmation is only possible after a teacher explicitly publishes that policy.
        body = deepcopy(self.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "overview":
                item["params"] = {
                    "url": "https://example.com/embed/1",
                    "tracking_mode": "confirmation",
                    "confirmation_allowed": True,
                }
        await self.apply(body)
        self.assertEqual((await self.event("overview", "video_confirmed")).status_code, 200)

    async def test_pending_review_does_not_unlock_and_teacher_approves(self):
        body = deepcopy(self.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "summary-1":
                item["required"] = False
            if item["lesson_id"] == "Lab1-01_Blink_LED":
                item.update(
                    required=True,
                    params={
                        "instructions": "Bài thực hành kiểm thử.",
                        "rubric": "Chương trình đáp ứng yêu cầu đã nêu.",
                    },
                )
        await self.apply(body)
        await self.complete(0)
        payload = {
            "idempotency_key": "submission-first-key",
            "code": "void setup() {} void loop() {}",
        }
        result = await self.call(
            4, "POST", self.base + "/lessons/Lab1-01_Blink_LED/submissions", payload
        )
        self.assertEqual(result.status_code, 201, result.text)
        submission = result.json()
        repeat = await self.call(
            4, "POST", self.base + "/lessons/Lab1-01_Blink_LED/submissions", payload
        )
        self.assertEqual(repeat.json()["id"], submission["id"])
        self.assertEqual((await self.path())["labs"][3]["access"], "locked")
        review_url = self.base + f"/submissions/{submission['id']}/review"
        self.assertEqual(
            (
                await self.call(4, "POST", review_url, {"verdict": "approved", "feedback": "Đạt"})
            ).status_code,
            403,
        )
        self.assertEqual(
            (
                await self.call(3, "POST", review_url, {"verdict": "approved", "feedback": "Đạt"})
            ).status_code,
            403,
        )
        reviewed = await self.call(
            2, "POST", review_url, {"verdict": "approved", "feedback": "Đạt rubric đã giao."}
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual((await self.path())["labs"][3]["access"], "available")
        dashboard = (await self.call(2, "GET", self.base + "/progress")).json()
        self.assertEqual(dashboard["pending_submissions"], [])

    async def test_two_classes_overrides_and_disabled_denominator(self):
        created = await self.call(
            2, "POST", "/api/classes", {"code": "SECOND", "name": "Second", "status": "active"}
        )
        class_id = created.json()["id"]
        await self.call(
            2, "POST", f"/api/classes/{class_id}/members", {"email": "user4@example.com"}
        )
        body = deepcopy(self.body)
        body["expected_version"] = 0
        saved = await self.call(2, "PUT", f"/api/classes/{class_id}/settings", body)
        self.assertEqual(saved.status_code, 200, saved.text)
        await self.call(
            2,
            "POST",
            f"/api/classes/{class_id}/publish",
            {"expected_version": saved.json()["version"]},
        )
        await self.complete(0)
        second = (await self.call(4, "GET", f"/api/classes/{class_id}/learning-path")).json()
        self.assertEqual(second["labs"][1]["access"], "locked")
        own = (await self.call(4, "GET", self.base + "/progress")).json()
        result = await self.call(
            2,
            "POST",
            self.base + "/completion-overrides",
            {
                "idempotency_key": "override-unlock-lab6",
                "membership_id": own["membership_id"],
                "action": "unlock",
                "lab_id": 6,
                "reason": "Đã kiểm tra kiến thức nền.",
            },
        )
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual((await self.path())["labs"][6]["access"], "available")
        self.assertFalse((await self.path())["labs"][6]["completed"])
        result = await self.call(
            2,
            "POST",
            self.base + "/completion-overrides",
            {
                "idempotency_key": "override-waive-lab1",
                "membership_id": own["membership_id"],
                "action": "waive",
                "lesson_id": "summary-1",
                "reason": "Công nhận kết quả tương đương.",
            },
        )
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual((await self.path())["labs"][1]["percent"], 100)
        body = deepcopy(self.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "document-2-1":
                item["required"] = True
        await self.apply(body)
        self.assertEqual((await self.path())["labs"][6]["access"], "locked")
        self.assertEqual(
            (await self.path())["labs"][1]["percent"], 100
        )  # Waiver survives configuration revisions.
        await self.event("document-2-1")
        await self.complete(2)
        self.assertEqual((await self.path())["labs"][2]["percent"], 100)
        body = deepcopy(self.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "document-2-1":
                item.update(enabled=False, required=False)
        await self.apply(body)
        self.assertEqual((await self.path())["labs"][2]["percent"], 100)

    async def test_revoked_member_and_archived_class_cannot_write(self):
        for user in (1, 2):
            response = await self.call(
                user,
                "POST",
                self.base + "/lessons/document/events",
                {"idempotency_key": f"staff-open-event-{user}", "kind": "opened"},
            )
            self.assertEqual(response.status_code, 403, response.text)
        removed = await self.call(2, "DELETE", self.base + "/members", {"user_id": 4})
        self.assertEqual(removed.status_code, 204, removed.text)
        for method, path, payload in [
            ("GET", "/learning-path", None),
            ("GET", "/progress", None),
            (
                "POST",
                "/lessons/document/events",
                {"idempotency_key": "revoked-open-event", "kind": "opened"},
            ),
            ("GET", "/lessons/document/submissions", None),
            (
                "POST",
                "/lessons/document/submissions",
                {"idempotency_key": "revoked-submit-key", "code": "void setup() {}"},
            ),
        ]:
            response = await self.call(4, method, self.base + path, payload)
            self.assertEqual(response.status_code, 403, response.text)
            self.assertEqual(response.json()["code"], "MEMBERSHIP_REQUIRED")
        await self.call(2, "POST", self.base + "/members", {"email": "user4@example.com"})
        archived = await self.call(2, "DELETE", self.base)
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertEqual((await self.call(4, "GET", self.base + "/progress")).status_code, 200)
        self.assertEqual((await self.event("document")).status_code, 409)
