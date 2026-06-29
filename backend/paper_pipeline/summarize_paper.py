import sys
import os
import json
import re
from typing import Dict, Any, cast

# Add backend to path to import promptloom
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from promptloom.runtime import WorkflowRuntime
from .paper_types import SourcePaperForSummary, SummaryResult, SummaryDraft
from .rule_based_summary import (
    detect_paper_mode,
    extract_abstract_sentences,
    extract_section_headings,
    build_rule_based_summary_draft,
)
from .summary_polish import polish_summary_draft

def reinforce_with_rule_based_baseline(
    draft: SummaryDraft, baseline: SummaryDraft, paper_mode: str
) -> SummaryDraft:
    next_draft: SummaryDraft = {
        "titleZh": draft.get("titleZh") or "",
        "hook": draft.get("hook") or "",
        "problem": draft.get("problem") or "",
        "method": draft.get("method") or "",
        "value": draft.get("value") or "",
        "ending": draft.get("ending") or "",
        "bullets": list(draft.get("bullets") or []),
    }

    SURVEY_METHOD_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'L1 Predictor', r'L2 Simulator', r'L3 Evolver', r'levels?\s*[×x]\s*laws', r'physical', r'digital', r'social', r'scientific']]
    SURVEY_VALUE_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'400', r'100', r'RL', r'GUI', r'multi-agent', r'scientific']]
    SURVEY_PROBLEM_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'world model', r'一步', r'预测', r'模拟', r'比较', r'定义']]
    THEORY_METHOD_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'plan existence', r'modal depth', r'postcondition', r'不可判定']]
    THEORY_VALUE_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'理论边界', r'不可判定', r'通用', r'可计算']]
    THEORY_PROBLEM_SIGNALS = [re.compile(p, re.IGNORECASE) for p in [r'plan existence', r'模态', r'知识', r'动作', r'目标']]
    GENERIC_PHRASES = [re.compile(p, re.IGNORECASE) for p in [r'统一坐标', r'双轴框架', r'画了张清晰地图', r'方便.*理解', r'提供.*评估', r'很重要']]
    GENERIC_BULLET_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [r'统一坐标系', r'助力', r'提供.*评估', r'方便.*理解']]
    PROMOTIONAL_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [r'收藏', r'值得先读', r'值得一读', r'推荐.*论文', r'先读.*论文', r'值得看']]
    TOO_SHORT_RATIO = 0.72

    def has_signal(value: str, patterns: list) -> bool:
        return any(p.search(value) for p in patterns)

    def is_weak_narration(value: str) -> bool:
        if not value or len(value.strip()) < 6 or re.match(r'^[.。…\s]+$', value.strip()):
            return True
        return False

    def is_too_short_compared_to_baseline(value: str, bline: str) -> bool:
        return len(value.strip()) < int(len(bline.strip()) * TOO_SHORT_RATIO)

    def has_dangling_ending(value: str) -> bool:
        if re.search(r'(?:[和与及]\s*(?:[A-Za-z][A-Za-z0-9-]*\s*){1,4}|[和与及])$', value.strip()):
            return True
        if re.search(r'(?:，|；|:|：)\s*$', value.strip()):
            return True
        return False

    if not next_draft["titleZh"].strip():
        next_draft["titleZh"] = baseline["titleZh"]

    if is_weak_narration(next_draft["hook"]):
        next_draft["hook"] = baseline["hook"]

    if is_weak_narration(next_draft["ending"]) or has_signal(next_draft["ending"], PROMOTIONAL_PATTERNS):
        next_draft["ending"] = baseline["ending"]

    if has_signal(next_draft["value"], PROMOTIONAL_PATTERNS):
        next_draft["value"] = baseline["value"]

    if has_dangling_ending(next_draft["method"]) or is_too_short_compared_to_baseline(next_draft["method"], baseline["method"]):
        next_draft["method"] = baseline["method"]

    if has_dangling_ending(next_draft["value"]) or is_too_short_compared_to_baseline(next_draft["value"], baseline["value"]):
        next_draft["value"] = baseline["value"]

    if paper_mode == "survey":
        if not has_signal(next_draft["problem"], SURVEY_PROBLEM_SIGNALS) or has_signal(next_draft["problem"], GENERIC_PHRASES) or is_too_short_compared_to_baseline(next_draft["problem"], baseline["problem"]):
            next_draft["problem"] = baseline["problem"]
        if not has_signal(next_draft["method"], SURVEY_METHOD_SIGNALS) or has_signal(next_draft["method"], GENERIC_PHRASES) or is_too_short_compared_to_baseline(next_draft["method"], baseline["method"]):
            next_draft["method"] = baseline["method"]
        if not has_signal(next_draft["value"], SURVEY_VALUE_SIGNALS) or has_signal(next_draft["value"], GENERIC_PHRASES) or is_too_short_compared_to_baseline(next_draft["value"], baseline["value"]):
            next_draft["value"] = baseline["value"]

    if paper_mode == "theory":
        if not has_signal(next_draft["problem"], THEORY_PROBLEM_SIGNALS) or is_too_short_compared_to_baseline(next_draft["problem"], baseline["problem"]):
            next_draft["problem"] = baseline["problem"]
        if not has_signal(next_draft["method"], THEORY_METHOD_SIGNALS) or is_too_short_compared_to_baseline(next_draft["method"], baseline["method"]):
            next_draft["method"] = baseline["method"]
        if not has_signal(next_draft["value"], THEORY_VALUE_SIGNALS) or is_too_short_compared_to_baseline(next_draft["value"], baseline["value"]):
            next_draft["value"] = baseline["value"]

    if len(next_draft["bullets"]) < 3:
        next_draft["bullets"] = baseline["bullets"]
    elif any(has_signal(b, GENERIC_BULLET_PATTERNS) for b in next_draft["bullets"]):
        next_draft["bullets"] = baseline["bullets"]

    return next_draft


