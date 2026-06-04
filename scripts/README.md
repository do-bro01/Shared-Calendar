# scripts/

SC 프로젝트의 **합성 데이터 + RAGAS 평가**용 Python 스크립트. RN/Edge Function 본체와 분리된 1회용 도구 폴더.

> Python 사용 이유는 RAGAS가 Python 전용이고, 합성 데이터/임베딩 백필도 같은 환경에서 다루기 편하기 때문. 프로덕션 로직은 절대 들어오지 않습니다.

---

## 1. 사전 준비

### 1.1 환경변수 (`../.env.local`)

세 키가 필요합니다. `.env.local`은 git-ignore 되어 있으니 안심하고 추가하세요.

```
EXPO_PUBLIC_SUPABASE_URL=...          (이미 있음)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (← 새로 추가)
OPENAI_API_KEY=sk-...                 (이미 있음, --skip-memo 시 불필요)
```

`SUPABASE_SERVICE_ROLE_KEY` 가져오는 곳:
1. https://supabase.com/dashboard 에서 SC 프로젝트 선택
2. 왼쪽 사이드바 톱니바퀴(**Project Settings**) → **API**
3. "Project API keys" 섹션의 `service_role` (secret) → **Reveal** 클릭 → 복사

> **주의**: service_role 키는 RLS를 우회합니다. 코드에 하드코딩 X, `.env.local`에만, git에 절대 커밋 X.

### 1.2 Python 환경

권장: **uv** (빠르고 가벼움).

```bash
# macOS
brew install uv

# 의존성 설치 (자동으로 .venv 생성)
cd scripts
uv sync
```

uv가 없으면 일반 venv도 OK:

```bash
cd scripts
python3.11 -m venv .venv
source .venv/bin/activate
pip install supabase openai python-dotenv httpx
```

---

## 2. 스크립트별 사용법

### 2.1 `seed_synthetic_data.py` — 합성 데이터 시드

가상 대학 친구 3명(**지수·민준·서연**) + 새 공유 캘린더방 + 1년치 일정 80개 + 메모 60개 생성.

**기본 실행** (가상 사용자 3명만 멤버):

```bash
cd scripts
uv run python seed_synthetic_data.py
```

**본인 실계정도 옵저버로 그룹에 추가** (앱에서 직접 볼 수 있음):

```bash
uv run python seed_synthetic_data.py --owner dohyunge6358@gmail.com
```

이 옵션을 주면 본인 auth_id 가 `group_calendars.members` 배열에 추가되어, 본인 앱(`공유 캘린더` 탭)에서도 "캠퍼스 친구들 (합성 데이터)" 방이 보입니다. 일정 자체의 `user_id`는 가상 페르소나로 유지되므로 페르소나 톤은 보존됩니다.

**다른 옵션**:

```bash
# DB 안 건드리고 일정 표만 출력 (분포 확인용)
uv run python seed_synthetic_data.py --dry-run

# OpenAI 호출 없이 메모 시드(키워드)를 그대로 메모로 사용 (비용 0)
uv run python seed_synthetic_data.py --skip-memo

# 가상 사용자 3명 삭제 → 그룹/일정 모두 CASCADE 삭제
uv run python seed_synthetic_data.py --cleanup
```

**멱등성**: 같은 명령을 두 번 실행해도 안전합니다.
- 가상 사용자가 이미 있으면 재사용
- 그룹 캘린더가 같은 이름으로 있으면 재사용 (멤버는 새 인자로 업데이트)
- 같은 (title, date) 일정은 중복 INSERT 안 함

**일정 분포** (RAGAS §9 평가 카테고리에 맞춤):

| 카테고리 | 개수 | 평가 질문 예시 |
|---|---|---|
| 카페 (반복 방문) | 15 | "지난 1년간 가장 자주 간 카페는?" |
| 전시·콘서트 (고유) | 12 | "9월에 본 전시는?" |
| 등산·운동 | 10 | "민준이랑 등산 간 게 언제?" |
| 여행 (분기별) | 8 | "여름에 다녀온 곳?" |
| 맛집 (일부 반복) | 14 | "곱창집 몇 번 갔어?" |
| 생일·기념일 | 6 | "민준이 생일은 언제?" |
| 영화·취미 | 8 | "방탈출 갔던 곳?" |
| 모임·파티 | 7 | "할로윈 어디서 보냈어?" |

비용 (OpenAI gpt-4o-mini 기준):
- 메모 생성 60건 × ~$0.0008 = **약 $0.05**
- `--skip-memo` 사용 시 $0

---

### 2.2 `eval_ragas.py` — RAGAS 평가

합성 데이터로 만들어진 그룹 캘린더를 대상으로 `chat-rag` Edge Function의 RAG 품질을 RAGAS 4개 메트릭으로 평가합니다.

