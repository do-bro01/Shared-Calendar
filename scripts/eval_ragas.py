#!/usr/bin/env python3
"""
SC RAG 챗봇 RAGAS 평가

흐름:
  1) 가상 페르소나 지수로 로그인 → JWT 획득
  2) group_calendar_id 조회 (그룹 이름으로)
  3) ground_truth.json 의 15개 질문을 chat-rag Edge Function 에 호출
  4) (질문, RAG답변, 검색된 컨텍스트, 정답) 데이터셋 구성
     · --include-meta 시: chat-rag 답변에 등장한 메타 채널 일정도 추가
  5) RAGAS 4개 메트릭 평가
     · Faithfulness     : 답변이 검색된 컨텍스트에 근거했는가
     · AnswerRelevancy  : 답변이 질문과 관련 있는가
     · ContextPrecision : 검색된 컨텍스트 중 관련 비율
     · ContextRecall    : 정답에 필요한 정보를 다 검색했는가
  6) CSV + 레이더 차트 + 카테고리별 바차트 저장

실행:
    uv sync --group ragas
    uv run python eval_ragas.py

옵션:
    --limit N            : 처음 N개만 평가 (디버깅)
    --output-dir DIR     : 결과 저장 폴더 (기본: eval_outputs/)
    --skip-collect       : rag_responses.json 재사용 (chat-rag 재호출 안 함)
    --include-meta       : chat-rag 답변에 언급된 메타 일정도 retrieved_contexts 로
                           추가 (vector top-8 외에). Faith/CtxRecall 더 정확히 측정.
                           --skip-collect 와 함께 써도 동작 (group_events 만 추가 조회).
    --evaluator MODEL    : RAGAS 평가용 LLM (기본: gpt-4o, 권장: gpt-4o-mini=싸지만 노이즈↑)
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")


def _require(key: str) -> str:
    v = os.environ.get(key)
    if not v:
        print(f"환경변수 누락: {key}\n  .env.local 에 추가하고 다시 실행하세요.")
        sys.exit(1)
    return v


SUPABASE_URL = _require("EXPO_PUBLIC_SUPABASE_URL")
ANON_KEY = _require("EXPO_PUBLIC_SUPABASE_ANON_KEY")
OPENAI_API_KEY = _require("OPENAI_API_KEY")

JISOO_EMAIL = "synthetic-jisoo@sc-eval.local"
JISOO_PASSWORD = "ScSynthetic!2026"
GROUP_NAME = "캠퍼스 친구들 (합성 데이터)"

METRIC_COLS = [
    "faithfulness",
    "answer_relevancy",
    "answer_similarity",
    "context_precision",
    "context_recall",
]
METRIC_PRETTY = {
    "faithfulness": "Faithfulness",
    "answer_relevancy": "Answer Relevancy",
    "answer_similarity": "Answer Similarity",
    "context_precision": "Context Precision",
    "context_recall": "Context Recall",
}
CATEGORY_PRETTY = {
    "fact_date_place": "사실(날짜/장소)",
    "fact_person": "사실(인물/관계)",
    "stat_pattern": "통계/패턴",
    "time_recall": "시간 한정 회상",
}


# ─────────────────────────────────────────────
# 1) 로그인 + 그룹 조회 + chat-rag 호출
# ─────────────────────────────────────────────
def login_as_jisoo() -> str:
    print(f"[1/4] 가상 사용자 로그인: {JISOO_EMAIL}")
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": JISOO_EMAIL, "password": JISOO_PASSWORD},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  ❌ 로그인 실패 ({resp.status_code}): {resp.text}")
        sys.exit(1)
    data = resp.json()
    print(f"  · JWT 획득 (expires_in={data.get('expires_in')}s)")
    return data["access_token"]


def find_group_calendar(jwt: str) -> str:
    print(f"[2/4] 그룹 캘린더 조회: {GROUP_NAME!r}")
    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/group_calendars",
        params={"name": f"eq.{GROUP_NAME}", "select": "id,name"},
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {jwt}"},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  ❌ 조회 실패 ({resp.status_code}): {resp.text}")
        sys.exit(1)
    rows = resp.json()
    if not rows:
        print("  ❌ 그룹을 찾을 수 없음. 먼저 seed_synthetic_data.py 를 실행하세요.")
        sys.exit(1)
    gc_id = rows[0]["id"]
    print(f"  · 그룹 id: {gc_id}")
    return gc_id


def call_chat_rag(jwt: str, gc_id: str, message: str) -> dict:
    resp = httpx.post(
        f"{SUPABASE_URL}/functions/v1/chat-rag",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {jwt}",
            "Content-Type": "application/json",
        },
        json={"group_calendar_id": gc_id, "message": message},
        timeout=90,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"chat-rag {resp.status_code}: {resp.text[:300]}")
    return resp.json()


# ─────────────────────────────────────────────
# Baseline (순수 LLM, 검색 X) 모드
# ─────────────────────────────────────────────
# chat-rag 와 같은 모델·답변 규칙을 쓰되 vector 검색 청크만 제거. project-plan §9.3
# 의 "Baseline = 순수 LLM (전체 일정 dump)" 정의에 정확히 대응.
BASELINE_SYSTEM_TEMPLATE = """당신은 사용자의 공유 캘린더 일정을 기반으로 질문에 답하는 한국어 어시스턴트입니다.

