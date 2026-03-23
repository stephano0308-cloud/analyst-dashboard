#!/usr/bin/env python3
"""
Telegram Channel Collector + Stock Analyzer
1. Collects messages from monitored channels (Telethon)
2. Groups messages by portfolio stock mentions
3. Summarizes each stock's mentions via Claude API
4. Saves to telegram-analysis.json
"""
import asyncio, json, os, sys, re, traceback, base64
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ─── Config ───
CHANNELS = [
    'Jstockclass', 'report_figure_by_offset', 'beluga_investment',
    'easobi', 'aetherjapanresearch', 'd_ticker',
    'DOC_POOL', 'Synetika', 'sunstudy1004',
]

BASE = Path(__file__).parent.parent / "src" / "data"
OUTPUT = BASE / "telegram-analysis.json"

# Load portfolio tickers for matching
PORTFOLIO_PATH = BASE / "portfolio.json"

def load_stock_keywords():
    """Build keyword → ticker mapping from portfolio."""
    portfolio = json.loads(PORTFOLIO_PATH.read_text())
    keywords = {}
    for item in portfolio["items"]:
        t = item["티커"]
        n = item["종목명"]
        # Add ticker and name as keywords
        keywords[t.upper()] = t
        keywords[t.lower()] = t
        keywords[n] = t
        # Short forms
        if len(n) > 2:
            keywords[n[:3]] = t  # First 3 chars
    # Add common English names
    extras = {
        "하이닉스": "SK하이닉스", "삼전": "삼성전자", "삼전우": "삼성전자우",
        "현대차": "현대차", "현차": "현대차", "한에어": "한화에어로",
        "한화에어로스페이스": "한화에어로", "HD중공업": "HD현대중공업",
        "GOOGLE": "GOOGL", "ALPHABET": "GOOGL", "TESLA": "TSLA",
        "NVIDIA": "NVDA", "APPLE": "AAPL", "MICROSOFT": "MSFT",
        "AMAZON": "AMZN", "PALANTIR": "PLTR", "BROADCOM": "AVGO",
        "테슬라": "TSLA", "엔비디아": "NVDA", "애플": "AAPL",
        "구글": "GOOGL", "알파벳": "GOOGL", "아마존": "AMZN",
        "마소": "MSFT", "팔란티어": "PLTR", "메타": "META",
        "브로드컴": "AVGO", "오라클": "ORCL", "록히드": "LMT",
    }
    keywords.update(extras)
    return keywords

def find_stocks_in_text(text, keywords):
    """Find which portfolio stocks are mentioned in text."""
    if not text: return set()
    found = set()
    text_upper = text.upper()
    for kw, ticker in keywords.items():
        if kw.upper() in text_upper:
            found.add(ticker)
    return found

async def collect_messages(api_id, api_hash, session_data, hours=24):
    """Collect messages from Telegram channels using Telethon."""
    from telethon import TelegramClient
    from telethon.sessions import StringSession

    messages = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    client = TelegramClient(StringSession(session_data), api_id, api_hash)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            print("ERROR: Telegram session not authorized")
            return messages

        print(f"✓ Telegram connected")

        for ch in CHANNELS:
            try:
                entity = await client.get_entity(ch)
                count = 0
                async for msg in client.iter_messages(entity, limit=30):
                    if msg.date.replace(tzinfo=timezone.utc) < cutoff:
                        break
                    if msg.text:
                        messages.append({
                            "channel": ch,
                            "text": msg.text[:2000],  # Limit text length
                            "date": msg.date.isoformat(),
                            "id": msg.id,
                        })
                        count += 1
                print(f"  @{ch}: {count} messages")
            except Exception as e:
                print(f"  @{ch}: ERROR {e}")

    finally:
        await client.disconnect()

    return messages

