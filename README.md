# SC - 공유 캘린더 앱

Expo + React Native로 만든 개인/공유 캘린더 앱입니다. 웹 빌드는 Vercel에 정적 호스팅되며, **PWA**로 동작합니다 (아이폰 Safari "홈화면에 추가" 지원).

## 주요 기능

- **개인 캘린더**: 개인 일정 관리
- **공유 캘린더**: 친구들과 달력방을 만들어 일정 공유
- **친구 관리**: SC ID를 통한 친구 추가/삭제
- **다크 모드**: 라이트/다크 테마 지원
- **PWA**: 모바일 브라우저에서 홈 화면에 추가하면 풀스크린 앱처럼 동작

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

3. 개발 서버 실행
   ```bash
   npm run web      # 웹 (Expo Metro)
   npm run ios      # iOS 시뮬레이터 (네이티브 빌드)
   npm run android  # Android
   ```

## 웹 배포 (Vercel)

[vercel.json](vercel.json) 설정에 따라 Vercel에서 빌드/배포됩니다.

```bash
npx expo export --platform web
```

- 빌드 결과물은 `dist/`에 생성되고 Vercel이 정적 호스팅합니다.
- [public/](public/) 안의 파일들(manifest, service worker, 아이콘)은 빌드 시 `dist/` 루트로 자동 복사됩니다.
- Supabase 환경 변수는 Vercel 프로젝트 설정에서도 동일하게 등록해야 합니다.

## PWA 설정

웹 빌드는 PWA로 동작하도록 구성되어 있습니다.

- [public/manifest.json](public/manifest.json): 앱 이름, 아이콘, `display: standalone`
- [public/sw.js](public/sw.js): 최소 service worker (PWA 인식용, 오프라인 캐싱 없음)
- [public/icon-192.png](public/icon-192.png), [public/icon-512.png](public/icon-512.png), [public/apple-touch-icon.png](public/apple-touch-icon.png): 앱 아이콘 (원본: [assets/icon.svg](assets/icon.svg))
- [index.js](index.js): 런타임에 `apple-mobile-web-app-*` 등 메타태그 주입 + service worker 등록

아이콘을 새로 만들고 싶다면 [assets/icon.svg](assets/icon.svg)를 수정 후 다음으로 재생성:
```bash
rsvg-convert -w 192 -h 192 assets/icon.svg -o public/icon-192.png && \
rsvg-convert -w 512 -h 512 assets/icon.svg -o public/icon-512.png && \
rsvg-convert -w 180 -h 180 assets/icon.svg -o public/apple-touch-icon.png
```

**사용 방법 (iOS Safari):** 배포된 사이트 접속 → 공유 → "홈 화면에 추가" → 홈 아이콘 탭 시 풀스크린 앱으로 실행

## 프로젝트 구조

```
src/
├── components/     # 재사용 컴포넌트 (Button, CalendarView 등)
├── constants/      # 한국 공휴일 등 상수
├── context/        # React Context (테마)
├── lib/            # Supabase 클라이언트
├── navigation/     # React Navigation 설정
├── screens/        # 화면 컴포넌트 (Login, Personal, Shared, Settings)
└── services/       # Supabase 서비스 레이어 (Auth, Friend, Group, Event, User)

public/             # 웹 정적 파일 (PWA manifest, sw, 아이콘) → dist/ 루트로 복사
assets/             # 앱 아이콘 원본 (icon.svg, google-logo.png)
supabase/
└── migrations/     # DB 스키마 마이그레이션
ios/                # Expo prebuild로 생성된 iOS 네이티브 프로젝트
docs/               # 기획/회고 문서
```

## 기술 스택

- **Expo SDK 54** + React Native 0.81 (네이티브/웹 공통)
- **React Navigation v7** (`@react-navigation/native-stack`, `bottom-tabs`)
- **Supabase** (Auth + Postgres)
- **react-native-calendars** (캘린더 UI)
- **AsyncStorage** (로컬 세션 저장)
- **Vercel** (웹 정적 호스팅)
