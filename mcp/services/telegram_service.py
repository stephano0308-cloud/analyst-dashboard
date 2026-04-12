from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .ticker_alias import matches_ticker, normalize_ticker


def _default_json_path() -> Path:
    env_path = os.getenv("TELEGRAM_ANALYSIS_JSON")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[2] / "src" / "data" / "telegram-analysis.json"


def load_telegram_data() -> dict[str, Any]:
    path = _default_json_path()
    if not path.exists():
        return {"status": "missing", "stocks": {}, "channels": [], "totalMessages": 0}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_channels() -> list[str]:
    data = load_telegram_data()
    return data.get("channels", [])


def get_messages(channel: str | None = None, limit: int = 50, since_hours: int | None = None, query: str | None = None) -> list[dict[str, Any]]:
    data = load_telegram_data()
    stocks = data.get("stocks", {})
    rows: list[dict[str, Any]] = []

    for ticker, payload in stocks.items():
        if ticker == "__market__":
            continue
        for msg in payload.get("messages", []) or []:
            row = {
                "ticker": ticker,
                "channel": msg.get("channel"),
                "text": msg.get("text", ""),
                "date": msg.get("date"),
            }
            rows.append(row)

    if channel:
        rows = [r for r in rows if r.get("channel") == channel]
    if query:
        q = query.lower()
        rows = [r for r in rows if q in (r.get("text") or "").lower() or q in (r.get("ticker") or "").lower()]

    rows.sort(key=lambda x: x.get("date") or "", reverse=True)
    return rows[:limit]


def search_messages(query: str, limit: int = 50) -> list[dict[str, Any]]:
    return get_messages(query=query, limit=limit)


def get_ticker_payload(ticker: str) -> dict[str, Any]:
    data = load_telegram_data()
    stocks = data.get("stocks", {})
    normalized = normalize_ticker(ticker)

    if normalized in stocks:
        payload = dict(stocks[normalized])
        payload.setdefault("ticker", normalized)
        return payload

    matched_messages: list[dict[str, Any]] = []
    channels: set[str] = set()
    latest_date = None

    for stock_ticker, payload in stocks.items():
        if stock_ticker == "__market__":
            continue
        for msg in payload.get("messages", []) or []:
            if matches_ticker(msg.get("text", ""), normalized):
                matched_messages.append({
                    "channel": msg.get("channel"),
                    "text": msg.get("text", ""),
                    "date": msg.get("date"),
                })
                if msg.get("channel"):
                    channels.add(msg.get("channel"))
                if msg.get("date") and (latest_date is None or msg.get("date") > latest_date):
                    latest_date = msg.get("date")

    return {
        "ticker": normalized,
        "summary": "",
        "messageCount": len(matched_messages),
        "channels": sorted(channels),
        "latestDate": latest_date,
        "messages": matched_messages,
    }