def analyze_messages(messages, keywords, anthropic_key):
    """Group messages by stock and summarize with Claude."""
    import anthropic

    # Group messages by mentioned stock
    stock_messages = {}  # ticker → [messages]
    unmatched = []

    for msg in messages:
        stocks = find_stocks_in_text(msg["text"], keywords)
        if stocks:
            for ticker in stocks:
                if ticker not in stock_messages:
                    stock_messages[ticker] = []
                stock_messages[ticker].append(msg)
        else:
            unmatched.append(msg)

    print(f"\n종목 매칭: {len(stock_messages)}종목, 미매칭: {len(unmatched)}개")

    # Analyze each stock's messages with Claude
    results = {}
    client = anthropic.Anthropic(api_key=anthropic_key)

    for ticker, msgs in stock_messages.items():
        if not msgs: continue
        combined = "\n---\n".join([
            f"[{m['channel']} | {m['date'][:16]}]\n{m['text'][:500]}"
            for m in msgs[:10]  # Max 10 messages per stock
        ])

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": f"""다음은 텔레그램 채널에서 {ticker} 종목에 대한 최근 게시글입니다.
5줄 이내로 핵심 내용을 요약해주세요. 투자 관점에서 중요한 정보(실적, 전망, 이슈)를 중심으로 정리하세요.

{combined}"""}]
            )
            summary = "".join(b.text for b in response.content if b.type == "text")
        except Exception as e:
            summary = f"분석 실패: {e}"

        results[ticker] = {
            "ticker": ticker,
            "summary": summary,
            "messageCount": len(msgs),
            "channels": list(set(m["channel"] for m in msgs)),
            "latestDate": max(m["date"] for m in msgs),
            "messages": [{"channel": m["channel"], "text": m["text"][:300], "date": m["date"][:16]} for m in msgs[:5]],
        }
        print(f"  ✓ {ticker}: {len(msgs)}개 메시지 → 분석 완료")

    # Also summarize general market messages (unmatched)
    if unmatched:
        general_text = "\n---\n".join([
            f"[{m['channel']}] {m['text'][:300]}" for m in unmatched[:15]
        ])
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=500,
                messages=[{"role": "user", "content": f"다음 텔레그램 게시글에서 시장 전반 동향을 5줄로 요약:\n{general_text}"}]
            )
            results["__market__"] = {
                "ticker": "__market__",
                "summary": "".join(b.text for b in response.content if b.type == "text"),
                "messageCount": len(unmatched),
                "channels": list(set(m["channel"] for m in unmatched)),
                "latestDate": max(m["date"] for m in unmatched) if unmatched else "",
                "messages": [],
            }
        except: pass

    return results

def main():
    api_id = os.environ.get("TELEGRAM_API_ID")
    api_hash = os.environ.get("TELEGRAM_API_HASH")
    session_str = os.environ.get("TELEGRAM_SESSION")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if not all([api_id, api_hash, session_str]):
        print("⚠️ Telegram credentials not set — skipping")
        out = {"fetchedAt": datetime.now().isoformat(), "status": "skipped", "stocks": {}, "totalMessages": 0}
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        return

    print(f"=== Telegram Collector ===\n{datetime.now():%Y-%m-%d %H:%M}\n")

    keywords = load_stock_keywords()
    print(f"종목 키워드: {len(keywords)}개\n")

    # Collect
    messages = asyncio.run(collect_messages(int(api_id), api_hash, session_str, hours=24))
    print(f"\n총 수집: {len(messages)}개 메시지")

    if not messages:
        out = {"fetchedAt": datetime.now().isoformat(), "status": "no_messages", "stocks": {}, "totalMessages": 0}
        OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        return

    # Analyze
    if anthropic_key:
        results = analyze_messages(messages, keywords, anthropic_key)
    else:
        # Without Claude, just group messages
        results = {}
        for msg in messages:
            stocks = find_stocks_in_text(msg["text"], keywords)
            for t in stocks:
                if t not in results:
                    results[t] = {"ticker": t, "summary": "", "messageCount": 0, "channels": [], "messages": [], "latestDate": ""}
                results[t]["messageCount"] += 1
                results[t]["channels"] = list(set(results[t]["channels"] + [msg["channel"]]))
                if len(results[t]["messages"]) < 5:
                    results[t]["messages"].append({"channel": msg["channel"], "text": msg["text"][:300], "date": msg["date"][:16]})
                results[t]["latestDate"] = max(results[t].get("latestDate", ""), msg["date"])

    out = {
        "fetchedAt": datetime.now().isoformat(),
        "status": "ok",
        "stocks": results,
        "totalMessages": len(messages),
        "channels": CHANNELS,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n✓ {len(results)}종목 분석 → {OUTPUT.name}")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        out = {"fetchedAt": datetime.now().isoformat(), "status": "error", "stocks": {}, "totalMessages": 0}
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        sys.exit(0)
