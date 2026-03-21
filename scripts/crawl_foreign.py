#!/usr/bin/env python3
"""
Foreign Stock Analyst Data Crawler (Yahoo Finance)
Fetches: target prices, PER/PBR, financials, daily change,
RSI/MACD technical indicators, revenue/OI consensus estimates.
"""

import json
import time
import sys
import math
from datetime import datetime
from pathlib import Path

try:
    import yfinance as yf
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "numpy", "-q"])
    import yfinance as yf
    import numpy as np

STOCK_MAP = {
    "GOOGL": "알파벳 A", "GOOG": "알파벳 C", "TSM": "TSMC",
    "GEV": "GE베르노바", "VRT": "버티브 홀딩스", "LLY": "일라이 릴리",
    "AAPL": "애플", "META": "메타", "BE": "블룸 에너지",
    "PLTR": "팔란티어", "NVDA": "엔비디아", "LMT": "록히드 마틴",
    "MSFT": "마이크로소프트", "AMZN": "아마존", "ORCL": "오라클",
    "ADI": "ADI", "AVGO": "브로드컴", "CEG": "컨스텔레이션 에너지",
    "TSLA": "테슬라", "MRVL": "마블 테크", "APP": "앱러빈",
    "CRWD": "크라우드스트라이크", "SMR": "뉴스케일 파워",
    "NVTS": "나비타스", "CLS": "셀레스티카", "TEM": "템퍼스 AI",
    "NVO": "노보노디스크",
    "3690.HK": "메이투안", "9618.HK": "징둥그룹",
}


def safe(val, default=None):
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
        return default
    return val


def calc_rsi(prices, period=14):
    """Calculate RSI from price series."""
    if len(prices) < period + 1:
        return None
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 1)


def calc_macd(prices, fast=12, slow=26, signal=9):
    """Calculate MACD, signal line, histogram."""
    if len(prices) < slow + signal:
        return None, None, None
    prices = np.array(prices, dtype=float)
    ema_fast = _ema(prices, fast)
    ema_slow = _ema(prices, slow)
    macd_line = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return round(float(macd_line[-1]), 4), round(float(signal_line[-1]), 4), round(float(histogram[-1]), 4)


def _ema(data, period):
    alpha = 2 / (period + 1)
    ema = np.zeros_like(data)
    ema[0] = data[0]
    for i in range(1, len(data)):
        ema[i] = alpha * data[i] + (1 - alpha) * ema[i - 1]
    return ema


def get_signal(rsi, macd_hist):
    """Determine overbought/oversold signal."""
    signals = []
    if rsi is not None:
        if rsi >= 70:
            signals.append("과매수")
        elif rsi <= 30:
            signals.append("과매도")
    if macd_hist is not None:
        if macd_hist > 0:
            signals.append("MACD+")
        else:
            signals.append("MACD-")
    return " / ".join(signals) if signals else "중립"


