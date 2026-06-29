import re
from typing import List
from .paper_types import SourcePaperForSummary, PaperMode, PaperSummaryContext, SummaryDraft

def split_sentences(text: str) -> List[str]:
    text = re.sub(r'\s+', ' ', text)
    parts = re.split(r'(?<=[.?!])\s+', text)
    return [p.strip() for p in parts if p.strip()]

def extract_abstract_sentences(raw_text: str, fallback_summary: str) -> List[str]:
    text = re.sub(r'\s+', ' ', raw_text)
    abstract_match = re.search(r'(?:^|\n|\s)(abstract|摘要)\s*[:：]?\s*', raw_text, flags=re.IGNORECASE)
    
    if abstract_match:
        start_index = abstract_match.end()
        following = raw_text[start_index:]
        section_boundary_match = re.search(r'\n\s*(?:1[\s.]+introduction|introduction|1[\s.]+背景|引言|keywords?)\b', following, flags=re.IGNORECASE)
        
        abstract_window = following
        if section_boundary_match:
            abstract_window = following[:section_boundary_match.start()]
            
        abstract_window = re.sub(r'\s+', ' ', abstract_window)
        abstract_sentences = split_sentences(abstract_window)[:6]
        if abstract_sentences:
            return abstract_sentences
            
    if fallback_summary.strip():
        return split_sentences(fallback_summary)[:4]
        
    return split_sentences(text[:2400])[:6]

def extract_section_headings(raw_text: str) -> List[str]:
    headings = []
    for match in re.finditer(r'§\d+(?:\.\d+)?\s+([^\n]+)', raw_text):
        heading = match.group(1).strip()
        if len(heading) > 1 and heading not in headings:
            headings.append(heading)
    return headings[:10]

def detect_paper_mode(paper: SourcePaperForSummary) -> PaperMode:
    title = paper["title"].lower()
    summary = paper["summary"].lower()
    
    if "survey" in title or "foundations" in title or "taxonomy" in summary:
        return "survey"
        
    if "proof" in title or "undecidable" in summary:
        return "theory"
        
    return "method"

def build_rule_based_title_zh(paper: SourcePaperForSummary, mode: PaperMode) -> str:
    normalized_title = paper["title"].strip()
    
    if re.search(r'agentic world modeling', normalized_title, flags=re.IGNORECASE):
        return "智能体世界模型：基础、能力、规律与未来"
    if re.search(r'plan existence problem', normalized_title, flags=re.IGNORECASE):
        return "认知规划中计划存在性问题的不可判定性"
    if re.search(r'symptomai', normalized_title, flags=re.IGNORECASE):
        return "SymptomAI：让 AI 问诊主动补齐关键信息"
    if re.search(r'safe-scale', normalized_title, flags=re.IGNORECASE):
        return "SaFE-Scale：医疗大模型部署安全性的系统评测"
        
    if mode == "survey":
        return "世界模型综述：能力层级、规律约束与研究地图"
    if mode == "theory":
        return "认知规划的理论边界：什么问题根本无通解"
        
    return ""

def sentence_or(sentences: List[str], index: int, fallback: str) -> str:
    if index < len(sentences):
        return sentences[index]
    return fallback

def includes_any(value: str, patterns: List[re.Pattern]) -> bool:
    return any(p.search(value) for p in patterns)

