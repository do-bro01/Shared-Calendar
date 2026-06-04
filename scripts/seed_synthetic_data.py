#!/usr/bin/env python3
"""
SC 합성 데이터 시드 스크립트

가상 대학 친구 3명(지수·민준·서연) + 새 공유 캘린더방
+ 1년치(2025-06-04 ~ 2026-06-04) 일정 80개 + 메모 60개 생성.

RAGAS 평가용 데이터셋. service_role 키로 RLS 우회하므로 절대 git에 커밋 금지.

실행:
    cd scripts
    uv sync                                          # 의존성 설치
    uv run python seed_synthetic_data.py             # 생성 (가상 사용자 3명만 멤버)
    uv run python seed_synthetic_data.py --owner dohyunge6358@gmail.com
                                                     # 본인 실계정도 옵저버로 그룹에 추가
    uv run python seed_synthetic_data.py --dry-run   # DB 없이 일정 표만 출력
    uv run python seed_synthetic_data.py --cleanup   # 합성 데이터 전부 삭제

환경변수 (../.env.local):
    EXPO_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    OPENAI_API_KEY
"""
from __future__ import annotations

import argparse
import os
import random
import sys
from dataclasses import dataclass
from pathlib import Path

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
SERVICE_ROLE_KEY = _require("SUPABASE_SERVICE_ROLE_KEY")

GROUP_NAME = "캠퍼스 친구들 (합성 데이터)"
SYNTHETIC_EMAIL_DOMAIN = "sc-eval.local"
SYNTHETIC_PASSWORD = "ScSynthetic!2026"


# ─────────────────────────────────────────────
# 페르소나
# ─────────────────────────────────────────────
@dataclass(frozen=True)
class Persona:
    key: str
    name: str
    email: str
    tone: str
    dot_color: str
    sc_id: str


PERSONAS: list[Persona] = [
    Persona("jisoo", "지수", f"synthetic-jisoo@{SYNTHETIC_EMAIL_DOMAIN}",
            "감성적이고 디테일을 잘 기억. 색감·분위기·메뉴·소품 자주 언급",
            "#395fa5ff", "SYNJSU"),
    Persona("minjun", "민준", f"synthetic-minjun@{SYNTHETIC_EMAIL_DOMAIN}",
            "짧고 활기참. 운동량·거리·체력·승부 결과 자주 언급",
            "#2f9e44ff", "SYNMNJ"),
    Persona("seoyeon", "서연", f"synthetic-seoyeon@{SYNTHETIC_EMAIL_DOMAIN}",
            "정보 정리형. 시간·장소·곡명·티켓 가격·예약 정보 정확히",
            "#e8590cff", "SYNSEY"),
]
P = {p.key: p for p in PERSONAS}


