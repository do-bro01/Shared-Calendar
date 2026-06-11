#!/usr/bin/env python3
"""
합성 데이터 가상 계정 3명(지수·민준·서연)의 public.users.display_name 백필.

설정 탭에서 직접 이름을 넣어준 적이 없어 "(미설정)"으로 뜨는 경우,
이 스크립트가 display_name 만 채워준다. (일정/메모/그룹은 건드리지 않음)

실행:
    cd scripts
    uv run python fix_persona_names.py
"""
from __future__ import annotations

from seed_synthetic_data import (
    PERSONAS,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    _find_user_by_email,
    _get,
)


def main() -> None:
    from supabase import create_client

    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    print("[가상 계정 display_name 백필]")
    for p in PERSONAS:
        user = _find_user_by_email(sb, p.email)
        if not user:
            print(f"  · {p.name} ({p.email}): auth 사용자 없음 — skip")
            continue
        uid = _get(user, "id")

        # auth_id unique 제약이 없어 on_conflict upsert 불가 → 존재하면 UPDATE, 없으면 INSERT
        existing = (
            sb.table("users").select("id").eq("auth_id", uid).limit(1).execute()
        )
        if existing.data:
            sb.table("users").update({"display_name": p.name}).eq(
                "auth_id", uid
            ).execute()
        else:
            sb.table("users").insert(
                {"auth_id": uid, "sc_id": p.sc_id, "display_name": p.name}
            ).execute()

        # 확인용 읽기
        check = (
            sb.table("users")
            .select("display_name, sc_id")
            .eq("auth_id", uid)
            .limit(1)
            .execute()
        )
        row = (check.data or [{}])[0]
        print(
            f"  · {p.name} ({p.email}) → display_name="
            f"'{row.get('display_name')}', sc_id='{row.get('sc_id')}'"
        )

    print("완료. 앱에서 그룹 새로고침하면 이름이 보입니다.")


if __name__ == "__main__":
    main()
