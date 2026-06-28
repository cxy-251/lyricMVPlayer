from __future__ import annotations

import json
import sys
from pathlib import Path

from audio_download import get_default_audio_download_config, refresh_youtube_cookies_file


def _build_hint(error: str | None) -> str | None:
    if not error:
        return None

    lowered = error.lower()
    if "operation not permitted" in lowered and "cookies.binarycookies" in lowered:
        return (
            "macOS blocked access to Safari cookies. Grant Full Disk Access to the terminal app "
            "running this command, then restart that terminal and run npm run refresh:cookies again."
        )

    return None


def refresh_youtube_cookies(project_root: str) -> dict:
    config = get_default_audio_download_config(project_root)
    cookies_path, error, browser = refresh_youtube_cookies_file(config)
    return {
        "ok": cookies_path is not None,
        "cookies_path": str(cookies_path) if cookies_path else str(config.cookies_file_path),
        "browser": browser,
        "hint": _build_hint(error),
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