# ─────────────────────────────────────────────
# 일정 정의 (80개 · 1년)
#   d, ed   : 시작/종료 날짜 (ed 없으면 단일일)
#   ad      : all_day (false면 st/et 필수)
#   st, et  : 시작/종료 시각 "HH:MM"
#   o       : 작성자 persona key
#   cat     : 카테고리 (RAGAS 평가 분포 추적용)
#   title   : 일정 제목
#   loc     : 장소 (메모 시드용)
#   w       : 참여자 persona keys
#   m       : 메모 시드(사실/키워드). OpenAI가 이걸 자연어 메모로 변환.
# ─────────────────────────────────────────────
EVENTS: list[dict] = [
    # ── 카페 루틴 (15) — 반복 방문 패턴, "가장 자주 간 카페는?" 답변용 ──
    {"d": "2025-06-21", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "안다즈 카페 모임", "loc": "안다즈 카페 (한남)",
     "w": ["jisoo", "seoyeon"],
     "m": "주말 오후. 시그니처 라떼. 창가 자리에서 책 한 챕터씩."},
    {"d": "2025-07-20", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "어니언 안국점 브런치", "loc": "어니언 안국",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "팡도르와 아이스 라떼. 점심 즈음. 한옥 마당이 좋음."},
    {"d": "2025-08-09", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "블루보틀 성수 카페", "loc": "블루보틀 성수",
     "w": ["jisoo", "seoyeon"],
     "m": "신메뉴 시나몬 라떼. 햇살 좋아서 2층 창가."},
    {"d": "2025-08-30", "ad": True, "o": "seoyeon", "cat": "cafe",
     "title": "카페 봄", "loc": "카페 봄 (서촌)",
     "w": ["jisoo", "seoyeon"],
     "m": "늦여름 오후. 시즌 메뉴 살구 에이드."},
    {"d": "2025-09-20", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "안다즈 카페", "loc": "안다즈 카페 (한남)",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "가을 시즌 메뉴. 시그니처 라떼는 여전히 베스트. 디저트는 별로."},
    {"d": "2025-09-27", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "띵글스 새로 생긴 카페", "loc": "띵글스 (성수)",
     "w": ["jisoo"],
     "m": "혼자 작업. 인테리어가 정말 예쁨. 라떼는 평범."},
    {"d": "2025-10-12", "ad": True, "o": "seoyeon", "cat": "cafe",
     "title": "1953 카페", "loc": "1953 카페 (연남)",
     "w": ["jisoo", "seoyeon"],
     "m": "빈티지 가구. 드립 커피 두 잔. 비 오는 날 분위기 최고."},
    {"d": "2025-11-08", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "어니언 안국점", "loc": "어니언 안국",
     "w": ["jisoo", "minjun"],
     "m": "늦가을 따뜻한 라떼. 단풍이 거의 끝났음."},
    {"d": "2025-12-07", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "안다즈 카페 (연말)", "loc": "안다즈 카페 (한남)",
     "w": ["jisoo", "seoyeon"],
     "m": "크리스마스 시즌 페퍼민트 모카."},
    {"d": "2026-01-11", "ad": True, "o": "seoyeon", "cat": "cafe",
     "title": "카페 봄", "loc": "카페 봄 (서촌)",
     "w": ["jisoo", "seoyeon"],
     "m": "새해 첫 카페. 호지차 라떼."},
    {"d": "2026-01-25", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "블루보틀 성수", "loc": "블루보틀 성수",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "겨울 한정 진저브레드 라떼. 셋 다 같이 모임."},
    {"d": "2026-02-14", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "1953 카페", "loc": "1953 카페 (연남)",
     "w": ["jisoo", "seoyeon"],
     "m": "발렌타인 시즌. 초콜릿 케이크 쉐어."},
    {"d": "2026-03-22", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "어니언 안국점 봄", "loc": "어니언 안국",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "봄 햇살. 한옥 마당. 팡도르 두 개."},
    {"d": "2026-04-19", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "안다즈 카페", "loc": "안다즈 카페 (한남)",
     "w": ["jisoo", "seoyeon"],
     "m": "벚꽃 다 끝나고. 시그니처 라떼는 변함없이."},
    {"d": "2026-05-10", "ad": True, "o": "jisoo", "cat": "cafe",
     "title": "블루보틀 성수", "loc": "블루보틀 성수",
     "w": ["jisoo", "minjun"],
     "m": "늦봄. 콜드브루. 야외 자리."},

    # ── 전시·콘서트 (12) — 고유 이벤트, "○월에 본 공연은?" 답변용 ──
    {"d": "2025-07-12", "ad": False, "st": "14:00", "et": "17:30",
     "o": "jisoo", "cat": "exhibition", "title": "뱅크시 전시", "loc": "DDP",
     "w": ["jisoo", "seoyeon"],
     "m": "입장료 22000원. 사진 NG 구역 많음. 도슨트 좋았음."},
    {"d": "2025-08-23", "ad": False, "st": "15:00", "et": "18:00",
     "o": "jisoo", "cat": "exhibition",
     "title": "송은아트센터 현실의 시인 전시", "loc": "송은아트센터",
     "w": ["jisoo", "seoyeon"],
     "m": "무료 전시. 2층 영상 작품 인상적."},
    {"d": "2025-09-06", "ad": False, "st": "13:00", "et": "16:30",
     "o": "jisoo", "cat": "exhibition",
     "title": "데이비드 호크니 전시", "loc": "서울시립미술관",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "입장 17000원. 셋이 같이. 아이패드 드로잉 섹션이 백미."},
    {"d": "2025-10-04", "ad": False, "st": "11:00", "et": "14:00",
     "o": "jisoo", "cat": "exhibition",
     "title": "어반브레이크 아트페어", "loc": "코엑스",
     "w": ["jisoo", "seoyeon"],
     "m": "입장 25000원. 작가 200여 명. 작은 드로잉 하나 구매."},
    {"d": "2025-10-18", "ed": "2025-10-19", "ad": True,
     "o": "seoyeon", "cat": "concert",
     "title": "자라섬 재즈 페스티벌", "loc": "자라섬",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "2일권 13만원. 토요일 헤드라이너 좋았음. 옆 글램핑에서 잠."},
    {"d": "2025-11-22", "ad": False, "st": "19:00", "et": "22:00",
     "o": "seoyeon", "cat": "concert",
     "title": "장미여관 라이브", "loc": "롤링홀",
     "w": ["jisoo", "seoyeon"],
     "m": "스탠딩. 신곡 위주. 앵콜 두 곡."},
    {"d": "2025-11-30", "ad": False, "st": "14:00", "et": "17:00",
     "o": "jisoo", "cat": "exhibition",
     "title": "라프 시몬스 전시", "loc": "디뮤지엄",
     "w": ["jisoo", "seoyeon"],
     "m": "입장 20000원. 패션 디자이너 회고전. 사진 가능."},
    {"d": "2025-12-13", "ad": False, "st": "19:00", "et": "22:30",
     "o": "seoyeon", "cat": "concert",
     "title": "아이유 콘서트", "loc": "KSPO 돔",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "R석 13만원. 셋이 같이. 앵콜 4곡. 종이비행기."},
    {"d": "2026-02-21", "ad": False, "st": "14:00", "et": "16:00",
     "o": "jisoo", "cat": "exhibition",
     "title": "백석 시화전", "loc": "교보문고 광화문",
     "w": ["jisoo", "seoyeon"],
     "m": "무료 시화 30점. 굿즈 한정판 빨리 매진."},
    {"d": "2026-03-08", "ad": False, "st": "19:30", "et": "22:00",
     "o": "seoyeon", "cat": "concert",
     "title": "쇼팽 콩쿠르 한국 라운드", "loc": "예술의전당",
     "w": ["seoyeon"],
     "m": "R석 8만원. 한국 참가자 본선 진출. 박수 길게."},
    {"d": "2026-04-04", "ad": False, "st": "19:00", "et": "23:00",
     "o": "seoyeon", "cat": "concert",
     "title": "콜드플레이 내한", "loc": "고척스카이돔",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "스탠딩 25만원. Yellow에서 셋 다 울었음."},
    {"d": "2026-04-26", "ad": False, "st": "13:00", "et": "16:00",
     "o": "jisoo", "cat": "exhibition",
     "title": "MMCA 이불 회고전", "loc": "국립현대미술관 서울",
     "w": ["jisoo", "seoyeon"],
     "m": "입장 4000원. 한국 현대미술 거장. 설치 작품 압도적."},

    # ── 등산·운동 (10) — "민준이랑 등산 간 게 언제?" 답변용 ──
    {"d": "2025-06-08", "ad": False, "st": "08:00", "et": "14:00",
     "o": "minjun", "cat": "hiking",
     "title": "도봉산 둘레길", "loc": "도봉산",
     "w": ["minjun", "jisoo"],
     "m": "왕복 4시간. 무릎 살짝 시큰. 정상은 다음에."},
    {"d": "2025-07-06", "ad": False, "st": "16:00", "et": "19:00",
     "o": "minjun", "cat": "sports",
     "title": "한강 자전거 라이딩", "loc": "여의도-잠실 한강",
     "w": ["minjun", "seoyeon"],
     "m": "왕복 40km. 한강대교 야경. 따릉이 대여."},
    {"d": "2025-09-21", "ad": False, "st": "15:00", "et": "18:30",
     "o": "minjun", "cat": "sports",
     "title": "한강 자전거 라이딩", "loc": "반포-여의도 한강",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "가을 바람. 30km. 중간에 김밥."},
    {"d": "2025-10-26", "ad": False, "st": "07:00", "et": "14:30",
     "o": "minjun", "cat": "hiking",
     "title": "북한산 백운대", "loc": "북한산",
     "w": ["minjun"],
     "m": "단풍 절정. 정상까지 3시간. 도시락 라면."},
    {"d": "2025-11-15", "ad": False, "st": "14:00", "et": "17:00",
     "o": "minjun", "cat": "sports",
     "title": "축구 동아리 친선전", "loc": "잠실 풋살장",
     "w": ["minjun"],
     "m": "5:2 승. 두 골 어시스트. 풋살화 새로."},
    {"d": "2025-12-21", "ad": False, "st": "19:00", "et": "21:30",
     "o": "minjun", "cat": "sports",
     "title": "탁구장", "loc": "성수 탁구클럽",
     "w": ["minjun", "seoyeon"],
     "m": "1시간 1만원. 서연이 의외로 잘 침. 3:2 졌음."},
    {"d": "2026-02-08", "ad": False, "st": "20:00", "et": "22:00",
     "o": "minjun", "cat": "sports",
     "title": "탁구장 복식", "loc": "성수 탁구클럽",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "셋이서 복식. 2시간 풀. 다음 주 또 오기로."},
    {"d": "2026-03-15", "ad": False, "st": "07:30", "et": "15:00",
     "o": "minjun", "cat": "hiking",
     "title": "관악산 정상 도전", "loc": "관악산",
     "w": ["minjun", "jisoo"],
     "m": "정상 깃대까지. 봄꽃 시작. 다리 풀려서 하산은 케이블카."},
    {"d": "2026-04-12", "ad": False, "st": "15:00", "et": "18:00",
     "o": "minjun", "cat": "sports",
     "title": "한강 자전거 라이딩", "loc": "성수-여의도 한강",
     "w": ["minjun", "seoyeon"],
     "m": "벚꽃 마지막. 25km. 카페 봄에서 마무리."},
    {"d": "2026-05-17", "ad": False, "st": "08:00", "et": "15:00",
     "o": "minjun", "cat": "hiking",
     "title": "남한산성 트레킹", "loc": "남한산성",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "성벽 한바퀴. 6시간. 백숙으로 마무리."},

    # ── 여행 (8) — "여름에 다녀온 곳?" 답변용 ──
    {"d": "2025-07-26", "ad": True, "o": "minjun", "cat": "trip",
     "title": "단양 당일치기", "loc": "단양",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "만천하스카이워크. 마늘갈비 점심. KTX 왕복."},
    {"d": "2025-08-14", "ed": "2025-08-17", "ad": True,
     "o": "jisoo", "cat": "trip",
     "title": "제주 3박 4일", "loc": "제주도",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "애월 게스트하우스. 협재해변·우도·서귀포. 흑돼지 두 번."},
    {"d": "2025-09-13", "ed": "2025-09-14", "ad": True,
     "o": "seoyeon", "cat": "trip",
     "title": "가평 글램핑", "loc": "가평",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "6인 텐트. 바베큐·모닥불·맥주. 잠 거의 안 잠."},
    {"d": "2025-11-01", "ed": "2025-11-02", "ad": True,
     "o": "seoyeon", "cat": "trip",
     "title": "강릉 1박 2일", "loc": "강릉",
     "w": ["jisoo", "seoyeon"],
     "m": "안목해변 커피거리. 테라로사 본점. KTX."},
    {"d": "2025-12-31", "ed": "2026-01-02", "ad": True,
     "o": "seoyeon", "cat": "trip",
     "title": "부산 새해 2박 3일", "loc": "부산",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "광안리 새해 카운트다운. 해운대 일출. 돼지국밥."},
    {"d": "2026-02-28", "ad": True, "o": "minjun", "cat": "trip",
     "title": "춘천 닭갈비 당일치기", "loc": "춘천",
     "w": ["minjun", "jisoo"],
     "m": "명동 닭갈비골목. 막국수. ITX 왕복 2만원."},
    {"d": "2026-04-30", "ed": "2026-05-02", "ad": True,
     "o": "jisoo", "cat": "trip",
     "title": "경주 2박 3일", "loc": "경주",
     "w": ["jisoo", "seoyeon"],
     "m": "황리단길 한옥 스테이. 첨성대·불국사·동궁과 월지 야경."},
    {"d": "2026-05-23", "ed": "2026-05-24", "ad": True,
     "o": "minjun", "cat": "trip",
     "title": "양양 서핑 1박 2일", "loc": "양양",
     "w": ["minjun", "seoyeon"],
     "m": "죽도해변. 강습 8만원. 보드 위에 5초 섰음."},

    # ── 맛집 (14) — 일부 반복, "자주 간 식당?" 답변용 ──
    {"d": "2025-07-15", "ad": False, "st": "19:00", "et": "21:30",
     "o": "minjun", "cat": "food",
     "title": "익선동 정원 한식", "loc": "익선동 정원",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "한식 코스 4만원. 마당 자리. 보쌈이 베스트."},
    {"d": "2025-08-02", "ad": False, "st": "18:30", "et": "21:00",
     "o": "minjun", "cat": "food",
     "title": "마포 곱창집", "loc": "마포 곱창골목",
     "w": ["minjun", "seoyeon"],
     "m": "막창·곱창 모듬. 1인 4만원. 술 안 마심."},
    {"d": "2025-09-19", "ad": False, "st": "12:00", "et": "14:00",
     "o": "minjun", "cat": "food",
     "title": "이태원 츠케멘 마타가츠", "loc": "이태원 마타가츠",
     "w": ["minjun"],
     "m": "점심 웨이팅 30분. 진한 츠케멘. 1만2천원."},
    {"d": "2025-09-28", "ad": True, "o": "jisoo", "cat": "food",
     "title": "성수 빵지순례", "loc": "성수동 (밀도·센터커피·노티드)",
     "w": ["jisoo", "seoyeon"],
     "m": "빵집 세 곳. 밀도 식빵·센터커피 스콘·노티드 도넛."},
    {"d": "2025-10-25", "ad": False, "st": "19:00", "et": "21:30",
     "o": "jisoo", "cat": "food",
     "title": "성수 페테레우니 파스타", "loc": "성수 페테레우니",
     "w": ["jisoo", "seoyeon"],
     "m": "라구·푸타네스카. 와인 한 잔. 둘이 8만원."},
    {"d": "2025-11-25", "ad": False, "st": "19:30", "et": "22:30",
     "o": "minjun", "cat": "food",
     "title": "을지로 노가리 골목", "loc": "을지로 노가리골목",
     "w": ["minjun", "seoyeon"],
     "m": "노가리·골뱅이무침. OB생맥주. 가성비 최고."},
    {"d": "2025-12-04", "ad": False, "st": "19:00", "et": "21:30",
     "o": "minjun", "cat": "food",
     "title": "신촌 양꼬치", "loc": "신촌 양꼬치 거리",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "양꼬치 + 마라샹궈. 칭따오 두 병. 1인 3만원."},
    {"d": "2025-12-27", "ad": False, "st": "18:30", "et": "21:00",
     "o": "minjun", "cat": "food",
     "title": "강남 사천식 마라", "loc": "강남 사천왕",
     "w": ["minjun", "seoyeon"],
     "m": "마라샹궈 + 어향가지. 매운맛 3단계. 셋이 9만원."},
    {"d": "2026-01-18", "ad": False, "st": "19:00", "et": "21:30",
     "o": "jisoo", "cat": "food",
     "title": "익선동 정원 재방문", "loc": "익선동 정원",
     "w": ["jisoo", "seoyeon"],
     "m": "두 번째 방문. 코스 바뀜. 보쌈은 여전."},
    {"d": "2026-01-31", "ad": False, "st": "18:00", "et": "21:00",
     "o": "jisoo", "cat": "food",
     "title": "한남동 비건 파인다이닝", "loc": "한남동 비건바",
     "w": ["jisoo", "seoyeon"],
     "m": "비건 7코스 12만원. 셀러리악 수프 인상적."},
    {"d": "2026-02-17", "ad": True, "o": "minjun", "cat": "food",
     "title": "광장시장 빈대떡", "loc": "광장시장",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "빈대떡·육회·마약김밥. 막걸리 두 통. 1인 2만원."},
    {"d": "2026-03-02", "ad": False, "st": "19:30", "et": "22:30",
     "o": "seoyeon", "cat": "food",
     "title": "압구정 오마카세 (1주년 기념)", "loc": "압구정 스시 마사",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "우정 1주년. 디너 오마카세 1인 18만원. 셀카 많이."},
    {"d": "2026-03-29", "ad": False, "st": "19:00", "et": "21:30",
     "o": "minjun", "cat": "food",
     "title": "마포 곱창집 (재방문)", "loc": "마포 곱창골목",
     "w": ["minjun", "jisoo"],
     "m": "여기 진짜 자주 옴. 막창 여전히 베스트. 술 X."},
    {"d": "2026-04-08", "ad": False, "st": "12:00", "et": "14:00",
     "o": "minjun", "cat": "food",
     "title": "홍대 우래옥 평양냉면", "loc": "홍대 우래옥",
     "w": ["minjun", "seoyeon"],
     "m": "점심 웨이팅 1시간. 평냉 + 만두. 1만5천원."},

    # ── 생일·기념일 (6) ──
    {"d": "2025-07-22", "ad": False, "st": "19:00", "et": "23:00",
     "o": "minjun", "cat": "birthday",
     "title": "민준 생일파티", "loc": "홍대 펍",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "24살. 셋이 펍에서 맥주. 케이크는 지수가 준비."},
    {"d": "2025-09-01", "ad": False, "st": "19:00", "et": "22:00",
     "o": "jisoo", "cat": "anniversary",
     "title": "우리 셋 만남 1주년", "loc": "한남동 와인바",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "동아리에서 처음 만난 지 1년. 와인 두 병. 기념 사진."},
    {"d": "2025-10-05", "ad": False, "st": "19:00", "et": "23:00",
     "o": "seoyeon", "cat": "birthday",
     "title": "서연 생일파티", "loc": "강남 루프탑 바",
     "w": ["seoyeon", "jisoo", "minjun"],
     "m": "23살. 루프탑 칵테일. 선물 책 두 권."},
    {"d": "2025-12-30", "ad": False, "st": "18:00", "et": "23:30",
     "o": "jisoo", "cat": "gathering",
     "title": "송년회", "loc": "이태원 와인바 르 쁘띠",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "한 해 정리. 셋이 다이어리 교환."},
    {"d": "2026-01-08", "ad": False, "st": "14:00", "et": "17:00",
     "o": "seoyeon", "cat": "gathering",
     "title": "신년 모임 카페", "loc": "안다즈 카페 (한남)",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "새해 결심 발표. 셋이서 세 시간."},
    {"d": "2026-03-12", "ad": False, "st": "19:00", "et": "23:00",
     "o": "jisoo", "cat": "birthday",
     "title": "지수 생일파티", "loc": "성수 비건바",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "24살. 비건바 디너. 케이크는 노티드."},

    # ── 영화·취미 (8) ──
    {"d": "2025-07-18", "ad": False, "st": "19:30", "et": "22:30",
     "o": "seoyeon", "cat": "hobby",
     "title": "오펜하이머 IMAX 재개봉", "loc": "용산 CGV IMAX",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "3시간 풀 IMAX. 1인 22000원. 사운드 압도적."},
    {"d": "2025-08-24", "ad": False, "st": "16:00", "et": "18:30",
     "o": "minjun", "cat": "hobby",
     "title": "방탈출 강남", "loc": "강남 방탈출 카페 X",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "테마 '세컨 룸'. 50분 만에 탈출 성공. 첫 도전."},
    {"d": "2025-10-30", "ad": False, "st": "18:30", "et": "22:00",
     "o": "minjun", "cat": "hobby",
     "title": "잠실 야구장 LG vs 두산", "loc": "잠실야구장",
     "w": ["minjun", "seoyeon"],
     "m": "LG석. 5:3 LG 승. 치맥 + 응원."},
    {"d": "2025-11-16", "ad": False, "st": "15:00", "et": "19:00",
     "o": "jisoo", "cat": "hobby",
     "title": "보드게임 카페 더 메이즈", "loc": "홍대 더 메이즈",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "카탄·코드네임 4시간. 1인 1만8천원. 민준이 카탄 이김."},
    {"d": "2025-12-17", "ad": False, "st": "22:00", "et": "23:59",
     "o": "minjun", "cat": "hobby",
     "title": "노래방 코인 강남", "loc": "강남 코인노래방",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "2시간 셋이 번갈아. 서연이 발라드 1위."},
    {"d": "2026-01-22", "ad": False, "st": "19:30", "et": "22:30",
     "o": "seoyeon", "cat": "hobby",
     "title": "뮤지컬 헤드윅", "loc": "대학로 한팩",
     "w": ["jisoo", "seoyeon"],
     "m": "R석 11만원. 헤드윅 배우 김호영. 앵콜 두 곡."},
    {"d": "2026-02-25", "ad": False, "st": "16:00", "et": "18:30",
     "o": "minjun", "cat": "hobby",
     "title": "방탈출 강남 (재도전)", "loc": "강남 방탈출 카페 X",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "두 번째 테마 '검은 숲'. 55분 탈출."},
    {"d": "2026-03-21", "ad": False, "st": "15:00", "et": "19:00",
     "o": "jisoo", "cat": "hobby",
     "title": "보드게임 카페 더 메이즈", "loc": "홍대 더 메이즈",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "이번엔 다이스 게임. 서연이 우승."},

    # ── 모임·파티 (7) ──
    {"d": "2025-06-14", "ed": "2025-06-15", "ad": True,
     "o": "minjun", "cat": "gathering",
     "title": "동아리 MT 양평 1박", "loc": "양평 펜션",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "종강 직전. 바베큐. 동아리 후배 5명 같이."},
    {"d": "2025-06-28", "ad": False, "st": "18:00", "et": "23:00",
     "o": "minjun", "cat": "gathering",
     "title": "종강 술자리", "loc": "신촌 호프집",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "학기 끝. 셋이 새벽 1시까지."},
    {"d": "2025-10-07", "ad": True, "o": "jisoo", "cat": "gathering",
     "title": "추석 모임 (민준이네 본가)", "loc": "민준이네 본가",
     "w": ["jisoo", "minjun", "seoyeon"],
     "m": "어머니가 잡채 차려주심. 송편 만들기."},
    {"d": "2025-10-31", "ad": False, "st": "21:00", "et": "23:59",
     "o": "seoyeon", "cat": "gathering",
     "title": "할로윈 파티 이태원", "loc": "이태원 클럽 케이크샵",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "코스튬: 지수 마녀·민준 좀비·서연 캣."},
    {"d": "2025-12-24", "ad": False, "st": "18:00", "et": "23:00",
     "o": "jisoo", "cat": "gathering",
     "title": "크리스마스 이브 디너", "loc": "가로수길 비스트로",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "코스 1인 9만원. 셋이 선물 교환."},
    {"d": "2026-02-13", "ad": False, "st": "19:00", "et": "23:00",
     "o": "seoyeon", "cat": "gathering",
     "title": "졸업 축하 모임 (선배 송별)", "loc": "강남 한식당",
     "w": ["jisoo", "seoyeon", "minjun"],
     "m": "4학년 선배 졸업. 셋이 후배로 참석."},
    {"d": "2026-03-06", "ad": False, "st": "18:00", "et": "22:00",
     "o": "minjun", "cat": "gathering",
     "title": "신학기 OT 환영회", "loc": "학교 근처 호프집",
     "w": ["minjun", "jisoo", "seoyeon"],
     "m": "동아리 신입 환영. 셋이 후배 챙김."},
]


