import {buildRuleBasedSummaryDraft, detectPaperMode} from "./rule-based-summary.service";
import {polishSummaryDraft} from "./summary-polish.service";
import type {LmStudioSummaryConfig, PaperMode, PaperSummaryContext, SourcePaperForSummary, SummaryDraft} from "./summarizer.types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{type?: string; text?: string}>;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
};

const RESPONSE_SCHEMA_EXAMPLE = {
  titleZh: "论文标题的直接中文翻译",
  hook: "开场钩子",
  problem: "论文在解决什么问题",
  method: "作者的核心方法是什么",
  value: "这件事带来了什么关键判断或技术价值",
  ending: "结尾总结",
  bullets: ["要点 1", "要点 2", "要点 3"],
};

const GENERIC_SENTENCE_PATTERNS = [
  /搭了一个.*框架/u,
  /很有价值/u,
  /真正价值/u,
  /值得先读/u,
  /值得一读/u,
  /统一.*坐标系/u,
  /重新梳理清楚/u,
  /非常重要/u,
  /帮助.*建立/u,
  /提供.*统一/u,
  /双轴框架/u,
  /重新整理成图/u,
  /方便评估比较/u,
] as const;

const containsExcessiveEnglish = (value: string) => {
  const letters = (value.match(/[A-Za-z]/g) ?? []).length;
  return letters >= 22 || /(?:\b[A-Za-z][A-Za-z0-9-]*\b[\s,;:()（）]*){5,}/.test(value);
};

const STRICT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titleZh", "hook", "problem", "method", "value", "ending", "bullets"],
  properties: {
    titleZh: {type: "string"},
    hook: {type: "string"},
    problem: {type: "string"},
    method: {type: "string"},
    value: {type: "string"},
    ending: {type: "string"},
    bullets: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {type: "string"},
    },
  },
} as const;

const SHORT_RESPONSE_SCHEMA_EXAMPLE = {
  titleZh: "论文英文标题的直接中文翻译",
  hook: "先用一句人话点出这篇论文最重要的判断或发现。",
  problem: "说明作者真正想解决的瓶颈，别复述标题。",
  method: "明确作者提出了什么方法、框架、证明或系统。",
  value: "说明这件事带来的技术价值、理论结论或关键结果。",
  ending: "最后一句直接收束成结论，不要引导观众去看原文。",
  bullets: ["屏显要点一", "屏显要点二", "屏显要点三"],
};

const extractContent = (payload: ChatCompletionResponse) => {
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw === "string") {
    return raw.trim();
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => item.text ?? "")
      .join("")
      .trim();
  }

  return "";
};

const extractReasoningContent = (payload: ChatCompletionResponse) =>
  payload.choices?.[0]?.message?.reasoning_content?.trim() ?? "";

const extractFinalResponseFromReasoning = (reasoning: string) => {
  const patterns = [
    /(?:Construct Final Response|Final Response|Final Answer|最终回答|最终输出)\s*[:：]\s*([\s\S]+)$/i,
    /(?:输出如下|答案如下)\s*[:：]\s*([\s\S]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(reasoning);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
};

const normalizeJsonText = (raw: string) =>
  raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();

const extractJsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return raw;
  }

  return raw.slice(start, end + 1);
};

const stripTrailingCommas = (raw: string) => raw.replace(/,\s*([}\]])/g, "$1");

