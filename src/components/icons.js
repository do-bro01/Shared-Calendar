// 외부 아이콘 라이브러리 없이 View 프리미티브로 그린 커스텀 아이콘.
// 모든 아이콘은 `size`(정사각형 한 변 px)와 `color`(stroke/foreground)를 받음.
// 색은 props로 받기 때문에 다크모드/테마 컬러에 자유롭게 대응됨.
import React from "react";
import { View } from "react-native";

// 달력 아이콘
// ┌─┐ ┌─┐
// │ │ │ │  ← 상단 바인딩(고리)
// ╔═════╗
// ║─────║  ← 헤더 구분선
// ║  ●  ║  ← 안쪽 점(오늘 강조)
// ╚═════╝
export function CalendarIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 14);
  const bodyTop = size * 0.18; // 본체 시작 y
  const ringWidth = Math.max(1.5, size / 10);
  const ringHeight = size * 0.22;
  const ringTop = 0;
  const ringLeft1 = size * 0.22;
  const ringLeft2 = size * 0.66;
  const headerHeight = size * 0.18;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 본체 (둥근 사각형) */}
      <View
        style={{
          position: "absolute",
          top: bodyTop,
          left: 0,
          right: 0,
          bottom: 0,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.12,
        }}
      />
      {/* 헤더 구분선 */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: bodyTop + headerHeight,
          height: stroke,
          backgroundColor: color,
        }}
      />
      {/* 상단 바인딩 고리 (왼쪽) */}
      <View
        style={{
          position: "absolute",
          top: ringTop,
          left: ringLeft1,
          width: ringWidth,
          height: ringHeight,
          backgroundColor: color,
          borderRadius: ringWidth / 2,
        }}
      />
      {/* 상단 바인딩 고리 (오른쪽) */}
      <View
        style={{
          position: "absolute",
          top: ringTop,
          left: ringLeft2,
          width: ringWidth,
          height: ringHeight,
          backgroundColor: color,
          borderRadius: ringWidth / 2,
        }}
      />
      {/* 안쪽 점 — 오늘 강조 */}
      <View
        style={{
          position: "absolute",
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: (size * 0.18) / 2,
          backgroundColor: color,
          left: (size - size * 0.18) / 2,
          top: bodyTop + headerHeight + size * 0.18,
        }}
      />
    </View>
  );
}

export default { CalendarIcon };
