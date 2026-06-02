from __future__ import annotations

import csv
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


CSV_HEADERS = ["video_status", "render_batch", "background_ready", "song_dir", "source_url"]
ALLOWED_STATUSES = {"pending", "rendered", "published"}
TRUE_VALUES = {"true", "1", "yes", "y"}
RENDER_BATCH_CODES = {
    "0": "ready",
    "1": "manual-lyrics-alignment-error",
    "2": "timed-lyrics-missing",
    "3": "lyrics-source-mismatch",
    "22": "published",
}
MANUAL_RENDER_BATCH_CODES = {"1", "22"}
LEGACY_STATUS_MAP = {
    "未渲染": "pending",
    "已渲染": "rendered",
    "已发布": "published",
}


@dataclass(frozen=True)
class RenderQueueRow:
    video_status: str
    render_batch: str
    background_ready: str
    song_dir: str
    source_url: str


def get_production_queue_csv_path(project_root: str) -> Path:
    return Path(project_root) / "artifacts" / "common" / "production-queue.csv"


def get_legacy_render_queue_csv_path(project_root: str) -> Path:
    return Path(project_root) / "artifacts" / "common" / "render-queue.csv"


def _has_background_asset(project_root: str, song_dir_name: str) -> bool:
    song_dir = Path(project_root) / "artifacts" / "songs" / song_dir_name
    for file_name in ("background.png", "background.jpg", "background.jpeg", "background.webp"):
        if (song_dir / file_name).exists():
            return True
    return False