const cleanLooseValue = (raw: string) =>
  raw
    .trim()
    .replace(/^"/, "")
    .replace(/",?$/, "")
    .replace(/,$/, "")
    .trim();

const tryParseLooseFieldObject = (raw: string): SummaryDraft | null => {
  const normalized = normalizeJsonText(raw);
  const fieldOrder = ["hook", "problem", "method", "value", "ending", "bullets"] as const;
  const values = new Map<string, string>();
  const titleMarker = /"titleZh"\s*:\s*/i.exec(normalized);
  if (titleMarker && titleMarker.index !== undefined) {
    const titleStart = titleMarker.index + titleMarker[0].length;
    const nextMatch = /,\s*"hook"\s*:/i.exec(normalized.slice(titleStart));
    if (nextMatch?.index !== undefined) {
      values.set("titleZh", cleanLooseValue(normalized.slice(titleStart, titleStart + nextMatch.index)));
    }
  }

  for (let index = 0; index < fieldOrder.length - 1; index += 1) {
    const key = fieldOrder[index];
    const nextKey = fieldOrder[index + 1];
    const keyMarker = new RegExp(`"${key}"\\s*:\\s*`, "i");
    const nextMarker = new RegExp(`,\\s*"${nextKey}"\\s*:`, "i");
    const keyMatch = keyMarker.exec(normalized);

    if (!keyMatch || keyMatch.index === undefined) {
      return null;
    }

    const startIndex = keyMatch.index + keyMatch[0].length;
    const remainder = normalized.slice(startIndex);
    const nextMatch = nextMarker.exec(remainder);
    if (!nextMatch || nextMatch.index === undefined) {
      return null;
    }

    values.set(key, cleanLooseValue(remainder.slice(0, nextMatch.index)));
  }

  const bulletsMarker = /"bullets"\s*:\s*\[/i.exec(normalized);
  if (!bulletsMarker || bulletsMarker.index === undefined) {
    return null;
  }

  const bulletsStart = bulletsMarker.index + bulletsMarker[0].length;
  const bulletsEnd = normalized.indexOf("]", bulletsStart);
  if (bulletsEnd === -1) {
    return null;
  }

  const bulletsSection = normalized.slice(bulletsStart, bulletsEnd);
  const bullets = [...bulletsSection.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 3);

  return {
    titleZh: values.get("titleZh") ?? "",
    hook: values.get("hook") ?? "",
    problem: values.get("problem") ?? "",
    method: values.get("method") ?? "",
    value: values.get("value") ?? "",
    ending: values.get("ending") ?? "",
    bullets,
  };
};

const parseTaggedDraft = (raw: string): SummaryDraft | null => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fields = {
    titleZh: "",
    hook: "",
    problem: "",
    method: "",
    value: "",
    ending: "",
  };
  const bullets: string[] = [];
  let currentKey: keyof typeof fields | null = null;
  let inBullets = false;

  for (const line of lines) {
    const match = /^(TITLE_ZH|HOOK|PROBLEM|METHOD|VALUE|ENDING|BULLETS)\s*[:：]\s*(.*)$/i.exec(line);
    if (match) {
      const key = match[1].toUpperCase();
      const value = match[2]?.trim() ?? "";
      inBullets = key === "BULLETS";
      currentKey =
        inBullets
          ? null
          : ((key === "TITLE_ZH" ? "titleZh" : key.toLowerCase()) as keyof typeof fields);

      if (currentKey) {
        fields[currentKey] = value;
      }
      continue;
    }

    if (inBullets) {
      const bullet = line.replace(/^[-*•]\s*/, "").trim();
      if (bullet) {
        bullets.push(bullet);
      }
      continue;
    }

    if (currentKey && line) {
      fields[currentKey] = `${fields[currentKey]} ${line}`.trim();
    }
  }

  if (
    !fields.hook ||
    !fields.problem ||
    !fields.method ||
    !fields.value ||
    !fields.ending ||
    bullets.length === 0
  ) {
    return null;
  }

  return {
    ...fields,
    bullets: bullets.slice(0, 3),
  };
};

const tryParseDraft = (raw: string): SummaryDraft | null => {
  const normalized = normalizeJsonText(raw);
  const candidates = [
    normalized,
    extractJsonObject(normalized),
    stripTrailingCommas(normalized),
    stripTrailingCommas(extractJsonObject(normalized)),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<SummaryDraft>;
      const bullets = Array.isArray(parsed.bullets)
        ? parsed.bullets.map((item) => `${item ?? ""}`.trim()).filter(Boolean).slice(0, 3)
        : [];

      return {
        titleZh: `${parsed.titleZh ?? ""}`.trim(),
        hook: `${parsed.hook ?? ""}`.trim(),
        problem: `${parsed.problem ?? ""}`.trim(),
        method: `${parsed.method ?? ""}`.trim(),
        value: `${parsed.value ?? ""}`.trim(),
        ending: `${parsed.ending ?? ""}`.trim(),
        bullets,
      };
    } catch {
      continue;
    }
  }

  const looseFieldDraft = tryParseLooseFieldObject(normalized);
  if (looseFieldDraft) {
    return looseFieldDraft;
  }

  const taggedDraft = parseTaggedDraft(normalized);
  if (taggedDraft) {
    return taggedDraft;
  }

  return null;
};

const parseDraft = (raw: string): SummaryDraft => {
  const parsed = tryParseDraft(raw);
  if (!parsed) {
    throw new SyntaxError("Unable to parse LM Studio completion into strict JSON");
  }

  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.map((item) => `${item ?? ""}`.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    titleZh: `${parsed.titleZh ?? ""}`.trim(),
    hook: `${parsed.hook ?? ""}`.trim(),
    problem: `${parsed.problem ?? ""}`.trim(),
    method: `${parsed.method ?? ""}`.trim(),
    value: `${parsed.value ?? ""}`.trim(),
    ending: `${parsed.ending ?? ""}`.trim(),
    bullets,
  };
};

const requestCompletion = async ({
  config,
  messages,
  maxTokens,
  temperature,
  preferStructuredOutput,
}: {
  config: LmStudioSummaryConfig;
  messages: Array<{role: "system" | "user"; content: string}>;
  maxTokens: number;
  temperature: number;
  preferStructuredOutput: boolean;
}) => {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const buildBody = (structured: boolean) => ({
    model: config.model,
    temperature,
    max_tokens: maxTokens,
    messages,
    ...(structured
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "paper_video_script",
              schema: STRICT_RESPONSE_SCHEMA,
            },
          },
        }
      : {}),
  });

  const doRequest = async (structured: boolean) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(buildBody(structured)),
    });

    return response;
  };

  const response = await doRequest(preferStructuredOutput);
  if (!response.ok && preferStructuredOutput && [400, 404, 422, 500].includes(response.status)) {
    const fallbackResponse = await doRequest(false);
    if (!fallbackResponse.ok) {
      const fallbackBody = await fallbackResponse.text().catch(() => "");
      throw new Error(
        `LM Studio request failed: ${fallbackResponse.status} ${fallbackResponse.statusText}${
          fallbackBody ? ` — ${fallbackBody.slice(0, 240)}` : ""
        }`,
      );
    }

    return (await fallbackResponse.json()) as ChatCompletionResponse;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `LM Studio request failed: ${response.status} ${response.statusText}${
        errorBody ? ` — ${errorBody.slice(0, 240)}` : ""
      }`,
    );
  }

  return (await response.json()) as ChatCompletionResponse;
};

