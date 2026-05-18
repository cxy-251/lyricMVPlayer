from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class BackgroundPromptContext:
    song_title: str
    artist: str
    song_base_name: str
    song_dir: str
    lyric_lines: list[str]


@dataclass(frozen=True)
class BackgroundPromptPackage:
    visual_mode: Literal["subjectless-illustration"]
    mood: str
    palette: str
    scene: str
    style: str
    composition: str
    positive_prompt: str
    negative_prompt: str
    workflow_hint: str


@dataclass(frozen=True)
class PoetryFramePackage:
    nickname: str
    top_label: str
    left_vertical: str
    right_vertical: str
    bottom_line: str
    tone: str


@dataclass(frozen=True)
class ComfyUIWorkflowPackage:
    checkpoint_name: str
    width: int
    height: int
    steps: int
    cfg: float
    sampler_name: str
    scheduler: str
    workflow: dict


POSITIVE_TEMPLATES = {
    "uplifting": {
        "palette": "warm sunset pink, honey gold, soft sky blue",
        "scene": "open coastal boardwalk, glowing horizon, breezy evening sky",
        "style": "premium lyric video background illustration, cinematic editorial matte painting",
    },
    "romantic": {
        "palette": "rose dusk, amber light, deep indigo shadows",
        "scene": "quiet city lights reflected on wet streets, dreamy evening atmosphere",
        "style": "dreamy storybook illustration, cinematic background art",
    },
    "melancholic": {
        "palette": "muted blue, silver gray, pale violet",
        "scene": "empty train platform in soft rain, distant lights, quiet night air",
        "style": "atmospheric illustration, poetic background painting",
    },
    "introspective": {
        "palette": "soft teal, desaturated gold, dusk lavender",
        "scene": "lonely overlook above a city, layered clouds, wind-swept horizon",
        "style": "cinematic illustration, elegant lyric backdrop art",
    },
    "energetic": {
        "palette": "neon coral, electric cyan, deep navy",
        "scene": "stylized nightlife boulevard, glowing signs, rhythmic light trails",
        "style": "stylized music illustration, bold cinematic poster background",
    },
}

NEGATIVE_PROMPT = (
    "person, portrait, face, human figure, hands, crowd, text, subtitle, watermark, logo, "
    "photo realism, low detail, blurry, cluttered foreground, busy center, harsh contrast"
)

LOCAL_LLM_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions"
LOCAL_LLM_MODEL = "google/gemma-4-e4b"


