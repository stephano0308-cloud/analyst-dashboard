from __future__ import annotations

import asyncio

from mcp.server.fastmcp import FastMCP

from services.analysis_service import analyze_ticker
from services.file_service import list_documents, read_document
from services.live_telegram_service import configured_channels, fetch_recent_messages, find_ticker_messages
from services.telegram_service import get_messages, list_channels, search_messages

mcp = FastMCP("analyst-dashboard-live-mcp")


@mcp.tool()
def list_telegram_channels() -> dict:
    static_channels = list_channels()
    live_channels = configured_channels()
    merged = sorted(set(static_channels + live_channels))
    return {"channels": merged, "static_channels": static_channels, "live_channels": live_channels}


@mcp.tool()
def get_telegram_messages(channel: str = "", limit: int = 50, since_hours: int = 24, query: str = "") -> dict:
    rows = get_messages(channel=channel or None, limit=limit, since_hours=since_hours, query=query or None)
    return {"source": "fallback_json", "channel": channel or None, "count": len(rows), "messages": rows}


@mcp.tool()
def get_live_telegram_messages(limit_per_channel: int = 30, since_hours: int = 24, query: str = "") -> dict:
    rows = asyncio.run(fetch_recent_messages(limit_per_channel=limit_per_channel, since_hours=since_hours, query=query or None))
    return {"source": "telethon", "count": len(rows), "messages": rows}


@mcp.tool()
def search_telegram_messages(query: str, limit: int = 50) -> dict:
    rows = search_messages(query=query, limit=limit)
    return {"source": "fallback_json", "query": query, "count": len(rows), "messages": rows}


@mcp.tool()
def analyze_live_ticker_mentions(ticker: str, since_hours: int = 24, limit_per_channel: int = 30) -> dict:
    payload = asyncio.run(find_ticker_messages(ticker=ticker, since_hours=since_hours, limit_per_channel=limit_per_channel))
    base = analyze_ticker(ticker=ticker, since_days=max(1, since_hours // 24 or 1))
    return {
        **base,
        "live_message_count": payload.get("message_count", 0),
        "live_channels": payload.get("channels", []),
        "live_messages": payload.get("messages", [])[:10],
    }


@mcp.tool()
def list_documents_tool() -> dict:
    docs = list_documents()
    return {"count": len(docs), "documents": docs}


@mcp.tool()
def read_document_tool(path: str) -> dict:
    return read_document(path)


if __name__ == "__main__":
    mcp.run()