def _resolve_source_url(project_root: str, song_dir_name: str, source_url: str | None) -> str:
    normalized = (source_url or "").strip()
    if normalized:
        return normalized
    if not song_dir_name:
        return ""
    source_json_path = Path(project_root) / "artifacts" / "songs" / song_dir_name / "source.json"
    if not source_json_path.exists():
        return ""
    try:
        payload = json.loads(source_json_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    for key in ("webpage_url", "original_url"):
        value = str(payload.get(key) or "").strip()
        if value.startswith(("http://", "https://")):
            return value
    return ""


def _normalize_background_flag(value: str | None, project_root: str, song_dir_name: str) -> str:
    if value is None or str(value).strip() == "":
        return "true" if _has_background_asset(project_root, song_dir_name) else "false"
    return "true" if str(value).strip().lower() in TRUE_VALUES else "false"


def _normalize_row(raw_row: dict[str, str], project_root: str) -> dict[str, str]:
    song_dir_name = (raw_row.get("song_dir") or raw_row.get("资源文件夹") or "").strip()
    status = (raw_row.get("video_status") or raw_row.get("视频状态") or "").strip()
    batch = (raw_row.get("render_batch") or raw_row.get("渲染批次") or "").strip()
    source_url = (raw_row.get("source_url") or raw_row.get("来源URL") or "").strip()

    if song_dir_name.lower() in TRUE_VALUES and source_url and not source_url.startswith(("http://", "https://")):
        song_dir_name, source_url = source_url, ""

    source_url = _resolve_source_url(project_root, song_dir_name, source_url)

    has_background = _normalize_background_flag(
        raw_row.get("background_ready") or raw_row.get("是否生产了背景图"),
        project_root,
        song_dir_name,
    )

    status = LEGACY_STATUS_MAP.get(status, status)
    if status not in ALLOWED_STATUSES:
        status = "pending"

    return {
        "video_status": status,
        "render_batch": batch,
        "background_ready": has_background,
        "song_dir": song_dir_name,
        "source_url": source_url,
    }


def _save_rows(csv_path: Path, rows: list[dict[str, str]]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _should_update_render_batch(existing_batch: str, incoming_batch: str) -> bool:
    if incoming_batch == "":
        return False
    if existing_batch in MANUAL_RENDER_BATCH_CODES:
        return False
    if incoming_batch == "0" and existing_batch not in {"", "0"}:
        return False
    return True


def _load_rows(csv_path: Path, project_root: str) -> list[dict[str, str]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [_normalize_row(dict(row), project_root) for row in reader]


def ensure_render_queue_csv(project_root: str) -> Path:
    csv_path = get_production_queue_csv_path(project_root)
    legacy_csv_path = get_legacy_render_queue_csv_path(project_root)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    if csv_path.exists():
        rows = _load_rows(csv_path, project_root)
        _save_rows(csv_path, rows)
        return csv_path

    if legacy_csv_path.exists():
        rows = _load_rows(legacy_csv_path, project_root)
        _save_rows(csv_path, rows)
        try:
            legacy_csv_path.unlink()
        except FileNotFoundError:
            pass
        return csv_path

    _save_rows(csv_path, [])
    return csv_path


def upsert_render_queue_row(project_root: str, row: RenderQueueRow) -> Path:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    serialized = _normalize_row(asdict(row), project_root)

    for existing in rows:
        if existing["song_dir"] == row.song_dir:
            existing["source_url"] = serialized["source_url"]
            if _should_update_render_batch(existing.get("render_batch", ""), serialized["render_batch"]):
                existing["render_batch"] = serialized["render_batch"]
            if existing["video_status"] not in ALLOWED_STATUSES:
                existing["video_status"] = serialized["video_status"]
            existing["background_ready"] = serialized["background_ready"]
            _save_rows(csv_path, rows)
            return csv_path

    rows.append(serialized)
    _save_rows(csv_path, rows)
    return csv_path


def list_background_pending_rows(
    project_root: str,
    batch_value: str = "0",
    include_finished: bool = False,
    include_ready: bool = False,
) -> list[dict[str, str]]:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    return [
        row
        for row in rows
        if (include_ready or row.get("background_ready") == "false")
        and row.get("render_batch", "") == batch_value
        and (include_finished or row.get("video_status") not in {"rendered", "published"})
    ]


def list_rows_for_visual_plan_regeneration(
    project_root: str,
    batch_value: str = "0",
    include_finished: bool = False,
) -> list[dict[str, str]]:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    return [
        row
        for row in rows
        if row.get("song_dir", "").strip()
        and row.get("render_batch", "") == batch_value
        and (include_finished or row.get("video_status") not in {"rendered", "published"})
    ]


def get_queue_row(project_root: str, song_dir_name: str) -> dict[str, str] | None:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    for row in rows:
        if row.get("song_dir") == song_dir_name:
            return row
    return None


def is_background_generation_allowed(
    project_root: str,
    song_dir_name: str,
    batch_value: str = "0",
    include_finished: bool = False,
) -> bool:
    row = get_queue_row(project_root, song_dir_name)
    return (
        row is not None
        and row.get("render_batch", "") == batch_value
        and (include_finished or row.get("video_status") not in {"rendered", "published"})
    )


def list_runnable_rows(project_root: str, batch_value: str = "0") -> list[dict[str, str]]:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    return [
        row
        for row in rows
        if row.get("video_status") == "pending"
        and row.get("render_batch", "") == batch_value
        and row.get("background_ready") == "true"
    ]


def mark_render_status(project_root: str, song_dir_name: str, status: str) -> Path:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Unsupported status: {status}")

    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    for existing in rows:
        if existing["song_dir"] == song_dir_name:
            existing["video_status"] = status
            _save_rows(csv_path, rows)
            return csv_path

    raise FileNotFoundError(f"Song not found in production queue: {song_dir_name}")


def mark_background_generated(project_root: str, song_dir_name: str, generated: bool = True) -> Path:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path, project_root)
    for existing in rows:
        if existing["song_dir"] == song_dir_name:
            existing["background_ready"] = "true" if generated else "false"
            _save_rows(csv_path, rows)
            return csv_path

    raise FileNotFoundError(f"Song not found in production queue: {song_dir_name}")


def _main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit(
            "Usage:\n"
            "  render_queue.py list-render-batch-codes <project_root>\n"
            "  render_queue.py list-background-pending <project_root> [batch] [--include-finished] [--include-ready]\n"
            "  render_queue.py list-visual-plan-targets <project_root> [batch] [--include-finished]\n"
            "  render_queue.py list-runnable <project_root> [batch]\n"
            "  render_queue.py mark <project_root> <song_dir_name> <status>\n"
            "  render_queue.py mark-background <project_root> <song_dir_name> <true|false>\n"
        )

    command = argv[1]
    project_root = argv[2]

    if command == "list-render-batch-codes":
        print(json.dumps(RENDER_BATCH_CODES, ensure_ascii=False, indent=2))
        return 0

    if command == "list-background-pending":
        batch_value = argv[3] if len(argv) > 3 and not argv[3].startswith("--") else "0"
        include_finished = "--include-finished" in argv[3:]
        include_ready = "--include-ready" in argv[3:]
        print(
            json.dumps(
                list_background_pending_rows(
                    project_root,
                    batch_value=batch_value,
                    include_finished=include_finished,
                    include_ready=include_ready,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if command == "list-visual-plan-targets":
        batch_value = argv[3] if len(argv) > 3 and not argv[3].startswith("--") else "0"
        include_finished = "--include-finished" in argv[3:]
        print(
            json.dumps(
                list_rows_for_visual_plan_regeneration(
                    project_root,
                    batch_value=batch_value,
                    include_finished=include_finished,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if command == "list-runnable":
        batch_value = argv[3] if len(argv) > 3 else "0"
        print(json.dumps(list_runnable_rows(project_root, batch_value=batch_value), ensure_ascii=False, indent=2))
        return 0

    if command == "mark":
        if len(argv) < 5:
            raise SystemExit("Usage: render_queue.py mark <project_root> <song_dir_name> <status>")
        csv_path = mark_render_status(project_root, argv[3], argv[4])
        print(str(csv_path))
        return 0

    if command == "mark-background":
        if len(argv) < 5:
            raise SystemExit("Usage: render_queue.py mark-background <project_root> <song_dir_name> <true|false>")
        generated = str(argv[4]).strip().lower() in TRUE_VALUES
        csv_path = mark_background_generated(project_root, argv[3], generated)
        print(str(csv_path))
        return 0

    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
