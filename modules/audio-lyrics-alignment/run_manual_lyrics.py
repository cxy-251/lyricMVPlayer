from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {file_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit(
            "Usage: run_manual_lyrics.py <project_root> <song_dir_name> [manual_file_name]\n"
        )

    project_root = Path(argv[1])
    song_dir_name = argv[2]
    manual_file_name = argv[3] if len(argv) > 3 else "lyrics.manual.txt"
    song_dir = project_root / "artifacts" / "songs" / song_dir_name
    module = _load_module(
        "audio_lyrics_alignment_manual_runtime",
        project_root / "modules" / "audio-lyrics-alignment" / "audio_lyrics_alignment.py",
    )
    result, error = module.apply_manual_lyrics(str(song_dir), str(project_root), manual_file_name)
    payload = {"ok": error is None, "result": result, "error": error}
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=lambda item: item.__dict__))
    return 0 if error is None else 1


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
