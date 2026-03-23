#!/usr/bin/env python3
"""Korean Stock Crawler: FnGuide + Naver + yfinance technicals"""
import json, time, math, sys, traceback
from datetime import datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import yfinance as yf
import numpy as np

STOCK_MAP = {
    "SK하이닉스": ("000660","000660.KS"), "삼성전자": ("005930","005930.KS"),
    "삼성전자우": ("005935","005935.KS"), "삼성전기": ("009150","009150.KS"),
    "한화에어로": ("012450","012450.KS"), "현대차": ("005380","005380.KS"),
    "현대로템": ("064350","064350.KS"), "에스티팜": ("237690","237690.KS"),
    "HD현대중공업": ("329180","329180.KS"), "HD건설기계": ("267270","267270.KS"),
    "HD한국조선": ("009540","009540.KS"), "HD현대일렉": ("267260","267260.KS"),
    "HD마린엔진": ("071970","071970.KS"), "한국금융우": ("071055","071055.KS"),
    "세진중공업": ("075580","075580.KS"), "삼성중공업": ("010140","010140.KS"),
    "미래에셋": ("006800","006800.KS"), "테크윙": ("089030","089030.KQ"),
    "두산에너빌": ("034020","034020.KS"), "한국카본": ("017960","017960.KS"),
    "삼양식품": ("003230","003230.KS"), "산일전기": ("062040","062040.KQ"),
}
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

def safe(v, d=None):
    if v is None: return d
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): return d
    return v

def pnum(t):
    if not t: return None
    t = str(t).strip().replace(",","").replace(" ","")
    if t in ("","-","N/A","nan"): return None
    try: return float(t)
    except: return None

def calc_rsi(p, n=14):
    if len(p) < n+1: return None
    d = np.diff(p); g = np.where(d>0,d,0); l = np.where(d<0,-d,0)
    ag, al = np.mean(g[-n:]), np.mean(l[-n:])
    if al == 0: return 100.0
    return round(100-(100/(1+ag/al)),1)

def calc_macd(p):
    if len(p)<35: return None,None,None
    p = np.array(p, dtype=float)
    def ema(d,n):
        a=2/(n+1); e=np.zeros_like(d); e[0]=d[0]
        for i in range(1,len(d)): e[i]=a*d[i]+(1-a)*e[i-1]
        return e
    ml=ema(p,12)-ema(p,26); sl=ema(ml,9); h=ml-sl
    return round(float(ml[-1]),2), round(float(sl[-1]),2), round(float(h[-1]),2)

def get_signal(rsi, mh):
    s=[]
    if rsi is not None:
        if rsi>=70: s.append("과매수")
        elif rsi<=30: s.append("과매도")
    if mh is not None: s.append("MACD+" if mh>0 else "MACD-")
    return " / ".join(s) if s else "중립"

def fetch_fnguide(code):
    r = {"targetPrice":None,"estimatedPER":None,"estimatedPBR":None}
    try:
        url = f"https://comp.fnguide.com/SVO2/asp/SVD_Main.asp?pGB=1&gicode=A{code}"
        res = requests.get(url, headers=HEADERS, timeout=15); res.encoding="utf-8"
        if res.status_code!=200: return r
        soup = BeautifulSoup(res.text,"html.parser")
        snap = soup.select_one("#svdMainGrid1")
        if snap:
            for row in snap.select("tr"):
                th=row.select_one("th"); tds=row.select("td")
                if not th or not tds: continue
                h=th.get_text(strip=True); last=tds[-1].get_text(strip=True)
                if "PER" in h and "12M" not in h: r["estimatedPER"]=pnum(last)
                elif "PBR" in h: r["estimatedPBR"]=pnum(last)
        cons = soup.select_one("#svdMainGrid2")
        if cons:
            for row in cons.select("tr"):
                th=row.select_one("th"); td=row.select_one("td")
                if th and td and "목표주가" in th.get_text(strip=True):
                    r["targetPrice"]=pnum(td.get_text(strip=True))
    except Exception as e:
        print(f"  [FnGuide] {e}")
    return r

def fetch_naver(code):
    r = {"currentPrice":None,"per":None,"pbr":None,"dividendYield":None}
    try:
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        res = requests.get(url, headers=HEADERS, timeout=10); res.encoding="euc-kr"
        if res.status_code!=200: return r
        soup = BeautifulSoup(res.text,"html.parser")
        pe = soup.select_one(".no_today .blind")
        if pe: r["currentPrice"]=pnum(pe.get_text())
        for em in soup.select("em#_per, em#_pbr, em#_dvr"):
            eid=em.get("id",""); v=pnum(em.get_text())
            if "_per" in eid: r["per"]=v
            elif "_pbr" in eid: r["pbr"]=v
            elif "_dvr" in eid: r["dividendYield"]=v
    except Exception as e:
        print(f"  [Naver] {e}")
    return r

def fetch_technicals(yf_ticker):
    r = {"dailyChangePct":None,"rsi14":None,"macd":None,"macdSignal":None,"macdHist":None,"technicalSignal":None}
    try:
        stock = yf.Ticker(yf_ticker)
        hist = stock.history(period="3mo")
        if hist is not None and len(hist)>30:
            closes = hist["Close"].values
            if len(closes)>=2:
                r["dailyChangePct"] = round(float((closes[-1]-closes[-2])/closes[-2]*100), 2)
            r["rsi14"] = calc_rsi(closes)
            m,s,h = calc_macd(closes)
            r["macd"]=m; r["macdSignal"]=s; r["macdHist"]=h
            r["technicalSignal"] = get_signal(r["rsi14"], h)
    except Exception as e:
        print(f"  [Tech] {e}")
    return r

def main():
    output = Path(__file__).parent.parent / "src" / "data" / "korean-consensus.json"
    results = {}; total = len(STOCK_MAP)
    print(f"=== Korean Stock Crawler ===\n{total} stocks · {datetime.now():%Y-%m-%d %H:%M}\n")

    for idx, (ticker, (code, yf_t)) in enumerate(STOCK_MAP.items(), 1):
        print(f"[{idx}/{total}] {ticker}", end=" → ", flush=True)
        try:
            fn = fetch_fnguide(code); time.sleep(0.8)
            nv = fetch_naver(code); time.sleep(0.5)
            tech = fetch_technicals(yf_t); time.sleep(0.5)
            results[ticker] = {
                "code": code, "ticker": ticker,
                "currentPrice": nv["currentPrice"],
                "targetPrice": fn["targetPrice"],
                "per": fn["estimatedPER"] or nv["per"],
                "pbr": fn["estimatedPBR"] or nv["pbr"],
                "dividendYield": nv["dividendYield"],
                **tech,
            }
            parts = []
            if tech.get("dailyChangePct") is not None: parts.append(f"{tech['dailyChangePct']:+.1f}%")
            if tech.get("rsi14"): parts.append(f"RSI:{tech['rsi14']}")
            if tech.get("technicalSignal"): parts.append(tech["technicalSignal"])
            print(", ".join(parts) if parts else "ok", flush=True)
        except Exception as e:
            print(f"ERROR: {e}", flush=True)
            results[ticker] = {"code": code, "ticker": ticker}

    out = {"fetchedAt": datetime.now().isoformat(), "stockCount": len(results), "stocks": results}
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n✓ {len(results)} stocks → {output.name}")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(0)  # Never fail the workflow
