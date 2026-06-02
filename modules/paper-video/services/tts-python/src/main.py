from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


async def synthesize(text: str, voice: str, rate: str, pitch: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
    await communicate.save(str(output_path))


def build_segments(text: str) -> list[dict[str, object]]:
    sentences = [part.strip() for part in text.replace("！", "。").replace("？", "。").split("。") if part.strip()]
    if not sentences:
        sentences = [text.strip()]

    segments: list[dict[str, object]] = []
    current_ms = 0

    for index, sentence in enumerate(sentences):
        estimated_duration = max(900, len(sentence) * 220)
        segments.append(
            {
                "id": f"seg-{index + 1:02d}",
                "text": sentence,
                "startMs": current_ms,
                "endMs": current_ms + estimated_duration,
                "role": "narration",
            }
        )
        current_ms += estimated_duration

    return segments


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate narration audio with edge-tts")
    parser.add_argument("--text", required=True, help="Narration text")
    parser.add_argument("--voice", required=True, help="Edge TTS voice name")
    parser.add_argument("--rate", default="+0%", help="Speech rate")
    parser.add_argument("--pitch", default="+0Hz", help="Speech pitch")
    parser.add_argument("--output-audio", required=True, help="Audio output path")
    parser.add_argument("--output-meta", required=True, help="Metadata output path")
    parser.add_argument("--scene-id", required=True, help="Scene identifier")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    audio_path = Path(args.output_audio)
    meta_path = Path(args.output_meta)
    meta_path.parent.mkdir(parents=True, exist_ok=True)

    asyncio.run(synthesize(args.text, args.voice, args.rate, args.pitch, audio_path))

    segments = build_segments(args.text)
    duration_ms = int(segments[-1]["endMs"]) if segments else 0
    payload = {
        "id": f"audio-{args.scene_id}",
        "sceneId": args.scene_id,
        "filePath": str(audio_path),
        "durationMs": duration_ms,
        "segments": segments,
    }
    meta_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
