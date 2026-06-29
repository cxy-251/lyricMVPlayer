import re
from typing import List, Literal
from .paper_types import SummaryDraft, PaperMode

def strip_outer_quotes(value: str) -> str:
    value = value.strip().replace("“", '"').replace("”", '"')
    value = re.sub(r'^"(.+)"$', r'\1', value)
    value = re.sub(r"^'(.+)'$", r'\1', value)
    return value

def collapse_whitespace(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()

REASONING_MARKERS = [
    re.compile(r'\bWait\b', re.IGNORECASE),
    re.compile(r"\bLet's\b", re.IGNORECASE),
    re.compile(r'\bI should\b', re.IGNORECASE),
    re.compile(r'\bTo be safe\b', re.IGNORECASE),
    re.compile(r'\bNeed to check\b', re.IGNORECASE),
    re.compile(r'\bRecount\b', re.IGNORECASE),
    re.compile(r'\bcharacter count\b', re.IGNORECASE),
    re.compile(r'\bchars?\b', re.IGNORECASE),
]

def strip_reasoning_leak(value: str) -> str:
    for marker in REASONING_MARKERS:
        match = marker.search(value)
        if match and match.start() > 0:
            return value[:match.start()].strip()
    return value

def remove_weak_openers(value: str) -> str:
    value = re.sub(r'^这篇论文(主要|核心)?(是在|想要|试图)?', '', value)
    value = re.sub(r'^作者(主要|核心)?(提出|讨论|研究)的是?', '', value)
    return value.strip()

def trim_by_clauses(value: str, max_clauses: int) -> str:
    clauses = [item.strip() for item in re.split(r'[。！？]', value) if item.strip()]
    if len(clauses) <= max_clauses:
        return '。'.join(clauses) + ('。' if value.endswith(('。','！','？')) else '')
    return '。'.join(clauses[:max_clauses]) + '。'

def trim_by_chars(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    trimmed = re.sub(r'[，、；：,.!?！？]+$', '', value[:limit]).strip()
    return trimmed or value[:limit]

def normalize_punctuation(value: str) -> str:
    value = re.sub(r'[。]{2,}', '。', value)
    value = re.sub(r'[，]{2,}', '，', value)
    value = re.sub(r'[；]{2,}', '；', value)
    return value.strip()

def expand_terms(value: str) -> str:
    value = re.sub(r'(?<![（(])\bagentic RAG\b', '__AGENTIC_RAG__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bRAG\b', '__RAG__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bLLMs\b', '__LLMS__', value)
    value = re.sub(r'(?<![（(])\bLLM\b', '__LLM__', value)
    value = re.sub(r'(?<![（(])\bGUI agents?\b', '__GUI_AGENT__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bRL\b', '__RL__', value)
    value = re.sub(r'(?<![（(])\bAI agents?\b', '__AI_AGENT__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bworld model\b', '__WORLD_MODEL__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bplan existence\b', '__PLAN_EXISTENCE__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bepistemic planning\b', '__EPISTEMIC_PLANNING__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bpointed Kripke model\b', '__POINTED_KRIPKE__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bepistemic actions?\b', '__EPISTEMIC_ACTION__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bmodal depth\b', '__MODAL_DEPTH__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\bpostconditions?\b', '__POSTCONDITION__', value, flags=re.IGNORECASE)
    value = re.sub(r'(?<![（(])\brollouts?\b', '__ROLLOUT__', value, flags=re.IGNORECASE)
    
    value = value.replace('__AGENTIC_RAG__', '主动规划式检索增强生成（agentic RAG）')
    value = value.replace('__RAG__', '检索增强生成（RAG）')
    value = value.replace('__LLMS__', '大语言模型（LLM）')
    value = value.replace('__LLM__', '大语言模型（LLM）')
    value = value.replace('__GUI_AGENT__', '图形界面智能体（GUI agent）')
    value = value.replace('__RL__', '强化学习（RL）')
    value = value.replace('__AI_AGENT__', 'AI 智能体')
    value = value.replace('__WORLD_MODEL__', '世界模型')
    value = value.replace('__PLAN_EXISTENCE__', '计划存在性')
    value = value.replace('__EPISTEMIC_PLANNING__', '认知规划（epistemic planning）')
    value = value.replace('__POINTED_KRIPKE__', '带真实世界指针的知识状态图（pointed Kripke model）')
    value = value.replace('__EPISTEMIC_ACTION__', '认知动作（epistemic action）')
    value = value.replace('__MODAL_DEPTH__', '模态深度（modal depth）')
    value = value.replace('__POSTCONDITION__', '后置条件（postcondition）')
    value = value.replace('__ROLLOUT__', '多步推演')
    
    value = re.sub(r'大语言模型（(?:大语言模型（)+LLM）(?:）)+', '大语言模型（LLM）', value)
    value = re.sub(r'主动规划式检索增强生成（agentic\s+检索增强生成（RAG））', '主动规划式检索增强生成（agentic RAG）', value)
    value = re.sub(r'标准\s+检索增强生成（RAG）', '标准检索增强生成（RAG）', value)
    
    return value

def rewrite_weak_ending(value: str) -> str:
    value = re.sub(r'建议你先收藏起来', '这篇论文的主线已经很明确', value)
    value = re.sub(r'建议先收藏起来', '这篇论文的主线已经很明确', value)
    value = re.sub(r'建议先收藏', '这篇论文的主线已经很明确', value)
    value = re.sub(r'值得收藏起来', '这篇论文的主线已经很明确', value)
    value = re.sub(r'值得先读', '这篇论文的重点已经讲清楚', value)
    value = re.sub(r'值得一读', '这篇论文的重点已经讲清楚', value)
    value = re.sub(r'值得一看', '这篇论文的重点已经讲清楚', value)
    value = re.sub(r'值得看', '这篇论文的重点已经讲清楚', value)
    value = re.sub(r'看完这篇[，,]?\s*你(?:就)?会知道', '这篇论文真正说明的是', value)
    value = re.sub(r'看完你(?:就)?会知道', '真正关键的是', value)
    value = re.sub(r'看完你(?:就)?能抓住这篇论文的主线', '这篇论文的主线是', value)
    return value

def polish_title_translation(value: str) -> str:
    cleaned = collapse_whitespace(strip_outer_quotes(value))
    cleaned = re.sub(r'^\s*中文标题\s*[:：]\s*', '', cleaned)
    cleaned = re.sub(r'^\s*标题\s*[:：]\s*', '', cleaned)
    cleaned = re.sub(r'^\s*论文标题\s*[:：]\s*', '', cleaned)
    cleaned = re.sub(r'[“”]', '', cleaned)
    cleaned = re.sub(r'\s*:\s*', '：', cleaned)
    cleaned = re.sub(r'\s*-\s*', ' - ', cleaned)
    return trim_by_chars(normalize_punctuation(cleaned.strip()), 42)

def polish_sentence(value: str, mode: Literal["hook", "problem", "method", "value", "ending"]) -> str:
    cleaned = collapse_whitespace(strip_outer_quotes(value))
    cleaned = re.sub(r'AI智能体', 'AI 智能体', cleaned)
    cleaned = re.sub(r'\s*（\s*', '（', cleaned)
    cleaned = re.sub(r'\s*）\s*', '）', cleaned)
    cleaned = re.sub(r'\s*×\s*', '×', cleaned)
    
    de_leaked = expand_terms(strip_reasoning_leak(cleaned))
    ending_normalized = rewrite_weak_ending(de_leaked) if mode == "ending" else de_leaked
    
    value_normalized = ending_normalized
    if mode == "value":
        value_normalized = re.sub(r'^它的价值不只是综述', '这不只是综述', value_normalized)
        value_normalized = re.sub(r'^它的价值不只是', '它真正的价值在于', value_normalized)
        
    clause_limited = trim_by_clauses(value_normalized, 1 if mode == "ending" else 2)
    de_fluffed = normalize_punctuation(remove_weak_openers(clause_limited))
    
    max_chars = {
        "hook": 92,
        "ending": 72,
        "method": 220,
        "value": 220
    }.get(mode, 156)
    
    return trim_by_chars(de_fluffed or clause_limited or cleaned, max_chars)

def polish_bullet(value: str) -> str:
    cleaned = collapse_whitespace(strip_outer_quotes(value))
    cleaned = re.sub(r'^[-*•]\s*', '', cleaned)
    cleaned = re.sub(r'[。；;！!？?]+$', '', cleaned)
    return trim_by_chars(strip_reasoning_leak(cleaned.strip()), 32)

def is_usable_bullet(value: str) -> bool:
    if not value or len(value) < 4:
        return False
    if any(marker.search(value) for marker in REASONING_MARKERS):
        return False
    ascii_count = len(re.findall(r'[A-Za-z]', value))
    return ascii_count <= max(4, len(value) // 4)

def build_fallback_bullets(draft: SummaryDraft) -> List[str]:
    candidates = []
    for text in [draft['method'], draft['value'], draft['problem']]:
        for item in re.split(r'[，。；]', text):
            polished = polish_bullet(item)
            if len(polished) >= 6:
                candidates.append(polished)
    return candidates[:3]

def polish_summary_draft(draft: SummaryDraft, paper_mode: PaperMode) -> SummaryDraft:
    bullets = []
    for item in draft['bullets']:
        polished = polish_bullet(item)
        if is_usable_bullet(polished) and polished not in bullets:
            bullets.append(polished)
            
    fallback_bullets = build_fallback_bullets(draft)
    normalized_bullets = (bullets + fallback_bullets)[:3]
    
    mode_aware_ending = draft['ending']
    if paper_mode == "survey" and not re.search(r'框架|坐标系|全景', draft['ending']):
        mode_aware_ending = f"{draft['ending']} 它更像进入这个方向的一张路线图。"
        
    final_bullets = normalized_bullets
    if len(final_bullets) < 3:
        final_bullets.extend(["核心问题更清楚", "方法结构更明确", "价值判断更直接"])
        final_bullets = final_bullets[:3]
        
    return {
        "titleZh": polish_title_translation(draft['titleZh']),
        "hook": polish_sentence(draft['hook'], "hook"),
        "problem": polish_sentence(draft['problem'], "problem"),
        "method": polish_sentence(draft['method'], "method"),
        "value": polish_sentence(draft['value'], "value"),
        "ending": polish_sentence(mode_aware_ending, "ending"),
        "bullets": final_bullets
    }

def to_display_sentence(value: str, mode: Literal["hook", "problem", "method", "value", "ending"]) -> str:
    spoken = polish_sentence(value, mode)
    clauses = [item.strip() for item in re.split(r'[，；：]', spoken) if item.strip()]
    first_clause = clauses[0] if clauses else spoken
    
    no_trail = re.sub(r'(其实|本质上|更像是|说白了|换句话说)', '', first_clause)
    no_trail = re.sub(r'[。！？!?]+$', '', no_trail).strip()
    
    max_chars = 24 if mode == "hook" else (22 if mode == "ending" else 20)
    return trim_by_chars(no_trail or spoken, max_chars)

def build_display_draft(draft: SummaryDraft, paper_mode: PaperMode) -> SummaryDraft:
    polished = polish_summary_draft(draft, paper_mode)
    
    bullets = []
    for item in polished['bullets']:
        pol = polish_bullet(item)
        if is_usable_bullet(pol) and pol not in bullets:
            bullets.append(pol)
    bullets = bullets[:3]
    
    if len(bullets) < 3:
        bullets.extend(["核心问题更清楚", "方法结构更明确", "价值判断更直接"])
        bullets = bullets[:3]
        
    return {
        "titleZh": polished["titleZh"],
        "hook": to_display_sentence(polished["hook"], "hook"),
        "problem": to_display_sentence(polished["problem"], "problem"),
        "method": to_display_sentence(polished["method"], "method"),
        "value": to_display_sentence(polished["value"], "value"),
        "ending": to_display_sentence(polished["ending"], "ending"),
        "bullets": bullets
    }