오늘은 {today} ({weekday}요일) 입니다.
"오늘", "어제", "내일", "이번 주", "다음 주", "작년", "올해" 같은 표현은 이 날짜를 기준으로 해석하세요.

아래 [전체 일정 목록] 만을 근거로 답하세요. 목록에 없으면 추측하지 말고 "기록에 없어요" 라고 답하세요.

[전체 일정 목록] (날짜·제목·짧은 메모, 최근부터 최대 200개)
{events_str}

답변 규칙:
- 한국어, 친근한 말투
- 질문에 직접 답하기: 묻지 않은 부가 정보 생략
- 짧은 사실 질문: 한두 문장으로 핵심만
- 리스트 질문: 항목마다 "날짜 — 제목" 한 줄
- 집계 질문 ("몇 번", "가장 자주"): 횟수 먼저 명시
- 카테고리·기간 한정 질문은 [전체 일정 목록] 을 빠짐없이 살펴 누락 없게
- 추측·창작 금지. 기록에 없으면 "기록에 없어요"
- 확신 없는 항목은 추가하지 말 것"""


def _format_events_for_baseline(all_events: list[dict]) -> str:
    if not all_events:
        return "(등록된 일정 없음)"
    lines: list[str] = []
    for ev in all_events:
        date = ev.get("date") or ""
        end_date = ev.get("end_date") or date
        date_range = date if date == end_date else f"{date} ~ {end_date}"
        memo = (ev.get("memo") or "").strip()
        memo_part = ""
        if memo:
            memo_short = memo[:100] + "…" if len(memo) > 100 else memo
            memo_part = f" · {memo_short}"
        lines.append(f"- {date_range} {ev.get('title') or ''}{memo_part}")
    return "\n".join(lines)


def call_baseline(message: str, all_events: list[dict]) -> str:
    """순수 LLM: vector 검색 없이 메타 200건만으로 답변. chat-rag 와 같은 gpt-4o-mini."""
    import openai

    KST = timezone(timedelta(hours=9))
    now_kst = datetime.now(KST)
    today = now_kst.strftime("%Y-%m-%d")
    weekday = ["월", "화", "수", "목", "금", "토", "일"][now_kst.weekday()]

    system_prompt = BASELINE_SYSTEM_TEMPLATE.format(
        today=today,
        weekday=weekday,
        events_str=_format_events_for_baseline(all_events),
    )

    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,  # chat-rag 와 동일
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    )
    return resp.choices[0].message.content or ""


def collect_baseline_responses(
    jwt: str, gc_id: str, items: list[dict], limit: int | None
) -> list[dict]:
    qs = items[:limit] if limit else items
    print(f"[3/4] baseline 호출 ({len(qs)}개 질문, 검색 X, 메타 200건 dump)")
    all_events = fetch_group_events(jwt, gc_id)
    print(f"  · 메타 {len(all_events)}건 fetch")
    results: list[dict] = []
    for q in qs:
        preview = q["user_input"][:42]
        print(f"  Q{q['id']:>2}. [{q['category']:<15}] {preview}")
        try:
            answer = call_baseline(q["user_input"], all_events)
        except Exception as ex:
            print(f"      ⚠ 실패: {ex}")
            continue
        print(f"      · 답변 {len(answer)}자")
        # baseline 은 vector retrieve 없음 → 빈 contexts (--include-meta 가 답변-증거 기준으로 채움)
        results.append({
            "id": q["id"],
            "category": q["category"],
            "user_input": q["user_input"],
            "response": answer,
            "retrieved_contexts": [],
            "reference": q["reference"],
            "n_sources": 0,
            "expected_events": q.get("expected_events", []),
        })
        time.sleep(0.3)
    return results


def fetch_group_events(jwt: str, gc_id: str, limit: int = 200) -> list[dict]:
    """chat-rag 의 '메타 채널' 과 동일한 그룹 일정 목록 조회 (최근 200건)."""
    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/group_events",
        params={
            "group_calendar_id": f"eq.{gc_id}",
            "select": "title,date,end_date,memo",
            "order": "date.desc",
            "limit": str(limit),
        },
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {jwt}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def augment_contexts_with_meta(
    rows: list[dict], all_events: list[dict]
) -> tuple[int, int]:
    """답변에 (title 또는 YYYY-MM-DD) 가 등장하는 메타 일정을
    retrieved_contexts 에 추가 (in-place). 기존 vector 청크와 (date,title) 키로 중복 제거.

    Faith/CtxRecall 정확도 ↑. Precision 은 답변-증거 필터로 거의 안 영향.
    """
    total_added = 0
    rows_changed = 0
    for r in rows:
        answer = r["response"] or ""
        existing_keys: set[str] = set()
        for ctx in r["retrieved_contexts"]:
            existing_keys.add(ctx.split("\n", 1)[0].strip())

        added: list[str] = []
        for ev in all_events:
            title = (ev.get("title") or "").strip()
            date = ev.get("date") or ""
            key = f"{date} — {title}"
            if not title or not date or key in existing_keys:
                continue
            # title (3자 이상) 또는 YYYY-MM-DD 가 답변에 등장하면 채택
            in_answer = (len(title) >= 3 and title in answer) or date in answer
            if not in_answer:
                continue
            memo = (ev.get("memo") or "").strip()
            memo_part = f"메모: {memo}" if memo else "메모: (없음)"
            added.append(f"{date} — {title}\n{memo_part}")
            existing_keys.add(key)

        if added:
            r["retrieved_contexts"].extend(added)
            r["n_meta_added"] = len(added)
            total_added += len(added)
            rows_changed += 1
        else:
            r["n_meta_added"] = 0
    return rows_changed, total_added


def collect_responses(
    jwt: str, gc_id: str, items: list[dict], limit: int | None
) -> list[dict]:
    qs = items[:limit] if limit else items
    print(f"[3/4] chat-rag 호출 ({len(qs)}개 질문)")
    results: list[dict] = []
    for q in qs:
        preview = q["user_input"][:42]
        print(f"  Q{q['id']:>2}. [{q['category']:<15}] {preview}")
        try:
            resp = call_chat_rag(jwt, gc_id, q["user_input"])
        except Exception as ex:
            print(f"      ⚠ 실패: {ex}")
            continue
        sources = resp.get("sources", []) or []
        contexts = [
            f"{s.get('date', '?')} — {s.get('title', '?')}\n"
            f"메모: {s.get('snippet') or '(없음)'}"
            for s in sources
        ]
        answer = resp.get("answer", "") or ""
        print(f"      · {len(sources)}개 청크 검색됨 / 답변 {len(answer)}자")
        results.append({
            "id": q["id"],
            "category": q["category"],
            "user_input": q["user_input"],
            "response": answer,
            "retrieved_contexts": contexts,
            "reference": q["reference"],
            "n_sources": len(sources),
            "expected_events": q.get("expected_events", []),
        })
        time.sleep(0.3)  # rate limit 보호
    return results


# ─────────────────────────────────────────────
# 2) RAGAS 평가
# ─────────────────────────────────────────────
def run_ragas(rows: list[dict], evaluator_model: str) -> pd.DataFrame:
    # 무거운 import 는 여기서만 (--skip-collect 외 경로에서 호출)
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas import EvaluationDataset, SingleTurnSample, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (
        AnswerRelevancy,
        AnswerSimilarity,
        ContextPrecision,
        ContextRecall,
        Faithfulness,
    )

    samples = [
        SingleTurnSample(
            user_input=r["user_input"],
            response=r["response"],
            retrieved_contexts=r["retrieved_contexts"],
            reference=r["reference"],
        )
        for r in rows
    ]
    ds = EvaluationDataset(samples=samples)

    evaluator_llm = LangchainLLMWrapper(
        ChatOpenAI(model=evaluator_model, temperature=0)
    )
    evaluator_emb = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(model="text-embedding-3-small")
    )

    print(f"[4/4] RAGAS 평가 ({evaluator_model} evaluator, 샘플 {len(samples)}개)")
    result = evaluate(
        dataset=ds,
        metrics=[
            Faithfulness(llm=evaluator_llm),
            AnswerRelevancy(llm=evaluator_llm, embeddings=evaluator_emb),
            # 답변과 reference 의 임베딩 코사인 유사도. LLM 호출 없음 → 한국어
            # 후보-질문 생성 노이즈 (Ans.Rel 의 n=1 문제) 회피.
            AnswerSimilarity(embeddings=evaluator_emb),
            ContextPrecision(llm=evaluator_llm),
            ContextRecall(llm=evaluator_llm),
        ],
    )
    df = result.to_pandas()
    df["id"] = [r["id"] for r in rows]
    df["category"] = [r["category"] for r in rows]
    return df


# ─────────────────────────────────────────────
# 3) 시각화
# ─────────────────────────────────────────────
def _setup_font():
    if platform.system() == "Darwin":
        plt.rcParams["font.family"] = "AppleGothic"
    elif platform.system() == "Windows":
        plt.rcParams["font.family"] = "Malgun Gothic"
    plt.rcParams["axes.unicode_minus"] = False


def plot_radar(scores: dict[str, float], out_path: Path) -> None:
    _setup_font()
    labels = list(scores.keys())
    values = list(scores.values())
    n = len(labels)
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    values_c = values + values[:1]
    angles_c = angles + angles[:1]

    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))
    ax.fill(angles_c, values_c, color="#395fa5", alpha=0.25)
    ax.plot(angles_c, values_c, color="#395fa5", linewidth=2, marker="o", markersize=8)
    ax.set_xticks(angles)
    ax.set_xticklabels(labels, fontsize=12)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"], fontsize=9)
    ax.set_title("RAGAS 평가 결과 (전체 평균)", fontsize=14, fontweight="bold", pad=20)
    for ang, val in zip(angles, values):
        ax.text(ang, val + 0.06, f"{val:.3f}",
                ha="center", fontsize=11, fontweight="bold", color="#1a1a1a")
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()


def plot_by_category(df: pd.DataFrame, out_path: Path) -> None:
    _setup_font()
    agg = (
        df.groupby("category")[METRIC_COLS]
        .mean()
        .rename(index=CATEGORY_PRETTY, columns=METRIC_PRETTY)
    )
    fig, ax = plt.subplots(figsize=(11, 6))
    agg.plot.bar(ax=ax, colormap="viridis", width=0.8, edgecolor="white")
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("점수")
    ax.set_xlabel("")
    ax.set_title("카테고리별 RAGAS 점수", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9, framealpha=0.9)
    ax.axhline(0.8, color="gray", linestyle="--", linewidth=0.6, alpha=0.7)
    ax.text(ax.get_xlim()[1], 0.805, " 목표 0.8", fontsize=8, color="gray", va="bottom")
    plt.xticks(rotation=0)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()


def plot_per_question(df: pd.DataFrame, out_path: Path) -> None:
    _setup_font()
    df_sorted = df.sort_values("id")
    fig, ax = plt.subplots(figsize=(16, 6))
    x = np.arange(len(df_sorted))
    n = len(METRIC_COLS)
    width = 0.16
    colors = ["#395fa5", "#2f9e44", "#1098ad", "#e8590c", "#7048e8"]
    offset = (n - 1) / 2
    for i, col in enumerate(METRIC_COLS):
        ax.bar(x + (i - offset) * width, df_sorted[col], width=width,
               label=METRIC_PRETTY[col], color=colors[i], edgecolor="white")
    ax.set_xticks(x)
    ax.set_xticklabels([f"Q{i}" for i in df_sorted["id"]], fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("점수")
    ax.set_title("질문별 RAGAS 점수", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9, framealpha=0.9, ncol=2)
    ax.axhline(0.8, color="gray", linestyle="--", linewidth=0.6, alpha=0.7)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()


# ─────────────────────────────────────────────
# main
# ─────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["rag", "baseline"], default="rag",
                        help="rag: chat-rag (vector + meta), baseline: 순수 LLM (메타 dump only)")
    parser.add_argument("--limit", type=int, default=None,
                        help="처음 N개만 평가 (디버깅용)")
    parser.add_argument("--output-dir", type=Path, default=None,
                        help="결과 저장 폴더 (미지정 시 mode 에 따라 eval_outputs/ 또는 eval_outputs_baseline/)")
    parser.add_argument("--skip-collect", action="store_true",
                        help="기존 rag_responses.json 재사용 (재호출 안 함)")
    parser.add_argument("--include-meta", action="store_true",
                        help="답변에 등장한 메타 일정을 retrieved_contexts 에 추가")
    parser.add_argument("--evaluator", default="gpt-4o",
                        help="RAGAS 평가용 LLM 모델 (기본: gpt-4o)")
    args = parser.parse_args()

    if args.output_dir is None:
        default_name = "eval_outputs" if args.mode == "rag" else "eval_outputs_baseline"
        args.output_dir = Path(__file__).parent / default_name

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    responses_path = out / "rag_responses.json"

    gt_path = Path(__file__).parent / "ground_truth.json"
    items = json.loads(gt_path.read_text(encoding="utf-8"))["items"]

    jwt: str | None = None
    gc_id: str | None = None

    if args.skip_collect and responses_path.exists():
        print(f"[1-3/4] --skip-collect: {responses_path} 재사용")
        results = json.loads(responses_path.read_text(encoding="utf-8"))
        if args.limit:
            results = results[: args.limit]
    else:
        jwt = login_as_jisoo()
        gc_id = find_group_calendar(jwt)
        if args.mode == "baseline":
            results = collect_baseline_responses(jwt, gc_id, items, args.limit)
        else:
            results = collect_responses(jwt, gc_id, items, args.limit)
        responses_path.write_text(
            json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  · 응답 저장: {responses_path}")

    if not results:
        print("❌ 수집된 응답 없음. 종료.")
        sys.exit(1)

    if args.include_meta:
        if jwt is None or gc_id is None:
            jwt = login_as_jisoo()
            gc_id = find_group_calendar(jwt)
        all_events = fetch_group_events(jwt, gc_id)
        rows_changed, total_added = augment_contexts_with_meta(results, all_events)
        print(
            f"  · --include-meta: {len(all_events)}개 메타에서 "
            f"{total_added}개 추가됨 ({rows_changed}/{len(results)} 질문에 영향)"
        )

    df = run_ragas(results, args.evaluator)

    csv_path = out / "ragas_results.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    # 전체 평균
    means = {col: float(df[col].mean()) for col in METRIC_COLS}
    radar_scores = {
        "Faithfulness": means["faithfulness"],
        "Ans. Relevancy": means["answer_relevancy"],
        "Ans. Similarity": means["answer_similarity"],
        "Ctx. Precision": means["context_precision"],
        "Ctx. Recall": means["context_recall"],
    }

    radar_path = out / "ragas_radar.png"
    cat_path = out / "ragas_by_category.png"
    per_q_path = out / "ragas_per_question.png"
    plot_radar(radar_scores, radar_path)
    plot_by_category(df, cat_path)
    plot_per_question(df, per_q_path)

    # 카테고리별 요약
    cat_agg = df.groupby("category")[METRIC_COLS].mean().round(3)
    cat_path_csv = out / "ragas_by_category.csv"
    cat_agg.to_csv(cat_path_csv, encoding="utf-8-sig")

    print()
    print("=" * 60)
    print("RAGAS 평가 결과 — 전체 평균 (샘플 {}개)".format(len(df)))
    print("=" * 60)
    print(f"  Faithfulness      (사실 일치도)   : {means['faithfulness']:.3f}")
    print(f"  Answer Relevancy  (답변 관련성)   : {means['answer_relevancy']:.3f}")
    print(f"  Answer Similarity (정답 임베딩)   : {means['answer_similarity']:.3f}")
    print(f"  Context Precision (검색 정밀도)   : {means['context_precision']:.3f}")
    print(f"  Context Recall    (검색 재현율)   : {means['context_recall']:.3f}")
    print("=" * 60)
    print()
    print("카테고리별 평균:")
    print(cat_agg.to_string())
    print()
    print("산출물:")
    print(f"  · {csv_path}            (질문별 상세)")
    print(f"  · {cat_path_csv}     (카테고리별 평균)")
    print(f"  · {radar_path}                (전체 평균 레이더)")
    print(f"  · {cat_path}          (카테고리별 바차트)")
    print(f"  · {per_q_path}         (질문별 바차트)")


if __name__ == "__main__":
    main()
