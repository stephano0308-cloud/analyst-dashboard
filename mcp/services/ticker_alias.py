ALIASES = {
    "SK하이닉스": ["하이닉스", "SK hynix", "000660"],
    "삼성전자": ["삼전", "Samsung Electronics", "005930"],
    "AAPL": ["Apple", "애플"],
    "NVDA": ["NVIDIA", "엔비디아"],
    "TSM": ["TSMC", "대만적층", "台積電"],
}


def normalize_ticker(query: str) -> str:
    q = (query or "").strip()
    if not q:
        return q

    for canonical, aliases in ALIASES.items():
        if q.lower() == canonical.lower():
            return canonical
        for alias in aliases:
            if q.lower() == alias.lower():
                return canonical
    return q


def matches_ticker(text: str, ticker: str) -> bool:
    if not text or not ticker:
        return False

    canonical = normalize_ticker(ticker)
    candidates = [canonical] + ALIASES.get(canonical, [])
    lower_text = text.lower()
    return any(candidate.lower() in lower_text for candidate in candidates)
