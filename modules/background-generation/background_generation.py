from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode
from urllib.request import urlopen


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
    lyric_reading: str
    visual_metaphor: str
    positive_prompt: str
    negative_prompt: str
    workflow_hint: str
    generation_source: str
    llm_model: str


@dataclass(frozen=True)
class PoetryFramePackage:
    nickname: str
    top_label: str
    left_vertical: str
    right_vertical: str
    bottom_line: str
    sonnet_lines: list[str]
    tone: str
    generation_source: str
    llm_model: str


@dataclass(frozen=True)
class ComfyUIWorkflowPackage:
    checkpoint_name: str
    seed: int
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

LOCAL_LLM_BASE_URL = "http://127.0.0.1:1234/v1"
LOCAL_LLM_ENDPOINT = f"{LOCAL_LLM_BASE_URL}/chat/completions"
LOCAL_LLM_MODEL = "google/gemma-4-12b-qat" #gemma-4-e4b"
COMFYUI_API_URL = "http://127.0.0.1:8000"
VISUAL_PLAN_KEYS = (
    "mood",
    "palette",
    "scene",ß
    "style",
    "composition",
    "lyric_reading",
    "visual_metaphor",
    "prompt_focus",
    "left_vertical",
    "right_vertical",
    "bottom_line",
    "tone",
)


class BackgroundGenerationError(RuntimeError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason


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


def _format_full_lyrics_for_llm(lyric_lines: list[str]) -> list[dict[str, str | int]]:
    formatted: list[dict[str, str | int]] = []
    for index, line in enumerate(lyric_lines, start=1):
        text = re.sub(r"\s+", " ", line.strip())
        if not text or text == "♪":
            continue
        formatted.append({"line": index, "text": text})
    return formatted


def _curl_json_payload(
    method: str,
    url: str,
    payload: dict | None = None,
    timeout_seconds: int = 90,
) -> dict | None:
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
            timeout=timeout_seconds,
        )
        if not completed.stdout.strip():
            return None
        return json.loads(completed.stdout)
    except (subprocess.SubprocessError, TimeoutError, json.JSONDecodeError):
        return None


def is_local_llm_available() -> bool:
    body = _curl_json_payload("GET", f"{LOCAL_LLM_BASE_URL}/models", timeout_seconds=8)
    return isinstance(body, dict) and isinstance(body.get("data"), list)


def require_local_llm_available() -> None:
    if is_local_llm_available():
        return
    raise BackgroundGenerationError(
        "local-llm-unavailable",
        (
            f"Local LLM is unavailable at {LOCAL_LLM_BASE_URL}. "
            "Open LM Studio/local server before preparing playlists or regenerating visual assets."
        ),
    )


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
        body = _curl_json_payload("POST", LOCAL_LLM_ENDPOINT, payload, timeout_seconds=90)
        if not body:
            return None
        if body.get("error"):
            return None
    except (TimeoutError, json.JSONDecodeError):
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


def _is_complete_visual_plan(payload: dict | None) -> bool:
    if not isinstance(payload, dict):
        return False
    if any(not str(payload.get(key) or "").strip() for key in VISUAL_PLAN_KEYS):
        return False
    sonnet_lines = payload.get("sonnet_lines")
    if not isinstance(sonnet_lines, list):
        return False
    return len([line for line in sonnet_lines if str(line).strip()]) == 14


def _generate_local_visual_plan_fields(context: BackgroundPromptContext) -> dict | None:
    full_lyrics = _format_full_lyrics_for_llm(context.lyric_lines)
    full_lyrics_json = json.dumps(full_lyrics, ensure_ascii=False)
    system_prompt = (
        "You are a lyric-video visual director and compact poetry writer. "
        "Read the full song lyrics in order before deciding anything. "
        "Infer the emotional arc, recurring images, point of view, and tonal shift across the whole song. "
        "Create subjectless 9:16 background art direction that is readable behind lyric overlays. "
        "Also write concise frame text and a 14-line original poem inspired by the whole song. "
        "Do not quote full lyric lines. Avoid generic night/city filler unless the full song clearly asks for it. "
        "Return strict JSON only."
    )
    user_prompt = (
        "Use the full lyrics below as the source of truth. "
        "Return JSON with keys: mood, palette, scene, style, composition, lyric_reading, visual_metaphor, "
        "prompt_focus, left_vertical, right_vertical, bottom_line, tone, sonnet_lines.\n"
        "- lyric_reading: 2-4 sentences explaining the song's full emotional arc.\n"
        "- visual_metaphor: a concrete subjectless environment that translates that arc into image language.\n"
        "- prompt_focus: specific image details derived from the full song, not generic filler.\n"
        "- left_vertical and right_vertical: uppercase poetic frame text, each 10-16 words.\n"
        "- bottom_line: uppercase ambient line, 6-10 words.\n"
        "- sonnet_lines: exactly 14 short original lines, inspired by the full song but not quoting it.\n\n"
        f"title: {context.song_title}\n"
        f"artist: {context.artist}\n"
        f"lyric_line_count: {len(full_lyrics)}\n"
        f"full_lyrics_json: {full_lyrics_json}\n"
    )
    last_payload: dict | None = None
    for _attempt in range(3):
        last_payload = _call_local_llm_json(system_prompt, user_prompt)
        if _is_complete_visual_plan(last_payload):
            return last_payload
    return last_payload if isinstance(last_payload, dict) else None