const buildRepairPrompt = (raw: string) => {
  return [
    "下面是一段格式损坏的 JSON 风格输出。",
    "请你把它修复成严格合法 JSON，并且只输出 JSON。",
    "必须包含以下字段：titleZh, hook, problem, method, value, ending, bullets。",
    "bullets 必须是长度为 3 的字符串数组。",
    "",
    raw,
  ].join("\n");
};

const buildTaggedRepairPrompt = (raw: string) => {
  return [
    "下面这段输出格式不稳定，请你重新整理成固定标签格式，并且只输出这些行。",
    "格式必须严格如下：",
    "TITLE_ZH: ...",
    "HOOK: ...",
    "PROBLEM: ...",
    "METHOD: ...",
    "VALUE: ...",
    "ENDING: ...",
    "BULLETS:",
    "- ...",
    "- ...",
    "- ...",
    "",
    "不要输出 JSON，不要输出解释。",
    "",
    raw,
  ].join("\n");
};

const recoverDraftFromMalformedResponse = async ({
  config,
  raw,
}: {
  config: LmStudioSummaryConfig;
  raw: string;
}) => {
  const directDraft = tryParseDraft(raw);
  if (directDraft) {
    return directDraft;
  }

  const repairedPayload = await requestCompletion({
    config,
    maxTokens: Math.max(Math.min(config.maxOutputTokens, 1200), 900),
    temperature: 0,
    preferStructuredOutput: true,
    messages: [
      {
        role: "system",
        content: "You repair malformed JSON into strict JSON.",
      },
      {
        role: "user",
        content: buildRepairPrompt(raw),
      },
    ],
  });
  let repairedContent = extractContent(repairedPayload);
  const repairedReasoning = extractReasoningContent(repairedPayload);
  if (!repairedContent && repairedReasoning) {
    repairedContent = extractFinalResponseFromReasoning(repairedReasoning) || repairedReasoning;
  }
  const repairedDraft = repairedContent ? tryParseDraft(repairedContent) : null;
  if (repairedDraft) {
    return repairedDraft;
  }

  const taggedPayload = await requestCompletion({
    config,
    maxTokens: Math.max(Math.min(config.maxOutputTokens, 1200), 900),
    temperature: 0,
    preferStructuredOutput: false,
    messages: [
      {
        role: "system",
        content: "You rewrite malformed output into a stable tagged plain-text structure.",
      },
      {
        role: "user",
        content: buildTaggedRepairPrompt(raw),
      },
    ],
  });
  let taggedContent = extractContent(taggedPayload);
  const taggedReasoning = extractReasoningContent(taggedPayload);
  if (!taggedContent && taggedReasoning) {
    taggedContent = extractFinalResponseFromReasoning(taggedReasoning) || taggedReasoning;
  }

  return taggedContent ? parseTaggedDraft(taggedContent) : null;
};

