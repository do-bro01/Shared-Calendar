# Claude 작업 가이드 — SC 프로젝트

> 이 파일은 새 Claude 세션이 자동으로 읽습니다. 짧고 핵심만 유지.

## 한 줄 요약

SC는 **Expo + Supabase 기반 공유 캘린더 앱**이며, 현재 MVP 완료 후 "**일정 공유 + 추억 기록(사진/코멘트/RAG 챗봇)**" 컨셉으로 확장 중. RAG 챗봇은 수업 팀플 결과물로도 활용 예정.

## 시작 시 반드시 읽을 것

1. **[docs/roadmap.md](docs/roadmap.md)** — 현재 Phase, 다음 작업, 핵심 결정
2. [docs/rag-extension/](docs/rag-extension/) — 팀플 RAG 확장 상세 문서 3종
3. [docs/spec-sc.md](docs/spec-sc.md) — 기존 MVP 스펙

## 박제된 핵심 결정 (재논의 금지)

- **백엔드는 Supabase Edge Function (Deno/TypeScript)** — Python 백엔드 X
- **Python은 `scripts/` 폴더의 RAGAS 평가·합성 데이터·임베딩 백필 스크립트에만** 사용
- **DB는 Supabase Postgres + pgvector** — 별도 벡터 DB 안 씀
- **프론트는 React Native + Expo (.js)** — 신규 파일은 .ts 권장이나 기존 .js 강제 변환 안 함
- **RLS 자동 적용을 유지** — `service_role` 키는 절대 클라이언트/Edge Function에서 사용 금지

자세한 이유: [docs/roadmap.md §1](docs/roadmap.md)

## 작업 컨벤션

### 코드 스타일
- 한국어 주석/UI 텍스트 유지 (사용자 한국인)
- 새 화면은 기존 화면 패턴 따르기 ([src/screens/](src/screens/) 참조)
- 새 서비스는 [src/services/](src/services/) 패턴 따르기 (static class + try/catch + console.error)
- 토큰 사용: [constants/theme.ts](constants/theme.ts)의 `Colors`, `Spacing`, `Radius`

### 작업 전 사용자에게 묻기
- Phase의 "결정해야 할 것" 항목 (디자인 선택, 모델 선택 등)
- 새 npm 패키지 추가
- Supabase 대시보드에서 해야 하는 작업 (마이그레이션 실행, Storage 버킷 생성, secrets 설정 등)
- 큰 화면 구조 변경

### 묻지 않고 해도 되는 것
- 로드맵에 명시된 코드 작성
- Lint 에러 수정
- 기존 동작 유지하는 리팩터링
- 주석 추가/정리

### 절대 하지 말 것
- 박제된 결정 재논의
- 기존 마이그레이션 SQL 수정 (항상 새 파일로 추가)
- `npm install` 임의 실행 (사용자가 직접)
- API 키를 코드에 하드코딩
- `.env.local` 또는 `service_role` 키를 git에 커밋

## 디렉토리 구조

```
sc/
├── App.js                    # 진입점
├── index.js                  # Web PWA 메타 + service worker
├── src/
│   ├── components/           # 재사용 컴포넌트 (Button, CalendarView, EventModal)
│   ├── constants/            # 한국 공휴일
│   ├── context/              # ThemeContext
│   ├── lib/                  # supabaseClient, caseHelpers
│   ├── navigation/           # MainTabNavigator (bottom tabs)
│   ├── screens/              # Login, Personal/Shared Calendar, Settings
│   └── services/             # Auth/Friend/Group/User/Event Service (Supabase 호출)
├── constants/theme.ts        # 디자인 토큰 (Colors, Spacing, Radius)
├── supabase/
│   ├── migrations/           # 기존 MVP 스키마 5개 파일
│   └── functions/            # ← Phase 4에서 신규
├── scripts/                  # ← Phase 5에서 신규 (Python)
├── public/                   # PWA manifest, sw.js, icons
├── assets/                   # google-logo, icon.svg
└── docs/
    ├── roadmap.md            # ★ 작업 로드맵
    ├── spec-sc.md            # MVP 스펙
    ├── ai-collaboration.md   # AI 협업 기록
    ├── retrospective.md      # MVP 회고
    ├── test-checklist.md     # 회귀 검증
    └── rag-extension/        # 팀플 RAG 확장 문서
        ├── idea-draft.md
        ├── project-plan.md
        └── db-design.md
```

## 자주 쓰는 명령

```bash
npm run web              # 웹 개발 서버 (Expo Metro)
npm run ios              # iOS 시뮬레이터
npm run lint             # ESLint
npx expo export --platform web  # Vercel용 웹 빌드
```

## 환경변수

[.env.local](.env.local)에:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (이미 있음)
- (Phase 4 후) `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` → Edge Function secrets로 별도 등록
- (Phase 5 후) `SUPABASE_SERVICE_ROLE_KEY` → Python 스크립트 전용

## 메모리 참조

`/Users/do_bro/.claude/projects/-Users-do-bro-GitHub-sc/memory/`에 사용자 컨텍스트:
- `project_concept.md` — 컨셉 (일정+추억)
- `project_tech_decisions.md` — 기술 결정 (TS+Python 분업 등)