# ─────────────────────────────────────────────
# 헬퍼: supabase-py 객체/딕셔너리 양쪽 대응
# ─────────────────────────────────────────────
def _get(obj, key, default=None):
    if obj is None:
        return default
    if hasattr(obj, key):
        return getattr(obj, key)
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


def _find_user_by_email(sb, email: str):
    try:
        resp = sb.auth.admin.list_users()
    except Exception as ex:
        print(f"  ⚠ list_users 실패: {ex}")
        return None
    items = resp if isinstance(resp, list) else (_get(resp, "users") or [])
    for u in items:
        if _get(u, "email") == email:
            return u
    return None


# ─────────────────────────────────────────────
# 단계별 함수
# ─────────────────────────────────────────────
def create_or_get_persona_users(sb) -> dict[str, str]:
    auth_ids: dict[str, str] = {}
    for p in PERSONAS:
        existing = _find_user_by_email(sb, p.email)
        if existing:
            uid = _get(existing, "id")
            print(f"  · {p.name} ({p.email}): 기존 재사용 ({uid})")
        else:
            resp = sb.auth.admin.create_user({
                "email": p.email,
                "password": SYNTHETIC_PASSWORD,
                "email_confirm": True,
                "user_metadata": {"name": p.name, "synthetic": True},
            })
            user_obj = _get(resp, "user", resp)
            uid = _get(user_obj, "id")
            print(f"  · {p.name} ({p.email}): 신규 생성 ({uid})")
        auth_ids[p.key] = uid

        # public.users upsert (auth_id 기준)
        try:
            sb.table("users").upsert(
                {"auth_id": uid, "sc_id": p.sc_id, "display_name": p.name},
                on_conflict="auth_id",
            ).execute()
        except Exception as ex:
            print(f"    ⚠ public.users upsert 실패 ({p.name}): {ex}")
    return auth_ids