const validateDraft = ({
  draft,
  allowPartial = false,
}: {
  draft: SummaryDraft;
  allowPartial?: boolean;
}) => {
  const requiredKeys = ["hook", "problem", "method", "value", "ending"] as const;

  for (const key of requiredKeys) {
    if (!draft[key].trim() && !allowPartial) {
      throw new Error(`LM Studio summary is missing required field: ${key}`);
    }
  }
};

const extractTechnicalAnchors = (paper: SourcePaperForSummary, context: PaperSummaryContext) => {
  const text = [paper.title, paper.summary, ...context.abstractSentences, ...context.sectionHeadings].join(" ");
  const anchors = new Set<string>();
  const knownPatterns = [
    /levels?\s*[×x]\s*laws/gi,
    /L1 Predictor/gi,
    /L2 Simulator/gi,
    /L3 Evolver/gi,
    /physical/gi,
    /digital/gi,
    /social/gi,
    /scientific/gi,
    /plan existence/gi,
    /epistemic planning/gi,
    /modal depth/gi,
    /postconditions?/gi,
    /undecidable|undecidability/gi,
    /action-conditioned rollouts?/gi,
    /minimal reproducible evaluation package/gi,
  ];

  for (const pattern of knownPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0]?.trim();
      if (value) {
        anchors.add(value);
      }
    }
  }

  return [...anchors];
};

