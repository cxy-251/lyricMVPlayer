from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path


@dataclass(frozen=True)
class TranscriptSegment:
    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True)
class TranscriptWord:
    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True)
class TranscribedLyricLine:
    text: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class TranscribedLyricsDocument:
    source: str
    source_detail: str
    has_word_level_timing: bool
    language: str | None
    vocals_path: str
    lines: list[TranscribedLyricLine]


@dataclass(frozen=True)
class AlignedLyricLine:
    text: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class AlignedLyricsDocument:
    source: str
    vocals_path: str
    lyric_source_format: str
    lines: list[AlignedLyricLine]
    transcript_segments: list[TranscriptSegment]


@dataclass(frozen=True)
class LyricsAlignmentInput:
    vocals_path: str
    lyrics_text: str
    lyrics_format: str = "auto"
    transcription_model_size: str = "small"
    models_root: str | None = None


@dataclass(frozen=True)
class LyricsAlignmentError:
    code: str
    message: str
    details: dict | None = None


@dataclass(frozen=True)
class ParsedLyricEntry:
    text: str
    reference_start_ms: int | None = None
    reference_end_ms: int | None = None


def _normalize_text(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\[[^\]]+\]", "", value)
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff\s']", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _parse_lrc_or_plain_text(lyrics_text: str, lyrics_format: str) -> list[ParsedLyricEntry]:
    raw_lines = [line.strip() for line in lyrics_text.splitlines()]
    raw_lines = [line for line in raw_lines if line]

    if lyrics_format == "plain":
        return [ParsedLyricEntry(text=line) for line in raw_lines]

    if lyrics_format == "lrc" or (lyrics_format == "auto" and any("]" in line and "[" in line for line in raw_lines)):
        parsed: list[ParsedLyricEntry] = []
        for line in raw_lines:
            timestamps = re.findall(r"\[([0-9:.]+)\]", line)
            content = re.sub(r"\[[0-9:.]+\]", "", line).strip()
            if content:
                reference_start_ms = None
                if timestamps:
                    token = timestamps[0]
                    parts = token.split(":")
                    if len(parts) == 2:
                        minutes = int(parts[0])
                        seconds = float(parts[1])
                        reference_start_ms = int((minutes * 60 + seconds) * 1000)
                parsed.append(
                    ParsedLyricEntry(
                        text=content,
                        reference_start_ms=reference_start_ms,
                    )
                )
        for index, entry in enumerate(parsed):
            if entry.reference_start_ms is None:
                continue
            next_reference_start_ms = None
            for next_index in range(index + 1, len(parsed)):
                candidate = parsed[next_index]
                if candidate.reference_start_ms is not None:
                    next_reference_start_ms = candidate.reference_start_ms
                    break
            if next_reference_start_ms is None:
                next_reference_start_ms = entry.reference_start_ms + 3200
            parsed[index] = ParsedLyricEntry(
                text=entry.text,
                reference_start_ms=entry.reference_start_ms,
                reference_end_ms=next_reference_start_ms,
            )
        return parsed

    return [ParsedLyricEntry(text=line) for line in raw_lines]


