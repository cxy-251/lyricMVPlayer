from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
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
        "style": "dreamy storybook illustration, cinematic background art",
    },
    "romantic": {
        "palette": "rose dusk, amber light, deep indigo shadows",
        "scene": "quiet city lights reflected on wet streets, dreamy evening atmosphere",
        "style": "dreamy storybook illustration, cinematic background art",
    },
    "melancholic": {
        "palette": "muted blue, silver gray, pale violet",
        "scene": "empty train platform in soft rain, distant lights, quiet night air",
        "style": "dreamy storybook illustration, cinematic background art",
    },
    "introspective": {
        "palette": "soft teal, desaturated gold, dusk lavender",
        "scene": "lonely overlook above a city, layered clouds, wind-swept horizon",
        "style": "dreamy storybook illustration, cinematic background art",
    },
    "energetic": {
        "palette": "neon coral, electric cyan, deep navy",
        "scene": "stylized nightlife boulevard, glowing signs, rhythmic light trails",
        "style": "dreamy storybook illustration, cinematic background art",
    },
}

NEGATIVE_PROMPT = (
    "person, portrait, face, human figure, hands, crowd, text, subtitle, watermark, logo, "
    "photo realism, low detail, blurry, cluttered foreground, busy center, harsh contrast"
)

LOCAL_LLM_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions"
LOCAL_LLM_MODEL = "google/gemma-4-e4b"
COMFYUI_API_URL = "http://127.0.0.1:8000"


