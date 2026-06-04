# SC RAG 챗봇 RAGAS 평가 보고서

> 평가일: 2026-06-04 · 평가자: gpt-4o-mini · 샘플: 합성 그룹 캘린더 "캠퍼스 친구들 (합성 데이터)" 의 일정 80건 + 메모 60건
> 스크립트: [scripts/eval_ragas.py](../../scripts/eval_ragas.py) · GT: [scripts/ground_truth.json](../../scripts/ground_truth.json) · 원자료: [scripts/eval_outputs/](../../scripts/eval_outputs/)

---

## 1. 결과 요약

15개 질문, 4개 메트릭 평균.

| 메트릭 | 점수 | 목표 ([project-plan §9.2](project-plan.md)) | 달성 |
|---|---:|---:|:---:|
| Faithfulness (사실 일치도) | **0.749** | ≥ 0.85 | ✗ |
| Answer Relevancy (답변 관련성) | **0.397** | ≥ 0.80 | ✗ |
| Context Precision (검색 정밀도) | **0.581** | ≥ 0.75 | ✗ |
| Context Recall (검색 재현율) | **0.605** | ≥ 0.80 | ✗ |

![radar](../../scripts/eval_outputs/ragas_radar.png)

> 네 메트릭 모두 목표 미달. 단, **Answer Relevancy 와 Faithfulness 의 큰 갭**(0.4 → 0.75) 이 핵심 신호. 답변은 컨텍스트에 비교적 잘 근거하고 있는데(0.749) RAGAS 가 봤을 때 "질문과 직접 닿는가" 가 약하다는 뜻 — 즉 **챗봇이 컨텍스트는 잘 활용하지만 부가 정보를 너무 많이 풀어 쓰는 경향**이 있음. 카테고리별로 보면 원인이 더 명확함 (§3).

---

## 2. 평가 환경

| 항목 | 값 |
|---|---|
| 백엔드 | Supabase Edge Function `chat-rag` (Deno/TS) |
| 생성 LLM | OpenAI `gpt-4o-mini` (chat-rag 내부) |
| 평가 LLM | OpenAI `gpt-4o-mini` (RAGAS evaluator) |
| 임베딩 | `text-embedding-3-small` (1536d, pgvector) |
| 검색 | top-k = 8, `match_threshold = 0.3` (cosine) |
| 컨텍스트 채널 | (1) 그룹 일정 메타 200건 + (2) 벡터 검색 top-8 |
| Ground Truth | 15문항 (4 카테고리, [§9.1](project-plan.md) 분포) |
| 평가 호출 | 4 metric × 15 sample = **60 LLM 평가 호출** |
| 비용 | chat-rag 15회 + RAGAS 60회 ≈ **$0.40** |

**중요한 측정 제약**: RAGAS 의 `retrieved_contexts` 인풋엔 **벡터 검색 top-8 만** 넣었다 (메타 200건은 토큰 폭주 방지 위해 제외). 따라서 Context Recall 은 의도적으로 보수적으로 측정된다 — 실제 챗봇은 "메타 채널" 을 추가로 활용하기 때문. 이는 후술하는 Q1·Q9 의 점수 패턴을 해석할 때 핵심이다.

---

## 3. 카테고리별 분석

![category-bar](../../scripts/eval_outputs/ragas_by_category.png)

| 카테고리 | Faith. | Ans. Rel. | Ctx. Prec. | Ctx. Recall |
|---|---:|---:|---:|---:|
| 사실(날짜/장소) | **0.842** | 0.428 | **0.792** | **0.778** |
| 사실(인물/관계) | 0.611 | 0.451 | 0.333 | 0.333 |
| 통계/패턴 | 0.700 | **0.244** | 0.417 | 0.500 |
| 시간 한정 회상 | 0.750 | 0.433 | 0.569 | 0.635 |

### 3.1 사실(날짜/장소) — 가장 잘 됨

단일 청크로 답이 끝나는 질문 (Q2 "12월 13일 콘서트", Q4 "부산 여행 언제", Q6 "콜드플레이 어디서")에선 4메트릭 모두 1.0 만점. 임베딩 검색이 "특정 날짜·장소" 키워드를 잘 잡는다는 증거.

**예외 — Q1 ("작년 가을 여행지")**: 답변은 정확(가평+강릉)인데 점수는 Faith 0.25 / Ctx 0.0. 원인 분석:
- 챗봇 답변에 등장한 "2025-09-13 가평 글램핑" 일정의 **메모 청크가 retrieved_contexts 에 없다** (가평이 top-8 안에 안 들어옴).
- 그러나 챗봇은 정확히 답했음 — 이는 **메타 200건 채널에서 가평을 봤다**는 의미.
- → RAGAS 는 sources 만 평가하므로 챗봇의 정답을 "할루시네이션" 으로 오판. 이 평가 한계는 §5 에서 다룸.

### 3.2 사실(인물/관계) — 가장 약함

Context Precision/Recall 0.333 으로 4 카테고리 중 최하. 인물 조건이 임베딩 검색에 약하다는 신호.

