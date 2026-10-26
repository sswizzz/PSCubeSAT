"""Pure progress/path computations. Percentages are presentation only."""

import math

BRANCHING = {0: [], 1: [0], 2: [0], 3: [1], 4: [1], 5: [1], 6: [2, 3, 4], 7: [5, 6], 8: [7]}


def path_template(kind, ids):
    ordered = sorted(ids)
    if kind == "sequential":
        return {value: ordered[i - 1 : i] if i else [] for i, value in enumerate(ordered)}
    if kind == "branching":
        return {value: list(BRANCHING.get(value, [])) for value in ordered}
    raise ValueError("Unknown learning path template")


def lesson_version(config, lesson_id):
    return f"{config['course_version_id']}/{lesson_id}"


def satisfies(status, allow_waivers=True):
    return status == "completed" or (allow_waivers and status == "waived")


def merge_segments(segments, start, end, duration):
    if not all(
        type(value) in (float, int) and math.isfinite(value) for value in (start, end, duration)
    ):
        raise ValueError("Đoạn xem phải là số hữu hạn.")
    if duration <= 0 or not 0 <= start < end <= duration or end - start > 60.001:
        raise ValueError("Đoạn xem ngoài thời lượng hoặc dài quá 60 giây.")
    merged = []
    for left, right in sorted([*segments, [float(start), float(end)]]):
        if merged and left <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], right)
        else:
            merged.append([left, right])
    return merged


def watched_seconds(segments):
    return sum(end - start for start, end in segments)


def video_complete(segments, duration, threshold=0.9):
    return duration > 0 and watched_seconds(segments) >= duration * threshold


def learning_path(config, states, unlocked=(), last_lesson=None, allow_waivers=True):
    labs = []
    done = {}
    for lab in config["labs"]:
        if not lab["enabled"]:
            continue
        required = [item for item in lab["lessons"] if item["enabled"] and item["required"]]
        count = sum(
            satisfies(states.get(item["id"], "not_started"), allow_waivers) for item in required
        )
        done[lab["id"]] = bool(required) and count == len(required)
        labs.append(
            {
                "id": lab["id"],
                "title": lab["title"],
                "required_count": len(required),
                "completed_count": count,
                "percent": round(100 * count / len(required), 2) if required else 0,
                "completed": done[lab["id"]],
                "prerequisites": lab["prerequisites"],
                "lessons": [
                    {
                        "id": item["id"],
                        "title": item["title"],
                        "type": item["type"],
                        "required": item["required"],
                        "status": states.get(item["id"], "not_started"),
                    }
                    for item in lab["lessons"]
                    if item["enabled"]
                ],
            }
        )
    previous_lesson = None
    for lab in labs:
        missing = [value for value in lab["prerequisites"] if not done.get(value, False)]
        available = not missing or lab["id"] in unlocked or lab["completed"]
        lab.update(
            access="available" if available else "locked",
            missing_prerequisites=missing,
            reason=""
            if available
            else "Cần hoàn thành " + ", ".join(f"Lab {value}" for value in missing),
        )
        for lesson in lab["lessons"]:
            completed = satisfies(lesson["status"], allow_waivers)
            lesson_missing = []
            if not available:
                lesson_missing.append(lab["reason"])
            elif previous_lesson and not satisfies(previous_lesson["status"], allow_waivers):
                lesson_missing.append("Bạn cần hoàn thành bài học trước để mở khóa bài này.")
            lesson.update(
                access="completed" if completed else "available" if not lesson_missing else "locked",
                reason="; ".join(lesson_missing),
            )
            if lesson["required"]:
                previous_lesson = lesson
    candidates = [
        item
        for lab in labs
        if lab["access"] == "available"
        for item in lab["lessons"]
        if item["access"] == "available"
        and not satisfies(item["status"], allow_waivers)
        and item["status"] != "pending_review"
    ]
    resume = next((item["id"] for item in candidates if item["id"] == last_lesson), None)
    if resume is None and candidates:
        resume = next((item["id"] for item in candidates if item["required"]), candidates[0]["id"])
    total_done = sum(lab["completed"] for lab in labs)
    return {
        "labs": labs,
        "completed_labs": total_done,
        "total_labs": len(labs),
        "percent": round(100 * total_done / len(labs), 2) if labs else 0,
        "continue_lesson_id": resume,
    }