def _normalize_title(title: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", title)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _infer_mood(song_title: str, lyric_lines: list[str]) -> str:
    haystack = " ".join([song_title, *lyric_lines]).lower()
    if any(token in haystack for token in ["love", "heart", "kiss", "together", "forever"]):
        return "romantic"
    if any(token in haystack for token in ["cry", "goodbye", "alone", "hurt", "rain"]):
        return "melancholic"
    if any(token in haystack for token in ["night", "inside", "feeling", "dream", "understand"]):
        return "introspective"
    if any(token in haystack for token in ["dance", "fire", "run", "light", "party"]):
        return "energetic"
    return "uplifting"


def _extract_focus_lines(lyric_lines: list[str], limit: int = 4) -> list[str]:
    cleaned = []
    for line in lyric_lines:
        text = line.strip()
        if not text or text == "♪":
            continue
        if text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _call_local_llm_json(system_prompt: str, user_prompt: str) -> dict | None:
    payload = {
        "model": LOCAL_LLM_MODEL,
        "temperature": 0.5,
        "messages": [
            {"role": "system", "content": f"{system_prompt} Return only valid JSON. No markdown."},
            {"role": "user", "content": user_prompt},
        ],
    }
    try:
        curl_binary = shutil.which("curl")
        if not curl_binary:
            return None
        completed = subprocess.run(
            [
                curl_binary,
                "-s",
                LOCAL_LLM_ENDPOINT,
                "-H",
                "Content-Type: application/json",
                "-d",
                json.dumps(payload, ensure_ascii=False),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=90,
        )
        body = json.loads(completed.stdout)
    except (subprocess.SubprocessError, TimeoutError, json.JSONDecodeError):
        return None

    try:
        content = body["choices"][0]["message"]["content"].strip()
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return json.loads(content[start : end + 1])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None


def _generate_local_background_fields(context: BackgroundPromptContext) -> dict | None:
    focus_lines = _extract_focus_lines(context.lyric_lines, limit=6)
    system_prompt = (
        "You write high-quality visual prompt plans for subjectless lyric-video backgrounds. "
        "Return strict JSON only."
    )
    user_prompt = (
        "Given the song title, artist, and lyric excerpts, create a background prompt plan for a 9:16 lyric video. "
        "The background must be subjectless, illustration-friendly, readable behind lyrics, and emotionally specific. "
        "Return JSON with keys: mood, palette, scene, style, composition, prompt_focus.\n\n"
        f"title: {context.song_title}\n"
        f"artist: {context.artist}\n"
        f"lyric_excerpts: {focus_lines}\n"
    )
    return _call_local_llm_json(system_prompt, user_prompt)


def _generate_local_poetry_fields(context: BackgroundPromptContext) -> dict | None:
    focus_lines = _extract_focus_lines(context.lyric_lines, limit=6)
    system_prompt = (
        "You write short atmospheric framing text for music video overlays. "
        "Return strict JSON only."
    )
    user_prompt = (
        "Write decorative overlay text for a lyric video frame. "
        "The text should feel cinematic, restrained, and inspired by the song lyrics. "
        "Return JSON with keys: left_vertical, right_vertical, bottom_line, tone. "
        "left_vertical and right_vertical should each be one uppercase poetic sentence around 10 to 16 words. "
        "bottom_line should be one short uppercase ambient line around 6 to 10 words.\n\n"
        f"title: {context.song_title}\n"
        f"artist: {context.artist}\n"
        f"lyric_excerpts: {focus_lines}\n"
    )
    return _call_local_llm_json(system_prompt, user_prompt)


def build_background_prompt_package(context: BackgroundPromptContext) -> BackgroundPromptPackage:
    normalized_title = _normalize_title(context.song_title)
    mood = _infer_mood(normalized_title, context.lyric_lines)
    template = POSITIVE_TEMPLATES[mood]
    focus_lines = _extract_focus_lines(context.lyric_lines)
    focus_hint = "; ".join(focus_lines)

    local_fields = _generate_local_background_fields(context) or {}
    mood = str(local_fields.get("mood") or mood)
    palette = str(local_fields.get("palette") or template["palette"])
    scene = str(local_fields.get("scene") or template["scene"])
    style = str(local_fields.get("style") or template["style"])

    composition = str(local_fields.get("composition") or (
        "vertical 9:16 composition, subjectless illustration, clean center area for lyric overlay, "
        "layered depth, calm readable layout, premium wallpaper framing"
    ))
    prompt_focus = str(local_fields.get("prompt_focus") or focus_hint)
    positive_prompt = (
        f"subjectless illustration background for a music lyric video, inspired by the song "
        f"'{normalized_title}' by {context.artist}, mood {mood}, {scene}, "
        f"{palette}, {style}, {composition}, no characters, no human figures, "
        f"visually rich but uncluttered, evocative atmosphere, detailed environment storytelling, "
        f"focus inspiration: {prompt_focus}"
    )

    return BackgroundPromptPackage(
        visual_mode="subjectless-illustration",
        mood=mood,
        palette=palette,
        scene=scene,
        style=style,
        composition=composition,
        positive_prompt=positive_prompt,
        negative_prompt=NEGATIVE_PROMPT,
        workflow_hint="comfyui-subjectless-illustration-background",
    )


def build_poetry_frame_package(context: BackgroundPromptContext) -> PoetryFramePackage:
    local_fields = _generate_local_poetry_fields(context) or {}
    return PoetryFramePackage(
        nickname="@xcai43323",
        top_label="@xcai43323 · AUDIO DIARY",
        left_vertical=str(
            local_fields.get("left_vertical")
            or "THE CITY HOLDS ITS BREATH WHILE THE SONG TURNS MEMORY INTO LIGHT"
        ).upper(),
        right_vertical=str(
            local_fields.get("right_vertical")
            or "EACH CHORUS LEAVES A QUIET TRACE ABOVE THE STREETS OF MIDNIGHT"
        ).upper(),
        bottom_line=str(
            local_fields.get("bottom_line")
            or "LET THE NIGHT HUM SOFTLY"
        ).upper(),
        tone=str(local_fields.get("tone") or "cinematic-ambient"),
    )


def save_background_prompt_package(
    package: BackgroundPromptPackage,
    context: BackgroundPromptContext,
) -> dict[str, str]:
    song_dir = Path(context.song_dir)
    song_dir.mkdir(parents=True, exist_ok=True)

    json_path = song_dir / "background-prompt.json"
    md_path = song_dir / "background-prompt.md"

    json_path.write_text(json.dumps(asdict(package), ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(
        "\n".join(
            [
                f"# Background Prompt",
                "",
                f"- Song: `{context.song_title}`",
                f"- Artist: `{context.artist}`",
                f"- Visual mode: `{package.visual_mode}`",
                f"- Mood: `{package.mood}`",
                f"- Workflow hint: `{package.workflow_hint}`",
                "",
                "## Positive Prompt",
                "",
                package.positive_prompt,
                "",
                "## Negative Prompt",
                "",
                package.negative_prompt,
                "",
            ]
        ),
        encoding="utf-8",
    )

    return {
        "json_path": str(json_path),
        "md_path": str(md_path),
    }


def save_poetry_frame_package(
    package: PoetryFramePackage,
    context: BackgroundPromptContext,
) -> dict[str, str]:
    song_dir = Path(context.song_dir)
    song_dir.mkdir(parents=True, exist_ok=True)
    json_path = song_dir / "poetry-frame.json"
    md_path = song_dir / "poetry-frame.md"
    json_path.write_text(json.dumps(asdict(package), ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(
        "\n".join(
            [
                "# Poetry Frame",
                "",
                f"- Song: `{context.song_title}`",
                f"- Artist: `{context.artist}`",
                f"- Tone: `{package.tone}`",
                "",
                "## Top",
                "",
                package.top_label,
                "",
                "## Left Vertical",
                "",
                package.left_vertical,
                "",
                "## Right Vertical",
                "",
                package.right_vertical,
                "",
                "## Bottom",
                "",
                package.bottom_line,
                "",
            ]
        ),
        encoding="utf-8",
    )
    return {
        "json_path": str(json_path),
        "md_path": str(md_path),
    }


def build_comfyui_workflow_package(
    package: BackgroundPromptPackage,
    context: BackgroundPromptContext,
) -> ComfyUIWorkflowPackage:
    checkpoint_name = "RealVisXLV4.0.safetensors"
    width = 1080
    height = 1920
    steps = 32
    cfg = 6.0
    sampler_name = "dpmpp_2m"
    scheduler = "karras"

    workflow = {
        "3": {
            "inputs": {"seed": 724638291847261, "steps": steps, "cfg": cfg, "sampler_name": sampler_name, "scheduler": scheduler, "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]},
            "class_type": "KSampler",
        },
        "4": {
            "inputs": {"ckpt_name": checkpoint_name},
            "class_type": "CheckpointLoaderSimple",
        },
        "5": {
            "inputs": {"width": width, "height": height, "batch_size": 1},
            "class_type": "EmptyLatentImage",
        },
        "6": {
            "inputs": {"text": package.positive_prompt, "clip": ["4", 1]},
            "class_type": "CLIPTextEncode",
        },
        "7": {
            "inputs": {"text": package.negative_prompt, "clip": ["4", 1]},
            "class_type": "CLIPTextEncode",
        },
        "8": {
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
            "class_type": "VAEDecode",
        },
        "9": {
            "inputs": {"filename_prefix": f"lyricMVPlayer/{context.song_base_name}/background", "images": ["8", 0]},
            "class_type": "SaveImage",
        },
    }

    return ComfyUIWorkflowPackage(
        checkpoint_name=checkpoint_name,
        width=width,
        height=height,
        steps=steps,
        cfg=cfg,
        sampler_name=sampler_name,
        scheduler=scheduler,
        workflow=workflow,
    )


def save_comfyui_workflow_package(
    package: ComfyUIWorkflowPackage,
    context: BackgroundPromptContext,
) -> str:
    song_dir = Path(context.song_dir)
    song_dir.mkdir(parents=True, exist_ok=True)
    workflow_path = song_dir / "background-workflow.json"
    workflow_path.write_text(json.dumps(package.workflow, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(workflow_path)


def get_default_comfy_output_root() -> str:
    return "/Users/cxy251/Documents/ComfyUI/output"


def import_latest_comfy_background(
    context: BackgroundPromptContext,
    comfy_output_root: str | None = None,
) -> str | None:
    output_root = Path(comfy_output_root or get_default_comfy_output_root())
    source_dir = output_root / "lyricMVPlayer" / context.song_base_name
    if not source_dir.exists():
        return None

    candidates: list[Path] = []
    for pattern in ["background*.png", "background*.jpg", "background*.jpeg", "background*.webp"]:
        candidates.extend(source_dir.glob(pattern))

    if not candidates:
        return None

    latest = sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)[0]
    song_dir = Path(context.song_dir)
    song_dir.mkdir(parents=True, exist_ok=True)
    destination = song_dir / f"background{latest.suffix.lower()}"
    shutil.copy2(latest, destination)
    return str(destination)
