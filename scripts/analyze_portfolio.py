#!/usr/bin/env python3
"""
Portfolio AI Analysis via Claude API
Reads crawled data + portfolio → sends to Claude → saves analysis JSON.
Runs in GitHub Actions after crawl jobs complete.
"""
import json, sys, os
from datetime import datetime
from pathlib import Path

try:
    import anthropic
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic", "-q"])
    import anthropic

BASE = Path(__file__).parent.parent / "src" / "data"

def fmt_krw(v):
    if abs(v) >= 1e8: return f"{v/1e8:.1f}억"
    if abs(v) >= 1e4: return f"{v/1e4:.0f}만"
    return f"{v:,.0f}"

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("⚠️ ANTHROPIC_API_KEY not set — skipping AI analysis")
        # Write empty result so frontend doesn't break
        out = {"fetchedAt": datetime.now().isoformat(), "analysis": "", "status": "skipped"}
        (BASE / "ai-analysis.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
        return

    # Load data
    portfolio = json.loads((BASE / "portfolio.json").read_text())
    kr_data = json.loads((BASE / "korean-consensus.json").read_text())
    foreign_data = json.loads((BASE / "foreign-analyst.json").read_text())

    items = portfolio["items"]
    meta = portfolio["metadata"]

    # Merge analyst data
    analyst = {}
    for k, v in kr_data.get("stocks", {}).items():
        analyst[k] = v
    for k, v in foreign_data.get("stocks", {}).items():
        analyst[k] = v

    # Build summary
    total_val = sum(i["평가금액(원)"] for i in items)
    total_invested = sum(i["매수금액(원)"] for i in items)
    total_pl = sum(i["손익(원)"] for i in items)
    ret_rate = total_pl / total_invested if total_invested > 0 else 0

    # Sector allocation
    sector_map = {}
    market_map = {}
    for i in items:
        sector_map[i["섹터"]] = sector_map.get(i["섹터"], 0) + i["평가금액(원)"]
        m = {"USD":"미국","KRW":"한국","HKD":"홍콩"}.get(i["통화"], i["통화"])
        market_map[m] = market_map.get(m, 0) + i["평가금액(원)"]

    # Deduplicate and merge
    merged = {}
    for i in items:
        t = i["티커"]
        if t not in merged:
            merged[t] = {**i, "총수량": i["수량"], "총평가": i["평가금액(원)"], "총손익": i["손익(원)"], "총매수": i["매수금액(원)"]}
        else:
            merged[t]["총수량"] += i["수량"]
            merged[t]["총평가"] += i["평가금액(원)"]
            merged[t]["총손익"] += i["손익(원)"]
            merged[t]["총매수"] += i["매수금액(원)"]

    # Build stock lines
    sorted_stocks = sorted(merged.values(), key=lambda x: x["총평가"], reverse=True)
    stock_lines = []
    for s in sorted_stocks[:40]:
        t = s["티커"]
        ad = analyst.get(t, {})
        pct = s["총손익"]/s["총매수"]*100 if s["총매수"] else 0
        weight = s["총평가"]/total_val*100 if total_val else 0
        parts = [f"{s['종목명']}({t})", f"평가:{fmt_krw(s['총평가'])}", f"수익률:{pct:+.1f}%", f"비중:{weight:.1f}%"]

        dc = ad.get("dailyChangePct")
        if dc is not None: parts.append(f"일간:{dc:+.1f}%")
        rsi = ad.get("rsi14")
        if rsi: parts.append(f"RSI:{rsi}")
        sig = ad.get("technicalSignal")
        if sig: parts.append(f"기술:{sig}")
        tp = ad.get("targetPrice")
        if tp and s["현재가"]:
            up = (tp - s["현재가"]) / s["현재가"] * 100
            parts.append(f"상승여력:{up:+.1f}%")
        per = ad.get("forwardPer") or ad.get("per")
        if per: parts.append(f"PER:{per:.1f}")
        rec = ad.get("recommendation")
        if rec: parts.append(f"추천:{rec}")
        rg = ad.get("revenueGrowth")
        if rg: parts.append(f"매출성장:{rg*100:.1f}%" if isinstance(rg, float) and rg < 10 else f"매출성장:{rg}")

        stock_lines.append(" | ".join(parts))

    # Overbought/oversold
    ob = [s["종목명"] for s in sorted_stocks if analyst.get(s["티커"], {}).get("rsi14", 50) >= 70]
    os_ = [s["종목명"] for s in sorted_stocks if analyst.get(s["티커"], {}).get("rsi14", 50) <= 30]

    sector_str = ", ".join(f"{k}:{fmt_krw(v)}({v/total_val*100:.1f}%)" for k, v in sorted(sector_map.items(), key=lambda x: -x[1]))
    market_str = ", ".join(f"{k}:{v/total_val*100:.1f}%" for k, v in market_map.items())

    prompt = f"""당신은 포트폴리오 분석 전문가입니다. 아래 포트폴리오를 종합 분석하고 리밸런싱 의견을 한국어로 제시해주세요.

## 포트폴리오 개요
- 기준일: {meta['date']}
- 총 평가금액: {fmt_krw(total_val)}
- 총 손익: {fmt_krw(total_pl)} (수익률: {ret_rate*100:.2f}%)
- 종목 수: {len(merged)}개 (합산 기준)
- 시장 배분: {market_str}
- 섹터 배분 (상위): {sector_str}
{"- RSI 과매수(≥70): " + ", ".join(ob) if ob else ""}
{"- RSI 과매도(≤30): " + ", ".join(os_) if os_ else ""}

## 종목별 현황 (상위 40, 평가금액순)
{chr(10).join(stock_lines)}

## 분석 요청
다음 5개 섹션으로 분석해주세요:

### 1. 포트폴리오 종합 진단
분산투자 적정성, 섹터/시장 편중도, 전반적 리스크 수준

### 2. 강점 종목 (유지/확대 추천)
상승여력 높고, 기술적 지표 양호하고, 실적 성장세인 종목들

### 3. 주의 종목 (축소/매도 검토)
RSI 과매수, 밸류에이션 과열, 큰 손실, 또는 하락 추세인 종목들

### 4. 섹터 리밸런싱 의견
현재 섹터 배분의 문제점과 조정 방향

### 5. 실행 액션 플랜
- 단기 (1개월 내): 즉시 실행할 구체적 액션
- 중기 (3개월): 점진적 조정 방향

각 섹션에 **구체적 종목명**을 반드시 포함하고, 간결하게 작성해주세요."""

    print(f"=== AI Portfolio Analysis ===")
    print(f"Sending {len(stock_lines)} stocks to Claude...")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    analysis_text = ""
    for block in message.content:
        if block.type == "text":
            analysis_text += block.text

    print(f"✓ Got {len(analysis_text)} chars of analysis")

    out = {
        "fetchedAt": datetime.now().isoformat(),
        "analysis": analysis_text,
        "status": "ok",
        "model": "claude-sonnet-4-20250514",
        "stockCount": len(merged),
    }

    output_path = BASE / "ai-analysis.json"
    output_path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"✓ Saved to {output_path.name}")


if __name__ == "__main__":
    main()