def _has_any_field(payload: dict | None, keys: tuple[str, ...]) -> bool:
    if not isinstance(payload, dict):
        return False
    return any(str(payload.get(key) or "").strip() for key in keys)


def build_background_prompt_package(
    context: BackgroundPromptContext,
    require_llm: bool = True,
    local_fields: dict | None = None,
) -> BackgroundPromptPackage:
    normalized_title = _normalize_title_against_artist(context.song_title, context.artist)
    mood = _infer_mood(normalized_title, context.lyric_lines)
    template = POSITIVE_TEMPLATES[mood]
    focus_lines = _extract_focus_lines(context.lyric_lines)
    focus_hint = "; ".join(focus_lines)

    if local_fields is None:
        local_fields = _generate_local_visual_plan_fields(context)
    if require_llm and not _has_any_field(
        local_fields,
        ("mood", "palette", "scene", "style", "composition", "lyric_reading", "visual_metaphor", "prompt_focus"),
    ):
        raise BackgroundGenerationError(
            "local-llm-background-failed",
            f"Local LLM did not return a usable background prompt plan for: {context.song_base_name}",
        )
    local_fields = local_fields or {}
    mood = str(local_fields.get("mood") or mood)
    palette = str(local_fields.get("palette") or template["palette"])
    scene = str(local_fields.get("scene") or template["scene"])
    style = str(local_fields.get("style") or template["style"])

    composition_detail = str(local_fields.get("composition") or "").strip()
    composition = (
        "vertical 9:16 composition, subjectless illustration, clean center area for lyric overlay, "
        "layered depth, calm readable layout, premium wallpaper framing"
    )
    if composition_detail:
        composition = f"{composition}, {composition_detail}"
    lyric_reading = str(local_fields.get("lyric_reading") or "").strip()
    visual_metaphor = str(local_fields.get("visual_metaphor") or "").strip()
    prompt_focus = str(local_fields.get("prompt_focus") or focus_hint)
    song_reference = f"{context.artist} - {normalized_title}"
    positive_prompt = (
        f"subjectless illustration background for a music lyric video, inspired by the song "
        f"'{song_reference}' by {context.artist}, mood {mood}, {scene}, "
        f"{palette}, {style}, {composition}, no characters, no human figures, "
        f"visually rich but uncluttered, evocative atmosphere, detailed environment storytelling, "
        f"lyric reading: {lyric_reading}, visual metaphor: {visual_metaphor}, "
        f"focus inspiration: {prompt_focus}"
    )

    return BackgroundPromptPackage(
        visual_mode="subjectless-illustration",
        mood=mood,
        palette=palette,
        scene=scene,
        style=style,
        composition=composition,
        lyric_reading=lyric_reading,
        visual_metaphor=visual_metaphor,
        positive_prompt=positive_prompt,
        negative_prompt=NEGATIVE_PROMPT,
        workflow_hint="comfyui-subjectless-illustration-background",
        generation_source="local-llm" if _has_any_field(local_fields, ("mood", "palette", "scene", "lyric_reading", "visual_metaphor", "prompt_focus")) else "template-fallback",
        llm_model=LOCAL_LLM_MODEL if _has_any_field(local_fields, ("mood", "palette", "scene", "lyric_reading", "visual_metaphor", "prompt_focus")) else "",
    )


