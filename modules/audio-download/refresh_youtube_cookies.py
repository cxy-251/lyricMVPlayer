from __future__ import annotations

import json
import sys
from pathlib import Path

from audio_download import ensure_youtube_cookies, get_default_audio_download_config


def refresh_youtube_cookies(project_root: str) -> dict:
    config = get_default_audio_download_config(project_root)
    cookies_path, error = ensure_youtube_cookies(config)
    return {
        "ok": cookies_path is not None,
        "cookies_path": str(cookies_path) if cookies_path else str(config.cookies_file_path),
        "error": error,
    }


def _main(argv: list[str]) -> int:
    if len(argv) < 2:
        raise SystemExit("Usage: refresh_youtube_cookies.py <project_root>")

    project_root = argv[1]
    result = refresh_youtube_cookies(project_root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    module_dir = Path(__file__).resolve().parent
    if str(module_dir) not in sys.path:
        sys.path.insert(0, str(module_dir))
    raise SystemExit(_main(sys.argv))