def create_group_calendar(sb, member_ids: list[str], created_by: str) -> str:
    existing = (
        sb.table("group_calendars")
        .select("id, members")
        .eq("name", GROUP_NAME)
        .execute()
    )
    if existing.data:
        gc_id = existing.data[0]["id"]
        sb.table("group_calendars").update({"members": member_ids}).eq("id", gc_id).execute()
        print(f"  · 기존 그룹 캘린더 재사용 ({gc_id})")
        return gc_id
    resp = sb.table("group_calendars").insert({
        "name": GROUP_NAME,
        "members": member_ids,
        "created_by": created_by,
    }).execute()
    gc_id = resp.data[0]["id"]
    print(f"  · 신규 그룹 캘린더 생성 ({gc_id})")
    return gc_id


def generate_memos(events: list[dict]) -> None:
    """events 의 m(시드) 을 OpenAI 가 자연어 메모로 변환. m=None 은 건너뜀."""
    from openai import OpenAI
    client = OpenAI(api_key=_require("OPENAI_API_KEY"))
    targets = [(i, e) for i, e in enumerate(events) if e.get("m")]
    print(f"  → {len(targets)}개 메모를 OpenAI(gpt-4o-mini)로 생성합니다...")

    for done, (_, e) in enumerate(targets, 1):
        owner = P[e["o"]]
        participants = ", ".join(P[w].name for w in e["w"])
        date_range = e["d"] + (f" ~ {e['ed']}" if e.get("ed") else "")
        sys_msg = (
            "너는 한국 대학생이 캘린더에 일정 메모를 쓰는 톤으로 1~3문장 짧게 작성한다. "
            "이모지·해시태그·과한 구두점 강조 금지. 평어체. 사실(장소·금액·인물·메뉴)은 키워드에서 그대로."
        )
        user_msg = (
            f"일정 제목: {e['title']}\n"
            f"날짜: {date_range}\n"
            f"장소: {e['loc']}\n"
            f"같이 간 사람: {participants}\n"
            f"작성자: {owner.name} (톤: {owner.tone})\n"
            f"키워드/사실: {e['m']}\n\n"
            f"위 일정의 메모를 {owner.name} 입장에서 1~3문장으로."
        )
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.7,
                max_tokens=180,
            )
            e["m"] = (resp.choices[0].message.content or "").strip()
        except Exception as ex:
            print(f"    ⚠ {e['title']} 메모 생성 실패, 시드 유지: {ex}")
        if done % 10 == 0 or done == len(targets):
            print(f"    {done}/{len(targets)} 완료")


