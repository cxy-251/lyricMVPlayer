import type {SummaryModeId} from "@paper-to-video/shared-types";
import {buildRuleBasedSummaryDraft, detectPaperMode, extractAbstractSentences, extractSectionHeadings} from "./rule-based-summary.service";
import {polishSummaryDraft} from "./summary-polish.service";
// Call promptloom backend instead of lm-studio.service
import type {LmStudioSummaryConfig, PaperMode, SourcePaperForSummary, SummaryDraft, SummaryResult} from "./summarizer.types";

type SummarizePaperOptions = {
  paper: SourcePaperForSummary;
  rawText: string;
  summaryMode: SummaryModeId;
  lmStudioConfig?: LmStudioSummaryConfig;
};

const SURVEY_METHOD_SIGNALS = [/L1 Predictor/i, /L2 Simulator/i, /L3 Evolver/i, /levels?\s*[×x]\s*laws/i, /physical/i, /digital/i, /social/i, /scientific/i];
const SURVEY_VALUE_SIGNALS = [/400/u, /100/u, /RL/i, /GUI/i, /multi-agent/i, /scientific/i];
const SURVEY_PROBLEM_SIGNALS = [/world model/i, /一步/u, /预测/u, /模拟/u, /比较/u, /定义/u];
const THEORY_METHOD_SIGNALS = [/plan existence/i, /modal depth/i, /postcondition/i, /不可判定/u];
const THEORY_VALUE_SIGNALS = [/理论边界/u, /不可判定/u, /通用/u, /可计算/u];
const THEORY_PROBLEM_SIGNALS = [/plan existence/i, /模态/u, /知识/u, /动作/u, /目标/u];
const GENERIC_PHRASES = [/统一坐标/u, /双轴框架/u, /画了张清晰地图/u, /方便.*理解/u, /提供.*评估/u, /很重要/u] as const;
const GENERIC_BULLET_PATTERNS = [/统一坐标系/u, /助力/u, /提供.*评估/u, /方便.*理解/u] as const;
const PROMOTIONAL_PATTERNS = [/收藏/u, /值得先读/u, /值得一读/u, /推荐.*论文/u, /先读.*论文/u, /值得看/u] as const;
const TOO_SHORT_RATIO = 0.72;

const hasSignal = (value: string, patterns: readonly RegExp[]) => patterns.some((pattern) => pattern.test(value));
const isWeakNarration = (value: string) => !value || value.trim().length < 6 || /^[.。…\s]+$/u.test(value.trim());
const isTooShortComparedToBaseline = (value: string, baseline: string) => value.trim().length < Math.floor(baseline.trim().length * TOO_SHORT_RATIO);
const hasDanglingEnding = (value: string) =>
  /(?:[和与及]\s*(?:[A-Za-z][A-Za-z0-9-]*\s*){1,4}|[和与及])$/u.test(value.trim()) ||
  /(?:，|；|:|：)\s*$/.test(value.trim());

