import asyncio
import json
import argparse
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)
    
from paper_pipeline.summarize_paper import summarize_paper
from paper_pipeline.paper_types import SourcePaperForSummary

async def main():
    parser = argparse.ArgumentParser(description="Run paper summarization pipeline")
    parser.add_argument("--input", "-i", type=str, required=True, help="Path to raw paper text file")
    parser.add_argument("--mode", "-m", type=str, default="rule-based", choices=["rule-based", "lm-studio"], help="Summary mode")
    parser.add_argument("--title", "-t", type=str, default="", help="Paper title")
    parser.add_argument("--summary", "-s", type=str, default="", help="Paper summary / abstract")
    parser.add_argument("--arxiv-id", type=str, default="", help="Arxiv ID")
    parser.add_argument("--output", "-o", type=str, help="Output JSON path (optional)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist.")
        sys.exit(1)
        
    with open(args.input, "r", encoding="utf-8") as f:
        raw_text = f.read()
        
    paper: SourcePaperForSummary = {
        "arxivId": args.arxiv_id,
        "title": args.title,
        "summary": args.summary,
        "categories": [],
        "publishedAt": ""
    }
    
    lm_studio_config = None
    if args.mode == "lm-studio":
        lm_studio_config = {
            "baseUrl": "http://127.0.0.1:1234/v1",
            "model": "local-model",
            "apiKey": "not-needed",
            "temperature": 0.7,
            "maxOutputTokens": 1000,
            "maxInputChars": 8000,
            "compactInputChars": 6000
        }
        
    print(f"Starting paper pipeline for: {args.title} (Mode: {args.mode})")
    
    result = await summarize_paper(
        paper=paper,
        raw_text=raw_text,
        summary_mode=args.mode,
        lm_studio_config=lm_studio_config
    )
    
    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"Result saved to {args.output}")
    else:
        print("\n--- Summary Result ---")
        print(output_json)

if __name__ == "__main__":
    asyncio.run(main())
