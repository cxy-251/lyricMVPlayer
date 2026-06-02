import type {PaperMode, SummaryDraft} from "./summarizer.types";

const stripOuterQuotes = (value: string) =>
  value
    .trim()
    .replace(/[“”]/g, "\"")
    .replace(/^"(.+)"$/u, "$1")
    .replace(/^'(.+)'$/u, "$1");

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const REASONING_MARKERS = [
  /\bWait\b/i,
  /\bLet's\b/i,
  /\bI should\b/i,
  /\bTo be safe\b/i,
  /\bNeed to check\b/i,
  /\bRecount\b/i,
  /\bcharacter count\b/i,
  /\bchars?\b/i,
] as const;

const stripReasoningLeak = (value: string) => {
  for (const marker of REASONING_MARKERS) {
    const match = marker.exec(value);
    if (match?.index !== undefined && match.index > 0) {
      return value.slice(0, match.index).trim();
    }
  }

  return value;
};

const removeWeakOpeners = (value: string) =>
  value
    .replace(/^这篇论文(主要|核心)?(是在|想要|试图)?/u, "")
    .replace(/^作者(主要|核心)?(提出|讨论|研究)的是?/u, "")
    .trim();

const trimByClauses = (value: string, maxClauses: number) => {
  const clauses = value
    .split(/[。！？]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (clauses.length <= maxClauses) {
    return clauses.join("。");
  }

  return clauses.slice(0, maxClauses).join("。");
};

const trimByChars = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  const trimmed = value.slice(0, limit).replace(/[，、；：,.!?！？]+$/u, "").trim();
  return trimmed || value.slice(0, limit);
};

const normalizePunctuation = (value: string) =>
  value
    .replace(/[。]{2,}/gu, "。")
    .replace(/[，]{2,}/gu, "，")
    .replace(/[；]{2,}/gu, "；")
    .trim();

