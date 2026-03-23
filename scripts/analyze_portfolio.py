#!/usr/bin/env python3
"""Portfolio AI Analysis - calls Claude API. Gracefully skips if no key."""
import json, os, sys, traceback
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).parent.parent / "src" / "data"
OUTPUT = BASE / "ai-analysis.json"

def write_result(status, analysis="", **extra):
    out = {"fetchedAt": datetime.now().isoformat(), "analysis": analysis, "status": status, **extra}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"✓ Saved ai-analysis.json (status={status})")

def fmt_krw(v):
    if abs(v) >= 1e8: return f"{v/1e8:.1f}억"
    if abs(v) >= 1e4: return f"{v/1e4:.0f}만"
    return f"{v:,.0f}"

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        print("⚠️ ANTHROPIC_API_KEY not set — skipping AI analysis")
        write_result("skipped")
        return

    # Import anthropic (already installed via requirements.txt)
    try:
        import anthropic
    except ImportError:
        print("⚠️ anthropic package not installed — skipping")
        write_result("skipped")
        return

    # Load data
    portfolio = json.loads((BASE / "portfolio.json").read_text())
    kr = json.loads((BASE / "korean-consensus.json").read_text()).get("stocks", {})
    foreign = json.loads((BASE / "foreign-analyst.json").read_text()).get("stocks", {})
    analyst = {**kr, **foreign}

    items = portfolio["items"]
    meta = portfolio["metadata"]
    total_val = sum(i["평가금액(원)"] for i in items)
    total_inv = sum(i["매수금액(원)"] for i in items)
    total_pl = total_val - total_inv
    ret = total_pl / total_inv if total_inv else 0

    # Merge duplicates
    merged = {}
    for i in items:
        t = i["티커"]
        if t not in merged:
            merged[t] = {**i, "총평가": i["평가금액(원)"], "총손익": i["손익(원)"], "총매수": i["매수금액(원)"]}
        else:
            merged[t]["총평가"] += i["평가금액(원)"]
            merged[t]["총손익"] += i["손익(원)"]
            merged[t]["총매수"] += i["매수금액(원)"]

    sector_map, market_map = {}, {}
    for i in items:
        sector_map[i["섹터"]] = sector_map.get(i["섹터"], 0) + i["평가금액(원)"]
        m = {"USD":"미국","KRW":"한국","HKD":"홍콩"}.get(i["통화"], i["통화"])
        market_map[m] = market_map.get(m, 0) + i["평가금액(원)"]

    sorted_s = sorted(merged.values(), key=lambda x: x["총평가"], reverse=True)

    lines = []
    for s in sorted_s[:40]:
        t = s["티커"]; ad = analyst.get(t, {})
        pct = s["총손익"]/s["총매수"]*100 if s["총매수"] else 0
        w = s["총평가"]/total_val*100 if total_val else 0
        p = [f"{s['종목명']}({t})", f"평가:{fmt_krw(s['총평가'])}", f"수익률:{pct:+.1f}%", f"비중:{w:.1f}%"]
        dc = ad.get("dailyChangePct"); rsi = ad.get("rsi14"); sig = ad.get("technicalSignal")
        tp = ad.get("targetPrice"); per = ad.get("forwardPer") or ad.get("per")
        rec = ad.get("recommendation"); rg = ad.get("revenueGrowth")
        if dc is not None: p.append(f"일간:{dc:+.1f}%")
        if rsi: p.append(f"RSI:{rsi}")
        if sig: p.append(f"기술:{sig}")
        if tp and s["현재가"]: p.append(f"상승여력:{(tp-s['현재가'])/s['현재가']*100:+.1f}%")
        if per: p.append(f"PER:{per:.1f}")
        if rec: p.append(f"추천:{rec}")
        if rg and isinstance(rg, (int, float)): p.append(f"매출성장:{rg*100:.1f}%")
        lines.append(" | ".join(p))

    ob = [s["종목명"] for s in sorted_s if analyst.get(s["티커"],{}).get("rsi14",50)>=70]
    os_ = [s["종목명"] for s in sorted_s if analyst.get(s["티커"],{}).get("rsi14",50)<=30]

    prompt = f"""당신은 포트폴리오 분석 전문가입니다. 아래 포트폴리오를 종합 분석하고 리밸런싱 의견을 한국어로 제시해주세요.

## 포트폴리오 개요
- 기준일: {meta['date']}, 총 평가: {fmt_krw(total_val)}, 손익: {fmt_krw(total_pl)} ({ret*100:.2f}%)
- 종목수: {len(merged)}개, 시장: {', '.join(f'{k}:{v/total_val*100:.1f}%' for k,v in market_map.items())}
- 섹터: {', '.join(f'{k}:{v/total_val*100:.1f}%' for k,v in sorted(sector_map.items(), key=lambda x:-x[1])[:10])}
{'- RSI 과매수(≥70): '+', '.join(ob) if ob else ''}
{'- RSI 과매도(≤30): '+', '.join(os_) if os_ else ''}

## 종목 현황 (상위 40)
{chr(10).join(lines)}

## 분석해주세요
### 1. 포트폴리오 종합 진단 (분산투자, 편중도, 리스크)
### 2. 강점 종목 (유지/확대) — 상승여력, 기술적 양호, 실적 성장
### 3. 주의 종목 (축소/매도) — 과매수, 고밸류, 큰손실, 하락추세
### 4. 섹터 리밸런싱 — 현 배분 문제점과 조정 방향
### 5. 액션 플랜 — 단기(1개월) / 중기(3개월) 구체적 액션

각 섹션에 구체적 종목명을 포함하고 간결하게 작성."""

    print(f"Sending {len(lines)} stocks to Claude...")
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=4000,
                                  messages=[{"role":"user","content":prompt}])
    text = "".join(b.text for b in msg.content if b.type=="text")
    print(f"✓ Got {len(text)} chars")
    write_result("ok", text, model="claude-sonnet-4-20250514", stockCount=len(merged))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        write_result("error", f"Analysis failed: {traceback.format_exc()[-200:]}")
        sys.exit(0)  # Never fail the workflow
