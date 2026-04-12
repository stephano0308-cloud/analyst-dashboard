from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from telethon import TelegramClient
from telethon.sessions import StringSession

from .ticker_alias import matches_ticker, normalize_ticker


def _split_channels(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip().lstrip('@') for part in raw.split(',') if part.strip()]


def configured_channels() -> list[str]:
    return _split_channels(os.getenv("TELEGRAM_CHANNELS"))


async def fetch_recent_messages(
    channels: list[str] | None = None,
    limit_per_channel: int = 30,
    since_hours: int = 24,
    query: str | None = None,
) -> list[dict[str, Any]]:
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session = os.getenv("TELEGRAM_SESSION")

    if not api_id or not api_hash or not session:
        raise RuntimeError("텔레그램 환경변수(TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION)가 필요합니다.")

    target_channels = channels or configured_channels()
    if not target_channels:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    rows: list[dict[str, Any]] = []

    async with TelegramClient(StringSession(session), int(api_id), api_hash) as client:
        for channel in target_channels:
            async for message in client.iter_messages(channel, limit=limit_per_channel):
                if not message or not message.message:
                    continue
                msg_date = message.date
                if msg_date and msg_date < cutoff:
                    continue
                text = message.message or ""
                if query and query.lower() not in text.lower():
                    continue
                rows.append({
                    "channel": channel,
                    "text": text,
                    "date": msg_date.isoformat() if msg_date else None,
                    "message_id": message.id,
                    "url": f"https://t.me/{channel}/{message.id}",
                })

    rows.sort(key=lambda x: x.get("date") or "", reverse=True)
    return rows


async def find_ticker_messages(
    ticker: str,
    channels: list[str] | None = None,
    limit_per_channel: int = 30,
    since_hours: int = 24,
) -> dict[str, Any]:
    canonical = normalize_ticker(ticker)
    rows = await fetch_recent_messages(
        channels=channels,
        limit_per_channel=limit_per_channel,
        since_hours=since_hours,
        query=None,
    )
    matched = [row for row in rows if matches_ticker(row.get("text", ""), canonical) or matches_ticker(row.get("channel", ""), canonical)]
    matched_channels = sorted({row.get("channel") for row in matched if row.get("channel")})

    return {
        "ticker": canonical,
        "message_count": len(matched),
        "channels": matched_channels,
        "messages": matched,
    }
