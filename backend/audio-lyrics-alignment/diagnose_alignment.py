from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class DiagnosticIssue:
    severity: str
    code: str
    message: str
    line_index: int | None = None
    text: str | None = None
    details: dict | None = None


@dataclass(frozen=True)
class AlignmentDiagnosticReport:
    song_dir: str
    original_line_count: int
    aligned_line_count: int
    missing_lines: list[str]
    issues: list[DiagnosticIssue]


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize_text(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\[[^\]]+\]", "", value)
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff\s']", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _meaningful_lines(raw_lines: list[dict]) -> list[str]:
    values: list[str] = []
    for line in raw_lines:
        text = str(line.get("text", "")).strip()
        if not text:
            continue
        if re.fullmatch(r"[♪\s]+", text):
            continue
        values.append(text)
    return values


def build_alignment_diagnostic(song_dir: str) -> AlignmentDiagnosticReport:
    song_path = Path(song_dir)
    lyrics_data = _load_json(song_path / "lyrics.json")
    aligned_data = _load_json(song_path / "alignedLRC.json")

    original_lines = _meaningful_lines(lyrics_data.get("lines", []))
    aligned_lines = aligned_data.get("lines", [])

    aligned_lookup = {_normalize_text(str(line.get("text", ""))) for line in aligned_lines}
    missing_lines = [line for line in original_lines if _normalize_text(line) not in aligned_lookup]

    issues: list[DiagnosticIssue] = []
    previous_end_ms = None

    for index, line in enumerate(aligned_lines):
        text = str(line.get("text", ""))
        start_ms = int(line.get("start_ms", 0))
        end_ms = int(line.get("end_ms", 0))
        duration_ms = end_ms - start_ms

        if duration_ms < 900:
            issues.append(
                DiagnosticIssue(
                    severity="medium",
                    code="line-too-short",
                    message="Aligned lyric duration looks too short for a full lyric line.",
                    line_index=index,
                    text=text,
                    details={"durationMs": duration_ms},
                )
            )
        if duration_ms > 9000:
            issues.append(
                DiagnosticIssue(
                    severity="high",
                    code="line-too-long",
                    message="Aligned lyric duration looks too long and may span multiple lyric lines.",
                    line_index=index,
                    text=text,
                    details={"durationMs": duration_ms},
                )
            )
        if previous_end_ms is not None:
            gap_ms = start_ms - previous_end_ms
            if gap_ms > 5000:
                issues.append(
                    DiagnosticIssue(
                        severity="high",
                        code="large-gap",
                        message="Large silent timing gap detected between aligned lyric lines.",
                        line_index=index,
                        text=text,
                        details={"gapMs": gap_ms},
                    )
                )
            if gap_ms < -600:
                issues.append(
                    DiagnosticIssue(
                        severity="medium",
                        code="line-overlap",
                        message="Aligned lyric overlaps the previous line more than expected.",
                        line_index=index,
                        text=text,
                        details={"gapMs": gap_ms},
                    )
                )
        previous_end_ms = end_ms

    for missing_line in missing_lines:
        issues.append(
            DiagnosticIssue(
                severity="high",
                code="missing-line",
                message="A source lyric line is missing from aligned output.",
                text=missing_line,
            )
        )

    return AlignmentDiagnosticReport(
        song_dir=str(song_path),
        original_line_count=len(original_lines),
        aligned_line_count=len(aligned_lines),
        missing_lines=missing_lines,
        issues=issues,
    )


def diagnostic_report_to_json(report: AlignmentDiagnosticReport) -> str:
    return json.dumps(asdict(report), ensure_ascii=False, indent=2)


def diagnostic_report_to_markdown(report: AlignmentDiagnosticReport) -> str:
    lines = [
        "# Alignment Diagnostic",
        "",
        f"- song dir: `{report.song_dir}`",
        f"- original lyric lines: `{report.original_line_count}`",
        f"- aligned lyric lines: `{report.aligned_line_count}`",
        f"- missing lines: `{len(report.missing_lines)}`",
        f"- issues: `{len(report.issues)}`",
        "",
    ]

    if report.missing_lines:
        lines.extend(["## Missing Lines", ""])
        for line in report.missing_lines:
            lines.append(f"- {line}")
        lines.append("")

    if report.issues:
        lines.extend(["## Issues", ""])
        for issue in report.issues:
            suffix = f" | line `{issue.line_index}`" if issue.line_index is not None else ""
            text_suffix = f" | `{issue.text}`" if issue.text else ""
            detail_suffix = f" | `{json.dumps(issue.details, ensure_ascii=False)}`" if issue.details else ""
            lines.append(f"- `{issue.severity}` `{issue.code}`{suffix}{text_suffix}{detail_suffix}")
        lines.append("")

    if not report.issues:
        lines.extend(["## Issues", "", "- No structural issues detected by the current heuristic.", ""])

    return "\n".join(lines)


def save_alignment_diagnostic(report: AlignmentDiagnosticReport, song_dir: str) -> dict[str, str]:
    song_path = Path(song_dir)
    json_path = song_path / "alignment-diagnostic.json"
    md_path = song_path / "alignment-diagnostic.md"
    json_path.write_text(diagnostic_report_to_json(report), encoding="utf-8")
    md_path.write_text(diagnostic_report_to_markdown(report), encoding="utf-8")
    return {"json_path": str(json_path), "md_path": str(md_path)}