**Q7 ("셋이 같이 등산 간 곳들") 케이스**:
- Reference: 도봉산 둘레길·관악산·남한산성 3건
- 답변: 남한산성·관악산·**북한산 백운대** (북한산은 reference 에 없음 — 데이터엔 있지만 둘이 간 거)
- Retrieved top-8 에 등산 관련 청크 **0개** ('경주 2박', '종강 술자리', 'MT 양평'… 전혀 다른 카테고리)
- → 임베딩이 "등산 = 산 이름 + 트레킹/하이킹" 의 추상화를 못 잡음. 답변은 메타 채널에서 가져온 것.

**대안**: `events.tags` 컬럼 (배열 메타) + Hybrid Search (BM25 키워드 + 벡터) 를 추가하면 "등산", "셋이" 같은 조건을 명시적으로 필터링할 수 있음. ([db-design.md §3.2](db-design.md) 의 tags 필드 활용 미사용 상태)

### 3.3 통계/패턴 — Answer Relevancy 최저

Q10 ("가장 자주 간 카페") 의 Answer Relevancy = **0.0**.
- Reference: 안다즈 카페 4회 (06-21, 09-20, 12-07, 04-19)
- 답변: 안다즈 4회 중 3개만 (12-07 누락) + 잘못된 1월 8일 추가 ('신년 모임 카페' 는 다른 곳)
- Retrieved top-8: 09-20, 04-19 두 건만 들어옴. 06-21·12-07 누락.

**구조적 한계**: 집계 질문 ("몇 번", "가장 자주") 은 모든 발생을 정확히 retrieve 해야 정답이 나옴. top-k=8 에 의존하는 단순 RAG 로는 한계가 있고, **SQL 집계 또는 메타데이터 group-by** 가 필요한 영역. 챗봇은 메타 200건 채널로 일부 보완하고 있지만 청크 단위 임베딩 검색만으로는 부족.

### 3.4 시간 한정 회상 — 절반의 성공

Q14 ("2026년 1월에 한 일들") = Faith 1.0 / Ctx Recall 0.571.
- 정답 7건 중 답변 3건만 (다른 4건은 retrieved 에도 없음).
- Reference 의 "한남동 비건 파인다이닝(01-31)", "블루보틀 성수(01-25)" 같은 후반 일정이 top-8 에 못 들어옴.
- 시간 범위 질문도 통계 질문처럼 **top-k 8 의 임계점에 부딪힘**.

Q15 ("작년 추석") 같은 단일 일정 시간 질문은 모든 메트릭 1.0 으로 잘 됨.

---

## 4. 질문별 상세

![per-question](../../scripts/eval_outputs/ragas_per_question.png)

| Q | 카테고리 | Faith. | Ans.R. | Ctx.P. | Ctx.R. | 평가 |
|---:|---|---:|---:|---:|---:|---|
| 1 | 날짜/장소 | 0.250 | 0.446 | 0.000 | 0.000 | 답변 OK, retrieve 실패 (가평 누락) |
| 2 | 날짜/장소 | 1.000 | 0.366 | 1.000 | 1.000 | 만점 |
| 3 | 날짜/장소 | 0.800 | 0.502 | 0.750 | 0.667 | 단양 누락 (제주만 답함) |
| 4 | 날짜/장소 | 1.000 | 0.491 | 1.000 | 1.000 | 만점 |
| 5 | 날짜/장소 | 1.000 | 0.353 | 1.000 | 1.000 | 만점 |
| 6 | 날짜/장소 | 1.000 | 0.410 | 1.000 | 1.000 | 만점 |
| 7 | 인물/관계 | 0.000 | 0.457 | 0.000 | 0.000 | 검색·답변 모두 실패 |
| 8 | 인물/관계 | 1.000 | 0.517 | 1.000 | 0.500 | 답 정확 (장소 정보 누락) |
| 9 | 인물/관계 | 0.833 | 0.379 | 0.000 | 0.500 | 부산 한 건만 답함 (정답 4건) |
| 10 | 통계/패턴 | 0.500 | 0.000 | 0.250 | 0.000 | 횟수 오류 + 잘못된 카페 포함 |
| 11 | 통계/패턴 | 1.000 | 0.391 | 1.000 | 1.000 | 만점 |
| 12 | 통계/패턴 | 0.600 | 0.340 | 0.000 | 0.500 | 횟수 단정 못함 |
| 13 | 시간 회상 | 0.250 | 0.371 | 0.125 | 0.333 | 전시 1건만 답함 |
| 14 | 시간 회상 | 1.000 | 0.545 | 0.583 | 0.571 | 7건 중 3건 |
| 15 | 시간 회상 | 1.000 | 0.382 | 1.000 | 1.000 | 만점 |

**만점 비율**: 15개 중 6개 (Q2·4·5·6·11·15) 는 4메트릭 모두 1.0 또는 평균 0.85 이상.

---

## 5. 실패 패턴 정리

평가 결과에서 챗봇 한계를 4가지로 분류할 수 있다.