def build_poetry_frame_package(
    context: BackgroundPromptContext,
    require_llm: bool = True,
    local_fields: dict | None = None,
) -> PoetryFramePackage:
    if local_fields is None:
        local_fields = _generate_local_visual_plan_fields(context)
    if require_llm and not _has_any_field(
        local_fields,
        ("left_vertical", "right_vertical", "bottom_line", "tone", "sonnet_lines"),
    ):
        raise BackgroundGenerationError(
            "local-llm-poetry-failed",
            f"Local LLM did not return usable poetry-frame text for: {context.song_base_name}",
        )
    local_fields = local_fields or {}
    raw_sonnet_lines = local_fields.get("sonnet_lines")
    sonnet_lines = [
        str(line).strip()
        for line in raw_sonnet_lines
        if str(line).strip()
    ] if isinstance(raw_sonnet_lines, list) else []
    if require_llm and len(sonnet_lines) != 14:
        raise BackgroundGenerationError(
            "local-llm-sonnet-failed",
            f"Local LLM did not return exactly 14 sonnet lines for: {context.song_base_name}",
        )
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
        sonnet_lines=sonnet_lines,
        tone=str(local_fields.get("tone") or "cinematic-ambient"),
        generation_source="local-llm" if _has_any_field(local_fields, ("left_vertical", "right_vertical", "bottom_line", "tone", "sonnet_lines")) else "template-fallback",
        llm_model=LOCAL_LLM_MODEL if _has_any_field(local_fields, ("left_vertical", "right_vertical", "bottom_line", "tone", "sonnet_lines")) else "",
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
                "## Sonnet",
                "",
                *package.sonnet_lines,
                "",
            ]
        ),
        encoding="utf-8",
    )
    return {
        "json_path": str(json_path),
        "md_path": str(md_path),
    }


def _build_stable_seed(context: BackgroundPromptContext) -> int:
    seed_source = f"{context.song_base_name}|{context.song_title}|{context.artist}"
    digest = hashlib.sha256(seed_source.encode("utf-8")).hexdigest()
    return int(digest[:14], 16)


def build_comfyui_workflow_package(
    package: BackgroundPromptPackage,
    context: BackgroundPromptContext,
) -> ComfyUIWorkflowPackage:
    checkpoint_name = "RealVisXLV4.0.safetensors"
    seed = _build_stable_seed(context)
    width = 1080
    height = 1920
    steps = 32
    cfg = 6.0
    sampler_name = "dpmpp_2m"
    scheduler = "karras"

    workflow = {
        "3": {
            "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler_name, "scheduler": scheduler, "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]},
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
        seed=seed,
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
    return _curl_json_payload(method, url, payload, timeout_seconds=90)


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


def refresh_song_background_assets(song_dir: str, require_llm: bool = True) -> dict[str, str]:
    if require_llm:
        require_local_llm_available()
    context = build_context_from_song_dir(song_dir)
    local_fields = _generate_local_visual_plan_fields(context)
    background_package = build_background_prompt_package(context, require_llm=require_llm, local_fields=local_fields)
    poetry_package = build_poetry_frame_package(context, require_llm=require_llm, local_fields=local_fields)
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


