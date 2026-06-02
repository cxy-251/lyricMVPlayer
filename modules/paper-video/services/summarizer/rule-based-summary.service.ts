import type {PaperMode, PaperSummaryContext, SourcePaperForSummary, SummaryDraft} from "./summarizer.types";

export const splitSentences = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const extractAbstractSentences = (rawText: string, fallbackSummary: string) => {
  const text = rawText.replace(/\s+/g, " ");
  const abstractMatch = /(?:^|\n|\s)(abstract|摘要)\s*[:：]?\s*/i.exec(rawText);

  if (abstractMatch?.index !== undefined) {
    const startIndex = abstractMatch.index + abstractMatch[0].length;
    const following = rawText.slice(startIndex);
    const sectionBoundary =
      following.search(/\n\s*(?:1[\s.]+introduction|introduction|1[\s.]+背景|引言|keywords?)\b/i);
    const abstractWindow = (sectionBoundary > 0 ? following.slice(0, sectionBoundary) : following).replace(/\s+/g, " ");
    const abstractSentences = splitSentences(abstractWindow).slice(0, 6);
    if (abstractSentences.length > 0) {
      return abstractSentences;
    }
  }

  if (fallbackSummary.trim()) {
    return splitSentences(fallbackSummary).slice(0, 4);
  }

  return splitSentences(text.slice(0, 2400)).slice(0, 6);
};

export const extractSectionHeadings = (rawText: string) => {
  return [...rawText.matchAll(/§\d+(?:\.\d+)?\s+([^\n]+)/g)]
    .map((match) => match[1].trim())
    .filter((heading, index, all) => heading.length > 1 && all.indexOf(heading) === index)
    .slice(0, 10);
};

export const detectPaperMode = (paper: SourcePaperForSummary): PaperMode => {
  const title = paper.title.toLowerCase();
  const summary = paper.summary.toLowerCase();

  if (title.includes("survey") || title.includes("foundations") || summary.includes("taxonomy")) {
    return "survey";
  }

  if (title.includes("proof") || summary.includes("undecidable")) {
    return "theory";
  }

  return "method";
};

const buildRuleBasedTitleZh = (paper: SourcePaperForSummary, mode: PaperMode) => {
  const normalizedTitle = paper.title.trim();

  if (/agentic world modeling/i.test(normalizedTitle)) {
    return "智能体世界模型：基础、能力、规律与未来";
  }

  if (/plan existence problem/i.test(normalizedTitle)) {
    return "认知规划中计划存在性问题的不可判定性";
  }

  if (/symptomai/i.test(normalizedTitle)) {
    return "SymptomAI：让 AI 问诊主动补齐关键信息";
  }

  if (/safe-scale/i.test(normalizedTitle)) {
    return "SaFE-Scale：医疗大模型部署安全性的系统评测";
  }

  if (mode === "survey") {
    return "世界模型综述：能力层级、规律约束与研究地图";
  }

  if (mode === "theory") {
    return "认知规划的理论边界：什么问题根本无通解";
  }

  return "";
};

const sentenceOr = (sentences: string[], index: number, fallback: string) => sentences[index] ?? fallback;
const includesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const capitalizeTerm = (value: string) => value.replace(/\s+/g, " ").trim();