const extractEvidenceArtifacts = (paper: SourcePaperForSummary, context: PaperSummaryContext) => {
  const text = [paper.title, paper.summary, ...context.abstractSentences, ...context.sectionHeadings].join(" ");
  const artifacts = new Set<string>();
  const ignore = new Set([
    "AI",
    "The",
    "This",
    "That",
    "We",
    "Our",
    "To",
    "As",
    "In",
    "On",
    "For",
    "With",
  ]);

  for (const match of text.matchAll(/\b(?:[A-Z][A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b/g)) {
    const value = match[0]?.trim();
    if (!value || value.length < 2 || ignore.has(value)) {
      continue;
    }

    artifacts.add(value.toLowerCase());
  }

  return [...artifacts];
};

const extractSentenceArtifacts = (value: string) =>
  [...value.matchAll(/\b(?:[A-Z][A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b/g)]
    .map((match) => match[0]?.trim().toLowerCase() ?? "")
    .filter(Boolean);

const containsUnsupportedArtifacts = ({
  value,
  evidenceArtifacts,
}: {
  value: string;
  evidenceArtifacts: string[];
}) => {
  const artifacts = extractSentenceArtifacts(value);
  if (artifacts.length === 0) {
    return false;
  }

  return artifacts.some((artifact) => !evidenceArtifacts.includes(artifact));
};

const sentenceHasAnchor = (value: string, anchors: string[]) => {
  const normalized = value.toLowerCase();
  return anchors.some((anchor) => normalized.includes(anchor.toLowerCase()));
};

const isWeakSentence = ({
  value,
  anchors,
  evidenceArtifacts,
  mode,
  paperMode,
}: {
  value: string;
  anchors: string[];
  evidenceArtifacts: string[];
  mode: keyof Omit<SummaryDraft, "bullets">;
  paperMode: PaperMode;
}) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 12) {
    return true;
  }

  const normalized = trimmed.toLowerCase();

  if (mode === "method" || mode === "value") {
    if (containsExcessiveEnglish(trimmed)) {
      return true;
    }

    if (containsUnsupportedArtifacts({value: trimmed, evidenceArtifacts})) {
      return true;
    }

    if (GENERIC_SENTENCE_PATTERNS.some((pattern) => pattern.test(trimmed)) && !sentenceHasAnchor(trimmed, anchors)) {
      return true;
    }

    if (!sentenceHasAnchor(trimmed, anchors) && /(框架|方法|价值|坐标系|综述|重要|统一)/u.test(trimmed)) {
      return true;
    }

    if (paperMode === "survey" && mode === "method") {
      const surveyAnchors = ["l1 predictor", "l2 simulator", "l3 evolver", "levels×laws", "levels x laws", "physical", "digital", "social", "scientific"];
      if (!surveyAnchors.some((anchor) => normalized.includes(anchor))) {
        return true;
      }
    }

    if (paperMode === "theory" && mode === "method") {
      const theoryAnchors = ["plan existence", "modal depth", "postcondition", "不可判定"];
      if (!theoryAnchors.some((anchor) => normalized.includes(anchor.toLowerCase()))) {
        return true;
      }
    }
  }

  return false;
};

const isWeakBullet = (value: string) =>
  !value ||
  value.length < 5 ||
  /(更清楚|更明确|更直接|值得先读|路线图|统一坐标系)$/u.test(value);

const mergeDraftWithBaseline = ({
  draft,
  baseline,
  anchors,
  evidenceArtifacts,
  paperMode,
}: {
  draft: SummaryDraft;
  baseline: SummaryDraft;
  anchors: string[];
  evidenceArtifacts: string[];
  paperMode: PaperMode;
}): SummaryDraft => {
  const merged: SummaryDraft = {
    titleZh: draft.titleZh,
    hook: draft.hook,
    problem: draft.problem,
    method: draft.method,
    value: draft.value,
    ending: draft.ending,
    bullets: draft.bullets,
  };

  if (!merged.titleZh.trim()) {
    merged.titleZh = baseline.titleZh;
  }

  const fieldKeys: Array<keyof Omit<SummaryDraft, "bullets" | "titleZh">> = ["hook", "problem", "method", "value", "ending"];
  for (const key of fieldKeys) {
    if (isWeakSentence({value: merged[key], anchors, evidenceArtifacts, mode: key, paperMode})) {
      merged[key] = baseline[key];
    }
  }

  const usableBullets = merged.bullets.filter((bullet) => !isWeakBullet(bullet));
  merged.bullets = usableBullets.length >= 3 ? usableBullets.slice(0, 3) : baseline.bullets;
  return merged;
};

const normalizeRawText = (rawText: string) =>
  rawText
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const SECTION_HINTS = {
  intro: [/^\s*(introduction|1 introduction|引言)\b/im, /^\s*(motivation|背景)\b/im],
  method: [/^\s*(method|methods|approach|framework|model|methodology)\b/im, /^\s*(2 |3 )?(approach|framework|method)\b/im],
  result: [/^\s*(experiments|results|evaluation|conclusion|discussion)\b/im, /^\s*(实验|结果|结论)\b/im],
} as const;

const extractSectionSnippet = (rawText: string, patterns: readonly RegExp[], maxChars: number) => {
  for (const pattern of patterns) {
    const match = pattern.exec(rawText);
    if (!match?.index && match?.index !== 0) {
      continue;
    }

    return rawText.slice(match.index, match.index + maxChars).trim();
  }

  return "";
};

const buildEvidencePacket = (
  paper: SourcePaperForSummary,
  context: PaperSummaryContext,
  excerptChars: number,
  compact = false,
) => {
  const normalized = normalizeRawText(context.rawText);
  const compactSnippetLimit = Math.max(120, Math.min(excerptChars, 220));
  const sourceSummary = paper.summary.trim().slice(0, compact ? Math.min(220, excerptChars) : 1500);
  const abstract = context.abstractSentences.slice(0, compact ? 2 : 6).join(" ");
  const headings = context.sectionHeadings.slice(0, compact ? 3 : 8);
  const introSnippet = extractSectionSnippet(normalized, SECTION_HINTS.intro, compact ? compactSnippetLimit : 1200);
  const methodSnippet = extractSectionSnippet(normalized, SECTION_HINTS.method, compact ? compactSnippetLimit : 1200);
  const resultSnippet = extractSectionSnippet(normalized, SECTION_HINTS.result, compact ? compactSnippetLimit : 1200);
  const focusedExcerpt = extractFocusedExcerpt(normalized, excerptChars);

  return {
    mode: detectPaperMode(paper),
    sourceSummary,
    abstract,
    headings,
    introSnippet,
    methodSnippet,
    resultSnippet,
    focusedExcerpt,
  };
};

const extractFocusedExcerpt = (rawText: string, maxChars: number) => {
  const normalized = normalizeRawText(rawText);
  if (!normalized) {
    return "";
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const priorityKeywords = [
    "abstract",
    "introduction",
    "method",
    "approach",
    "experiment",
    "results",
    "conclusion",
    "discussion",
    "摘要",
    "引言",
    "方法",
    "实验",
    "结果",
    "结论",
  ];

  const prioritized = sections.filter((section) =>
    priorityKeywords.some((keyword) => section.toLowerCase().includes(keyword)),
  );
  const orderedSections = [...prioritized, ...sections.filter((section) => !prioritized.includes(section))];

  let excerpt = "";
  for (const section of orderedSections) {
    const nextSection = excerpt ? `${excerpt}\n\n${section}` : section;
    if (nextSection.length > maxChars) {
      break;
    }
    excerpt = nextSection;
  }

  if (!excerpt) {
    return normalized.slice(0, maxChars);
  }

  return excerpt.slice(0, maxChars);
};

const buildPrompt = (
  paper: SourcePaperForSummary,
  context: PaperSummaryContext,
  excerptChars: number,
  compact = false,
) => {
  const evidence = buildEvidencePacket(paper, context, excerptChars, compact);
  const styleRules = compact
    ? [
        "1. 语言使用中文。",
        "2. titleZh 是论文英文标题的直接中文翻译；hook/problem/method/value/ending 这些字段是配音稿，不是屏幕标题。",
        "3. 每个字段写 1 到 2 句口语化短句，尽量自然。",
        "4. bullets 固定 3 条，每条 8 到 18 个汉字，不要句号。",
        "5. 只根据当前论文证据作答，不要借用其他论文的句式或结论。",
        "6. 只输出 JSON。",
      ]
    : [
        "1. 语言使用中文，面向短视频观众，不要像论文摘要翻译。",
        "2. titleZh 必须是论文英文标题的直接中文翻译，保留模型名、数据集名、系统名等专有名词英文，不要写成口号。",
        "3. hook / problem / method / value / ending 这些字段都是配音稿，要比屏幕文案更完整、更口语化。",
        "4. 每个字段写 1 到 2 句自然短句，适合真人配音，尽量控制在 28 到 68 个汉字。",
        "5. hook 要像前 3 秒开场，先说最核心的判断或最关键的发现，不要复述标题，不要空话。",
        "6. problem 必须说清楚当前研究卡在哪里，为什么这是个真实瓶颈。",
        "7. method 必须明确回答作者到底提出了什么新框架、新算法或新证明，不要只说“搭了一个框架”这种空句。",
        "8. value 必须明确回答这件事带来了什么判断、能力提升、理论结论或统一视角，不能只说“很有价值”。",
        "9. 如果是综述/框架型论文，强调它重新整理了什么、统一了什么坐标系。",
        "10. 如果是理论论文，强调它证明了什么边界或不可能性。",
        "11. 如果是方法论文，强调怎么做、解决了什么真实瓶颈、带来什么结果。",
        "12. bullets 固定 3 条，每条 8 到 18 个汉字，是给屏幕显示的要点，不要句号、不要长句。",
        "13. 避免空泛表达，例如“通过这套全面图谱”“值得进一步展开”。",
        "14. 不要捏造实验数字；不确定就说贡献，不说具体数值。",
        "15. 禁止直接粘贴英文摘要原句；必要时可以保留英文术语名，但必须先用中文解释它是什么。",
        "16. 禁止使用“先收藏”“值得一读”“推荐去看原论文”“先读论文再说”这类引流口吻；默认假设观众只看短视频也要理解主线。",
        "17. 只输出 JSON，不要 markdown，不要解释。",
        "18. 只允许根据当前论文证据作答，不要沿用别的论文话术、术语搭配或结论模板。",
        "19. 每个缩写第一次出现时，都必须补中文解释，例如“检索增强生成（RAG）”“大语言模型（LLM）”。",
        "20. 把这次请求视为完全独立的一篇论文，忽略之前处理过的任何论文、答案和表述习惯。",
      ];

  return [
    "你是一个 AI 论文总结专家兼短视频脚本总编，不是论文翻译器。",
    "请根据下面的论文证据，写出适合 5 页竖屏短视频的中文脚本 JSON。",
    "记住：hook/problem/method/value/ending 是朗读文案，bullets 是屏幕要点。",
    "输出格式必须与这个结构一致：",
    JSON.stringify(SHORT_RESPONSE_SCHEMA_EXAMPLE, null, 2),
    "",
    "写作要求：",
    ...styleRules,
    "",
    `论文类型提示：${evidence.mode}`,
    `论文标题：${paper.title}`,
    `论文编号：${paper.arxivId}`,
    `论文方向：${paper.categories.join(" / ")}`,
    `发布日期：${paper.publishedAt}`,
    "",
    `官方摘要：${evidence.sourceSummary}`,
    `关键摘要句：${evidence.abstract}`,
    `章节线索：${evidence.headings.join(" | ") || "N/A"}`,
    "",
    compact ? "引言摘录：" : "引言/动机摘录：",
    evidence.introSnippet || evidence.focusedExcerpt,
    "",
    compact ? "方法摘录：" : "方法/框架摘录：",
    evidence.methodSnippet || evidence.focusedExcerpt,
    "",
    compact ? "结果摘录：" : "结果/结论摘录：",
    evidence.resultSnippet || evidence.focusedExcerpt,
  ].join("\n");
};

const buildReviewPrompt = ({
  paper,
  context,
  draft,
  baseline,
}: {
  paper: SourcePaperForSummary;
  context: PaperSummaryContext;
  draft: SummaryDraft;
  baseline: SummaryDraft;
}) => {
  const evidence = buildEvidencePacket(paper, context, 2200, true);

  return [
    "你是 AI 论文短视频脚本的审稿编辑，专门负责删掉空话、英文直抄、引流口吻和串题内容。",
    "请审核下面这份中文脚本初稿是否真正抓住论文核心，再重写成更清楚、更像人话的版本。",
    "只输出合法 JSON。",
    "目标：",
    "1. titleZh 是英文标题的直接中文翻译；hook/problem/method/value/ending 是配音稿，不是屏幕标题，要口语化、信息完整。",
    "2. 先说最核心的判断，不要复述标题。",
    "3. 讲清问题、方法、价值，不要空话。",
    "4. method 必须回答作者到底做了什么新东西；value 必须回答这件事为什么重要。",
    "5. bullets 是幻灯片要点，不是完整句，每条 8 到 18 个汉字。",
    "6. 不要照抄英文摘要，不要堆术语，不要写“通过这套全面图谱”这类空泛句。",
    "7. 如果有更具体的核心判断，就优先说具体判断，不要说泛泛的大词。",
    "8. 禁止使用“值得看”“值得先读”“建议收藏”“推荐去读原论文”这类引流表达。",
    "9. 如果初稿里有长段英文原句，必须翻成中文再输出。",
    "10. 只能根据当前论文证据改写，不要沿用其他论文的句式或结论。",
    "11. 每个缩写第一次出现时都要补中文解释，例如“检索增强生成（RAG）”“大语言模型（LLM）”。",
    "12. 把这次请求视为单篇论文的独立审稿，不要继承上一条论文的任何口吻、判断或句式。",
    "13. titleZh 不要写成营销标题，直接翻译论文英文标题即可。",
    "",
    `论文类型提示：${evidence.mode}`,
    `标题：${paper.title}`,
    `摘要句：${evidence.abstract}`,
    `章节线索：${evidence.headings.join(" | ") || "N/A"}`,
    `方法/结论摘录：${evidence.methodSnippet || evidence.focusedExcerpt}`,
    `结果/结论摘录：${evidence.resultSnippet || evidence.focusedExcerpt}`,
    "",
    "保底事实草案（更偏技术锚点，可参考但不要照抄）：",
    JSON.stringify(baseline, null, 2),
    "",
    "当前初稿：",
    JSON.stringify(draft, null, 2),
  ].join("\n");
};

const isContextLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : `${error ?? ""}`;
  return (
    /400\b/.test(message) &&
    /(context size|context window|context length|exceeds the available context size|too many tokens|prompt is too long|n_keep|n_ctx)/i.test(message)
  );
};

const createContextLimitHint = (config: LmStudioSummaryConfig) =>
  [
    "LM Studio 上下文长度不足，当前请求没有继续自动收紧输入。",
    `请在 LM Studio 里调高该模型的 context length 后重试。`,
    `当前本地配置：LM_STUDIO_MODEL=${config.model}，LM_STUDIO_MAX_INPUT_CHARS=${config.maxInputChars}。`,
  ].join(" ");

export const summarizeWithLmStudio = async (
  paper: SourcePaperForSummary,
  context: PaperSummaryContext,
  config: LmStudioSummaryConfig,
): Promise<SummaryDraft> => {
  const paperMode = detectPaperMode(paper);
  const baselineDraft = buildRuleBasedSummaryDraft(paper, context);
  const technicalAnchors = extractTechnicalAnchors(paper, context);
  const evidenceArtifacts = extractEvidenceArtifacts(paper, context);
  const runSummaryRequest = async (
    compact = false,
    preferStructuredOutput = true,
    maxTokensOverride?: number,
    inputCharsOverride?: number,
  ) =>
    requestCompletion({
      config,
      maxTokens:
        maxTokensOverride ??
        (compact ? Math.min(config.maxOutputTokens, 1200) : config.maxOutputTokens),
      temperature: config.temperature,
      preferStructuredOutput,
      messages: [
        {
          role: "system",
          content:
            "You are an expert AI-paper summarizer for Chinese short-video scripts. Treat every request as stateless, use only the current paper evidence, never reuse text from other papers, explain abbreviations in Chinese on first mention, and return strict JSON.",
        },
        {
          role: "user",
          content: buildPrompt(
            paper,
            context,
            inputCharsOverride ?? (compact ? config.compactInputChars : config.maxInputChars),
            compact,
          ),
        },
      ],
    });

  const requestSummaryWithFallbacks = async () => {
    try {
      return await runSummaryRequest(false, true, config.maxOutputTokens, config.maxInputChars);
    } catch (error) {
      if (isContextLimitError(error)) {
        const baseMessage = error instanceof Error ? error.message : `${error ?? ""}`;
        throw new Error(`${createContextLimitHint(config)} 原始报错：${baseMessage}`);
      }

      throw error;
    }
  };

  const payload: ChatCompletionResponse = await requestSummaryWithFallbacks();

  let content = extractContent(payload);
  const reasoningContent = extractReasoningContent(payload);
  if (!content && reasoningContent) {
    content = extractFinalResponseFromReasoning(reasoningContent);
  }

  if (!content) {
    const fallbackPayload = await requestSummaryWithFallbacks();
    content = extractContent(fallbackPayload);
    const fallbackReasoning = extractReasoningContent(fallbackPayload);
    if (!content && fallbackReasoning) {
      content = extractFinalResponseFromReasoning(fallbackReasoning);
      if (!content) {
        const recoveredDraft = await recoverDraftFromMalformedResponse({
          config,
          raw: fallbackReasoning,
        });
        if (recoveredDraft) {
          const mergedRecoveredDraft = mergeDraftWithBaseline({
            draft: recoveredDraft,
            baseline: baselineDraft,
            anchors: technicalAnchors,
            evidenceArtifacts,
            paperMode,
          });
          validateDraft({draft: mergedRecoveredDraft});
          return mergedRecoveredDraft;
        }
      }
    }
  }

  if (!content) {
    throw new Error("LM Studio returned an empty completion");
  }

  let draft = await recoverDraftFromMalformedResponse({
    config,
    raw: content,
  });

  if (!draft) {
    throw new SyntaxError(
      `LM Studio returned non-parseable JSON. Preview: ${normalizeJsonText(content).slice(0, 240)}`,
    );
  }

  draft = parseDraft(JSON.stringify(draft));
  draft = mergeDraftWithBaseline({
    draft,
    baseline: baselineDraft,
    anchors: technicalAnchors,
    evidenceArtifacts,
    paperMode,
  });

  try {
    const reviewPayload = await requestCompletion({
      config,
      maxTokens: Math.min(config.maxOutputTokens, 1400),
      temperature: Math.min(config.temperature, 0.15),
      preferStructuredOutput: true,
      messages: [
        {
          role: "system",
          content:
            "You are an expert editor for Chinese AI-paper short-video scripts. Treat every request as stateless, remove fluff, English quote leakage, unexplained abbreviations, promotional wording, and cross-paper reuse. Return strict JSON only.",
        },
        {
          role: "user",
          content: buildReviewPrompt({
            paper,
            context,
            draft,
            baseline: baselineDraft,
          }),
        },
      ],
    });

    let reviewedContent = extractContent(reviewPayload);
    const reviewedReasoning = extractReasoningContent(reviewPayload);
    if (!reviewedContent && reviewedReasoning) {
      reviewedContent = extractFinalResponseFromReasoning(reviewedReasoning) || reviewedReasoning;
    }

    if (reviewedContent) {
      const reviewedDraft = await recoverDraftFromMalformedResponse({
        config,
        raw: reviewedContent,
      });
      if (reviewedDraft) {
        draft = mergeDraftWithBaseline({
          draft: reviewedDraft,
          baseline: baselineDraft,
          anchors: technicalAnchors,
          evidenceArtifacts,
          paperMode,
        });
      }
    }
  } catch {
    // Keep the first successful draft if the editorial pass fails.
  }

  const polishedDraft = polishSummaryDraft({
    draft,
    paperMode,
  });
  const polishedBaseline = polishSummaryDraft({
    draft: baselineDraft,
    paperMode,
  });

  const finalizedDraft = mergeDraftWithBaseline({
    draft: polishedDraft,
    baseline: polishedBaseline,
    anchors: technicalAnchors,
    evidenceArtifacts,
    paperMode,
  });

  validateDraft({draft: finalizedDraft});

  return finalizedDraft;
};