def _tokenize_normalized_text(value: str) -> list[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return []
    return normalized.split()


def _score_candidate_tokens(lyric_tokens: list[str], candidate_tokens: list[str]) -> float:
    if not lyric_tokens or not candidate_tokens:
        return 0.0

    lyric_text = " ".join(lyric_tokens)
    candidate_text = " ".join(candidate_tokens)
    sequence_score = SequenceMatcher(None, lyric_text, candidate_text).ratio()
    lyric_unique = set(lyric_tokens)
    candidate_unique = set(candidate_tokens)
    overlap_score = len(lyric_unique & candidate_unique) / max(1, len(lyric_unique))
    length_penalty = abs(len(candidate_tokens) - len(lyric_tokens)) / max(len(lyric_tokens), len(candidate_tokens), 1)
    return (sequence_score * 0.58) + (overlap_score * 0.42) - (length_penalty * 0.08)


def _estimate_reference_duration_ms(lyric_entry: ParsedLyricEntry) -> int:
    if lyric_entry.reference_start_ms is not None and lyric_entry.reference_end_ms is not None:
        duration = lyric_entry.reference_end_ms - lyric_entry.reference_start_ms
        return max(900, min(7000, duration))
    return 2800


def _transcribe_vocals_with_faster_whisper(
    vocals_path: str,
    model_size: str,
    models_root: str | None,
) -> tuple[tuple[list[TranscriptSegment], list[TranscriptWord]] | None, LyricsAlignmentError | None]:
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        return None, LyricsAlignmentError(
            code="faster-whisper-missing",
            message="faster-whisper is not installed in the current Python environment.",
            details={"expected_package": "faster-whisper"},
        )

    model_kwargs = {}
    if models_root:
        model_kwargs["download_root"] = str(Path(models_root) / "faster-whisper")

    try:
        model = WhisperModel(model_size, device="auto", compute_type="auto", **model_kwargs)
        segments, _info = model.transcribe(vocals_path, vad_filter=True, word_timestamps=True)
    except Exception as error:  # noqa: BLE001
        return None, LyricsAlignmentError(
            code="transcription-failed",
            message="Failed to transcribe vocals with faster-whisper.",
            details={"error": str(error)},
        )

    results: list[TranscriptSegment] = []
    words: list[TranscriptWord] = []
    for segment in segments:
        text = str(segment.text).strip()
        if not text:
            continue
        results.append(
            TranscriptSegment(
                start_ms=int(float(segment.start) * 1000),
                end_ms=int(float(segment.end) * 1000),
                text=text,
            )
        )
        segment_words = getattr(segment, "words", None) or []
        for word in segment_words:
            word_text = str(getattr(word, "word", "")).strip()
            word_start = getattr(word, "start", None)
            word_end = getattr(word, "end", None)
            if not word_text or word_start is None or word_end is None:
                continue
            words.append(
                TranscriptWord(
                    start_ms=int(float(word_start) * 1000),
                    end_ms=int(float(word_end) * 1000),
                    text=word_text,
                )
            )

    if not results:
        return None, LyricsAlignmentError(
            code="empty-transcript",
            message="No transcript segments were produced from vocals.wav.",
        )

    return (results, words), None


def transcribe_vocals_to_lyrics_document(
    vocals_path: str,
    transcription_model_size: str = "small",
    models_root: str | None = None,
) -> tuple[TranscribedLyricsDocument | None, LyricsAlignmentError | None]:
    transcript_payload, transcript_error = _transcribe_vocals_with_faster_whisper(
        vocals_path=vocals_path,
        model_size=transcription_model_size,
        models_root=models_root,
    )
    if transcript_error is not None:
        return None, transcript_error

    transcript_segments, transcript_words = transcript_payload
    lines = [
        TranscribedLyricLine(
            text=segment.text,
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
        )
        for segment in transcript_segments
        if str(segment.text).strip()
    ]
    if not lines:
        return None, LyricsAlignmentError(
            code="transcription-empty",
            message="The transcription fallback produced no usable lyric lines.",
        )

    return (
        TranscribedLyricsDocument(
            source="transcription-fallback",
            source_detail=f"faster-whisper:{transcription_model_size}",
            has_word_level_timing=bool(transcript_words),
            language=None,
            vocals_path=vocals_path,
            lines=lines,
        ),
        None,
    )


def _align_lines_to_segments(
    lyric_lines: list[str],
    transcript_segments: list[TranscriptSegment],
) -> list[AlignedLyricLine]:
    aligned: list[AlignedLyricLine] = []
    segment_index = 0

    for lyric_line in lyric_lines:
        normalized_lyric = _normalize_text(lyric_line)
        if not normalized_lyric:
            continue

        best_match: tuple[float, int, int] | None = None
        best_text = ""

        for start_index in range(segment_index, min(len(transcript_segments), segment_index + 8)):
            combined_text = ""
            for end_index in range(start_index, min(len(transcript_segments), start_index + 4)):
                combined_text = f"{combined_text} {transcript_segments[end_index].text}".strip()
                ratio = SequenceMatcher(None, normalized_lyric, _normalize_text(combined_text)).ratio()
                if best_match is None or ratio > best_match[0]:
                    best_match = (ratio, start_index, end_index)
                    best_text = combined_text

        if best_match is None:
            continue

        score, start_index, end_index = best_match
        if score < 0.38:
            # fall back to the next transcript segment to avoid total alignment collapse
            start_index = min(segment_index, len(transcript_segments) - 1)
            end_index = start_index
            best_text = transcript_segments[start_index].text

        aligned.append(
            AlignedLyricLine(
                text=lyric_line,
                start_ms=transcript_segments[start_index].start_ms,
                end_ms=transcript_segments[end_index].end_ms,
            )
        )
        segment_index = max(segment_index + 1, end_index + 1)

    return aligned


def _align_lines_to_words(
    lyric_entries: list[ParsedLyricEntry],
    transcript_words: list[TranscriptWord],
) -> list[AlignedLyricLine]:
    if not transcript_words:
        return []

    aligned: list[AlignedLyricLine] = []
    search_start = 0
    previous_reference_ms: int | None = None
    previous_aligned_start_ms: int | None = None

    for lyric_entry in lyric_entries:
        lyric_line = lyric_entry.text
        lyric_tokens = _tokenize_normalized_text(lyric_line)
        if not lyric_tokens:
            continue

        desired_len = len(lyric_tokens)
        best_match: tuple[float, int, int] | None = None
        expected_start_ms: int | None = None
        if (
            lyric_entry.reference_start_ms is not None
            and previous_reference_ms is not None
            and previous_aligned_start_ms is not None
        ):
            expected_start_ms = previous_aligned_start_ms + (lyric_entry.reference_start_ms - previous_reference_ms)

        max_start = min(len(transcript_words), search_start + 180)
        for start_index in range(search_start, max_start):
            min_len = max(1, desired_len - 2)
            max_len = min(16, desired_len + 8)
            for span_len in range(min_len, max_len + 1):
                end_index = start_index + span_len - 1
                if end_index >= len(transcript_words):
                    break
                candidate_tokens = _tokenize_normalized_text(
                    " ".join(word.text for word in transcript_words[start_index : end_index + 1])
                )
                score = _score_candidate_tokens(lyric_tokens, candidate_tokens)
                if expected_start_ms is not None:
                    candidate_start_ms = transcript_words[start_index].start_ms
                    delta_ms = abs(candidate_start_ms - expected_start_ms)
                    if delta_ms <= 1200:
                        score += 0.2
                    elif delta_ms <= 2800:
                        score += 0.08
                    elif delta_ms >= 12000:
                        score -= 0.18
                if best_match is None or score > best_match[0]:
                    best_match = (score, start_index, end_index)

        if best_match is None:
            if expected_start_ms is not None:
                duration_ms = _estimate_reference_duration_ms(lyric_entry)
                aligned.append(
                    AlignedLyricLine(
                        text=lyric_line,
                        start_ms=expected_start_ms,
                        end_ms=expected_start_ms + duration_ms,
                    )
                )
                previous_reference_ms = lyric_entry.reference_start_ms
                previous_aligned_start_ms = expected_start_ms
            continue

        score, start_index, end_index = best_match
        candidate_start_ms = transcript_words[start_index].start_ms
        candidate_end_ms = transcript_words[end_index].end_ms
        if expected_start_ms is not None and abs(candidate_start_ms - expected_start_ms) > 5500:
            duration_ms = _estimate_reference_duration_ms(lyric_entry)
            aligned.append(
                AlignedLyricLine(
                    text=lyric_line,
                    start_ms=expected_start_ms,
                    end_ms=expected_start_ms + duration_ms,
                )
            )
            previous_reference_ms = lyric_entry.reference_start_ms
            previous_aligned_start_ms = expected_start_ms
            search_start = max(search_start, start_index)
            continue
        if score < 0.34:
            if expected_start_ms is not None:
                duration_ms = _estimate_reference_duration_ms(lyric_entry)
                aligned.append(
                    AlignedLyricLine(
                        text=lyric_line,
                        start_ms=expected_start_ms,
                        end_ms=expected_start_ms + duration_ms,
                    )
                )
                previous_reference_ms = lyric_entry.reference_start_ms
                previous_aligned_start_ms = expected_start_ms
            continue

        aligned.append(
            AlignedLyricLine(
                text=lyric_line,
                start_ms=candidate_start_ms,
                end_ms=candidate_end_ms,
            )
        )
        search_start = max(search_start + 1, end_index + 1)
        previous_reference_ms = lyric_entry.reference_start_ms
        previous_aligned_start_ms = candidate_start_ms

    return aligned


def _find_best_segment_window(
    lyric_entry: ParsedLyricEntry,
    transcript_segments: list[TranscriptSegment],
    search_start: int,
    previous_reference_ms: int | None,
    previous_aligned_start_ms: int | None,
) -> tuple[int, int] | None:
    lyric_line = lyric_entry.text
    normalized_lyric = _normalize_text(lyric_line)
    if not normalized_lyric:
        return None

    expected_start_ms: int | None = None
    if (
        lyric_entry.reference_start_ms is not None
        and previous_reference_ms is not None
        and previous_aligned_start_ms is not None
    ):
        expected_start_ms = previous_aligned_start_ms + (lyric_entry.reference_start_ms - previous_reference_ms)

    best_match: tuple[float, int, int] | None = None
    for start_index in range(search_start, min(len(transcript_segments), search_start + 8)):
        combined_text = ""
        for end_index in range(start_index, min(len(transcript_segments), start_index + 4)):
            combined_text = f"{combined_text} {transcript_segments[end_index].text}".strip()
            ratio = SequenceMatcher(None, normalized_lyric, _normalize_text(combined_text)).ratio()
            if expected_start_ms is not None:
                candidate_start_ms = transcript_segments[start_index].start_ms
                delta_ms = abs(candidate_start_ms - expected_start_ms)
                if delta_ms <= 1500:
                    ratio += 0.16
                elif delta_ms <= 3200:
                    ratio += 0.05
                elif delta_ms >= 12000:
                    ratio -= 0.16
            if best_match is None or ratio > best_match[0]:
                best_match = (ratio, start_index, end_index)

    if best_match is None:
        return None

    score, start_index, end_index = best_match
    if score < 0.28:
        start_index = min(search_start, len(transcript_segments) - 1)
        end_index = start_index

    return start_index, end_index


def align_lyrics(
    input_data: LyricsAlignmentInput,
) -> tuple[AlignedLyricsDocument | None, LyricsAlignmentError | None]:
    vocals_file = Path(input_data.vocals_path)
    if not vocals_file.exists():
        return None, LyricsAlignmentError(
            code="vocals-not-found",
            message=f"Vocals file does not exist: {input_data.vocals_path}",
        )

    lyric_entries = _parse_lrc_or_plain_text(input_data.lyrics_text, input_data.lyrics_format)
    if not lyric_entries:
        return None, LyricsAlignmentError(
            code="lyrics-empty",
            message="No lyric lines were available for alignment.",
        )

    transcript_payload, transcript_error = _transcribe_vocals_with_faster_whisper(
        vocals_path=input_data.vocals_path,
        model_size=input_data.transcription_model_size,
        models_root=input_data.models_root,
    )
    if transcript_error is not None:
        return None, transcript_error

    transcript_segments, transcript_words = transcript_payload
    aligned_lines = _align_lines_to_words(lyric_entries, transcript_words)
    if len(aligned_lines) < len(lyric_entries):
        aligned_by_text: dict[str, list[AlignedLyricLine]] = defaultdict(list)
        for line in aligned_lines:
            aligned_by_text[line.text].append(line)
        stitched_lines: list[AlignedLyricLine] = []
        segment_cursor = 0
        previous_reference_ms: int | None = None
        previous_aligned_start_ms: int | None = None

        for lyric_entry in lyric_entries:
            lyric_line = lyric_entry.text
            existing_bucket = aligned_by_text.get(lyric_line, [])
            existing = existing_bucket.pop(0) if existing_bucket else None
            if existing is not None:
                stitched_lines.append(existing)
                for index, segment in enumerate(transcript_segments):
                    if segment.start_ms <= existing.start_ms <= segment.end_ms or segment.start_ms >= existing.end_ms:
                        segment_cursor = index
                        break
                previous_reference_ms = lyric_entry.reference_start_ms
                previous_aligned_start_ms = existing.start_ms
                continue

            window = _find_best_segment_window(
                lyric_entry,
                transcript_segments,
                segment_cursor,
                previous_reference_ms,
                previous_aligned_start_ms,
            )
            if window is None:
                continue
            start_index, end_index = window
            stitched_lines.append(
                AlignedLyricLine(
                    text=lyric_line,
                    start_ms=transcript_segments[start_index].start_ms,
                    end_ms=transcript_segments[end_index].end_ms,
                )
            )
            segment_cursor = max(segment_cursor + 1, end_index + 1)
            previous_reference_ms = lyric_entry.reference_start_ms
            previous_aligned_start_ms = transcript_segments[start_index].start_ms

        aligned_lines = stitched_lines

    if len(aligned_lines) < max(1, len(lyric_entries) // 2):
        aligned_lines = _align_lines_to_segments([entry.text for entry in lyric_entries], transcript_segments)
    if not aligned_lines:
        return None, LyricsAlignmentError(
            code="alignment-empty",
            message="Transcript was produced but no lyric lines could be aligned.",
        )

    return (
        AlignedLyricsDocument(
            source="faster-whisper-line-alignment",
            vocals_path=input_data.vocals_path,
            lyric_source_format=input_data.lyrics_format,
            lines=aligned_lines,
            transcript_segments=transcript_segments,
        ),
        None,
    )


def aligned_lyrics_to_json(document: AlignedLyricsDocument) -> str:
    return json.dumps(asdict(document), ensure_ascii=False, indent=2)


def save_aligned_lyrics(document: AlignedLyricsDocument, output_path: str) -> str:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(aligned_lyrics_to_json(document), encoding="utf-8")
    return str(path)
