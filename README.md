# Analyst Dashboard

포트폴리오 보유 종목의 애널리스트 전망치를 한 눈에 확인하는 대시보드

## 주요 기능

- **목표주가 컨센서스**: 애널리스트 평균/최고/최저 목표주가 및 상승여력
- **밸류에이션 지표**: PER, PBR, PSR, EV/EBITDA, ROE 등 TTM 기준 핵심 지표
- **EPS/매출 전망**: 향후 3개년 EPS 및 매출 전망치 차트
- **영업이익(EBITDA) 전망**: 연도별 EBITDA 추정치 테이블
- **FMP 종합 등급**: DCF, ROE, ROA, D/E, P/E, P/B 기반 종합 투자등급
- **필터 & 정렬**: 시장/섹터/계좌별 필터링, 상승여력/등급 등 정렬

## 데이터 소스

- 포트폴리오: `src/data/portfolio.json` (수동 업데이트)
- 애널리스트 데이터: [Financial Modeling Prep API](https://financialmodelingprep.com/) (무료 250 calls/day)

## 시작하기

```bash
npm install
npm run dev
```

1. 브라우저에서 `http://localhost:5173` 접속
2. 우측 상단 **API Key 설정** 클릭 → FMP API Key 입력
3. **애널리스트 데이터 조회** 클릭
4. 종목을 클릭하면 우측에 상세 패널 표시

## 기술 스택

- React 19 + TypeScript
- Vite
- Tailwind CSS 3
- Recharts
- Lucide Icons

## 배포

GitHub Pages로 자동 배포됩니다 (`main` 브랜치 push 시).