**선행 조건**:
- `seed_synthetic_data.py` 실행 완료
- 메모 임베딩 백필 완료 (앱 설정 탭 → "챗봇에게 내 일정 알려주기")
- 챗봇 수동 테스트로 답변이 잘 나오는 것 확인

**실행**:

```bash
cd scripts
uv sync --group ragas   # 처음 한 번 (ragas/langchain/matplotlib 추가)
uv run python eval_ragas.py
```

**옵션**:

```bash
uv run python eval_ragas.py --limit 3        # 처음 3개만 (디버깅)
uv run python eval_ragas.py --skip-collect   # rag_responses.json 재사용 (평가만 다시)
uv run python eval_ragas.py --output-dir my_eval/
```

**흐름**:
1. 가상 페르소나 **지수**로 로그인 → JWT 획득
2. `group_calendars` 에서 "캠퍼스 친구들 (합성 데이터)" 그룹 id 조회
3. `ground_truth.json` 의 15개 질문을 `chat-rag` 에 호출
4. `(question, answer, retrieved_contexts, reference)` 데이터셋 구성
5. RAGAS `evaluate()` 로 4개 메트릭 측정 (gpt-4o-mini 평가자)
6. 결과 저장 (`eval_outputs/`)

**산출물** (`eval_outputs/` 폴더):

| 파일 | 내용 |
|---|---|
| `rag_responses.json` | chat-rag 원본 응답 (JWT 헤더 제외) |
| `ragas_results.csv` | 질문별 4개 메트릭 점수 |
| `ragas_by_category.csv` | 카테고리별 평균 점수 |
| `ragas_radar.png` | 전체 평균 레이더 차트 |
| `ragas_by_category.png` | 카테고리별 바차트 |
| `ragas_per_question.png` | 질문별 바차트 |

**Ground Truth 분포** (`ground_truth.json`):

| 카테고리 | 개수 | 예시 |
|---|---|---|
| 사실(날짜/장소) | 6 | "2025년 12월 13일에 본 콘서트는?" |
| 사실(인물/관계) | 3 | "셋이 같이 등산 간 곳들 알려줘" |
| 통계/패턴 | 3 | "지난 1년 동안 가장 자주 간 카페는?" |
| 시간 한정 회상 | 3 | "2026년 1월에 한 일들 알려줘" |

**평가 환경 제약**:
- `retrieved_contexts` 에는 `chat-rag` 의 **벡터 검색 결과 (top-8)** 만 포함. `chat-rag` 은 그룹 전체 일정 메타 200개도 LLM 에 함께 주입하지만, 평가 LLM 토큰 폭주 방지 위해 RAGAS 입력에선 제외함.
- → ContextRecall 이 의도적으로 낮게 측정될 수 있음. 이는 "벡터 검색만으로는 카테고리·시간 한정 질문에 약하다 → 메타 채널을 추가했다"는 설계 결정을 정량적으로 보여주는 자료가 됨.

**비용 추정**:
- chat-rag 호출 15회 + RAGAS 평가 LLM 호출 (4 metric × 15 sample = 60 평가) → **약 $0.30~0.50** (OpenAI gpt-4o-mini 기준)

---

## 3. 시드~평가 전체 흐름

1. **합성 데이터 시드** — `seed_synthetic_data.py --owner ...`
2. **임베딩 백필** — 앱 설정 탭 → "챗봇에게 내 일정 알려주기"
3. **챗봇 수동 확인** — "작년 여름에 다녀온 곳?" 같은 질문에 합성 데이터 기반으로 답하는지
4. **RAGAS 평가** — `eval_ragas.py`
5. **평가 보고서 작성** — `docs/rag-extension/evaluation-report.md` (산출물 임베드)

---

## 4. 자주 묻는 것

**Q. 가상 사용자 3명의 비밀번호는?**
`ScSynthetic!2026` (스크립트 상수). 외부 노출 의미 없는 합성 계정용이지만, 이메일도 `@sc-eval.local` 도메인이라 실제 로그인은 안 됩니다 (이메일 확인 메일 못 받음). `email_confirm=True` 로 자동 확정 처리되어 있음.

**Q. 본인 실계정에 합성 데이터가 섞이나?**
아니요. 일정의 `user_id` 는 모두 가상 페르소나 3명 중 하나입니다. 본인은 `--owner` 옵션으로 추가했을 때만 **그룹 멤버**로 참여하는 것이고, 일정 자체는 가상 사용자 것입니다. `--cleanup` 시 본인 계정은 절대 삭제되지 않습니다 (페르소나 3명만 삭제).

**Q. 같은 그룹에 합성 데이터를 더 추가하고 싶은데?**
스크립트를 다시 실행하면 됩니다. `(title, date)` 가 같은 일정은 skip 되므로 새 항목만 추가됩니다.

**Q. service_role 키를 실수로 git에 커밋했어요!**
즉시 Supabase Dashboard → Project Settings → API 에서 **Reset service_role key** 누르고, 새 키를 받아 `.env.local` 갱신. 기존 키는 무효화됩니다.