def _normalize_title(title: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", title)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _normalize_title_against_artist(title: str, artist: str) -> str:
    normalized_title = _normalize_title(title)
    artist_prefix = f"{artist} - "
    if normalized_title.lower().startswith(artist_prefix.lower()):
        return normalized_title[len(artist_prefix) :].strip()
    return normalized_title


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
    normalized_title = _normalize_title_against_artist(context.song_title, context.artist)
    mood = _infer_mood(normalized_title, context.lyric_lines)
    template = POSITIVE_TEMPLATES[mood]
    focus_lines = _extract_focus_lines(context.lyric_lines)
    focus_hint = "; ".join(focus_lines)

    local_fields = _generate_local_background_fields(context) or {}
    mood = str(local_fields.get("mood") or mood)
    palette = str(local_fields.get("palette") or template["palette"])
    scene = str(local_fields.get("scene") or template["scene"])
    style = template["style"]

    composition = "vertical 9:16 composition, subjectless illustration, clean center area for lyric overlay, layered depth, calm readable layout, premium wallpaper framing"
    prompt_focus = str(local_fields.get("prompt_focus") or focus_hint)
    song_reference = f"{context.artist} - {normalized_title}"
    positive_prompt = (
        f"subjectless illustration background for a music lyric video, inspired by the song "
        f"'{song_reference}' by {context.artist}, mood {mood}, {scene}, "
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


def get_default_comfyui_api_url() -> str:
    return COMFYUI_API_URL


def _curl_json(method: str, url: str, payload: dict | None = None) -> dict | None:
    curl_binary = shutil.which("curl")
    if not curl_binary:
        return None

    command = [curl_binary, "-s", "-X", method, url]
    if payload is not None:
        command.extend(
            [
                "-H",
                "Content-Type: application/json",
                "-d",
                json.dumps(payload, ensure_ascii=False),
            ]
        )

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=90,
        )
        if not completed.stdout.strip():
            return None
        return json.loads(completed.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, TimeoutError):
        return None


def is_comfyui_api_available(api_url: str | None = None) -> bool:
    body = _curl_json("GET", f"{api_url or get_default_comfyui_api_url()}/system_stats")
    return isinstance(body, dict) and "system" in body


def submit_workflow_to_comfyui(
    workflow: dict,
    api_url: str | None = None,
    client_id: str = "lyricMVPlayer",
) -> str | None:
    payload = {
        "prompt": workflow,
        "client_id": client_id,
    }
    body = _curl_json("POST", f"{api_url or get_default_comfyui_api_url()}/prompt", payload)
    if not body:
        return None
    prompt_id = body.get("prompt_id")
    return str(prompt_id) if prompt_id else None


def wait_for_comfyui_prompt(
    prompt_id: str,
    api_url: str | None = None,
    timeout_seconds: int = 600,
    poll_interval_seconds: float = 2.0,
) -> dict | None:
    deadline = time.time() + timeout_seconds
    history_url = f"{api_url or get_default_comfyui_api_url()}/history/{prompt_id}"

    while time.time() < deadline:
        body = _curl_json("GET", history_url)
        if isinstance(body, dict) and prompt_id in body:
            return body[prompt_id]
        time.sleep(poll_interval_seconds)

    return None


def build_context_from_song_dir(song_dir: str) -> BackgroundPromptContext:
    song_path = Path(song_dir)
    source_data = json.loads((song_path / "source.json").read_text(encoding="utf-8"))
    lyrics_path = song_path / "alignedLRC.json"
    if not lyrics_path.exists():
        lyrics_path = song_path / "lyrics.json"
    lyrics_data = json.loads(lyrics_path.read_text(encoding="utf-8"))

    return BackgroundPromptContext(
        song_title=str(source_data.get("title") or song_path.name),
        artist=str(source_data.get("channel") or source_data.get("uploader") or "unknown-artist"),
        song_base_name=song_path.name,
        song_dir=str(song_path),
        lyric_lines=[
            str(line.get("text", "")).strip()
            for line in lyrics_data.get("lines", [])
            if str(line.get("text", "")).strip()
        ],
    )


def refresh_song_background_assets(song_dir: str) -> dict[str, str]:
    context = build_context_from_song_dir(song_dir)
    background_package = build_background_prompt_package(context)
    poetry_package = build_poetry_frame_package(context)
    workflow_package = build_comfyui_workflow_package(background_package, context)

    background_paths = save_background_prompt_package(background_package, context)
    poetry_paths = save_poetry_frame_package(poetry_package, context)
    workflow_path = save_comfyui_workflow_package(workflow_package, context)

    return {
        "song_dir": context.song_dir,
        "background_json_path": background_paths["json_path"],
        "background_md_path": background_paths["md_path"],
        "poetry_json_path": poetry_paths["json_path"],
        "poetry_md_path": poetry_paths["md_path"],
        "workflow_path": workflow_path,
    }


def generate_background_for_song(
    song_dir: str,
    project_root: str,
    api_url: str | None = None,
    comfy_output_root: str | None = None,
    timeout_seconds: int = 600,
) -> dict:
    root = Path(project_root)
    context = build_context_from_song_dir(song_dir)
    asset_paths = refresh_song_background_assets(song_dir)
    workflow = json.loads(Path(asset_paths["workflow_path"]).read_text(encoding="utf-8"))

    existing_import = import_latest_comfy_background(
        context=context,
        comfy_output_root=comfy_output_root,
    )
    if existing_import is not None:
        video_render_path = root / "modules" / "video-render" / "video_render.py"
        import importlib.util
        import sys

        spec = importlib.util.spec_from_file_location("video_render_background_module", video_render_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load module from {video_render_path}")
        video_render_module = importlib.util.module_from_spec(spec)
        sys.modules["video_render_background_module"] = video_render_module
        spec.loader.exec_module(video_render_module)
        render_input_path = video_render_module.refresh_render_job_input(context.song_dir)
        return {
            "ok": True,
            "song_dir": context.song_dir,
            "workflow_path": asset_paths["workflow_path"],
            "prompt_id": None,
            "background_path": existing_import,
            "render_input_path": render_input_path,
            "reused_existing_output": True,
        }

    if not is_comfyui_api_available(api_url):
        return {
            "ok": False,
            "reason": "comfyui-api-unavailable",
            "song_dir": context.song_dir,
            "workflow_path": asset_paths["workflow_path"],
            "api_url": api_url or get_default_comfyui_api_url(),
        }

    prompt_id = submit_workflow_to_comfyui(workflow, api_url=api_url)
    if not prompt_id:
        return {
            "ok": False,
            "reason": "workflow-submit-failed",
            "song_dir": context.song_dir,
            "workflow_path": asset_paths["workflow_path"],
            "api_url": api_url or get_default_comfyui_api_url(),
        }

    history_record = wait_for_comfyui_prompt(
        prompt_id,
        api_url=api_url,
        timeout_seconds=timeout_seconds,
    )
    if history_record is None:
        return {
            "ok": False,
            "reason": "workflow-timeout",
            "song_dir": context.song_dir,
            "prompt_id": prompt_id,
        }

    imported_background = wait_for_imported_background(
        context=context,
        comfy_output_root=comfy_output_root,
        timeout_seconds=90,
    )

    video_render_path = root / "modules" / "video-render" / "video_render.py"
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("video_render_background_module", video_render_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {video_render_path}")
    video_render_module = importlib.util.module_from_spec(spec)
    sys.modules["video_render_background_module"] = video_render_module
    spec.loader.exec_module(video_render_module)
    render_input_path = video_render_module.refresh_render_job_input(context.song_dir)

    return {
        "ok": imported_background is not None,
        "song_dir": context.song_dir,
        "workflow_path": asset_paths["workflow_path"],
        "prompt_id": prompt_id,
        "background_path": imported_background,
        "render_input_path": render_input_path,
    }


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


def wait_for_imported_background(
    context: BackgroundPromptContext,
    comfy_output_root: str | None = None,
    timeout_seconds: int = 90,
    poll_interval_seconds: float = 1.5,
) -> str | None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        imported = import_latest_comfy_background(
            context=context,
            comfy_output_root=comfy_output_root,
        )
        if imported is not None:
            return imported
        time.sleep(poll_interval_seconds)
    return None
