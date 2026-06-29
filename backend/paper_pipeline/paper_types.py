from typing import List, Literal, TypedDict, Optional

class SummaryDraft(TypedDict):
    titleZh: str
    hook: str
    problem: str
    method: str
    value: str
    ending: str
    bullets: List[str]

class SourcePaperForSummary(TypedDict):
    arxivId: str
    title: str
    summary: str
    categories: List[str]
    publishedAt: str

PaperMode = Literal["survey", "theory", "method"]

class PaperSummaryContext(TypedDict):
    rawText: str
    abstractSentences: List[str]
    sectionHeadings: List[str]

class SummaryResult(TypedDict):
    summaryMode: str
    scriptDraft: SummaryDraft
    abstractSentences: List[str]
    sectionHeadings: List[str]
    modelName: Optional[str]
