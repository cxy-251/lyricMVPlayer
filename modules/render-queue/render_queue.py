from __future__ import annotations

import csv
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


CSV_HEADERS = ["视频状态", "渲染批次", "资源文件夹", "来源URL"]
ALLOWED_STATUSES = {"未渲染", "已渲染", "已发布"}


@dataclass(frozen=True)
class RenderQueueRow:
    视频状态: str
    渲染批次: str
    来源URL: str
    资源文件夹: str


def get_render_queue_csv_path(project_root: str) -> Path:
    return Path(project_root) / "artifacts" / "common" / "render-queue.csv"


def ensure_render_queue_csv(project_root: str) -> Path:
    csv_path = get_render_queue_csv_path(project_root)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if not csv_path.exists():
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
            writer.writeheader()
    return csv_path


def _load_rows(csv_path: Path) -> list[dict[str, str]]:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if not csv_path.exists():
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
            writer.writeheader()
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [dict(row) for row in reader]


def _save_rows(csv_path: Path, rows: list[dict[str, str]]) -> None:
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def upsert_render_queue_row(project_root: str, row: RenderQueueRow) -> Path:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path)
    serialized = asdict(row)

    for existing in rows:
        if existing["资源文件夹"] == row.资源文件夹:
            existing["来源URL"] = row.来源URL
            if row.渲染批次 != "":
                existing["渲染批次"] = row.渲染批次
            if existing["视频状态"] not in ALLOWED_STATUSES:
                existing["视频状态"] = row.视频状态
            _save_rows(csv_path, rows)
            return csv_path

    rows.append(serialized)
    _save_rows(csv_path, rows)
    return csv_path


def list_runnable_rows(project_root: str, batch_value: str = "0") -> list[dict[str, str]]:
    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path)
    return [
        row
        for row in rows
        if row.get("视频状态") == "未渲染" and row.get("渲染批次", "") == batch_value
    ]


def mark_render_status(project_root: str, song_dir_name: str, status: str) -> Path:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Unsupported status: {status}")

    csv_path = ensure_render_queue_csv(project_root)
    rows = _load_rows(csv_path)
    for existing in rows:
        if existing["资源文件夹"] == song_dir_name:
            existing["视频状态"] = status
            _save_rows(csv_path, rows)
            return csv_path

    raise FileNotFoundError(f"Song not found in render queue: {song_dir_name}")


def _main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit(
            "Usage:\n"
            "  render_queue.py list-runnable <project_root> [batch]\n"
            "  render_queue.py mark <project_root> <song_dir_name> <status>\n"
        )

    command = argv[1]
    project_root = argv[2]

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

    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
