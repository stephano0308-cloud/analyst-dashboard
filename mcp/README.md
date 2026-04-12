# Analyst Dashboard MCP

이 폴더는 Claude Code 등 MCP 클라이언트에서 사용할 수 있는 투자분석용 MCP 서버를 포함합니다.

## 기능

- 텔레그램 채널 메시지 조회
- 로컬 문서 목록 조회 및 읽기
- 텔레그램 + 문서 기반 종목 분석
- 기존 `src/data/telegram-analysis.json`를 fallback 데이터로 사용

## 빠른 시작

```bash
cd mcp
pip install -r requirements.txt
python server.py
```

환경변수는 선택사항입니다.

- `MCP_DOCS_DIR`: 문서 폴더 경로 (기본값 `mcp/data/docs`)
- `TELEGRAM_ANALYSIS_JSON`: fallback JSON 경로 (기본값 `src/data/telegram-analysis.json`)

## 노출되는 도구

- `list_telegram_channels`
- `get_telegram_messages`
- `search_telegram_messages`
- `list_documents`
- `read_document`
- `analyze_ticker_mentions`

## 메모

현재 버전은 기존 저장소 구조를 보존하기 위해 프론트엔드와 분리된 독립 MCP 서버로 추가되었습니다.