def refresh_render_input_for_song(song_dir: str, project_root: str) -> str:
    video_render_path = Path(project_root) / "modules" / "video-render" / "video_render.py"
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("video_render_background_module", video_render_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {video_render_path}")
    video_render_module = importlib.util.module_from_spec(spec)
    sys.modules["video_render_background_module"] = video_render_module
    spec.loader.exec_module(video_render_module)
    return video_render_module.refresh_render_job_input(song_dir)


def generate_background_for_song(
    song_dir: str,
    project_root: str,
    api_url: str | None = None,
    comfy_output_root: str | None = None,
    timeout_seconds: int = 600,
    reuse_existing_output: bool = False,
    require_llm: bool = True,
    refresh_assets: bool = False,
) -> dict:
    context = build_context_from_song_dir(song_dir)
    if refresh_assets:
        try:
            asset_paths = refresh_song_background_assets(song_dir, require_llm=require_llm)
            workflow_path = Path(asset_paths["workflow_path"])
        except BackgroundGenerationError as error:
            return {
                "ok": False,
                "reason": error.reason,
                "song_dir": context.song_dir,
                "message": str(error),
            }
    else:
        workflow_path = Path(song_dir) / "background-workflow.json"
        if not workflow_path.exists():
            return {
                "ok": False,
                "reason": "background-workflow-missing",
                "song_dir": context.song_dir,
                "workflow_path": str(workflow_path),
                "message": "Run npm run regenerate:lyrics-llm-workflow-text before generating background images.",
            }
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))

    if reuse_existing_output:
        existing_import = import_latest_comfy_background(
            context=context,
            comfy_output_root=comfy_output_root,
        )
        if existing_import is not None:
            render_input_path = refresh_render_input_for_song(context.song_dir, project_root)
            return {
                "ok": True,
                "song_dir": context.song_dir,
                "workflow_path": str(workflow_path),
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
            "workflow_path": str(workflow_path),
            "api_url": api_url or get_default_comfyui_api_url(),
        }

    prompt_id = submit_workflow_to_comfyui(workflow, api_url=api_url)
    if not prompt_id:
        return {
            "ok": False,
            "reason": "workflow-submit-failed",
            "song_dir": context.song_dir,
            "workflow_path": str(workflow_path),
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

    imported_background = import_background_from_history_record(
        history_record=history_record,
        context=context,
        api_url=api_url,
    )
    if imported_background is None:
        imported_background = wait_for_imported_background(
            context=context,
            comfy_output_root=comfy_output_root,
            timeout_seconds=90,
        )

    render_input_path = refresh_render_input_for_song(context.song_dir, project_root)

    return {
        "ok": imported_background is not None,
        "song_dir": context.song_dir,
        "workflow_path": str(workflow_path),
        "prompt_id": prompt_id,
        "background_path": imported_background,
        "render_input_path": render_input_path,
    }


def import_latest_comfy_background(
    context: BackgroundPromptContext,
    comfy_output_root: str | None = None,
) -> str | None:
    output_root = Path(comfy_output_root or get_default_comfy_output_root())
    lyric_root = output_root / "lyricMVPlayer"
    source_dir = lyric_root / context.song_base_name
    candidate_dirs: list[Path] = []
    try:
        if source_dir.exists():
            candidate_dirs.append(source_dir)
        else:
            video_id = context.song_base_name.rsplit(" - ", 1)[-1].strip()
            if lyric_root.exists() and video_id:
                candidate_dirs.extend(
                    sorted(
                        [path for path in lyric_root.iterdir() if path.is_dir() and path.name.endswith(video_id)],
                        key=lambda item: item.stat().st_mtime,
                        reverse=True,
                    )
                )
    except (PermissionError, OSError):
        return None
    if not candidate_dirs:
        return None

    candidates: list[Path] = []
    for candidate_dir in candidate_dirs:
        for pattern in ["background*.png", "background*.jpg", "background*.jpeg", "background*.webp"]:
            candidates.extend(candidate_dir.glob(pattern))

    if not candidates:
        return None

    latest = sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)[0]
    song_dir = Path(context.song_dir)
    song_dir.mkdir(parents=True, exist_ok=True)
    destination = song_dir / f"background{latest.suffix.lower()}"
    shutil.copy2(latest, destination)
    return str(destination)


def _extract_history_images(history_record: dict) -> list[dict]:
    outputs = history_record.get("outputs")
    if not isinstance(outputs, dict):
        return []
    images: list[dict] = []
    for node_output in outputs.values():
        if not isinstance(node_output, dict):
            continue
        node_images = node_output.get("images")
        if not isinstance(node_images, list):
            continue
        for image in node_images:
            if isinstance(image, dict) and image.get("filename"):
                images.append(image)
    return images


def _download_history_image(
    image_record: dict,
    destination: Path,
    api_url: str | None = None,
) -> str | None:
    filename = image_record.get("filename")
    if not filename:
        return None
    params = {
        "filename": str(filename),
        "type": str(image_record.get("type") or "output"),
    }
    subfolder = image_record.get("subfolder")
    if subfolder:
        params["subfolder"] = str(subfolder)
    view_url = f"{api_url or get_default_comfyui_api_url()}/view?{urlencode(params)}"
    try:
        with urlopen(view_url, timeout=90) as response:
            body = response.read()
    except Exception:
        return None

    if not body:
        return None

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(body)
    return str(destination)


def import_background_from_history_record(
    history_record: dict,
    context: BackgroundPromptContext,
    api_url: str | None = None,
) -> str | None:
    images = _extract_history_images(history_record)
    if not images:
        return None

    prioritized = sorted(
        images,
        key=lambda item: (
            0 if str(item.get("filename", "")).lower().startswith("background") else 1,
            str(item.get("filename", "")).lower(),
        ),
    )
    song_dir = Path(context.song_dir)
    for image in prioritized:
        filename = str(image.get("filename", ""))
        suffix = Path(filename).suffix.lower() or ".png"
        destination = song_dir / f"background{suffix}"
        imported = _download_history_image(image, destination, api_url=api_url)
        if imported is not None:
            return imported
    return None


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