def insert_events(sb, gc_id: str, events: list[dict], auth_ids: dict[str, str]) -> None:
    existing = (
        sb.table("group_events")
        .select("title, date")
        .eq("group_calendar_id", gc_id)
        .execute()
    )
    existing_keys = {(r["title"], r["date"]) for r in (existing.data or [])}

    rows = []
    for e in events:
        if (e["title"], e["d"]) in existing_keys:
            continue
        owner = P[e["o"]]
        row = {
            "title": e["title"],
            "date": e["d"],
            "end_date": e.get("ed") or e["d"],
            "all_day": e["ad"],
            "group_calendar_id": gc_id,
            "user_id": auth_ids[e["o"]],
            "dot_color": owner.dot_color,
            "memo": e.get("m"),
        }
        if not e["ad"]:
            row["start_time"] = e["st"]
            row["end_time"] = e["et"]
        rows.append(row)

    if not rows:
        print("  · 신규 INSERT 할 일정 없음 (이미 다 들어가 있음)")
        return

    # 배치 INSERT (80건은 한 번에 OK)
    sb.table("group_events").insert(rows).execute()
    with_memo = sum(1 for r in rows if r["memo"])
    print(f"  · {len(rows)}개 일정 INSERT 완료 (메모 포함: {with_memo}개)")