async def summarize_paper(
    paper: SourcePaperForSummary,
    raw_text: str,
    summary_mode: str,
    lm_studio_config: Dict[str, Any] = None
) -> SummaryResult:
    paper_mode = detect_paper_mode(paper)
    abstract_sentences = extract_abstract_sentences(raw_text, paper.get("summary", ""))
    section_headings = extract_section_headings(raw_text)
    context = {
        "rawText": raw_text,
        "abstractSentences": abstract_sentences,
        "sectionHeadings": section_headings
    }
    
    baseline_draft = polish_summary_draft(
        build_rule_based_summary_draft(paper, context),
        paper_mode
    )

    if summary_mode == "lm-studio":
        if not lm_studio_config:
            raise ValueError("LM Studio summary mode requires lm_studio_config")
            
        runtime = WorkflowRuntime()
        
        input_data = {
            "paper_context": {
                "sourceSummary": paper.get("summary", ""),
                "abstract": " ".join(abstract_sentences),
                "headings": section_headings
            }
        }
        
        # Directly call the PromptLoom workflow locally
        script_draft_raw = await runtime.run_workflow(
            workflow_id="paper_summary.v1",
            input_data=input_data,
            runtime_options=lm_studio_config
        )
        
        script_draft = cast(SummaryDraft, script_draft_raw)
        
        return {
            "summaryMode": summary_mode,
            "scriptDraft": reinforce_with_rule_based_baseline(
                script_draft,
                baseline_draft,
                paper_mode
            ),
            "abstractSentences": abstract_sentences,
            "sectionHeadings": section_headings,
            "modelName": lm_studio_config.get("model")
        }

    return {
        "summaryMode": "rule-based",
        "scriptDraft": baseline_draft,
        "abstractSentences": abstract_sentences,
        "sectionHeadings": section_headings,
        "modelName": None
    }