const reinforceWithRuleBasedBaseline = ({
  draft,
  baseline,
  paperMode,
}: {
  draft: SummaryDraft;
  baseline: SummaryDraft;
  paperMode: PaperMode;
}): SummaryDraft => {
  const nextDraft: SummaryDraft = {
    ...draft,
    bullets: [...draft.bullets],
  };

  if (!nextDraft.titleZh.trim()) {
    nextDraft.titleZh = baseline.titleZh;
  }

  if (isWeakNarration(nextDraft.hook)) {
    nextDraft.hook = baseline.hook;
  }

  if (isWeakNarration(nextDraft.ending) || PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(nextDraft.ending))) {
    nextDraft.ending = baseline.ending;
  }

  if (PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(nextDraft.value))) {
    nextDraft.value = baseline.value;
  }

  if (hasDanglingEnding(nextDraft.method) || isTooShortComparedToBaseline(nextDraft.method, baseline.method)) {
    nextDraft.method = baseline.method;
  }

  if (hasDanglingEnding(nextDraft.value) || isTooShortComparedToBaseline(nextDraft.value, baseline.value)) {
    nextDraft.value = baseline.value;
  }

  if (paperMode === "survey") {
    if (
      !hasSignal(nextDraft.problem, SURVEY_PROBLEM_SIGNALS) ||
      GENERIC_PHRASES.some((pattern) => pattern.test(nextDraft.problem)) ||
      isTooShortComparedToBaseline(nextDraft.problem, baseline.problem)
    ) {
      nextDraft.problem = baseline.problem;
    }
    if (
      !hasSignal(nextDraft.method, SURVEY_METHOD_SIGNALS) ||
      GENERIC_PHRASES.some((pattern) => pattern.test(nextDraft.method)) ||
      isTooShortComparedToBaseline(nextDraft.method, baseline.method)
    ) {
      nextDraft.method = baseline.method;
    }
    if (
      !hasSignal(nextDraft.value, SURVEY_VALUE_SIGNALS) ||
      GENERIC_PHRASES.some((pattern) => pattern.test(nextDraft.value)) ||
      isTooShortComparedToBaseline(nextDraft.value, baseline.value)
    ) {
      nextDraft.value = baseline.value;
    }
  }

  if (paperMode === "theory") {
    if (!hasSignal(nextDraft.problem, THEORY_PROBLEM_SIGNALS) || isTooShortComparedToBaseline(nextDraft.problem, baseline.problem)) {
      nextDraft.problem = baseline.problem;
    }
    if (!hasSignal(nextDraft.method, THEORY_METHOD_SIGNALS) || isTooShortComparedToBaseline(nextDraft.method, baseline.method)) {
      nextDraft.method = baseline.method;
    }
    if (!hasSignal(nextDraft.value, THEORY_VALUE_SIGNALS) || isTooShortComparedToBaseline(nextDraft.value, baseline.value)) {
      nextDraft.value = baseline.value;
    }
  }

  if (nextDraft.bullets.length < 3) {
    nextDraft.bullets = baseline.bullets;
  } else if (nextDraft.bullets.some((bullet) => GENERIC_BULLET_PATTERNS.some((pattern) => pattern.test(bullet)))) {
    nextDraft.bullets = baseline.bullets;
  }

  return nextDraft;
};

export const summarizePaper = async ({
  paper,
  rawText,
  summaryMode,
  lmStudioConfig,
}: SummarizePaperOptions): Promise<SummaryResult> => {
  const paperMode = detectPaperMode(paper);
  const abstractSentences = extractAbstractSentences(rawText, paper.summary);
  const sectionHeadings = extractSectionHeadings(rawText);
  const context = {
    rawText,
    abstractSentences,
    sectionHeadings,
  };
  const baselineDraft = polishSummaryDraft({
    draft: buildRuleBasedSummaryDraft(paper, context),
    paperMode,
  });

  if (summaryMode === "lm-studio") {
    if (!lmStudioConfig) {
      throw new Error("LM Studio summary mode requires lmStudioConfig");
    }

    const response = await fetch("http://127.0.0.1:8000/api/promptloom/workflow", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        workflow_id: "paper_summary.v1",
        input_data: {paper_context: {sourceSummary: paper.summary, abstract: context.abstractSentences.join(" "), headings: context.sectionHeadings}},
        runtime_options: lmStudioConfig
      })
    });
    const scriptDraft = (await response.json()) as SummaryDraft;
    
    return {
      summaryMode,
      scriptDraft: reinforceWithRuleBasedBaseline({
        draft: scriptDraft,
        baseline: baselineDraft,
        paperMode,
      }),
      abstractSentences,
      sectionHeadings,
      modelName: lmStudioConfig.model,
    };
  }

  return {
    summaryMode: "rule-based",
    scriptDraft: baselineDraft,
    abstractSentences,
    sectionHeadings,
  };
};