def cleanup(sb) -> None:
    print("[Cleanup] 가상 사용자 3명 삭제 (CASCADE 로 그룹 캘린더/일정 자동 정리)")
    try:
        resp = sb.auth.admin.list_users()
        items = resp if isinstance(resp, list) else (_get(resp, "users") or [])
    except Exception as ex:
        print(f"  ⚠ list_users 실패: {ex}")
        return

    for p in PERSONAS:
        target = next((u for u in items if _get(u, "email") == p.email), None)
        if target:
            uid = _get(target, "id")
            try:
                sb.auth.admin.delete_user(uid)
                print(f"  · {p.name} ({p.email}) 삭제")
            except Exception as ex:
                print(f"  ⚠ {p.name} 삭제 실패: {ex}")
        else:
            print(f"  · {p.name} 없음 — skip")
    print("[Cleanup] 완료.")


# ─────────────────────────────────────────────
# main
# ─────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="SC 합성 데이터 시드")
    parser.add_argument("--cleanup", action="store_true",
                        help="합성 데이터 삭제 후 종료")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 없이 일정 표만 출력")
    parser.add_argument("--skip-memo", action="store_true",
                        help="OpenAI 호출 없이 메모 시드를 그대로 메모로 사용")
    parser.add_argument("--owner", metavar="EMAIL",
                        help="해당 이메일의 본인 실계정도 그룹 멤버로 추가 (옵저버). "
                             "일정의 user_id 는 가상 페르소나 그대로 유지.")
    args = parser.parse_args()

    # 80개 중 20개는 메모 없음 (자연스러움 — 모든 일정에 메모 적지는 않음)
    random.seed(42)
    no_memo_idx = set(random.sample(range(len(EVENTS)), 20))
    for i in no_memo_idx:
        EVENTS[i]["m"] = None
    memo_count = sum(1 for e in EVENTS if e["m"])

    if args.dry_run:
        print(f"[Dry-run] 총 {len(EVENTS)}개 일정 (메모: {memo_count}개)")
        for e in EVENTS:
            mark = "Y" if e["m"] else "·"
            print(f"  {e['d']:<10} {e['cat']:<11} {e['title']:<35} "
                  f"owner={e['o']:<7} memo={mark}")
        return

    from supabase import create_client
    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    if args.cleanup:
        cleanup(sb)
        return

    print("[1/4] 가상 사용자 3명 생성/재사용")
    auth_ids = create_or_get_persona_users(sb)

    print("[2/4] 그룹 캘린더 생성/재사용")
    member_ids = [auth_ids[p.key] for p in PERSONAS]
    if args.owner:
        me = _find_user_by_email(sb, args.owner)
        if not me:
            print(f"❌ {args.owner} 사용자를 찾을 수 없습니다.")
            print("   Supabase Dashboard → Authentication → Users 에서 이메일을 확인하세요.")
            sys.exit(1)
        owner_uid = _get(me, "id")
        if owner_uid not in member_ids:
            member_ids.append(owner_uid)
        print(f"  · 본인 옵저버로 추가: {args.owner} ({owner_uid})")
    gc_id = create_group_calendar(sb, member_ids, auth_ids["jisoo"])

    if args.skip_memo:
        print("[3/4] --skip-memo: 메모 시드를 그대로 사용 (OpenAI 호출 X)")
    else:
        print("[3/4] OpenAI 로 자연스러운 메모 생성")
        generate_memos(EVENTS)

    print("[4/4] 일정 INSERT")
    insert_events(sb, gc_id, EVENTS, auth_ids)

    print()
    print("=" * 56)
    print("합성 데이터 시드 완료")
    print(f"  Group calendar id : {gc_id}")
    print(f"  Group calendar name: {GROUP_NAME}")
    print(f"  Members           : {', '.join(p.name for p in PERSONAS)}")
    print(f"  Events            : {len(EVENTS)}개 (메모: {memo_count}개)")
    print("=" * 56)
    print()
    print("다음 단계:")
    print("  1. Supabase Dashboard → Table Editor → group_events 에서 데이터 확인")
    print("  2. 앱(설정 탭)에서 '챗봇에게 내 일정 알려주기' 트리거 또는")
    print("     embed-batch Edge Function 호출 → memo_embedding 백필")
    print("  3. 챗봇으로 '작년 여름에 다녀온 곳?' 등 질문 테스트")
    print("  4. RAGAS 평가 스크립트 작성 (Phase 6)")


if __name__ == "__main__":
    main()