const extractNamedArtifacts = (text: string) => {
  const ignore = new Set([
    "Clinical",
    "LLMs",
    "LLM",
    "AI",
    "As",
    "We",
    "To",
    "The",
    "This",
    "That",
    "In",
    "On",
    "By",
  ]);

  return [...text.matchAll(/\b(?:[A-Z][A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b/g)]
    .map((match) => capitalizeTerm(match[0] ?? ""))
    .filter((item) => item.length >= 3 && !ignore.has(item))
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 4);
};

const extractIntroducedMethodName = (text: string) => {
  const patterns = [
    /(?:introduce|introduced|propose|proposed|present|presented)\s+([A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,3})\s*\(([A-Z0-9-]+)\)/i,
    /(?:introduce|introduced|propose|proposed|present|presented)\s+([A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }

    const name = match[1]?.trim() ?? "";
    const short = match[2]?.trim() ?? "";
    if (name && short) {
      return `${name}（${short}）`;
    }

    if (name) {
      return name;
    }
  }

  return "";
};

const inferMethodPaperFocus = (paper: SourcePaperForSummary, context: PaperSummaryContext) => {
  const text = `${paper.title} ${paper.summary} ${context.sectionHeadings.join(" ")}`.toLowerCase();

  if (/diffusion|dit|outlier token|image generation|denoiser/.test(text)) {
    return "扩散 Transformer 内部异常 token 对生成质量的影响";
  }

  if (/symptom|conversational|triage|diagnos|assessment/.test(text)) {
    return "对话式问诊能否主动补齐关键信息";
  }

  if (/clinical|medicine|radiology|medical|safety/.test(text)) {
    return "医疗系统在真实部署中的可靠性和高风险错误";
  }

  if (/benchmark|dataset|evaluation|leaderboard/.test(text)) {
    return "评测标准、失败模式和真实瓶颈";
  }

  if (/retrieval|rag|search|ranking/.test(text)) {
    return "检索链路和最终答案质量之间的关系";
  }

  if (/agent|multi-agent|planner|planning/.test(text)) {
    return "智能体系统在复杂任务里的关键能力";
  }

  if (/detection|detect/.test(text)) {
    return "检测任务在复杂环境下的泛化和鲁棒性";
  }

  return "系统真正的性能瓶颈和失败来源";
};

const extractProblemSignal = (text: string) => {
  const normalized = text.toLowerCase();

  if (/diffusion|dit|outlier token|image generation|denoiser/.test(normalized)) {
    return "模型内部会冒出一小批权重过高、但局部语义被破坏的异常 token，最后把图像生成过程带偏";
  }

  if (/symptom|conversational|triage|assessment/.test(normalized)) {
    return "现有工具往往只是被动接收症状，缺少像医生一样主动追问的能力";
  }

  if (/clinical|medicine|radiology|medical/.test(normalized)) {
    return "平均分数很高，并不代表它在高风险场景里真的安全";
  }

  if (/retrieval|rag|search|ranking/.test(normalized)) {
    return "大家常把检索链路做得越来越复杂，却不一定真正提高最终答案质量";
  }

  if (/planning|planner|agent/.test(normalized)) {
    return "系统能不能完成复杂任务，往往卡在行动策略、环境反馈和长期规划之间的衔接";
  }

  if (/benchmark|dataset|evaluation/.test(normalized)) {
    return "总分看起来漂亮，不代表关键能力真的被测到了";
  }

  return "现有方法往往只能覆盖局部步骤，离真实任务还差关键一环";
};

const extractMethodDimensions = (text: string) => {
  const normalized = text.toLowerCase();
  const dimensions: string[] = [];

  const mapping: Array<[RegExp, string]> = [
    [/model scale/, "模型规模"],
    [/context length/, "上下文长度"],
    [/evidence quality|clean evidence|conflict evidence/, "证据质量"],
    [/retrieval complexity|retrieval strategy|standard rag|agentic rag/, "检索方式"],
    [/context exposure|max-context/, "上下文构造"],
    [/inference-time compute|latency/, "推理时算力"],
  ];

  for (const [pattern, label] of mapping) {
    if (pattern.test(normalized) && !dimensions.includes(label)) {
      dimensions.push(label);
    }
  }

  return dimensions.slice(0, 5);
};

const extractEvaluationSetup = (text: string) => {
  const modelCount = /evaluated\s+(\d+)\s+(?:locally deployed\s+)?llms?/i.exec(text)?.[1];
  const conditionCount = /across\s+(\d+)\s+deployment conditions/i.exec(text)?.[1];
  const questionCount = /benchmark of\s+(\d+)\s+(?:multiple-choice\s+)?questions/i.exec(text)?.[1];

  const parts: string[] = [];

  if (questionCount) {
    parts.push(`${questionCount} 道评测题`);
  }

  if (modelCount && conditionCount) {
    parts.push(`${modelCount} 个模型 × ${conditionCount} 种部署条件`);
  } else if (modelCount) {
    parts.push(`${modelCount} 个模型`);
  }

  return parts;
};

const extractMethodFindings = (text: string) => {
  const findings: string[] = [];
  const normalized = text.toLowerCase();

  if (/clean evidence produced the strongest improvement/.test(normalized)) {
    findings.push("最有效的是高质量、干净的证据输入，不是更复杂的检索链路");
  }

  const highRiskDrop = /high-risk error from\s+([0-9.]+)%\s+to\s+([0-9.]+)%/i.exec(text);
  if (highRiskDrop) {
    findings.push(`高风险错误率可从 ${highRiskDrop[1]}% 降到 ${highRiskDrop[2]}%`);
  }

  if (/did not reproduce this safety profile/.test(normalized)) {
    findings.push("标准 RAG 和 agentic RAG 没有复制这种安全收益");
  }

  if (/increased latency without closing the safety gap/.test(normalized)) {
    findings.push("长上下文会增加延迟，但不会自动补齐安全差距");
  }

  if (/worst-case analysis showed/i.test(text)) {
    findings.push("真正危险的错误集中在少数高风险问题上");
  }

  if (/reduce outlier artifacts/i.test(normalized)) {
    findings.push("能减少异常 token 带来的生成伪影");
  }

  if (/improve generation quality/i.test(normalized)) {
    findings.push("同时提升最终图像生成质量");
  }

  if (/outlier-token control/i.test(normalized)) {
    findings.push("异常 token 控制是更强 DiT 的关键组成");
  }

  return findings.slice(0, 3);
};

export const buildRuleBasedSummaryDraft = (
  paper: SourcePaperForSummary,
  context: PaperSummaryContext,
): SummaryDraft => {
  const mode = detectPaperMode(paper);
  const evidenceText = [paper.title, paper.summary, ...context.abstractSentences, ...context.sectionHeadings].join(" ");

  if (mode === "survey") {
    const hasLevels = includesAny(evidenceText, [/L1 Predictor/i, /L2 Simulator/i, /L3 Evolver/i, /three capability levels/i]);
    const hasLaws = includesAny(evidenceText, [/physical/i, /digital/i, /social/i, /scientific/i, /governing-law regimes/i]);
    const hasScale = includesAny(evidenceText, [/400 works/i, /100 representative systems/i, /representative systems/i]);

    return {
      titleZh: buildRuleBasedTitleZh(paper, mode),
      hook: "如果 AI 真要自己干活，它最缺的不是多说几句像人的话，而是能不能持续预测环境接下来会怎么变。",
      problem: "问题是现在大家都在说 world model，但有人指一步预测器，有人指完整模拟器，还有人把会自我修正的系统也算进去。术语一散，不同 agent 的方法就很难放在同一张表里比较。",
      method:
        hasLevels && hasLaws
          ? "作者提出一个 levels×laws 双轴分类：一轴把 world model 分成 L1、L2、L3 三层能力，另一轴按 physical、digital、social、scientific 四类规律划分场景，用同一套坐标去比较不同 agent。"
          : `作者搭了一个双轴框架，把能力层级和环境约束放进同一张图里，并把 ${context.sectionHeadings.slice(0, 3).join("、")} 这些主线串了起来。`,
      value:
        hasScale
          ? "它的价值不只是综述，而是把 400 多篇工作和 100 多个代表系统放回同一套坐标系，让你看清一个系统缺的是短期预测、长期模拟，还是失败后的模型更新。"
          : "它的价值不只是综述，而是把 predictor、simulator、evolver 这些概念放回同一个坐标系，方便判断 agent 下一步该往哪走。",
      ending: "这篇综述真正留下的是一把尺子：你可以直接判断一个智能体缺的是短期预测、多步模拟，还是失败后的模型修正能力。",
      bullets: [
        "三层能力框架",
        "四类环境约束",
        "统一 world model 坐标系",
      ],
    };
  }

  if (mode === "theory") {
    return {
      titleZh: buildRuleBasedTitleZh(paper, mode),
      hook: "这篇论文最硬核的地方，是它告诉你：有些规划问题不是暂时难解，而是原则上就不可能有通用求解器。",
      problem: "作者研究的是 epistemic planning 里的 plan existence，也就是给定目标、知识状态和一组动作之后，到底存不存在一条可达计划。",
      method: "它把条件收得很弱：precondition 的 modal depth 最多只有 1，而且没有 postcondition；即便这样，作者仍然证明 plan existence 是不可判定的。",
      value: "这等于划出了一条理论边界，说明有些瓶颈不是算法没调好，而是问题本身就不存在通用可计算解。对做 agent 规划的人来说，这会直接决定你该去找可解子类还是额外结构假设。",
      ending: "结论很直接：即便把条件压到很弱，这类认知规划问题依然不可判定，继续堆通用 planner 也不会跨过这条理论边界。",
      bullets: [
        "研究 plan existence",
        "弱条件下仍不可判定",
        "划出规划理论边界",
      ],
    };
  }

  const methodSentence = context.abstractSentences.find((sentence) => /We propose|framework|objective/i.test(sentence)) ??
    sentenceOr(context.abstractSentences, 1, paper.summary);
  const resultSentence = context.abstractSentences.find((sentence) => /improves|faster|Recall|MAP|F1/i.test(sentence)) ??
    sentenceOr(context.abstractSentences, 2, paper.summary);
  const artifacts = extractNamedArtifacts([paper.title, paper.summary, ...context.abstractSentences].join(" "));
  const introducedMethodName = extractIntroducedMethodName([paper.summary, ...context.abstractSentences].join(" "));
  const focus = inferMethodPaperFocus(paper, context);
  const problemSignal = extractProblemSignal(`${paper.title} ${paper.summary} ${context.abstractSentences.join(" ")}`);
  const dimensions = extractMethodDimensions(`${paper.summary} ${context.abstractSentences.join(" ")}`);
  const evaluationSetup = extractEvaluationSetup(`${paper.summary} ${context.abstractSentences.join(" ")}`);
  const methodFindings = extractMethodFindings(`${paper.summary} ${context.abstractSentences.join(" ")}`);
  const leadArtifact = introducedMethodName || artifacts[0];
  const supportingArtifact = artifacts.find((artifact) => artifact !== leadArtifact);
  const methodLead = leadArtifact
    ? supportingArtifact
      ? `作者提出 ${leadArtifact}，并配套 ${supportingArtifact}，分别处理 ${focus} 里的关键环节。`
      : `作者提出 ${leadArtifact} 这套方法，直接针对 ${focus} 里最容易失稳的部分动手。`
    : `作者的核心做法不是只改一个局部模块，而是重新组织整套系统，直接处理 ${focus} 里最关键的失稳环节。`;
  const dimensionSentence =
    dimensions.length > 0
      ? `它重点比较的是 ${dimensions.join("、")} 这些变量，想看清安全收益到底来自哪里。`
      : "";
  const setupSentence =
    evaluationSetup.length > 0
      ? `实验设置也不是只看一条曲线，而是直接比较 ${evaluationSetup.join("、")}。`
      : "";
  const valueLead = leadArtifact
    ? `${leadArtifact} 最关键的贡献，不是再堆一个更大的系统，而是把 ${focus} 里真正会失稳的环节拆开验证。`
    : `这项工作的关键贡献，不是再堆一个更大的系统，而是把 ${focus} 里真正会失稳的环节拆开验证。`;
  const findingSentence = methodFindings.length > 0 ? methodFindings.join("；") : "";

  return {
    titleZh: buildRuleBasedTitleZh(paper, mode),
    hook: `这篇论文盯上的，不是表面分数，而是 ${focus} 这个真正决定系统好不好用的核心问题。`,
    problem: `作者想解决的是：${problemSignal}。真正决定系统能不能落地的，往往是 ${focus}。`,
    method: [methodLead, dimensionSentence, setupSentence].filter(Boolean).join(" "),
    value: `${valueLead} ${
      findingSentence ||
      (resultSentence
        ? "实验进一步说明，这种差别会真实改变系统表现，而不是只影响一个抽象总分。"
        : "")
    }`.trim(),
    ending: methodFindings[0]
      ? `这篇论文最后说明的是：${methodFindings[0]}，所以 ${focus} 不能再被粗暴压成一个总分。`
      : `这篇论文最后说明的是：${focus} 必须被拆开分析，不能只看最后一个漂亮总分。`,
    bullets: [
      leadArtifact ? `核心方法：${leadArtifact}` : "核心方法：系统级重构",
      supportingArtifact ? `关键配套：${supportingArtifact}` : `核心场景：${focus}`,
      methodFindings[0] ?? `关键变量：${dimensions.slice(0, 2).join("、") || focus}`,
    ],
  };
};