| 패턴 | 영향받는 질문 | 원인 | 해결 방향 |
|---|---|---|---|
| **A. top-k 한계** | Q1, Q10, Q13, Q14 | 정답 일정 일부가 top-8 밖 | top-k ↑ + 재정렬 (rerank), 또는 메타 채널을 RAGAS 입력에 포함 |
| **B. 인물·활동 임베딩 약함** | Q7, Q9 | "셋이 같이", "등산" 같은 추상 조건이 벡터에 안 잡힘 | `events.tags` 활용 + Hybrid Search (BM25) |
| **C. 집계 질문 구조적 한계** | Q10, Q12 | "몇 번", "가장 자주" 는 전체 집계가 필요 | SQL `count(*)` 호출용 tool calling 도입 |
| **D. 답변 장황함 → Ans. Relevancy ↓** | 전체 (평균 0.40) | 챗봇이 부가 메모를 다 풀어 씀 | 시스템 프롬프트에 "질문에 직접 답하고 부가 설명은 1줄" 추가 |

가장 큰 임팩트는 D (시스템 프롬프트 한 줄로 전체 0.4 → 0.6+ 기대) 와 A (top-k 를 12~16 으로 늘리면 Q10·14 즉시 개선).

---

## 6. 평가 방법론 한계

이 보고서의 **점수가 챗봇의 진짜 성능보다 낮게 측정된 부분**이 있음을 명시한다.

1. **메타 채널 제외**: chat-rag 은 그룹 일정 200건 메타를 LLM 에 함께 주입하지만 RAGAS 입력에선 토큰 폭주 방지 위해 빼버림. Q1 의 가평, Q7 의 일부 등산 일정처럼 **답변이 메타에서 정확히 가져온 경우 RAGAS 는 할루시네이션으로 오판**. → 실제 챗봇 정확도 > RAGAS 점수.
2. **합성 데이터**: 일정 80건·메모 60건 규모. 실사용 데이터의 다양성·노이즈가 빠져있어 평가 편향 가능.
3. **단일 평가 LLM (gpt-4o-mini)**: RAGAS 가 답변 LLM 과 같은 모델을 평가자로 쓰면 self-bias 가능. 다른 평가자 (claude-haiku 등) 와 교차 검증 안 함.
4. **단일 페르소나 (지수)**: 다른 두 페르소나 (민준·서연) 시점의 질문은 안 던짐. RLS 가 페르소나마다 다르게 동작하는 케이스 미커버.

---

## 7. 개선 후보 (Phase 7+)

우선순위 순.

1. **시스템 프롬프트 개선** (1시간) — `chat-rag/index.ts` 의 system 메시지에 "사용자 질문에 직접 답하고, 부가 메모는 한 줄 이내로 요약" 명시. 예상: Ans. Relevancy +0.2.
2. **top-k 12~16 + 메타 청크 통합 평가** (반나절) — `eval_ragas.py` 에서 두 채널을 합쳐 retrieved_contexts 로 넣는 옵션 추가. 예상: Ctx. Recall +0.15.
3. **Tag 필터링** (1일) — `events.tags` 컬럼이 이미 db-design 에 정의되어 있음. seed 데이터에 태그 부여 후 `chat-rag` 에서 질문 키워드 → 태그 필터 매칭. 예상: 인물/관계 카테고리 +0.3.
4. **집계 질문용 SQL Tool** (2일) — "몇 번", "가장 자주" 키워드 감지 시 `select count(*)` 호출. 예상: 통계 카테고리 +0.4.
5. **비교군 평가** ([project-plan §9.3](project-plan.md)) — 현재는 RAG Basic 만 측정. Baseline (순수 LLM, 일정 전체 dump) 와 비교해야 RAG 의 가치 증명 가능. 발표 자료에 핵심으로 들어가야 함.

---

## 8. 산출물 인덱스

| 파일 | 내용 |
|---|---|
| [scripts/eval_outputs/rag_responses.json](../../scripts/eval_outputs/rag_responses.json) | chat-rag 원본 응답 15건 |
| [scripts/eval_outputs/ragas_results.csv](../../scripts/eval_outputs/ragas_results.csv) | 질문별 4메트릭 |
| [scripts/eval_outputs/ragas_by_category.csv](../../scripts/eval_outputs/ragas_by_category.csv) | 카테고리별 평균 |
| [scripts/eval_outputs/ragas_radar.png](../../scripts/eval_outputs/ragas_radar.png) | 전체 평균 레이더 |
| [scripts/eval_outputs/ragas_by_category.png](../../scripts/eval_outputs/ragas_by_category.png) | 카테고리 바차트 |
| [scripts/eval_outputs/ragas_per_question.png](../../scripts/eval_outputs/ragas_per_question.png) | 질문별 바차트 |

재실행:
```bash
cd scripts
uv sync --group ragas
uv run python eval_ragas.py                  # 재수집 + 평가
uv run python eval_ragas.py --skip-collect   # 캐시 재사용 (chat-rag 호출 안 함, $ 절감)
```
