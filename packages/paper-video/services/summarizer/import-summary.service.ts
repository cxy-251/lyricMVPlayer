import path from "node:path";
import type {ContentProfileDocument} from "@paper-to-video/shared-types";
import {CONTENT_PROFILE_ROOT, slugify} from "../../shared-utils/run-artifacts";
import type {ImportedSummaryBundle, LooseSummaryRecord} from "./import-summary.types";

const SECTION_KEYS = ["hook", "problem", "method", "value", "ending"] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

type NormalizeOptions = {
  profileId?: string;
  label?: string;
};

const isRecord = (value: unknown): value is LooseSummaryRecord => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readRecord = (source: LooseSummaryRecord, keys: string[]): LooseSummaryRecord | null => {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return null;
};

const readString = (source: LooseSummaryRecord | null, keys: string[]): string | null => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const readStringArray = (source: LooseSummaryRecord | null, keys: string[]): string[] => {
  if (!source) {
    return [];
  }

  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  }

  return [];
};

const readSectionSource = (
  script: LooseSummaryRecord | null,
  key: SectionKey,
): LooseSummaryRecord | string | null => {
  if (!script) {
    return null;
  }

  const direct = script[key];
  if (typeof direct === "string" || isRecord(direct)) {
    return direct;
  }

  const aliases: Record<SectionKey, string[]> = {
    hook: ["intro", "opening"],
    problem: ["background", "challenge"],
    method: ["approach", "solution"],
    value: ["contribution", "impact", "results"],
    ending: ["conclusion", "outro", "takeaway"],
  };

  for (const alias of aliases[key]) {
    const candidate = script[alias];
    if (typeof candidate === "string" || isRecord(candidate)) {
      return candidate;
    }
  }

  return null;
};

const sectionDefaultTitle = (key: SectionKey, paperTitle: string) => {
  switch (key) {
    case "hook":
      return paperTitle;
    case "problem":
      return "这篇论文在解决什么？";
    case "method":
      return "核心方法";
    case "value":
      return "技术价值";
    case "ending":
      return "一句话结论";
  }
};

const normalizeSection = (
  value: LooseSummaryRecord | string | null,
  key: SectionKey,
  paperTitle: string,
  warnings: string[],
) => {
  if (typeof value === "string" && value.trim()) {
    return {
      narrationText: value.trim(),
      content: {
        title: sectionDefaultTitle(key, paperTitle),
        body: value.trim(),
      },
    };
  }

  const source = isRecord(value) ? value : null;
  const title =
    readString(source, ["title", "heading", "headline", "label"]) ??
    sectionDefaultTitle(key, paperTitle);
  const body = readString(source, ["body", "summary", "description", "text", "copy"]);
  const narration =
    readString(source, ["narration", "voiceover", "script", "text", "body"]) ?? body ?? "";
  const bullets = readStringArray(source, ["bullets", "points", "key_points", "highlights", "takeaways"]);

  if (!narration) {
    warnings.push(`Section "${key}" did not provide narration. The importer used an empty string.`);
  }

  const content: Record<string, unknown> = {title};

  if (bullets.length > 0) {
    content.bullets = bullets;
  } else if (body) {
    content.body = body;
  } else if (narration) {
    content.body = narration;
  }

  return {
    narrationText: narration,
    content,
  };
};

export const importSummaryJsonToContentProfile = (
  input: unknown,
  options: NormalizeOptions = {},
): ImportedSummaryBundle => {
  const warnings: string[] = [];
  const root = isRecord(input) ? input : {};
  const paper = readRecord(root, ["paper", "paper_meta", "paperMeta"]) ?? {};
  const videoScript = readRecord(root, ["video_script", "videoScript", "script"]) ?? {};
  const visualHints = readRecord(root, ["visual_hints", "visualHints"]) ?? {};

  const title =
    readString(paper, ["title", "paper_title", "paperTitle"]) ?? "未命名论文";
  const paperId =
    readString(paper, ["paper_id", "paperId", "id", "arxiv_id", "arxivId"]) ??
    slugify(title);
  const profileId =
    options.profileId?.trim() ||
    `summary-${slugify(paperId)}`;
  const label =
    options.label?.trim() ||
    readString(paper, ["one_line_positioning", "oneLinePositioning"]) ||
    title;

  const contentProfile: ContentProfileDocument = {
    id: profileId,
    paper: {
      source: "arxiv",
      paperId,
      title,
      categories: readStringArray(paper, ["categories", "tags"]),
      publishedAt:
        readString(paper, ["published_at", "publishedAt", "date"]) ?? undefined,
    },
    scenes: {
      hook: normalizeSection(readSectionSource(videoScript, "hook"), "hook", title, warnings),
      problem: normalizeSection(
        readSectionSource(videoScript, "problem"),
        "problem",
        title,
        warnings,
      ),
      method: normalizeSection(
        readSectionSource(videoScript, "method"),
        "method",
        title,
        warnings,
      ),
      value: normalizeSection(readSectionSource(videoScript, "value"), "value", title, warnings),
      ending: normalizeSection(
        readSectionSource(videoScript, "ending"),
        "ending",
        title,
        warnings,
      ),
    },
  };

  return {
    contentProfile,
    metadata: {
      profileId,
      label,
      preferredEffectId:
        readString(visualHints, ["preferred_effect", "preferredEffect"]) ?? null,
      coverImageKeywords: readStringArray(visualHints, [
        "cover_image_keywords",
        "coverImageKeywords",
        "image_keywords",
      ]),
      tone: readString(visualHints, ["tone", "style"]) ?? null,
      warnings,
    },
  };
};

export const resolveImportedProfilePath = (profileId: string) => {
  return path.join(CONTENT_PROFILE_ROOT, `${slugify(profileId)}.json`);
};