const expandTerms = (value: string) => {
  return value
    .replace(/(?<![（(])\bagentic RAG\b/gi, "__AGENTIC_RAG__")
    .replace(/(?<![（(])\bRAG\b/gi, "__RAG__")
    .replace(/(?<![（(])\bLLMs\b/g, "__LLMS__")
    .replace(/(?<![（(])\bLLM\b/g, "__LLM__")
    .replace(/(?<![（(])\bGUI agents?\b/gi, "__GUI_AGENT__")
    .replace(/(?<![（(])\bRL\b/g, "__RL__")
    .replace(/(?<![（(])\bAI agents?\b/gi, "__AI_AGENT__")
    .replace(/(?<![（(])\bworld model\b/gi, "__WORLD_MODEL__")
    .replace(/(?<![（(])\bplan existence\b/gi, "__PLAN_EXISTENCE__")
    .replace(/(?<![（(])\bepistemic planning\b/gi, "__EPISTEMIC_PLANNING__")
    .replace(/(?<![（(])\bpointed Kripke model\b/gi, "__POINTED_KRIPKE__")
    .replace(/(?<![（(])\bepistemic actions?\b/gi, "__EPISTEMIC_ACTION__")
    .replace(/(?<![（(])\bmodal depth\b/gi, "__MODAL_DEPTH__")
    .replace(/(?<![（(])\bpostconditions?\b/gi, "__POSTCONDITION__")
    .replace(/(?<![（(])\brollouts?\b/gi, "__ROLLOUT__")
    .replace(/__AGENTIC_RAG__/g, "主动规划式检索增强生成（agentic RAG）")
    .replace(/__RAG__/g, "检索增强生成（RAG）")
    .replace(/__LLMS__/g, "大语言模型（LLM）")
    .replace(/__LLM__/g, "大语言模型（LLM）")
    .replace(/__GUI_AGENT__/g, "图形界面智能体（GUI agent）")
    .replace(/__RL__/g, "强化学习（RL）")
    .replace(/__AI_AGENT__/g, "AI 智能体")
    .replace(/__WORLD_MODEL__/g, "世界模型")
    .replace(/__PLAN_EXISTENCE__/g, "计划存在性")
    .replace(/__EPISTEMIC_PLANNING__/g, "认知规划（epistemic planning）")
    .replace(/__POINTED_KRIPKE__/g, "带真实世界指针的知识状态图（pointed Kripke model）")
    .replace(/__EPISTEMIC_ACTION__/g, "认知动作（epistemic action）")
    .replace(/__MODAL_DEPTH__/g, "模态深度（modal depth）")
    .replace(/__POSTCONDITION__/g, "后置条件（postcondition）")
    .replace(/__ROLLOUT__/g, "多步推演")
    .replace(/大语言模型（(?:大语言模型（)+LLM）(?:）)+/g, "大语言模型（LLM）")
    .replace(/主动规划式检索增强生成（agentic\s+检索增强生成（RAG））/g, "主动规划式检索增强生成（agentic RAG）")
    .replace(/标准\s+检索增强生成（RAG）/g, "标准检索增强生成（RAG）");
};

const rewriteWeakEnding = (value: string) =>
  value
    .replace(/建议你先收藏起来/gu, "这篇论文的主线已经很明确")
    .replace(/建议先收藏起来/gu, "这篇论文的主线已经很明确")
    .replace(/建议先收藏/gu, "这篇论文的主线已经很明确")
    .replace(/值得收藏起来/gu, "这篇论文的主线已经很明确")
    .replace(/值得先读/gu, "这篇论文的重点已经讲清楚")
    .replace(/值得一读/gu, "这篇论文的重点已经讲清楚")
    .replace(/值得一看/gu, "这篇论文的重点已经讲清楚")
    .replace(/值得看/gu, "这篇论文的重点已经讲清楚")
    .replace(/看完这篇[，,]?\s*你(?:就)?会知道/gu, "这篇论文真正说明的是")
    .replace(/看完你(?:就)?会知道/gu, "真正关键的是")
    .replace(/看完你(?:就)?能抓住这篇论文的主线/gu, "这篇论文的主线是");

const polishTitleTranslation = (value: string) =>
  trimByChars(
    normalizePunctuation(
      collapseWhitespace(stripOuterQuotes(value))
        .replace(/^\s*中文标题\s*[:：]\s*/u, "")
        .replace(/^\s*标题\s*[:：]\s*/u, "")
        .replace(/^\s*论文标题\s*[:：]\s*/u, "")
        .replace(/[“”]/g, "")
        .replace(/\s*:\s*/g, "：")
        .replace(/\s*-\s*/g, " - ")
        .trim(),
    ),
    42,
  );

const polishSentence = ({
  value,
  mode,
}: {
  value: string;
  mode: "hook" | "problem" | "method" | "value" | "ending";
}) => {
  const cleaned = collapseWhitespace(stripOuterQuotes(value))
    .replace(/AI智能体/gu, "AI 智能体")
    .replace(/\s*（\s*/g, "（")
    .replace(/\s*）\s*/g, "）")
    .replace(/\s*×\s*/g, "×");

  const deLeaked = expandTerms(stripReasoningLeak(cleaned));
  const endingNormalized = mode === "ending" ? rewriteWeakEnding(deLeaked) : deLeaked;
  const valueNormalized =
    mode === "value"
      ? endingNormalized
          .replace(/^它的价值不只是综述/u, "这不只是综述")
          .replace(/^它的价值不只是/u, "它真正的价值在于")
      : endingNormalized;
  const clauseLimited = trimByClauses(valueNormalized, mode === "ending" ? 1 : 2);
  const deFluffed = normalizePunctuation(removeWeakOpeners(clauseLimited));
  const maxChars =
    mode === "hook"
      ? 92
      : mode === "ending"
        ? 72
        : mode === "method" || mode === "value"
          ? 220
          : 156;

  return trimByChars(deFluffed || clauseLimited || cleaned, maxChars);
};

const polishBullet = (value: string) =>
  trimByChars(
    stripReasoningLeak(
      collapseWhitespace(stripOuterQuotes(value))
      .replace(/^[-*•]\s*/u, "")
      .replace(/[。；;！!？?]+$/u, "")
      .trim(),
    ),
    32,
  );

const isUsableBullet = (value: string) => {
  if (!value || value.length < 4) {
    return false;
  }

  if (REASONING_MARKERS.some((marker) => marker.test(value))) {
    return false;
  }

  const asciiCount = (value.match(/[A-Za-z]/g) ?? []).length;
  return asciiCount <= Math.max(4, Math.floor(value.length / 4));
};

const buildFallbackBullets = (draft: SummaryDraft) => {
  const candidates = [draft.method, draft.value, draft.problem]
    .flatMap((text) => text.split(/[，。；]/u))
    .map((item) => polishBullet(item))
    .filter((item) => item.length >= 6);

  return candidates.slice(0, 3);
};

const toDisplaySentence = ({
  value,
  mode,
}: {
  value: string;
  mode: "hook" | "problem" | "method" | "value" | "ending";
}) => {
  const spoken = polishSentence({value, mode});
  const firstClause = spoken
    .split(/[，；：]/u)
    .map((item) => item.trim())
    .filter(Boolean)[0] ?? spoken;

  const noTrail = firstClause
    .replace(/(其实|本质上|更像是|说白了|换句话说)/gu, "")
    .replace(/[。！？!?]+$/u, "")
    .trim();

  const maxChars =
    mode === "hook"
      ? 24
      : mode === "ending"
        ? 22
        : 20;

  return trimByChars(noTrail || spoken, maxChars);
};

export const polishSummaryDraft = ({
  draft,
  paperMode,
}: {
  draft: SummaryDraft;
  paperMode: PaperMode;
}): SummaryDraft => {
  const bullets = draft.bullets
    .map((item) => polishBullet(item))
    .filter((item, index, all) => isUsableBullet(item) && all.indexOf(item) === index);

  const fallbackBullets = buildFallbackBullets(draft);
  const normalizedBullets = [...bullets, ...fallbackBullets].slice(0, 3);

  const modeAwareEnding =
    paperMode === "survey" && !/框架|坐标系|全景/u.test(draft.ending)
      ? `${draft.ending} 它更像进入这个方向的一张路线图。`
      : draft.ending;

  return {
    titleZh: polishTitleTranslation(draft.titleZh),
    hook: polishSentence({value: draft.hook, mode: "hook"}),
    problem: polishSentence({value: draft.problem, mode: "problem"}),
    method: polishSentence({value: draft.method, mode: "method"}),
    value: polishSentence({value: draft.value, mode: "value"}),
    ending: polishSentence({value: modeAwareEnding, mode: "ending"}),
    bullets:
      normalizedBullets.length >= 3
        ? normalizedBullets
        : [
            ...normalizedBullets,
            ...["核心问题更清楚", "方法结构更明确", "价值判断更直接"],
          ].slice(0, 3),
  };
};

export const buildDisplayDraft = ({
  draft,
  paperMode,
}: {
  draft: SummaryDraft;
  paperMode: PaperMode;
}): SummaryDraft => {
  const polished = polishSummaryDraft({draft, paperMode});
  const bullets = polished.bullets
    .map((item) => polishBullet(item))
    .filter((item, index, all) => isUsableBullet(item) && all.indexOf(item) === index)
    .slice(0, 3);

  return {
    titleZh: polished.titleZh,
    hook: toDisplaySentence({value: polished.hook, mode: "hook"}),
    problem: toDisplaySentence({value: polished.problem, mode: "problem"}),
    method: toDisplaySentence({value: polished.method, mode: "method"}),
    value: toDisplaySentence({value: polished.value, mode: "value"}),
    ending: toDisplaySentence({value: polished.ending, mode: "ending"}),
    bullets:
      bullets.length >= 3
        ? bullets
        : [
            ...bullets,
            ...["核心问题更清楚", "方法结构更明确", "价值判断更直接"],
          ].slice(0, 3),
  };
};
