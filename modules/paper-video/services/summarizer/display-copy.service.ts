import {buildRuleBasedSummaryDraft, detectPaperMode} from "./rule-based-summary.service";
import {polishSummaryDraft} from "./summary-polish.service";
import type {
  DisplaySceneDraft,
  DisplayScriptDraft,
  NarrationScriptDraft,
  PaperSummaryContext,
  SourcePaperForSummary,
  SummaryDraft,
} from "./summarizer.types";

const cleanText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/(?<![（(])\bagentic RAG\b/gi, "__AGENTIC_RAG__")
    .replace(/(?<![（(])\bRAG\b/gi, "__RAG__")
    .replace(/(?<![（(])\bLLMs\b/g, "__LLMS__")
    .replace(/(?<![（(])\bLLM\b/g, "__LLM__")
    .replace(/(?<![（(])\bGUI agents?\b/gi, "__GUI_AGENT__")
    .replace(/(?<![（(])\bRL\b/g, "__RL__")
    .replace(/(?<![（(])\bAI agents?\b/gi, "__AI_AGENT__")
    .replace(/(?<![（(])\bagents?\b/gi, "__AGENT__")
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
    .replace(/__AGENT__/g, "智能体")
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
    .replace(/标准\s+检索增强生成（RAG）/g, "标准检索增强生成（RAG）")
    .replace(/([\u4e00-\u9fff])\s+([A-Za-z\u4e00-\u9fff（])/g, "$1$2")
    .replace(/([A-Za-z0-9）])\s+([，。！？；：])/g, "$1$2")
    .replace(/([。！？；])\s+/g, "$1")
    .replace(/\s+([，。！？；：])/g, "$1")
    .replace(/\s*（\s*/g, "（")
    .replace(/\s*）\s*/g, "）")
    .replace(/\s*×\s*/g, "×")
    .replace(/[。]{2,}/gu, "。")
    .replace(/[，]{2,}/gu, "，")
    .trim();

const hasSentenceEnding = (value: string) => /[。！？!?]$/u.test(value.trim());

const trimByChars = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  const sliced = value.slice(0, limit);
  const lastSentenceBoundary = Math.max(
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("！"),
    sliced.lastIndexOf("？"),
    sliced.lastIndexOf("；"),
  );

  if (lastSentenceBoundary >= Math.floor(limit * 0.6)) {
    return sliced.slice(0, lastSentenceBoundary + 1).trim();
  }

  const lastSoftBoundary = Math.max(sliced.lastIndexOf("，"), sliced.lastIndexOf("："));
  if (lastSoftBoundary >= Math.floor(limit * 0.7)) {
    return sliced.slice(0, lastSoftBoundary).trim();
  }

  return sliced.replace(/[，、；：,.!?！？]+$/u, "").trim();
};

const englishLetterCount = (value: string) => (value.match(/[A-Za-z]/g) ?? []).length;

const isEnglishHeavy = (value: string) => {
  const letters = englishLetterCount(value);
  return letters >= 22 || /(?:\b[A-Za-z][A-Za-z0-9-]*\b[\s,;:()（）]*){5,}/.test(value);
};

const stripEnglishFragments = (value: string) =>
  cleanText(value)
    .replace(/(?:\b[A-Za-z][A-Za-z0-9-]*\b[\s,;:()（）]*){5,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

const uniqueBullets = (items: string[], limit = 4, maxChars = 46) => {
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const item of items) {
    const normalized = trimByChars(
      cleanText(item)
        .replace(/^[-*•]\s*/u, "")
        .replace(/[。；;！!？?]+$/u, "")
        .trim(),
      maxChars,
    );

    if (!normalized || normalized.length < 4 || seen.has(normalized) || isEnglishHeavy(normalized)) {
      continue;
    }

    seen.add(normalized);
    bullets.push(normalized);

    if (bullets.length >= limit) {
      break;
    }
  }

  return bullets;
};

const bulletSignature = (value: string) =>
  cleanText(value)
    .replace(/^论文主角：/u, "")
    .replace(/^核心场景：/u, "")
    .replace(/^核心变量：/u, "")
    .replace(/^核心方法：/u, "")
    .replace(/^关键配套：/u, "")
    .replace(/^比较/u, "")
    .replace(/^安全收益取决于/u, "")
    .replace(/[：:、，。；！？（）()\s]/gu, "")
    .toLowerCase();

const isSimilarBullet = (candidate: string, existing: string) => {
  const left = bulletSignature(candidate);
  const right = bulletSignature(existing);

  if (!left || !right) {
    return false;
  }

  if (left === right || left.includes(right) || right.includes(left)) {
    return true;
  }

  const leftTokens = cleanText(candidate)
    .split(/[：:、，。；！？（）()\s]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const rightTokens = cleanText(existing)
    .split(/[：:、，。；！？（）()\s]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const overlap = leftTokens.filter((token) => rightTokens.includes(token));
  return overlap.length >= Math.min(2, Math.min(leftTokens.length, rightTokens.length));
};

const filterDistinctBullets = (candidates: string[], existing: string[], minCount = 2) => {
  const next: string[] = [];

  for (const candidate of candidates) {
    if (
      existing.some((item) => isSimilarBullet(candidate, item)) ||
      next.some((item) => isSimilarBullet(candidate, item))
    ) {
      continue;
    }

    next.push(candidate);
  }

  return next.length >= minCount ? next : [];
};

const mergeDistinctParts = (parts: string[]) => {
  const next: string[] = [];

  for (const part of parts) {
    const normalized = cleanText(part);
    if (!normalized) {
      continue;
    }

    if (
      next.some((existing) => {
        const current = cleanText(existing);
        return current === normalized || current.includes(normalized) || normalized.includes(current);
      })
    ) {
      continue;
    }

    next.push(normalized);
  }

  return next;
};

const composeBody = (parts: string[], maxChars: number) => {
  const text = cleanText(
    mergeDistinctParts(parts)
      .map((part) => (hasSentenceEnding(part) ? part : `${part}。`))
      .join(" ")
      .replace(/\s+/g, " "),
  );

  if (!text) {
    return "";
  }

  return trimByChars(
    text
      .replace(/。(?=[，；：])/gu, "")
      .replace(/[。]{2,}/gu, "。"),
    maxChars,
  );
};

const composeDistinctBody = (primary: string, fallback: string, maxChars: number) => {
  const normalizedPrimary = cleanText(primary);
  const normalizedFallback = cleanText(fallback);
  const fallbackBody =
    !normalizedFallback ||
    normalizedFallback === normalizedPrimary ||
    normalizedPrimary.includes(normalizedFallback) ||
    normalizedFallback.includes(normalizedPrimary)
      ? ""
      : normalizedFallback;

  return composeBody([normalizedPrimary, fallbackBody], maxChars);
};

const composeNarration = (parts: string[], maxChars: number) => {
  const text = mergeDistinctParts(parts)
    .map((part) => (/[。！？]$/u.test(part) ? part : `${part}。`))
    .join("");

  return trimByChars(
    cleanText(text)
      .replace(/。(?=[，；：])/gu, "")
      .replace(/[。]{2,}/gu, "。"),
    maxChars,
  );
};

const inferMethodFocusLabel = (text: string) => {
  const normalized = text.toLowerCase();

  if (/diffusion|dit|outlier token|image generation|denoiser/.test(normalized)) {
    return "扩散 Transformer 里的异常 token 为什么会破坏生成质量";
  }

  if (/symptom|conversational|triage|assessment/.test(normalized)) {
    return "主动问诊与关键信息补齐";
  }

  if (/clinical|medicine|radiology|medical|safety/.test(normalized)) {
    return "医疗系统的真实可靠性";
  }

  if (/retrieval|rag|search|ranking/.test(normalized)) {
    return "检索链路对答案质量的影响";
  }

  if (/planning|planner|agent/.test(normalized)) {
    return "智能体的长期行动策略";
  }

  if (/benchmark|dataset|evaluation/.test(normalized)) {
    return "评测指标与真实能力的差距";
  }

  if (/vision|video|image|multimodal/.test(normalized)) {
    return "多模态系统的真实稳定性";
  }

  return "系统落地时的关键瓶颈";
};

const extractMethodProblemSignal = (text: string) => {
  const normalized = text.toLowerCase();

  if (/diffusion|dit|outlier token|image generation|denoiser/.test(normalized)) {
    return "模型内部会冒出一小批权重过高、但局部语义被破坏的异常 token，最后把图像生成过程带偏";
  }

  if (/symptom|conversational|triage|assessment/.test(normalized)) {
    return "很多系统只能被动接收症状，缺少像医生一样主动追问和补齐关键信息的能力";
  }

  if (/clinical|medicine|radiology|medical/.test(normalized)) {
    return "平均分数很高，并不代表模型在高风险医疗场景里真的安全";
  }

  if (/retrieval|rag|search|ranking/.test(normalized)) {
    return "很多检索链路越做越复杂，但最终答案质量不一定真的更稳";
  }

  if (/planning|planner|agent/.test(normalized)) {
    return "系统能不能完成复杂任务，往往卡在长期规划、环境反馈和动作衔接这一环";
  }

  if (/benchmark|dataset|evaluation/.test(normalized)) {
    return "总分看起来不错，不代表关键能力真的被测到了";
  }

  return "现有方法往往只能覆盖局部步骤，离真实任务还差关键一环";
};

const buildMethodProblemFollowup = (text: string) => {
  const normalized = text.toLowerCase();

  if (/diffusion|dit|outlier token|image generation|denoiser/.test(normalized)) {
    return "在 DiT 这类架构里，真正失稳的往往不是最后那一张图，而是中间注意力已经被少数异常 token 抢走。";
  }

  if (/symptom|conversational|triage|assessment/.test(normalized)) {
    return "真正麻烦的地方，是系统在信息还不完整时就急着下判断，后面再高分也补不回前面漏掉的病情线索。";
  }

  if (/clinical|medicine|radiology|medical/.test(normalized)) {
    return "最危险的不是平均分低一点，而是少数高风险场景里的错误会直接影响真实决策。";
  }

  if (/retrieval|rag|search|ranking/.test(normalized)) {
    return "最难的地方不是把链路做长，而是弄清哪些证据真的在帮答案变稳，哪些只是把流程变复杂。";
  }

  if (/planning|planner|agent/.test(normalized)) {
    return "真正的瓶颈往往出在多步执行过程中，一环判断失真，后面的行动就会连续偏掉。";
  }

  if (/benchmark|dataset|evaluation/.test(normalized)) {
    return "真正的麻烦是，平均分会把失败模式盖住，让你误以为系统已经能稳定落地。";
  }

  return "";
};

const appendIfMissing = (base: string, addition: string) => {
  const normalizedBase = cleanText(base);
  const normalizedAddition = cleanText(addition);

  if (!normalizedAddition || !normalizedBase) {
    return normalizedAddition ? [normalizedBase, normalizedAddition].filter(Boolean).join(" ") : normalizedBase;
  }

  return normalizedBase.includes(normalizedAddition) ? normalizedBase : `${normalizedBase} ${normalizedAddition}`.trim();
};

const extractNamedArtifacts = (text: string) => {
  const ignore = new Set(["Clinical", "LLMs", "LLM", "AI", "The", "This", "We", "To", "As", "In", "On"]);
  return [...text.matchAll(/\b(?:[A-Z][A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b/g)]
    .map((match) => match[0]?.trim() ?? "")
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

const localizeArtifactName = (artifact: string) => {
  if (/dual-stage registers|dsr/i.test(artifact)) {
    return "双阶段寄存器（DSR）";
  }

  if (/representation autoencoder|rae/i.test(artifact)) {
    return "表征自编码器（RAE）";
  }

  if (/diffusion transformers?|dits?\b/i.test(artifact)) {
    return "扩散Transformer（DiT）";
  }

  if (/vision transformers?|vits?\b/i.test(artifact)) {
    return "视觉Transformer（ViT）";
  }

  return cleanText(artifact);
};

const describeArtifact = (artifact: string, text: string) => {
  const joined = `${artifact} ${text}`.toLowerCase();

  if (/dual-stage registers|dsr/.test(joined)) {
    return "双阶段寄存器（DSR），一种同时作用在编码器和去噪器里的异常 token 干预机制";
  }

  if (/representation autoencoder|rae/.test(joined)) {
    return "表征自编码器（RAE），先把图像压成高层语义表示的编码管线";
  }

  if (/diffusion transformer|dits?\b/.test(joined)) {
    return "扩散Transformer（DiT），负责在逐步去噪过程中生成图像的主干网络";
  }

  if (/vision transformer|vits?\b/.test(joined)) {
    return "视觉Transformer（ViT），把图像切成 patch 再做注意力建模的编码器";
  }

  if (/agentic rag/.test(joined)) {
    return "主动规划式检索增强生成（agentic RAG），会主动规划检索和推理步骤的 RAG 链路";
  }

  if (/\brag\b/.test(joined)) {
    return "检索增强生成（RAG），先检索资料再生成答案的问答链路";
  }

  return "";
};

const stripArtifactPrefix = (definition: string, artifactLabel: string) => {
  const normalizedDefinition = cleanText(definition);
  const normalizedLabel = cleanText(artifactLabel);

  if (!normalizedDefinition || !normalizedLabel) {
    return normalizedDefinition;
  }

  if (normalizedDefinition.startsWith(`${normalizedLabel}，`)) {
    return normalizedDefinition.slice(normalizedLabel.length + 1).trim();
  }

  if (normalizedDefinition.startsWith(`${normalizedLabel},`)) {
    return normalizedDefinition.slice(normalizedLabel.length + 1).trim();
  }

  return normalizedDefinition;
};

const buildMethodMechanismSentence = (text: string) => {
  const normalized = text.toLowerCase();

  if (/register/.test(normalized) && /encoder/.test(normalized) && /denoiser/.test(normalized)) {
    return "核心机制是在编码器和去噪器两端都加寄存器，一边吸收预训练编码器里的异常表示，一边压住中间层里会抢注意力的异常 token。";
  }

  if (/clean evidence|retrieval complexity|agentic rag|standard rag|context length/.test(normalized)) {
    return "核心机制不是盲目换更大模型，而是把证据质量、检索方式和上下文构造这些变量拆开比较，直接定位哪一环真的在影响结果。";
  }

  if (/symptom|conversational|triage|assessment/.test(normalized)) {
    return "核心机制是让系统像医生一样主动追问，把缺失的关键信息补齐后，再继续做判断。";
  }

  if (/multi-agent|critic|verifier|knowledge graph/.test(normalized)) {
    return "核心机制是把任务拆给多个角色：先路由问题、再做工具分析、再做检索和验证，让不同环节各自承担明确职责。";
  }

  return "";
};

const buildResultSummarySentence = (findings: string[]) => {
  if (findings.length === 0) {
    return "";
  }

  if (findings.length === 1) {
    return `结果上最关键的一条就是：${findings[0]}。`;
  }

  return `结果上最关键的两点是：${findings[0]}；${findings[1]}。`;
};

const buildMechanismBullets = (text: string) => {
  const normalized = text.toLowerCase();
  const bullets: string[] = [];

  if (/register/.test(normalized) && /encoder/.test(normalized)) {
    bullets.push("编码器侧加入寄存器吸收异常表示");
  }

  if (/register/.test(normalized) && /denoiser/.test(normalized)) {
    bullets.push("去噪器侧压住中间层异常 token");
  }

  if (/clean evidence/.test(normalized)) {
    bullets.push("把干净证据和复杂检索链路拆开比较");
  }

  if (/retrieval complexity|agentic rag|standard rag/.test(normalized)) {
    bullets.push("检索方式单独对比，不只看总答案");
  }

  if (/symptom|triage|assessment/.test(normalized)) {
    bullets.push("先主动追问再做症状判断");
  }

  return bullets.slice(0, 3);
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

const extractEvaluationFacts = (text: string) => {
  const modelCount = /evaluated\s+(\d+)\s+(?:locally deployed\s+)?llms?/i.exec(text)?.[1];
  const conditionCount = /across\s+(\d+)\s+deployment conditions/i.exec(text)?.[1];
  const questionCount = /benchmark of\s+(\d+)\s+(?:multiple-choice\s+)?questions/i.exec(text)?.[1];
  const facts: string[] = [];

  if (questionCount) {
    facts.push(`${questionCount} 道任务题`);
  }

  if (modelCount && conditionCount) {
    facts.push(`${modelCount} 个模型 × ${conditionCount} 种条件`);
  } else if (modelCount) {
    facts.push(`${modelCount} 个模型对比`);
  }

  return facts;
};

const extractFindingBullets = (text: string) => {
  const findings: string[] = [];
  const normalized = text.toLowerCase();

  if (/clean evidence produced the strongest improvement/.test(normalized)) {
    findings.push("干净证据最有效，不是更复杂的 RAG");
  }

  const highRiskDrop = /high-risk error from\s+([0-9.]+)%\s+to\s+([0-9.]+)%/i.exec(text);
  if (highRiskDrop) {
    findings.push(`高风险错误率 ${highRiskDrop[1]}%→${highRiskDrop[2]}%`);
  }

  if (/did not reproduce this safety profile/.test(normalized)) {
    findings.push("标准 RAG 没复制这种安全收益");
  }

  if (/increased latency without closing the safety gap/.test(normalized)) {
    findings.push("长上下文更慢，但没补齐安全差距");
  }

  if (/worst-case analysis showed/i.test(text)) {
    findings.push("真正危险的错误集中在少数高风险题");
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

const withoutExistingBullets = (candidates: string[], existing: string[]) => {
  const normalizedExisting = new Set(existing.map((item) => cleanText(item)));
  return candidates.filter((item) => {
    const normalized = cleanText(item);
    return normalized && !normalizedExisting.has(normalized) && !existing.some((other) => isSimilarBullet(item, other));
  });
};

const dedupeDisplayDraftBullets = (draft: DisplayScriptDraft): DisplayScriptDraft => {
  const prior: string[] = [];
  const problemBullets = filterDistinctBullets(draft.problem.bullets, prior, 1);
  prior.push(...problemBullets);
  const methodBullets = filterDistinctBullets(draft.method.bullets, prior, 2);
  prior.push(...methodBullets);
  const valueBullets = filterDistinctBullets(draft.value.bullets, prior, 2);

  return {
    ...draft,
    problem: {
      ...draft.problem,
      bullets: problemBullets,
    },
    method: {
      ...draft.method,
      bullets: methodBullets,
    },
    value: {
      ...draft.value,
      bullets: valueBullets,
    },
  };
};

const buildSurveyDisplayDraft = ({
  polishedDraft,
  baselineDraft,
}: {
  polishedDraft: SummaryDraft;
  baselineDraft: SummaryDraft;
}): DisplayScriptDraft => {
  const hookBody = composeBody(
    [
      polishedDraft.hook,
      "这篇论文不是再造一个新 agent，而是先把 world model 这个词拆开：到底它分几层能力、受哪类规律约束、为什么不同系统会在完全不同的地方失效。",
    ],
    146,
  );

  const problemBody = composeBody(
    [
      "现在 world model 这个词同时指一步预测器、多步模拟器，甚至会根据新证据更新自身假设的系统。",
      "术语一乱，RL、GUI agent、多智能体和科研 agent 虽然都声称在做 world model，但其实在比较完全不同的对象。",
    ],
    168,
  );

  const methodBody = composeBody(
    [
      "作者用 levels×laws 双轴 taxonomy 重排文献：一轴看能力从 L1 Predictor、L2 Simulator 到 L3 Evolver，另一轴看系统面对的是 physical、digital、social、scientific 哪一类规律。",
      "重点不是再提一个新模型，而是给所有 world model 工作一张统一坐标纸。",
    ],
    178,
  );

  const valueBody = composeBody(
    [
      "这套框架把 400+ 论文和 100+ 代表系统放回同一坐标系，能直接解释为什么同样叫 world model 的方法，会在不同环境约束下暴露完全不同的失败点。",
      "因此你不仅能看懂术语，还能判断某个智能体到底缺的是短期预测、长期多步推演，还是失败后的模型修正能力。",
    ],
    182,
  );

  return {
    hook: {
      body: hookBody,
      bullets: [],
    },
    problem: {
      body: problemBody,
      bullets: uniqueBullets([
        "世界模型可能只指一步预测器",
        "也可能指可做长期多步推演的模拟器",
        "定义混乱会让评测结果失真",
        "不同研究社区往往在讨论不同对象",
      ]),
    },
    method: {
      body: methodBody,
      bullets: uniqueBullets([
        "L1 Predictor：只学一步局部转移",
        "L2 Simulator：多步条件模拟",
        "L3 Evolver：预测失败后用新证据修模",
        "新意是统一 taxonomy，而不是再发明一个新 backbone",
      ]),
    },
    value: {
      body: valueBody,
      bullets: uniqueBullets([
        "四类规律：物理 / 数字 / 社会 / 科学",
        "整理 400+ 论文与 100+ 代表系统",
        "给设计、失败分析和评测一套统一坐标系",
        "能判断系统缺的是预测、模拟还是修模",
      ]),
    },
    ending: {
      body: "这篇综述真正留下的是一把尺子：你可以直接判断一个智能体缺的是预测、模拟，还是失败后的模型修正能力。",
      bullets: [],
    },
  };
};

const buildTheoryDisplayDraft = ({
  polishedDraft,
  baselineDraft,
}: {
  polishedDraft: SummaryDraft;
  baselineDraft: SummaryDraft;
}): DisplayScriptDraft => {
  return {
    hook: {
      body: composeBody(
        [
          polishedDraft.hook,
          "它讨论的不是工程调参，而是某类规划问题从理论上是否存在通用解，以及为什么某些规划器永远不可能覆盖所有情形。",
        ],
        132,
      ),
      bullets: [],
    },
    problem: {
      body: composeBody(
        [
          "论文研究 epistemic planning 里的 plan existence：给定目标公式、初始知识状态和一组 epistemic actions，是否存在一条动作序列能达成目标。",
          "这里的关键不是最优性，而是“有没有任何一条计划存在”。",
        ],
        164,
      ),
      bullets: uniqueBullets([
        "epistemic planning：在不完全知识下规划",
        "pointed Kripke model：带真实世界指针的知识状态图",
        "epistemic action：优先改变认知而非物理世界的动作",
        "plan existence：问是否存在可达成目标的动作序列",
      ]),
    },
    method: {
      body: composeBody(
        [
          "作者把条件压到很弱：epistemic action 的 precondition modal depth 最多只有 1，而且没有 postcondition；即便这样，plan existence 仍被证明为不可判定。",
          "也就是说，论文的新意不是设计新 planner，而是在极简设定下给出不可判定性证明。",
        ],
        176,
      ),
      bullets: uniqueBullets([
        "precondition modal depth ≤ 1",
        "没有 postcondition",
        "把动作限制到非常弱的知识更新",
        "即便如此仍然不可判定",
      ]),
    },
    value: {
      body: composeBody(
        [
          "这条结果等于给 epistemic planning 画出硬边界：有些难题不是缺更强算法，而是问题本身就没有统一可计算解。",
          "这能帮助你判断后续工作该去找可解子类、近似方法还是额外结构假设，而不是盲目堆 planner。",
        ],
        176,
      ),
      bullets: uniqueBullets([
        "给 epistemic planning 画出理论边界",
        "解释为何某些规划器永远无法通解",
        "提醒研究者去找可解子类和额外结构",
        "后续研究必须绕开这条不可判定红线",
      ]),
    },
    ending: {
      body: "结论很直接：即便把条件压到很弱，这类认知规划问题仍然不可判定，后续研究必须绕开这条理论边界。",
      bullets: [],
    },
  };
};

const buildMethodDisplayDraft = ({
  paper,
  context,
  polishedDraft,
  baselineDraft,
}: {
  paper: SourcePaperForSummary;
  context: Pick<PaperSummaryContext, "abstractSentences" | "sectionHeadings">;
  polishedDraft: SummaryDraft;
  baselineDraft: SummaryDraft;
}): DisplayScriptDraft => {
  const evidenceText = [paper.title, paper.summary, ...context.abstractSentences, ...context.sectionHeadings].join(" ");
  const artifacts = extractNamedArtifacts(evidenceText);
  const introducedMethodName = extractIntroducedMethodName(evidenceText);
  const dimensions = extractMethodDimensions(evidenceText);
  const evaluationFacts = extractEvaluationFacts(evidenceText);
  const findingBullets = extractFindingBullets(evidenceText);
  const focusLabel = inferMethodFocusLabel(evidenceText);
  const problemSignal = extractMethodProblemSignal(evidenceText);
  const problemFollowup = buildMethodProblemFollowup(evidenceText);
  const hookSource = isEnglishHeavy(polishedDraft.hook) ? baselineDraft.hook : polishedDraft.hook;
  const problemSource = isEnglishHeavy(polishedDraft.problem) ? baselineDraft.problem : polishedDraft.problem;
  const methodSource = isEnglishHeavy(polishedDraft.method)
    ? stripEnglishFragments(baselineDraft.method)
    : stripEnglishFragments(polishedDraft.method) || stripEnglishFragments(baselineDraft.method);
  const valueSource = isEnglishHeavy(polishedDraft.value)
    ? stripEnglishFragments(baselineDraft.value)
    : stripEnglishFragments(polishedDraft.value) || stripEnglishFragments(baselineDraft.value);
  const endingSource = isEnglishHeavy(polishedDraft.ending) ? baselineDraft.ending : polishedDraft.ending;
  const leadArtifact = introducedMethodName || artifacts[0] || "";
  const supportingArtifact = artifacts.find((artifact) => artifact !== leadArtifact) ?? "";
  const leadArtifactLabel = leadArtifact ? localizeArtifactName(leadArtifact) : "";
  const supportingArtifactLabel = supportingArtifact ? localizeArtifactName(supportingArtifact) : "";
  const leadDefinition = leadArtifact ? describeArtifact(leadArtifact, evidenceText) : "";
  const supportingDefinition = supportingArtifact ? describeArtifact(supportingArtifact, evidenceText) : "";
  const leadDefinitionRemainder = leadDefinition ? stripArtifactPrefix(leadDefinition, leadArtifactLabel) : "";
  const supportingDefinitionRemainder =
    supportingDefinition && supportingArtifactLabel
      ? stripArtifactPrefix(supportingDefinition, supportingArtifactLabel)
      : "";
  const mechanismSentence = buildMethodMechanismSentence(evidenceText);
  const resultSentence = buildResultSummarySentence(findingBullets);
  const mechanismBullets = buildMechanismBullets(evidenceText);

  const hookBody = composeBody(
    [
      leadArtifactLabel
        ? `${leadArtifactLabel} 这篇论文盯住的问题是：${problemSignal}`
        : `${problemSignal}`,
      findingBullets[0] ? `最关键的结果是：${findingBullets[0]}。` : "",
    ],
    152,
  );
  const problemBody = composeBody(
    [
      `作者想解决的是：${problemSignal}。`,
      dimensions.length > 0
        ? `难点在于，${dimensions.join("、")} 这些变量会一起影响结果，只看最后总分很难判断到底是哪一环先出了问题。`
        : problemFollowup || "难点不在最终那一张图好不好看，而在你很难直接看到到底是哪一层内部机制先把系统带偏了。",
      !problemFollowup && problemSource && !problemSource.includes(problemSignal)
        ? trimByChars(stripEnglishFragments(problemSource), 72)
        : "",
    ],
    188,
  );
  const methodBody = composeBody(
    [
      leadArtifactLabel ? `作者真正提出的主方法是 ${leadArtifactLabel}。` : "",
      leadDefinitionRemainder ? `它本质上是${leadDefinitionRemainder}。` : "",
      supportingDefinitionRemainder && supportingDefinition !== leadDefinition
        ? `配套组件则是${supportingDefinitionRemainder}。`
        : "",
      mechanismSentence || appendIfMissing(methodSource, dimensions.length > 0 ? `重点拆开比较 ${dimensions.join("、")} 这些变量。` : ""),
      evaluationFacts.length > 0 ? `实验覆盖 ${evaluationFacts.join("、")}。` : "",
    ],
    208,
  );
  const valueBody = composeBody(
    findingBullets.length > 0
      ? [
          `实验结果不是抽象概念，而是非常具体：${findingBullets.join("；")}。`,
          "这说明要把这类系统做稳，不能只靠堆大模型，而要直接处理出问题的内部机制。",
        ]
      : [appendIfMissing(valueSource, resultSentence), findingBullets[2] ?? ""],
    206,
  );

  const methodBullets = uniqueBullets(
    [
      leadArtifactLabel ? `主方法：${leadArtifactLabel}` : "",
      supportingArtifactLabel ? `配套组件：${supportingArtifactLabel}` : "",
      ...mechanismBullets,
      dimensions.length > 0 ? `比较 ${dimensions.join("、")}` : "",
      ...evaluationFacts,
    ],
    5,
    48,
  );
  const valueBullets = uniqueBullets(
    withoutExistingBullets(
      [
        ...findingBullets,
        dimensions.length > 0 ? `安全收益取决于 ${dimensions.slice(0, 3).join("、")}` : "",
      ],
      methodBullets,
    ),
    4,
    48,
  );
  const problemBullets = uniqueBullets(
    [
      leadArtifactLabel ? `论文主角：${leadArtifactLabel}` : "",
      `核心场景：${focusLabel}`,
      leadDefinition ? trimByChars(`术语解释：${leadDefinition}`, 46) : "",
      dimensions.length > 0 ? `核心变量：${dimensions.slice(0, 3).join("、")}` : "",
    ],
    4,
    46,
  );

  return {
    hook: {
      body: hookBody,
      bullets: [],
    },
    problem: {
      body: problemBody,
      bullets: problemBullets,
    },
    method: {
      body: methodBody,
      bullets: methodBullets.length >= 2 ? methodBullets : [],
    },
    value: {
      body: valueBody,
      bullets: valueBullets.length >= 2 ? valueBullets : [],
    },
    ending: {
      body: composeBody([endingSource], 108),
      bullets: [],
    },
  };
};

const buildSurveyNarrationDraft = ({
}: {
  polishedDraft: SummaryDraft;
}): NarrationScriptDraft => {
  return {
    hook: composeNarration(
      [
        "如果一个智能体真要在环境里持续行动，它缺的往往不是会说话，而是能不能连续预测世界接下来怎么变。",
        "这篇综述真正做的，不是再发一个新模型，而是先把 world model 这个词拆开，看大家谈的到底是不是同一种能力。",
      ],
      154,
    ),
    problem: composeNarration(
      [
        "现在 world model 这个词，可能指一步预测器，也可能指能做长期多步推演的模拟器，甚至还可能指会在失败后更新假设的系统。",
        "术语一混，强化学习、图形界面智能体和科研智能体这些工作就很难放到同一张表里比较。",
      ],
      228,
    ),
    method: composeNarration(
      [
        "作者用 levels×laws 这张双轴表把文献重新排了一遍：能力层从 L1 Predictor、L2 Simulator 到 L3 Evolver，环境约束则分成 physical、digital、social、scientific 四类。",
        "你可以把它理解成，先给所有 world model 工作重新定位，再讨论它们各自真正擅长什么。",
      ],
      242,
    ),
    value: composeNarration(
      [
        "这套框架的价值，不是推荐某一个 backbone，而是告诉你：一个系统总是失败，到底是短期预测弱、长期模拟弱，还是失败后的模型修正能力弱。",
        "所以它第一次把 world model 变成了一张能直接拿来设计、分析和评测的能力地图。",
      ],
      226,
    ),
    ending: composeNarration(
      [
        "一句话说，这篇论文把 world model 从一个流行词，变成了一把能直接判断智能体短板的尺子。",
      ],
      92,
    ),
  };
};

const buildTheoryNarrationDraft = ({
}: {
  polishedDraft: SummaryDraft;
}): NarrationScriptDraft => {
  return {
    hook: composeNarration(
      [
        "这篇论文最硬核的地方在于，它讨论的不是怎么把 planner 调得更强，而是这类规划题从理论上有没有通用解。",
        "也就是说，它关心的是问题本身有没有边界，而不是某个工程技巧能不能再提一点分。",
      ],
      150,
    ),
    problem: composeNarration(
      [
        "论文研究的是认知规划里的计划存在性，也就是给定目标、知识状态和一组认知动作之后，到底有没有一条动作序列能把目标做成。",
        "这里问的不是最优，而是有没有任何一条计划存在。",
      ],
      216,
    ),
    method: composeNarration(
      [
        "作者把条件压得很弱：precondition 的 modal depth 最多只有 1，而且动作没有 postcondition。",
        "即便这样，论文仍然证明这类 plan existence 问题是不可判定的。",
      ],
      208,
    ),
    value: composeNarration(
      [
        "这条结果真正重要的地方在于，它给 epistemic planning 画出了一条硬边界：有些瓶颈不是算法没调好，而是问题本身就不存在统一可计算解。",
        "这会直接影响后续研究该去找可解子类、近似方法，还是额外结构假设。",
      ],
      228,
    ),
    ending: composeNarration(
      [
        "所以这篇论文留下的主线很直接：继续堆通用 planner，并不能越过这条不可判定的理论边界。",
      ],
      92,
    ),
  };
};

const buildMethodNarrationDraft = ({
  paper,
  context,
  polishedDraft,
  baselineDraft,
}: {
  paper: SourcePaperForSummary;
  context: Pick<PaperSummaryContext, "abstractSentences" | "sectionHeadings">;
  polishedDraft: SummaryDraft;
  baselineDraft: SummaryDraft;
}): NarrationScriptDraft => {
  const evidenceText = [paper.title, paper.summary, ...context.abstractSentences, ...context.sectionHeadings].join(" ");
  const artifacts = extractNamedArtifacts(evidenceText);
  const introducedMethodName = extractIntroducedMethodName(evidenceText);
  const dimensions = extractMethodDimensions(evidenceText);
  const evaluationFacts = extractEvaluationFacts(evidenceText);
  const findingBullets = extractFindingBullets(evidenceText);
  const focusLabel = inferMethodFocusLabel(evidenceText);
  const problemSignal = extractMethodProblemSignal(evidenceText);
  const problemFollowup = buildMethodProblemFollowup(evidenceText);
  const hookSource = isEnglishHeavy(polishedDraft.hook) ? baselineDraft.hook : polishedDraft.hook;
  const problemSource = isEnglishHeavy(polishedDraft.problem) ? baselineDraft.problem : polishedDraft.problem;
  const methodSource = isEnglishHeavy(polishedDraft.method)
    ? stripEnglishFragments(baselineDraft.method)
    : stripEnglishFragments(polishedDraft.method) || stripEnglishFragments(baselineDraft.method);
  const valueSource = isEnglishHeavy(polishedDraft.value)
    ? stripEnglishFragments(baselineDraft.value)
    : stripEnglishFragments(polishedDraft.value) || stripEnglishFragments(baselineDraft.value);
  const endingSource = isEnglishHeavy(polishedDraft.ending) ? baselineDraft.ending : polishedDraft.ending;
  const leadArtifact = introducedMethodName || artifacts[0] || "";
  const supportingArtifact = artifacts.find((artifact) => artifact !== leadArtifact) ?? "";
  const leadArtifactLabel = leadArtifact ? localizeArtifactName(leadArtifact) : "";
  const supportingArtifactLabel = supportingArtifact ? localizeArtifactName(supportingArtifact) : "";
  const leadDefinition = leadArtifact ? describeArtifact(leadArtifact, evidenceText) : "";
  const leadDefinitionRemainder = leadDefinition ? stripArtifactPrefix(leadDefinition, leadArtifactLabel) : "";
  const mechanismSentence = buildMethodMechanismSentence(evidenceText);
  const resultSentence = buildResultSummarySentence(findingBullets);

  return {
    hook: composeNarration(
      [
        leadArtifactLabel
          ? `${leadArtifactLabel} 这篇论文真正盯住的，是 ${focusLabel}。`
          : `这篇论文真正盯住的，是 ${focusLabel}。`,
        findingBullets[0] ? `它一上来就把最关键的结果摆在台面上：${findingBullets[0]}。` : "",
      ],
      168,
    ),
    problem: composeNarration(
      [
        `作者真正想解决的是：${problemSignal}。`,
        dimensions.length > 0
          ? `难点在于，${dimensions.join("、")} 这些变量会一起影响结果，只看最后总分，你分不清到底是哪一环真的在起作用。`
          : problemFollowup || "难点在于，最终那张图或者最后那个总分，根本不能告诉你到底是哪一层内部机制先出了问题。",
        !problemFollowup && problemSource && !problemSource.includes(problemSignal)
          ? trimByChars(stripEnglishFragments(problemSource), 72)
          : "",
      ],
      206,
    ),
    method: composeNarration(
      [
        leadArtifactLabel ? `这篇论文的主方法叫 ${leadArtifactLabel}。` : "这篇论文的做法，是直接对出问题的中间机制下手。",
        leadDefinitionRemainder ? `如果翻成人话，它就是${leadDefinitionRemainder}。` : "",
        supportingArtifactLabel ? `配套组件是 ${supportingArtifactLabel}。` : "",
        mechanismSentence || methodSource,
        evaluationFacts.length > 0 ? `具体实验覆盖 ${evaluationFacts.join("、")}。` : "",
        dimensions.length > 0 ? `重点比较的变量是 ${dimensions.join("、")}。` : "",
      ],
      248,
    ),
    value: composeNarration(
      findingBullets.length > 0
        ? [
            resultSentence,
            findingBullets[2] ? `再往下看，${findingBullets[2]}。` : "",
            "这说明这篇论文真正给出的，不是一个漂亮口号，而是一条很具体的改进方向：直接控制出问题的内部机制。",
          ]
        : [
            valueSource,
            "这说明真正有效的提升路径，和大家直觉里觉得会涨分的做法，并不是一回事。",
          ],
      236,
    ),
    ending: composeNarration(
      [
        findingBullets[0]
          ? `最后把主线压成一句话，就是 ${findingBullets[0]}。`
          : endingSource,
      ],
      98,
    ),
  };
};

export const buildDisplayScriptDraft = ({
  paper,
  draft,
  context,
}: {
  paper: SourcePaperForSummary;
  draft: SummaryDraft;
  context: Pick<PaperSummaryContext, "abstractSentences" | "sectionHeadings">;
}): DisplayScriptDraft => {
  const paperMode = detectPaperMode(paper);
  const polishedDraft = polishSummaryDraft({draft, paperMode});
  const baselineDraft = polishSummaryDraft({
    draft: buildRuleBasedSummaryDraft(paper, {
      rawText: "",
      abstractSentences: context.abstractSentences,
      sectionHeadings: context.sectionHeadings,
    }),
    paperMode,
  });

  if (paperMode === "survey") {
    return dedupeDisplayDraftBullets(buildSurveyDisplayDraft({polishedDraft, baselineDraft}));
  }

  if (paperMode === "theory") {
    return dedupeDisplayDraftBullets(buildTheoryDisplayDraft({polishedDraft, baselineDraft}));
  }

  return dedupeDisplayDraftBullets(
    buildMethodDisplayDraft({
      paper,
      context,
      polishedDraft,
      baselineDraft,
    }),
  );
};

export const buildNarrationScriptDraft = ({
  paper,
  draft,
  context,
}: {
  paper: SourcePaperForSummary;
  draft: SummaryDraft;
  context: Pick<PaperSummaryContext, "abstractSentences" | "sectionHeadings">;
}): NarrationScriptDraft => {
  const paperMode = detectPaperMode(paper);
  const polishedDraft = polishSummaryDraft({draft, paperMode});
  const baselineDraft = polishSummaryDraft({
    draft: buildRuleBasedSummaryDraft(paper, {
      rawText: "",
      abstractSentences: context.abstractSentences,
      sectionHeadings: context.sectionHeadings,
    }),
    paperMode,
  });

  if (paperMode === "survey") {
    return buildSurveyNarrationDraft({polishedDraft});
  }

  if (paperMode === "theory") {
    return buildTheoryNarrationDraft({polishedDraft});
  }

  return buildMethodNarrationDraft({
    paper,
    context,
    polishedDraft,
    baselineDraft,
  });
};
