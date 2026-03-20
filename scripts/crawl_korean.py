#!/usr/bin/env python3
"""
Korean Stock Consensus Data Crawler
Fetches analyst consensus data (target price, estimated PER/PBR, operating income)
from FnGuide CompanyGuide and Naver Finance.

Runs via GitHub Actions daily → outputs to src/data/korean-consensus.json
"""

import json
import time
import re
import sys
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ─── Korean Stock Code Mapping ───
# ticker (used in portfolio.json) → KRX 6-digit code
STOCK_MAP = {
    "SK하이닉스": "000660",
    "삼성전자": "005930",
    "삼성전자우": "005935",
    "삼성전기": "009150",
    "한화에어로": "012450",
    "현대차": "005380",
    "현대로템": "064350",
    "에스티팜": "237690",
    "HD현대중공업": "329180",
    "HD건설기계": "267270",
    "HD한국조선": "009540",
    "HD현대일렉": "267260",
    "HD마린엔진": "071970",
    "한국금융우": "071055",
    "세진중공업": "075580",
    "삼성중공업": "010140",
    "미래에셋": "006800",
    "테크윙": "089030",
    "두산에너빌": "034020",
    "한국카본": "017960",
    "삼양식품": "003230",
    "산일전기": "062040",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


def parse_number(text: str) -> float | None:
    """Parse Korean formatted number string to float."""
    if not text:
        return None
    text = text.strip().replace(",", "").replace(" ", "")
    if text in ("", "-", "N/A", "nan"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def fetch_fnguide_consensus(code: str) -> dict:
    """Fetch consensus data from FnGuide CompanyGuide."""
    result = {
        "targetPrice": None,
        "analystCount": None,
        "estimatedPER": None,
        "estimatedPBR": None,
        "estimatedEPS": None,
        "estimatedBPS": None,
        "estimatedRevenue": None,
        "estimatedOperatingIncome": None,
    }

    try:
        # Main page — has current PER, PBR, consensus summary
        url = f"https://comp.fnguide.com/SVO2/asp/SVD_Main.asp?pGB=1&gicode=A{code}"
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.encoding = "utf-8"

        if res.status_code != 200:
            print(f"  [WARN] FnGuide main page HTTP {res.status_code}")
            return result

        soup = BeautifulSoup(res.text, "html.parser")

        # ── Extract target price from consensus section ──
        # Look for 목표주가 in the consensus area
        consensus_table = soup.select_one("#svdMainGrid2")
        if consensus_table:
            rows = consensus_table.select("tr")
            for row in rows:
                header = row.select_one("th")
                value = row.select_one("td")
                if header and value:
                    h_text = header.get_text(strip=True)
                    v_text = value.get_text(strip=True)
                    if "목표주가" in h_text:
                        result["targetPrice"] = parse_number(v_text)
                    elif "애널리스트" in h_text or "리포트" in h_text:
                        result["analystCount"] = parse_number(v_text)

        # ── Extract estimated PER/PBR from snapshot section ──
        # svdMainGrid1 usually has the financial snapshot
        snap_table = soup.select_one("#svdMainGrid1")
        if snap_table:
            rows = snap_table.select("tr")
            for row in rows:
                cells = row.select("td")
                header = row.select_one("th")
                if not header or len(cells) == 0:
                    continue
                h = header.get_text(strip=True)
                # The last column is often the estimated (E) value
                last_val = cells[-1].get_text(strip=True) if cells else ""
                if "PER" in h and "12M" not in h:
                    result["estimatedPER"] = parse_number(last_val)
                elif "PBR" in h:
                    result["estimatedPBR"] = parse_number(last_val)
                elif "EPS" in h and "BPS" not in h:
                    result["estimatedEPS"] = parse_number(last_val)
                elif "BPS" in h:
                    result["estimatedBPS"] = parse_number(last_val)

        # ── Consensus page for more detailed data ──
        url2 = f"https://comp.fnguide.com/SVO2/asp/SVD_Consensus.asp?pGB=1&gicode=A{code}"
        res2 = requests.get(url2, headers=HEADERS, timeout=15)
        res2.encoding = "utf-8"

        if res2.status_code == 200:
            soup2 = BeautifulSoup(res2.text, "html.parser")

            # Look for consensus estimate tables
            tables = soup2.select("table")
            for table in tables:
                rows = table.select("tr")
                for row in rows:
                    header = row.select_one("th")
                    cells = row.select("td")
                    if not header or len(cells) == 0:
                        continue
                    h = header.get_text(strip=True)
                    # Get the nearest forward estimate (usually column index 1 or 2)
                    forward_val = cells[0].get_text(strip=True) if cells else ""

                    if "매출액" in h and result["estimatedRevenue"] is None:
                        val = parse_number(forward_val)
                        if val and val > 100:  # Revenue should be large
                            result["estimatedRevenue"] = val
                    elif "영업이익" in h and "증가" not in h and result["estimatedOperatingIncome"] is None:
                        val = parse_number(forward_val)
                        if val:
                            result["estimatedOperatingIncome"] = val
                    elif "목표주가" in h and result["targetPrice"] is None:
                        val = parse_number(forward_val)
                        if val:
                            result["targetPrice"] = val

    except Exception as e:
        print(f"  [ERROR] FnGuide: {e}")

    return result


def fetch_naver_finance(code: str) -> dict:
    """Fetch basic stock info from Naver Finance."""
    result = {
        "currentPrice": None,
        "per": None,
        "pbr": None,
        "dividendYield": None,
        "marketCap": None,
        "eps": None,
        "bps": None,
    }

    try:
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.encoding = "euc-kr"

        if res.status_code != 200:
            print(f"  [WARN] Naver HTTP {res.status_code}")
            return result

        soup = BeautifulSoup(res.text, "html.parser")

        # Current price
        price_el = soup.select_one(".no_today .blind")
        if price_el:
            result["currentPrice"] = parse_number(price_el.get_text())

        # Table with PER, PBR, etc.
        table = soup.select_one("#aside_as498562")
        if not table:
            # Alternative selector
            tables = soup.select("table.per_table, table.rwidth")
            table = tables[0] if tables else None

        # Try parsing from the corporate info section
        aside = soup.select("em#_per, em#_pbr, em#_dvr")
        for em in aside:
            eid = em.get("id", "")
            val = parse_number(em.get_text())
            if "_per" in eid:
                result["per"] = val
            elif "_pbr" in eid:
                result["pbr"] = val
            elif "_dvr" in eid:
                result["dividendYield"] = val

        # Try from per_table
        per_table = soup.select_one("table.per_table")
        if per_table:
            for tr in per_table.select("tr"):
                th = tr.select_one("th")
                em = tr.select_one("em")
                if th and em:
                    label = th.get_text(strip=True)
                    val = parse_number(em.get_text())
                    if "PER" in label:
                        result["per"] = val
                    elif "PBR" in label:
                        result["pbr"] = val
                    elif "배당수익률" in label:
                        result["dividendYield"] = val

        # EPS / BPS from corporate summary
        corp_table = soup.select_one("#tab_con1")
        if corp_table:
            for tr in corp_table.select("tr"):
                th = tr.select_one("th")
                tds = tr.select("td")
                if th and tds:
                    label = th.get_text(strip=True)
                    # Get most recent annual value
                    last_val = tds[-1].get_text(strip=True) if tds else ""
                    if "EPS" in label:
                        result["eps"] = parse_number(last_val)
                    elif "BPS" in label:
                        result["bps"] = parse_number(last_val)

    except Exception as e:
        print(f"  [ERROR] Naver: {e}")

    return result


def main():
    output_path = Path(__file__).parent.parent / "src" / "data" / "korean-consensus.json"

    results = {}
    total = len(STOCK_MAP)

    print(f"=== Korean Stock Consensus Crawler ===")
    print(f"Crawling {total} stocks...")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()

    for idx, (ticker, code) in enumerate(STOCK_MAP.items(), 1):
        print(f"[{idx}/{total}] {ticker} ({code})")

        # Fetch from both sources
        fnguide = fetch_fnguide_consensus(code)
        time.sleep(1)  # Be nice to servers

        naver = fetch_naver_finance(code)
        time.sleep(0.5)

        # Merge data (FnGuide consensus takes priority for estimates)
        merged = {
            "code": code,
            "ticker": ticker,
            "currentPrice": naver["currentPrice"],
            "targetPrice": fnguide["targetPrice"],
            "analystCount": fnguide["analystCount"],
            # Use FnGuide estimated values if available, fall back to Naver
            "per": fnguide["estimatedPER"] or naver["per"],
            "pbr": fnguide["estimatedPBR"] or naver["pbr"],
            "eps": fnguide["estimatedEPS"] or naver["eps"],
            "bps": fnguide["estimatedBPS"] or naver["bps"],
            "dividendYield": naver["dividendYield"],
            "estimatedRevenue": fnguide["estimatedRevenue"],
            "estimatedOperatingIncome": fnguide["estimatedOperatingIncome"],
            # Source tracking
            "sources": {
                "fnguide": {k: v for k, v in fnguide.items() if v is not None},
                "naver": {k: v for k, v in naver.items() if v is not None},
            },
        }

        results[ticker] = merged

        # Log
        parts = []
        if merged["targetPrice"]:
            parts.append(f"목표가:{int(merged['targetPrice']):,}")
        if merged["per"]:
            parts.append(f"PER:{merged['per']:.1f}")
        if merged["pbr"]:
            parts.append(f"PBR:{merged['pbr']:.2f}")
        if merged["estimatedOperatingIncome"]:
            parts.append(f"영업이익(E):{merged['estimatedOperatingIncome']:,.0f}")

        status = ", ".join(parts) if parts else "데이터 없음"
        print(f"  → {status}")

    # Write output
    output = {
        "fetchedAt": datetime.now().isoformat(),
        "stockCount": len(results),
        "stocks": results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved to {output_path}")
    print(f"✓ {len(results)} stocks processed")

    # Count how many have useful data
    with_target = sum(1 for v in results.values() if v["targetPrice"])
    with_per = sum(1 for v in results.values() if v["per"])
    print(f"  - 목표주가 있음: {with_target}/{len(results)}")
    print(f"  - PER 있음: {with_per}/{len(results)}")


if __name__ == "__main__":
    main()
