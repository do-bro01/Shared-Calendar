# SC - 공유 캘린더 앱

React Native와 Firebase를 사용한 개인/공유 캘린더 애플리케이션입니다.

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

2. Firebase 설정
   - `firebaseConfig.js` 파일에 Firebase 프로젝트 설정 추가

3. 앱 실행
   ```bash
   npx expo start
   ```

## 프로젝트 구조

```
src/
├── components/     # 재사용 가능한 컴포넌트
├── context/        # React Context (테마)
├── navigation/     # 네비게이션 설정
├── screens/        # 화면 컴포넌트
└── services/       # Firebase 서비스 레이어
```

## 기술 스택

- React Native + Expo
- Firebase (Authentication, Firestore)
- React Navigation
- Async Storage
