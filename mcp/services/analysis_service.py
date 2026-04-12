from __future__ import annotations

from collections import Counter
from typing import Any

from .file_service import list_documents, read_document
from .telegram_service import get_ticker_payload
from .ticker_alias import normalize_ticker, matches_ticker


def _extract_points(messages: list[dict[str, Any]]) -> dict[str, list[str]]:
    bull_keywords = ["확대", "성장", "상승", "수주", "강세", "기대", "호조", "모멘텀"]
    bear_keywords = ["하락", "리스크", "우려", "부담", "둔화", "경쟁", "불확실", "조정"]
    catalyst_keywords = ["실적", "가이던스", "발표", "승인", "수주", "양산", "출시"]

    bull_points: list[str] = []
    bear_points: list[str] = []
    catalysts: list[str] = []

    for msg in messages:
        text = msg.get("text", "")
        short = text[:160].replace("\n", " ")
        if any(k in text for k in bull_keywords):
            bull_points.append(short)
        if any(k in text for k in bear_keywords):
            bear_points.append(short)
        if any(k in text for k in catalyst_keywords):
            catalysts.append(short)

    return {
        "bull_points": bull_points[:5],
        "bear_points": bear_points[:5],
        "catalysts": catalysts[:5],
    }


def _find_document_evidence(ticker: str, max_docs: int = 3) -> list[dict[str, Any]]:
    canonical = normalize_ticker(ticker)
    evidence: list[dict[str, Any]] = []

    for doc in list_documents():
        loaded = read_document(doc["path"])
        text = loaded.get("text", "")
        if matches_ticker(text, canonical):
            idx = text.lower().find(canonical.lower())
            excerpt = text[max(0, idx - 120): idx + 280] if idx >= 0 else text[:400]
            evidence.append({
                "path": loaded.get("path"),
                "type": loaded.get("type"),
                "excerpt": excerpt,
            })
            if len(evidence) >= max_docs:
                break
    return evidence


def analyze_ticker(ticker: str, since_days: int = 7) -> dict[str, Any]:
    canonical = normalize_ticker(ticker)
    payload = get_ticker_payload(canonical)
    messages = payload.get("messages", []) or []
    channels = payload.get("channels", []) or []
    points = _extract_points(messages)

    channel_counts = Counter(msg.get("channel") for msg in messages if msg.get("channel"))
    document_evidence = _find_document_evidence(canonical)

    risks = points["bear_points"][:3]
    if not risks and payload.get("summary") and "실패" in str(payload.get("summary")):
        risks = ["기존 텔레그램 요약 파이프라인에서 분석 실패 흔적이 있어 원문 재검토 필요"]

    conclusion_parts = []
    if points["bull_points"]:
        conclusion_parts.append("긍정 논점이 일부 확인됨")
    if points["bear_points"]:
        conclusion_parts.append("동시에 리스크 언급도 존재함")
    if document_evidence:
        conclusion_parts.append("문서 근거와 교차검증 가능")
    if not conclusion_parts:
        conclusion_parts.append("근거가 충분하지 않아 추가 수집이 필요함")

    return {
        "ticker": canonical,
        "since_days": since_days,
        "message_count": payload.get("messageCount", len(messages)),
        "channels": channels,
        "latest_date": payload.get("latestDate"),
        "bull_points": points["bull_points"],
        "bear_points": points["bear_points"],
        "catalysts": points["catalysts"],
        "risks": risks,
        "channel_breakdown": dict(channel_counts),
        "telegram_summary": payload.get("summary", ""),
        "telegram_evidence": messages[:5],
        "document_evidence": document_evidence,
        "conclusion": "; ".join(conclusion_parts),
    }