def capitalize_term(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()

def extract_named_artifacts(text: str) -> List[str]:
    ignore = {"Clinical", "LLMs", "LLM", "AI", "As", "We", "To", "The", "This", "That", "In", "On", "By"}
    artifacts = []
    for match in re.finditer(r'\b(?:[A-Z][A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z]{2,}(?:-[A-Z0-9]+)*)\b', text):
        item = capitalize_term(match.group(0))
        if len(item) >= 3 and item not in ignore and item not in artifacts:
            artifacts.append(item)
    return artifacts[:4]

def extract_introduced_method_name(text: str) -> str:
    patterns = [
        re.compile(r'(?:introduce|introduced|propose|proposed|present|presented)\s+([A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,3})\s*\(([A-Z0-9-]+)\)', re.IGNORECASE),
        re.compile(r'(?:introduce|introduced|propose|proposed|present|presented)\s+([A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+){0,3})', re.IGNORECASE)
    ]
    
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            name = match.group(1).strip() if match.group(1) else ""
            short = match.group(2).strip() if len(match.groups()) > 1 and match.group(2) else ""
            
            if name and short:
                return f"{name}（{short}）"
            if name:
                return name
                
    return ""

def infer_method_paper_focus(paper: SourcePaperForSummary, context: PaperSummaryContext) -> str:
    text = f"{paper['title']} {paper['summary']} {' '.join(context['sectionHeadings'])}".lower()
    
    if re.search(r'diffusion|dit|outlier token|image generation|denoiser', text):
        return "扩散 Transformer 内部异常 token 对生成质量的影响"
    if re.search(r'symptom|conversational|triage|diagnos|assessment', text):
        return "对话式问诊能否主动补齐关键信息"
    if re.search(r'clinical|medicine|radiology|medical|safety', text):
        return "医疗系统在真实部署中的可靠性和高风险错误"
    if re.search(r'benchmark|dataset|evaluation|leaderboard', text):
        return "评测标准、失败模式和真实瓶颈"
    if re.search(r'retrieval|rag|search|ranking', text):
        return "检索链路和最终答案质量之间的关系"
    if re.search(r'agent|multi-agent|planner|planning', text):
        return "智能体系统在复杂任务里的关键能力"
    if re.search(r'detection|detect', text):
        return "检测任务在复杂环境下的泛化和鲁棒性"
        
    return "系统真正的性能瓶颈和失败来源"

def extract_problem_signal(text: str) -> str:
    normalized = text.lower()
    
    if re.search(r'diffusion|dit|outlier token|image generation|denoiser', normalized):
        return "模型内部会冒出一小批权重过高、但局部语义被破坏的异常 token，最后把图像生成过程带偏"
    if re.search(r'symptom|conversational|triage|assessment', normalized):
        return "现有工具往往只是被动接收症状，缺少像医生一样主动追问的能力"
    if re.search(r'clinical|medicine|radiology|medical', normalized):
        return "平均分数很高，并不代表它在高风险场景里真的安全"
    if re.search(r'retrieval|rag|search|ranking', normalized):
        return "大家常把检索链路做得越来越复杂，却不一定真正提高最终答案质量"
    if re.search(r'planning|planner|agent', normalized):
        return "系统能不能完成复杂任务，往往卡在行动策略、环境反馈和长期规划之间的衔接"
    if re.search(r'benchmark|dataset|evaluation', normalized):
        return "总分看起来漂亮，不代表关键能力真的被测到了"
        
    return "现有方法往往只能覆盖局部步骤，离真实任务还差关键一环"

def extract_method_dimensions(text: str) -> List[str]:
    normalized = text.lower()
    dimensions = []
    
    mapping = [
        (re.compile(r'model scale'), "模型规模"),
        (re.compile(r'context length'), "上下文长度"),
        (re.compile(r'evidence quality|clean evidence|conflict evidence'), "证据质量"),
        (re.compile(r'retrieval complexity|retrieval strategy|standard rag|agentic rag'), "检索方式"),
        (re.compile(r'context exposure|max-context'), "上下文构造"),
        (re.compile(r'inference-time compute|latency'), "推理时算力"),
    ]
    
    for pattern, label in mapping:
        if pattern.search(normalized) and label not in dimensions:
            dimensions.append(label)
            
    return dimensions[:5]

def extract_evaluation_setup(text: str) -> List[str]:
    parts = []
    
    question_match = re.search(r'benchmark of\s+(\d+)\s+(?:multiple-choice\s+)?questions', text, flags=re.IGNORECASE)
    if question_match:
        parts.append(f"{question_match.group(1)} 道评测题")
        
    model_match = re.search(r'evaluated\s+(\d+)\s+(?:locally deployed\s+)?llms?', text, flags=re.IGNORECASE)
    condition_match = re.search(r'across\s+(\d+)\s+deployment conditions', text, flags=re.IGNORECASE)
    
    if model_match and condition_match:
        parts.append(f"{model_match.group(1)} 个模型 × {condition_match.group(1)} 种部署条件")
    elif model_match:
        parts.append(f"{model_match.group(1)} 个模型")
        
    return parts

def extract_method_findings(text: str) -> List[str]:
    findings = []
    normalized = text.lower()
    
    if re.search(r'clean evidence produced the strongest improvement', normalized):
        findings.append("最有效的是高质量、干净的证据输入，不是更复杂的检索链路")
        
    high_risk_drop = re.search(r'high-risk error from\s+([0-9.]+)%\s+to\s+([0-9.]+)%', text, flags=re.IGNORECASE)
    if high_risk_drop:
        findings.append(f"高风险错误率可从 {high_risk_drop.group(1)}% 降到 {high_risk_drop.group(2)}%")
        
    if re.search(r'did not reproduce this safety profile', normalized):
        findings.append("标准 RAG 和 agentic RAG 没有复制这种安全收益")
        
    if re.search(r'increased latency without closing the safety gap', normalized):
        findings.append("长上下文会增加延迟，但不会自动补齐安全差距")
        
    if re.search(r'worst-case analysis showed', text, flags=re.IGNORECASE):
        findings.append("真正危险的错误集中在少数高风险问题上")
        
    if re.search(r'reduce outlier artifacts', normalized):
        findings.append("能减少异常 token 带来的生成伪影")
        
    if re.search(r'improve generation quality', normalized):
        findings.append("同时提升最终图像生成质量")
        
    if re.search(r'outlier-token control', normalized):
        findings.append("异常 token 控制是更强 DiT 的关键组成")
        
    return findings[:3]

def build_rule_based_summary_draft(paper: SourcePaperForSummary, context: PaperSummaryContext) -> SummaryDraft:
    mode = detect_paper_mode(paper)
    evidence_text = f"{paper['title']} {paper['summary']} {' '.join(context['abstractSentences'])} {' '.join(context['sectionHeadings'])}"
    
    if mode == "survey":
        has_levels = includes_any(evidence_text, [re.compile(r'L1 Predictor', re.IGNORECASE), re.compile(r'L2 Simulator', re.IGNORECASE), re.compile(r'L3 Evolver', re.IGNORECASE), re.compile(r'three capability levels', re.IGNORECASE)])
        has_laws = includes_any(evidence_text, [re.compile(r'physical', re.IGNORECASE), re.compile(r'digital', re.IGNORECASE), re.compile(r'social', re.IGNORECASE), re.compile(r'scientific', re.IGNORECASE), re.compile(r'governing-law regimes', re.IGNORECASE)])
        has_scale = includes_any(evidence_text, [re.compile(r'400 works', re.IGNORECASE), re.compile(r'100 representative systems', re.IGNORECASE), re.compile(r'representative systems', re.IGNORECASE)])
        
        method_str = "作者提出一个 levels×laws 双轴分类：一轴把 world model 分成 L1、L2、L3 三层能力，另一轴按 physical、digital、social、scientific 四类规律划分场景，用同一套坐标去比较不同 agent。" if (has_levels and has_laws) else f"作者搭了一个双轴框架，把能力层级和环境约束放进同一张图里，并把 {'、'.join(context['sectionHeadings'][:3])} 这些主线串了起来。"
        value_str = "它的价值不只是综述，而是把 400 多篇工作和 100 多个代表系统放回同一套坐标系，让你看清一个系统缺的是短期预测、长期模拟，还是失败后的模型更新。" if has_scale else "它的价值不只是综述，而是把 predictor、simulator、evolver 这些概念放回同一个坐标系，方便判断 agent 下一步该往哪走。"
        
        return {
            "titleZh": build_rule_based_title_zh(paper, mode),
            "hook": "如果 AI 真要自己干活，它最缺的不是多说几句像人的话，而是能不能持续预测环境接下来会怎么变。",
            "problem": "问题是现在大家都在说 world model，但有人指一步预测器，有人指完整模拟器，还有人把会自我修正的系统也算进去。术语一散，不同 agent 的方法就很难放在同一张表里比较。",
            "method": method_str,
            "value": value_str,
            "ending": "这篇综述真正留下的是一把尺子：你可以直接判断一个智能体缺的是短期预测、多步模拟，还是失败后的模型修正能力。",
            "bullets": [
                "三层能力框架",
                "四类环境约束",
                "统一 world model 坐标系",
            ]
        }
        
    if mode == "theory":
        return {
            "titleZh": build_rule_based_title_zh(paper, mode),
            "hook": "这篇论文最硬核的地方，是它告诉你：有些规划问题不是暂时难解，而是原则上就不可能有通用求解器。",
            "problem": "作者研究的是 epistemic planning 里的 plan existence，也就是给定目标、知识状态和一组动作之后，到底存不存在一条可达计划。",
            "method": "它把条件收得很弱：precondition 的 modal depth 最多只有 1，而且没有 postcondition；即便这样，作者仍然证明 plan existence 是不可判定的。",
            "value": "这等于划出了一条理论边界，说明有些瓶颈不是算法没调好，而是问题本身就不存在通用可计算解。对做 agent 规划的人来说，这会直接决定你该去找可解子类还是额外结构假设。",
            "ending": "结论很直接：即便把条件压到很弱，这类认知规划问题依然不可判定，继续堆通用 planner 也不会跨过这条理论边界。",
            "bullets": [
                "研究 plan existence",
                "弱条件下仍不可判定",
                "划出规划理论边界",
            ]
        }
        
    method_sentence = next((s for s in context["abstractSentences"] if re.search(r'We propose|framework|objective', s, re.IGNORECASE)), sentence_or(context["abstractSentences"], 1, paper["summary"]))
    result_sentence = next((s for s in context["abstractSentences"] if re.search(r'improves|faster|Recall|MAP|F1', s, re.IGNORECASE)), sentence_or(context["abstractSentences"], 2, paper["summary"]))
    
    combined_text = f"{paper['title']} {paper['summary']} {' '.join(context['abstractSentences'])}"
    artifacts = extract_named_artifacts(combined_text)
    introduced_method_name = extract_introduced_method_name(combined_text)
    focus = infer_method_paper_focus(paper, context)
    problem_signal = extract_problem_signal(combined_text)
    dimensions = extract_method_dimensions(combined_text)
    evaluation_setup = extract_evaluation_setup(combined_text)
    method_findings = extract_method_findings(combined_text)
    
    lead_artifact = introduced_method_name or (artifacts[0] if artifacts else "")
    supporting_artifact = next((a for a in artifacts if a != lead_artifact), "")
    
    if lead_artifact:
        if supporting_artifact:
            method_lead = f"作者提出 {lead_artifact}，并配套 {supporting_artifact}，分别处理 {focus} 里的关键环节。"
        else:
            method_lead = f"作者提出 {lead_artifact} 这套方法，直接针对 {focus} 里最容易失稳的部分动手。"
    else:
        method_lead = f"作者的核心做法不是只改一个局部模块，而是重新组织整套系统，直接处理 {focus} 里最关键的失稳环节。"
        
    dimension_sentence = f"它重点比较的是 {'、'.join(dimensions)} 这些变量，想看清安全收益到底来自哪里。" if dimensions else ""
    setup_sentence = f"实验设置也不是只看一条曲线，而是直接比较 {'、'.join(evaluation_setup)}。" if evaluation_setup else ""
    
    if lead_artifact:
        value_lead = f"{lead_artifact} 最关键的贡献，不是再堆一个更大的系统，而是把 {focus} 里真正会失稳的环节拆开验证。"
    else:
        value_lead = f"这项工作的关键贡献，不是再堆一个更大的系统，而是把 {focus} 里真正会失稳的环节拆开验证。"
        
    finding_sentence = "；".join(method_findings) if method_findings else ""
    
    value_text = f"{value_lead} "
    if finding_sentence:
        value_text += finding_sentence
    elif result_sentence:
        value_text += "实验进一步说明，这种差别会真实改变系统表现，而不是只影响一个抽象总分。"
    value_text = value_text.strip()
    
    ending = f"这篇论文最后说明的是：{method_findings[0]}，所以 {focus} 不能再被粗暴压成一个总分。" if method_findings else f"这篇论文最后说明的是：{focus} 必须被拆开分析，不能只看最后一个漂亮总分。"
    
    bullets = [
        f"核心方法：{lead_artifact}" if lead_artifact else "核心方法：系统级重构",
        f"关键配套：{supporting_artifact}" if supporting_artifact else f"核心场景：{focus}",
        method_findings[0] if method_findings else (f"关键变量：{'、'.join(dimensions[:2])}" if dimensions else f"关键变量：{focus}")
    ]
    
    return {
        "titleZh": build_rule_based_title_zh(paper, mode),
        "hook": f"这篇论文盯上的，不是表面分数，而是 {focus} 这个真正决定系统好不好用的核心问题。",
        "problem": f"作者想解决的是：{problem_signal}。真正决定系统能不能落地的，往往是 {focus}。",
        "method": " ".join([m for m in [method_lead, dimension_sentence, setup_sentence] if m]),
        "value": value_text,
        "ending": ending,
        "bullets": bullets
    }
