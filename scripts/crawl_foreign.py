#!/usr/bin/env python3
"""
Foreign Stock Analyst Data Crawler (Yahoo Finance)
Fetches analyst target prices, PER, PBR, EPS estimates, financials
for all non-Korean stocks in the portfolio.

Runs via GitHub Actions daily → outputs to src/data/foreign-analyst.json
"""

import json
import time
import sys
from datetime import datetime
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("Installing yfinance...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "-q"])
    import yfinance as yf


# ─── Foreign Stock Tickers ───
# ticker → display name (from portfolio.json)
STOCK_MAP = {
    # US Stocks
    "GOOGL": "알파벳 A",
    "GOOG": "알파벳 C",
    "TSM": "TSMC",
    "GEV": "GE베르노바",
    "VRT": "버티브 홀딩스",
    "LLY": "일라이 릴리",
    "AAPL": "애플",
    "META": "메타",
    "BE": "블룸 에너지",
    "PLTR": "팔란티어",
    "NVDA": "엔비디아",
    "LMT": "록히드 마틴",
    "MSFT": "마이크로소프트",
    "AMZN": "아마존",
    "ORCL": "오라클",
    "ADI": "ADI",
    "AVGO": "브로드컴",
    "CEG": "컨스텔레이션 에너지",
    "TSLA": "테슬라",
    "MRVL": "마블 테크",
    "APP": "앱러빈",
    "CRWD": "크라우드스트라이크",
    "SMR": "뉴스케일 파워",
    "NVTS": "나비타스",
    "CLS": "셀레스티카",
    "TEM": "템퍼스 AI",
    "NVO": "노보노디스크",
    # HK Stocks
    "3690.HK": "메이투안",
    "9618.HK": "징둥그룹",
}

# Map portfolio tickers to yfinance tickers
TICKER_YF_MAP = {
    "3690": "3690.HK",
    "9618": "9618.HK",
}


def safe_get(info: dict, key: str, default=None):
    """Safely get value from yfinance info dict."""
    val = info.get(key, default)
    if val is None or val == "Infinity" or val == float("inf"):
        return default
    return val


def fetch_stock_data(yf_ticker: str) -> dict:
    """Fetch analyst and valuation data for a single stock."""
    result = {
        "currentPrice": None,
        "targetPrice": None,
        "targetHigh": None,
        "targetLow": None,
        "targetMedian": None,
        "analystCount": None,
        "recommendation": None,
        "per": None,
        "forwardPer": None,
        "pbr": None,
        "psr": None,
        "evEbitda": None,
        "eps": None,
        "forwardEps": None,
        "dividendYield": None,
        "marketCap": None,
        "roe": None,
        "debtToEquity": None,
        "revenue": None,
        "operatingIncome": None,
        "netIncome": None,
        "yearHigh": None,
        "yearLow": None,
    }

    try:
        stock = yf.Ticker(yf_ticker)
        info = stock.info

        if not info or "symbol" not in info:
            print(f"  [WARN] No info returned")
            return result

        # ── Prices ──
        result["currentPrice"] = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice")
        result["yearHigh"] = safe_get(info, "fiftyTwoWeekHigh")
        result["yearLow"] = safe_get(info, "fiftyTwoWeekLow")

        # ── Analyst Target ──
        result["targetPrice"] = safe_get(info, "targetMeanPrice")
        result["targetHigh"] = safe_get(info, "targetHighPrice")
        result["targetLow"] = safe_get(info, "targetLowPrice")
        result["targetMedian"] = safe_get(info, "targetMedianPrice")
        result["analystCount"] = safe_get(info, "numberOfAnalystOpinions")
        result["recommendation"] = safe_get(info, "recommendationKey")

        # ── Valuation ──
        result["per"] = safe_get(info, "trailingPE")
        result["forwardPer"] = safe_get(info, "forwardPE")
        result["pbr"] = safe_get(info, "priceToBook")
        result["psr"] = safe_get(info, "priceToSalesTrailing12Months")
        result["evEbitda"] = safe_get(info, "enterpriseToEbitda")
        result["eps"] = safe_get(info, "trailingEps")
        result["forwardEps"] = safe_get(info, "forwardEps")
        result["dividendYield"] = safe_get(info, "dividendYield")
        result["marketCap"] = safe_get(info, "marketCap")
        result["roe"] = safe_get(info, "returnOnEquity")
        result["debtToEquity"] = safe_get(info, "debtToEquity")

        # ── Financials (latest annual) ──
        try:
            fin = stock.financials
            if fin is not None and not fin.empty:
                latest = fin.iloc[:, 0]  # Most recent year
                result["revenue"] = safe_get(dict(latest), "Total Revenue")
                result["operatingIncome"] = safe_get(dict(latest), "Operating Income")
                result["netIncome"] = safe_get(dict(latest), "Net Income")
        except Exception:
            pass

    except Exception as e:
        print(f"  [ERROR] {e}")

    return result


def main():
    output_path = Path(__file__).parent.parent / "src" / "data" / "foreign-analyst.json"

    results = {}
    total = len(STOCK_MAP)

    print(f"=== Foreign Stock Analyst Data Crawler (Yahoo Finance) ===")
    print(f"Crawling {total} stocks...")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()

    for idx, (yf_ticker, name) in enumerate(STOCK_MAP.items(), 1):
        # Portfolio ticker (without .HK suffix for display)
        portfolio_ticker = yf_ticker.replace(".HK", "")

        print(f"[{idx}/{total}] {name} ({yf_ticker})")

        data = fetch_stock_data(yf_ticker)
        data["yfinanceTicker"] = yf_ticker
        data["name"] = name

        results[portfolio_ticker] = data

        # Log summary
        parts = []
        if data["currentPrice"]:
            parts.append(f"${data['currentPrice']:.2f}")
        if data["targetPrice"]:
            parts.append(f"목표:${data['targetPrice']:.2f}")
        if data["forwardPer"]:
            parts.append(f"fPER:{data['forwardPer']:.1f}")
        elif data["per"]:
            parts.append(f"PER:{data['per']:.1f}")
        if data["pbr"]:
            parts.append(f"PBR:{data['pbr']:.2f}")
        if data["recommendation"]:
            parts.append(f"추천:{data['recommendation']}")

        status = ", ".join(parts) if parts else "데이터 없음"
        print(f"  → {status}")

        # Rate limit (be nice to Yahoo)
        if idx < total:
            time.sleep(1)

    # Write output
    output = {
        "fetchedAt": datetime.now().isoformat(),
        "source": "Yahoo Finance (yfinance)",
        "stockCount": len(results),
        "stocks": results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved to {output_path}")
    print(f"✓ {len(results)} stocks processed")

    with_target = sum(1 for v in results.values() if v["targetPrice"])
    with_per = sum(1 for v in results.values() if v["per"] or v["forwardPer"])
    print(f"  - 목표주가 있음: {with_target}/{len(results)}")
    print(f"  - PER 있음: {with_per}/{len(results)}")


if __name__ == "__main__":
    main()
