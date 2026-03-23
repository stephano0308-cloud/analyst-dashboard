#!/usr/bin/env python3
"""Foreign Stock Crawler (Yahoo Finance) - with RSI, MACD, daily change"""
import json, time, math, sys, traceback
from datetime import datetime
from pathlib import Path
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
    if val is None: return default
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): return default
    return val

def calc_rsi(prices, period=14):
    if len(prices) < period + 1: return None
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    ag = np.mean(gains[-period:])
    al = np.mean(losses[-period:])
    if al == 0: return 100.0
    return round(100 - (100 / (1 + ag / al)), 1)

def calc_macd(prices):
    if len(prices) < 35: return None, None, None
    p = np.array(prices, dtype=float)
    def ema(d, n):
        a = 2 / (n + 1); e = np.zeros_like(d); e[0] = d[0]
        for i in range(1, len(d)): e[i] = a * d[i] + (1 - a) * e[i - 1]
        return e
    ml = ema(p, 12) - ema(p, 26); sl = ema(ml, 9); h = ml - sl
    return round(float(ml[-1]), 2), round(float(sl[-1]), 2), round(float(h[-1]), 2)

def get_signal(rsi, mh):
    s = []
    if rsi is not None:
        if rsi >= 70: s.append("과매수")
        elif rsi <= 30: s.append("과매도")
    if mh is not None: s.append("MACD+" if mh > 0 else "MACD-")
    return " / ".join(s) if s else "중립"

def fetch_stock(yf_ticker):
    r = {
        "currentPrice": None, "prevClose": None, "dailyChange": None, "dailyChangePct": None,
        "targetPrice": None, "targetHigh": None, "targetLow": None, "targetMedian": None,
        "analystCount": None, "recommendation": None,
        "per": None, "forwardPer": None, "pbr": None, "psr": None, "evEbitda": None,
        "eps": None, "forwardEps": None, "dividendYield": None, "marketCap": None,
        "roe": None, "debtToEquity": None,
        "revenue": None, "revenueGrowth": None, "operatingIncome": None, "oiGrowth": None, "netIncome": None,
        "yearHigh": None, "yearLow": None,
        "rsi14": None, "macd": None, "macdSignal": None, "macdHist": None, "technicalSignal": None,
    }
    try:
        stock = yf.Ticker(yf_ticker)
        info = stock.info or {}
        if not info.get("symbol"): return r

        r["currentPrice"] = safe(info.get("currentPrice")) or safe(info.get("regularMarketPrice"))
        r["prevClose"] = safe(info.get("previousClose")) or safe(info.get("regularMarketPreviousClose"))
        if r["currentPrice"] and r["prevClose"] and r["prevClose"] > 0:
            chg = r["currentPrice"] - r["prevClose"]
            r["dailyChange"] = round(chg, 4)
            r["dailyChangePct"] = round(chg / r["prevClose"] * 100, 2)

        r["yearHigh"] = safe(info.get("fiftyTwoWeekHigh"))
        r["yearLow"] = safe(info.get("fiftyTwoWeekLow"))
        r["targetPrice"] = safe(info.get("targetMeanPrice"))
        r["targetHigh"] = safe(info.get("targetHighPrice"))
        r["targetLow"] = safe(info.get("targetLowPrice"))
        r["targetMedian"] = safe(info.get("targetMedianPrice"))
        r["analystCount"] = safe(info.get("numberOfAnalystOpinions"))
        r["recommendation"] = safe(info.get("recommendationKey"))
        r["per"] = safe(info.get("trailingPE"))
        r["forwardPer"] = safe(info.get("forwardPE"))
        r["pbr"] = safe(info.get("priceToBook"))
        r["psr"] = safe(info.get("priceToSalesTrailing12Months"))
        r["evEbitda"] = safe(info.get("enterpriseToEbitda"))
        r["eps"] = safe(info.get("trailingEps"))
        r["forwardEps"] = safe(info.get("forwardEps"))
        r["dividendYield"] = safe(info.get("dividendYield"))
        r["marketCap"] = safe(info.get("marketCap"))
        r["roe"] = safe(info.get("returnOnEquity"))
        r["debtToEquity"] = safe(info.get("debtToEquity"))
        r["revenueGrowth"] = safe(info.get("revenueGrowth"))

        try:
            fin = stock.financials
            if fin is not None and not fin.empty:
                c0 = fin.iloc[:, 0]
                r["revenue"] = safe(c0.get("Total Revenue"))
                r["operatingIncome"] = safe(c0.get("Operating Income"))
                r["netIncome"] = safe(c0.get("Net Income"))
                if fin.shape[1] > 1:
                    c1 = fin.iloc[:, 1]
                    pr = safe(c1.get("Total Revenue"))
                    po = safe(c1.get("Operating Income"))
                    if r["revenue"] and pr and pr != 0:
                        r["revenueGrowth"] = round((r["revenue"] - pr) / abs(pr), 4)
                    if r["operatingIncome"] and po and po != 0:
                        r["oiGrowth"] = round((r["operatingIncome"] - po) / abs(po), 4)
        except: pass

        try:
            hist = stock.history(period="3mo")
            if hist is not None and len(hist) > 30:
                closes = hist["Close"].values.astype(float)
                if len(closes) >= 2:
                    r["dailyChangePct"] = r["dailyChangePct"] or round(float((closes[-1] - closes[-2]) / closes[-2] * 100), 2)
                r["rsi14"] = calc_rsi(closes)
                m, s, h = calc_macd(closes)
                r["macd"] = m; r["macdSignal"] = s; r["macdHist"] = h
                r["technicalSignal"] = get_signal(r["rsi14"], h)
        except: pass

    except Exception as e:
        print(f"  [ERR] {e}")
    return r

def main():
    output_path = Path(__file__).parent.parent / "src" / "data" / "foreign-analyst.json"
    total = len(STOCK_MAP); results = {}
    print(f"=== Foreign Stock Crawler ===\n{total} stocks · {datetime.now():%Y-%m-%d %H:%M}\n")

    for idx, (yf_ticker, name) in enumerate(STOCK_MAP.items(), 1):
        pticker = yf_ticker.replace(".HK", "")
        print(f"[{idx}/{total}] {name} ({yf_ticker})", end=" → ", flush=True)
        try:
            data = fetch_stock(yf_ticker)
            data["yfinanceTicker"] = yf_ticker
            data["name"] = name
            results[pticker] = data
            parts = []
            if data["dailyChangePct"] is not None: parts.append(f"{data['dailyChangePct']:+.1f}%")
            if data["targetPrice"]: parts.append(f"TP:${data['targetPrice']:.0f}")
            if data["rsi14"]: parts.append(f"RSI:{data['rsi14']}")
            print(", ".join(parts) if parts else "ok", flush=True)
        except Exception as e:
            print(f"ERR: {e}", flush=True)
            results[pticker] = {"name": name, "yfinanceTicker": yf_ticker}
        if idx < total: time.sleep(1.2)

    output = {"fetchedAt": datetime.now().isoformat(), "source": "Yahoo Finance", "stockCount": len(results), "stocks": results}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    ok = sum(1 for v in results.values() if v.get("currentPrice"))
    print(f"\n✓ {ok}/{total} stocks → {output_path.name}")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(0)  # Never fail the workflow
