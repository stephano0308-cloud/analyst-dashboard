from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from services.analysis_service import analyze_ticker
from services.file_service import list_documents, read_document
from services.telegram_service import get_messages, list_channels, search_messages

mcp = FastMCP("analyst-dashboard-mcp")


@mcp.tool()
def list_telegram_channels() -> dict:
    return {"channels": list_channels()}


@mcp.tool()
def get_telegram_messages(channel: str = "", limit: int = 50, since_hours: int = 24, query: str = "") -> dict:
    return {
        "channel": channel or None,
        "count": len(get_messages(channel=channel or None, limit=limit, since_hours=since_hours, query=query or None)),
        "messages": get_messages(channel=channel or None, limit=limit, since_hours=since_hours, query=query or None),
    }


@mcp.tool()
def search_telegram_messages(query: str, limit: int = 50) -> dict:
    rows = search_messages(query=query, limit=limit)
    return {"query": query, "count": len(rows), "messages": rows}


@mcp.tool()
def list_documents_tool() -> dict:
    docs = list_documents()
    return {"count": len(docs), "documents": docs}


@mcp.tool()
def read_document_tool(path: str) -> dict:
    return read_document(path)


@mcp.tool()
def analyze_ticker_mentions(ticker: str, since_days: int = 7) -> dict:
    return analyze_ticker(ticker=ticker, since_days=since_days)


if __name__ == "__main__":
    mcp.run()
