# SC - 공유 캘린더 앱

React Native(Expo)와 Supabase로 만든 개인/공유 캘린더 애플리케이션입니다. 웹 빌드는 Vercel에 배포됩니다.

## 주요 기능

- **개인 캘린더**: 개인 일정 관리
- **공유 캘린더**: 친구들과 달력방을 만들어 일정 공유
- **친구 관리**: SC ID를 통한 친구 추가/삭제
- **다크 모드**: 라이트/다크 테마 지원

## 시작하기

1. 의존성 설치
   ```bash
   npm install
   ```

2. Supabase 환경 변수 설정

   프로젝트 루트에 `.env` 파일을 만들고 Supabase URL과 anon key를 추가합니다.
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   DB 스키마는 [supabase/migrations/](supabase/migrations/)에 있습니다.

3. 앱 실행
   ```bash
   npx expo start
   ```

## 배포 (Vercel)

웹 빌드는 [vercel.json](vercel.json) 설정에 따라 Vercel에서 빌드/배포됩니다.

```bash
npx expo export --platform web
```

빌드 결과물은 `dist/`에 생성되며, Vercel이 이를 정적 호스팅합니다. Supabase 환경 변수는 Vercel 프로젝트 설정에서 동일하게 등록해야 합니다.

## 프로젝트 구조

```
src/
├── components/     # 재사용 가능한 컴포넌트
├── context/        # React Context (테마)
├── lib/            # Supabase 클라이언트 등 공통 유틸
├── navigation/     # 네비게이션 설정
├── screens/        # 화면 컴포넌트
└── services/       # Supabase 서비스 레이어

supabase/
└── migrations/     # DB 스키마 마이그레이션
```

## 기술 스택

- React Native + Expo
- Supabase (Auth, Postgres)
- React Navigation
- Async Storage
- Vercel (웹 배포)