def fetch_stock(yf_ticker):
    result = {
        "currentPrice": None, "prevClose": None, "dailyChange": None, "dailyChangePct": None,
        "targetPrice": None, "targetHigh": None, "targetLow": None, "targetMedian": None,
        "analystCount": None, "recommendation": None,
        "per": None, "forwardPer": None, "pbr": None, "psr": None, "evEbitda": None,
        "eps": None, "forwardEps": None, "dividendYield": None, "marketCap": None,
        "roe": None, "debtToEquity": None,
        "revenue": None, "revenueGrowth": None,
        "operatingIncome": None, "oiGrowth": None,
        "netIncome": None,
        "yearHigh": None, "yearLow": None,
        "rsi14": None, "macd": None, "macdSignal": None, "macdHist": None,
        "technicalSignal": None,
        "revenueEstimateCurrent": None, "revenueEstimateNext": None,
        "epsEstimateCurrent": None, "epsEstimateNext": None,
    }

    try:
        stock = yf.Ticker(yf_ticker)
        info = stock.info or {}

        # Prices
        result["currentPrice"] = safe(info.get("currentPrice")) or safe(info.get("regularMarketPrice"))
        result["prevClose"] = safe(info.get("previousClose")) or safe(info.get("regularMarketPreviousClose"))
        if result["currentPrice"] and result["prevClose"] and result["prevClose"] > 0:
            chg = result["currentPrice"] - result["prevClose"]
            result["dailyChange"] = round(chg, 4)
            result["dailyChangePct"] = round(chg / result["prevClose"] * 100, 2)

        result["yearHigh"] = safe(info.get("fiftyTwoWeekHigh"))
        result["yearLow"] = safe(info.get("fiftyTwoWeekLow"))

        # Analyst
        result["targetPrice"] = safe(info.get("targetMeanPrice"))
        result["targetHigh"] = safe(info.get("targetHighPrice"))
        result["targetLow"] = safe(info.get("targetLowPrice"))
        result["targetMedian"] = safe(info.get("targetMedianPrice"))
        result["analystCount"] = safe(info.get("numberOfAnalystOpinions"))
        result["recommendation"] = safe(info.get("recommendationKey"))

        # Valuation
        result["per"] = safe(info.get("trailingPE"))
        result["forwardPer"] = safe(info.get("forwardPE"))
        result["pbr"] = safe(info.get("priceToBook"))
        result["psr"] = safe(info.get("priceToSalesTrailing12Months"))
        result["evEbitda"] = safe(info.get("enterpriseToEbitda"))
        result["eps"] = safe(info.get("trailingEps"))
        result["forwardEps"] = safe(info.get("forwardEps"))
        result["dividendYield"] = safe(info.get("dividendYield"))
        result["marketCap"] = safe(info.get("marketCap"))
        result["roe"] = safe(info.get("returnOnEquity"))
        result["debtToEquity"] = safe(info.get("debtToEquity"))
        result["revenueGrowth"] = safe(info.get("revenueGrowth"))
        result["oiGrowth"] = safe(info.get("operatingMargins"))  # proxy

        # Financials
        try:
            fin = stock.financials
            if fin is not None and not fin.empty:
                col0 = fin.iloc[:, 0]
                result["revenue"] = safe(col0.get("Total Revenue"))
                result["operatingIncome"] = safe(col0.get("Operating Income"))
                result["netIncome"] = safe(col0.get("Net Income"))
                if fin.shape[1] > 1:
                    col1 = fin.iloc[:, 1]
                    prev_rev = safe(col1.get("Total Revenue"))
                    prev_oi = safe(col1.get("Operating Income"))
                    if result["revenue"] and prev_rev and prev_rev != 0:
                        result["revenueGrowth"] = round((result["revenue"] - prev_rev) / abs(prev_rev), 4)
                    if result["operatingIncome"] and prev_oi and prev_oi != 0:
                        result["oiGrowth"] = round((result["operatingIncome"] - prev_oi) / abs(prev_oi), 4)
        except Exception:
            pass

        # Earnings estimates
        try:
            ee = stock.earnings_estimate
            if ee is not None and not ee.empty:
                if "avg" in ee.columns:
                    vals = ee["avg"].values
                    result["epsEstimateCurrent"] = safe(float(vals[0])) if len(vals) > 0 else None
                    result["epsEstimateNext"] = safe(float(vals[1])) if len(vals) > 1 else None
        except Exception:
            pass

        try:
            re_ = stock.revenue_estimate
            if re_ is not None and not re_.empty:
                if "avg" in re_.columns:
                    vals = re_["avg"].values
                    result["revenueEstimateCurrent"] = safe(float(vals[0])) if len(vals) > 0 else None
                    result["revenueEstimateNext"] = safe(float(vals[1])) if len(vals) > 1 else None
        except Exception:
            pass

        # Technical indicators (from 60-day history)
        try:
            hist = stock.history(period="3mo")
            if hist is not None and len(hist) > 30:
                closes = hist["Close"].values
                result["rsi14"] = calc_rsi(closes, 14)
                m, s, h = calc_macd(closes)
                result["macd"] = m
                result["macdSignal"] = s
                result["macdHist"] = h
                result["technicalSignal"] = get_signal(result["rsi14"], h)
        except Exception:
            pass

    except Exception as e:
        print(f"  [ERROR] {e}")

    return result


def main():
    output_path = Path(__file__).parent.parent / "src" / "data" / "foreign-analyst.json"
    total = len(STOCK_MAP)
    results = {}

    print(f"=== Foreign Stock Crawler (Yahoo Finance) ===")
    print(f"{total} stocks · {datetime.now():%Y-%m-%d %H:%M}")

    for idx, (yf_ticker, name) in enumerate(STOCK_MAP.items(), 1):
        pticker = yf_ticker.replace(".HK", "")
        print(f"[{idx}/{total}] {name} ({yf_ticker})", end=" → ")

        data = fetch_stock(yf_ticker)
        data["yfinanceTicker"] = yf_ticker
        data["name"] = name
        results[pticker] = data

        parts = []
        if data["dailyChangePct"] is not None:
            parts.append(f"{'+'if data['dailyChangePct']>=0 else ''}{data['dailyChangePct']}%")
        if data["targetPrice"]:
            parts.append(f"TP:${data['targetPrice']:.0f}")
        if data["rsi14"]:
            parts.append(f"RSI:{data['rsi14']}")
        if data["technicalSignal"]:
            parts.append(data["technicalSignal"])
        print(", ".join(parts) if parts else "no data")

        if idx < total:
            time.sleep(1.2)

    output = {"fetchedAt": datetime.now().isoformat(), "source": "Yahoo Finance", "stockCount": len(results), "stocks": results}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    ok = sum(1 for v in results.values() if v["currentPrice"])
    print(f"\n✓ {ok}/{total} stocks with data → {output_path.name}")


if __name__ == "__main__":
    main()
