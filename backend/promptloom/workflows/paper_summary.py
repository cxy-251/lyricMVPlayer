from __future__ import annotations

import json

from promptloom.providers.lmstudio import LmStudioClient
from promptloom.types import JsonObject


class PaperSummaryWorkflow:
    id = "paper_summary.v1"

    async def run(self, client: LmStudioClient, input_data: JsonObject) -> JsonObject:
        paper_context = input_data.get("paper_context", {})
        
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(paper_context)
        
        payload = await client.generate_json(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
        return self._normalize_results(payload)

    def _build_system_prompt(self) -> str:
        return """
You are an expert technical editor. Your goal is to summarize academic papers into short, engaging scripts for a short video presentation.
Always return ONLY a valid JSON object matching this schema exactly:
{
  "titleZh": "论文英文标题的直接中文翻译",
  "hook": "先用一句人话点出这篇论文最重要的判断或发现。",
  "problem": "说明作者真正想解决的瓶颈，别复述标题。",
  "method": "明确作者提出了什么方法、框架、证明或系统。",
  "value": "说明这件事带来的技术价值、理论结论或关键结果。",
  "ending": "最后一句直接收束成结论，不要引导观众去看原文。",
  "bullets": ["屏显要点一", "屏显要点二", "屏显要点三"]
}
"""

    def _build_user_prompt(self, context: JsonObject) -> str:
        return f"""
Please summarize the following paper into the required JSON structure.
Source Summary: {context.get("sourceSummary", "")}
Abstract: {context.get("abstract", "")}
Headings: {", ".join(context.get("headings", []))}
Intro Snippet: {context.get("introSnippet", "")}
Method Snippet: {context.get("methodSnippet", "")}
Result Snippet: {context.get("resultSnippet", "")}
Focused Excerpt: {context.get("focusedExcerpt", "")}
"""

    def _normalize_results(self, payload: JsonObject) -> JsonObject:
        # Provide fallback values if missing
        return {
            "titleZh": str(payload.get("titleZh") or "").strip(),
            "hook": str(payload.get("hook") or "").strip(),
            "problem": str(payload.get("problem") or "").strip(),
            "method": str(payload.get("method") or "").strip(),
            "value": str(payload.get("value") or "").strip(),
            "ending": str(payload.get("ending") or "").strip(),
            "bullets": [str(b).strip() for b in (payload.get("bullets") or [])][:3]
        }
