// 외부 아이콘 라이브러리 없이 View 프리미티브로 그린 커스텀 아이콘.
// 모든 아이콘은 `size`(정사각형 한 변 px)와 `color`(stroke/fill)를 받음.
// style prop으로 추가 스타일링 가능. 색은 props로 받기 때문에 다크모드/테마 컬러에 자유롭게 대응됨.
import React from "react";
import { View } from "react-native";

// 한 점 (cx, cy)을 중심으로 한 막대 (회전 가능)
function Stroke({ cx, cy, length, thickness, color, rotate = 0 }) {
  return (
    <View
      style={{
        position: "absolute",
        left: cx - length / 2,
        top: cy - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        borderRadius: thickness / 2,
        transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
      }}
    />
  );
}

// 달력
export function CalendarIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 14);
  const bodyTop = size * 0.18;
  const ringWidth = Math.max(1.5, size / 10);
  const ringHeight = size * 0.22;
  const ringLeft1 = size * 0.22;
  const ringLeft2 = size * 0.66;
  const headerHeight = size * 0.18;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 본체 */}
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
      {/* 바인딩 고리 (왼쪽) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: ringLeft1,
          width: ringWidth,
          height: ringHeight,
          backgroundColor: color,
          borderRadius: ringWidth / 2,
        }}
      />
      {/* 바인딩 고리 (오른쪽) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: ringLeft2,
          width: ringWidth,
          height: ringHeight,
          backgroundColor: color,
          borderRadius: ringWidth / 2,
        }}
      />
      {/* 안쪽 점 */}
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

// + 추가
export function AddIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.8, size / 9);
  const L = size * 0.68;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size / 2} cy={size / 2} length={L} thickness={t} color={color} />
      <Stroke cx={size / 2} cy={size / 2} length={L} thickness={t} color={color} rotate={90} />
    </View>
  );
}

// ✓ 체크
export function CheckIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.6, size / 8);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size * 0.28} cy={size * 0.66} length={size * 0.36} thickness={t} color={color} rotate={45} />
      <Stroke cx={size * 0.62} cy={size * 0.48} length={size * 0.72} thickness={t} color={color} rotate={-50} />
    </View>
  );
}

// › chevron-right
export function ChevronRightIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.6, size / 9);
  const L = size * 0.55;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size * 0.48} cy={size * 0.30} length={L} thickness={t} color={color} rotate={45} />
      <Stroke cx={size * 0.48} cy={size * 0.70} length={L} thickness={t} color={color} rotate={-45} />
    </View>
  );
}

// ‹ chevron-left
export function ChevronLeftIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.6, size / 9);
  const L = size * 0.55;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size * 0.52} cy={size * 0.30} length={L} thickness={t} color={color} rotate={-45} />
      <Stroke cx={size * 0.52} cy={size * 0.70} length={L} thickness={t} color={color} rotate={45} />
    </View>
  );
}

// ∨ chevron-down (expand-more)
export function ChevronDownIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.6, size / 9);
  const L = size * 0.55;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size * 0.30} cy={size * 0.48} length={L} thickness={t} color={color} rotate={45} />
      <Stroke cx={size * 0.70} cy={size * 0.48} length={L} thickness={t} color={color} rotate={-45} />
    </View>
  );
}

// ∧ chevron-up (expand-less)
export function ChevronUpIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.6, size / 9);
  const L = size * 0.55;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Stroke cx={size * 0.30} cy={size * 0.55} length={L} thickness={t} color={color} rotate={-45} />
      <Stroke cx={size * 0.70} cy={size * 0.55} length={L} thickness={t} color={color} rotate={45} />
    </View>
  );
}

// ← 뒤로가기
export function ArrowBackIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.8, size / 9);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 가로 본체 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.18,
          top: (size - t) / 2,
          width: size * 0.70,
          height: t,
          backgroundColor: color,
          borderRadius: t / 2,
        }}
      />
      {/* 화살촉 위 */}
      <Stroke cx={size * 0.30} cy={size * 0.32} length={size * 0.30} thickness={t} color={color} rotate={-45} />
      {/* 화살촉 아래 */}
      <Stroke cx={size * 0.30} cy={size * 0.68} length={size * 0.30} thickness={t} color={color} rotate={45} />
    </View>
  );
}

// 휴지통 (delete)
export function DeleteIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 손잡이 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.36,
          top: size * 0.08,
          width: size * 0.28,
          height: size * 0.10,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: stroke,
        }}
      />
      {/* 뚜껑 (가로 바) */}
      <View
        style={{
          position: "absolute",
          left: size * 0.10,
          top: size * 0.24,
          width: size * 0.80,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      {/* 본체 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.20,
          top: size * 0.30,
          width: size * 0.60,
          height: size * 0.60,
          borderWidth: stroke,
          borderColor: color,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.08,
          borderBottomRightRadius: size * 0.08,
        }}
      />
      {/* 안쪽 세로선 3개 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.34,
          top: size * 0.40,
          width: stroke,
          height: size * 0.40,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size / 2 - stroke / 2,
          top: size * 0.40,
          width: stroke,
          height: size * 0.40,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size * 0.66 - stroke,
          top: size * 0.40,
          width: stroke,
          height: size * 0.40,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

// ↻ 새로고침
export function RefreshIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.8, size / 9);
  const arrow = size * 0.30;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 3/4 원 (top 비움) */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: color,
          borderTopColor: "transparent",
        }}
      />
      {/* 화살촉 (오른쪽 위에서 아래 가리킴) */}
      <View
        style={{
          position: "absolute",
          top: -arrow * 0.1,
          right: -arrow * 0.05,
          width: 0,
          height: 0,
          borderLeftWidth: arrow / 2,
          borderLeftColor: "transparent",
          borderRightWidth: arrow / 2,
          borderRightColor: "transparent",
          borderTopWidth: arrow,
          borderTopColor: color,
        }}
      />
    </View>
  );
}

// 복사 (두 개의 겹친 사각형)
export function CopyIcon({ size = 20, color = "#000", style, bgColor }) {
  const stroke = Math.max(1.5, size / 11);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 뒤쪽 사각형 */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size * 0.66,
          height: size * 0.66,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.08,
        }}
      />
      {/* 앞쪽 사각형 — 배경색이 있으면 뒤 사각형의 모서리를 덮음 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.30,
          top: size * 0.30,
          width: size * 0.66,
          height: size * 0.66,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.08,
          backgroundColor: bgColor || "transparent",
        }}
      />
    </View>
  );
}

// 사람 (단일)
export function PersonIcon({ size = 20, color = "#000", style }) {
  const headR = size * 0.18;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 머리 */}
      <View
        style={{
          position: "absolute",
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: color,
          left: size / 2 - headR,
          top: size * 0.10,
        }}
      />
      {/* 몸 (반원형) */}
      <View
        style={{
          position: "absolute",
          left: size * 0.15,
          top: size * 0.55,
          width: size * 0.70,
          height: size * 0.40,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.35,
          borderTopRightRadius: size * 0.35,
        }}
      />
    </View>
  );
}

// 사람들 (groups, people, group)
export function PeopleIcon({ size = 20, color = "#000", style }) {
  const headR = size * 0.13;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 머리 1 */}
      <View
        style={{
          position: "absolute",
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: color,
          left: size * 0.16,
          top: size * 0.16,
        }}
      />
      {/* 머리 2 */}
      <View
        style={{
          position: "absolute",
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: color,
          left: size * 0.58,
          top: size * 0.16,
        }}
      />
      {/* 몸 1 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.02,
          top: size * 0.54,
          width: size * 0.52,
          height: size * 0.36,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.26,
          borderTopRightRadius: size * 0.26,
        }}
      />
      {/* 몸 2 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.46,
          top: size * 0.54,
          width: size * 0.52,
          height: size * 0.36,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.26,
          borderTopRightRadius: size * 0.26,
        }}
      />
    </View>
  );
}

// 사람 + 추가 (+)
export function PersonAddIcon({ size = 20, color = "#000", style }) {
  const headR = size * 0.15;
  const t = Math.max(1.6, size / 10);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 머리 */}
      <View
        style={{
          position: "absolute",
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: color,
          left: size * 0.20,
          top: size * 0.08,
        }}
      />
      {/* 몸 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.04,
          top: size * 0.50,
          width: size * 0.50,
          height: size * 0.38,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.25,
          borderTopRightRadius: size * 0.25,
        }}
      />
      {/* + 기호 (우측 상단) */}
      <Stroke cx={size * 0.78} cy={size * 0.34} length={size * 0.34} thickness={t} color={color} />
      <Stroke cx={size * 0.78} cy={size * 0.34} length={size * 0.34} thickness={t} color={color} rotate={90} />
    </View>
  );
}

// 키 (vpn-key)
export function KeyIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 10);
  const headR = size * 0.18;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 머리 링 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.06,
          top: size * 0.32,
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* 막대 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.42,
          top: size * 0.50 - stroke / 2,
          width: size * 0.54,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      {/* 톱니 1 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.72,
          top: size * 0.50,
          width: stroke,
          height: size * 0.18,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      {/* 톱니 2 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.88,
          top: size * 0.50,
          width: stroke,
          height: size * 0.14,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

// 동그라미 안 사람 (account-circle)
export function AccountCircleIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  const headR = size * 0.12;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          backgroundColor: color,
          left: size / 2 - headR,
          top: size * 0.22,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size * 0.22,
          top: size * 0.58,
          width: size * 0.56,
          height: size * 0.30,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.28,
          borderTopRightRadius: size * 0.28,
        }}
      />
    </View>
  );
}

// 연필 (edit)
export function EditIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(2, size / 7);
  const L = size * 0.78;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 연필 본체 (둥근 사각형, 45° 회전) */}
      <View
        style={{
          position: "absolute",
          left: (size - L) / 2,
          top: (size - t) / 2,
          width: L,
          height: t,
          backgroundColor: color,
          borderRadius: t * 0.18,
          transform: [{ rotate: "-45deg" }],
        }}
      />
      {/* 끝부분 강조 (작은 사각형) */}
      <View
        style={{
          position: "absolute",
          left: size * 0.10,
          top: size * 0.74,
          width: t * 0.7,
          height: t * 0.7,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}

// 로그아웃 / exit-to-app
export function LogoutIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.6, size / 10);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 문 (ㄷ 형태) */}
      <View
        style={{
          position: "absolute",
          left: size * 0.08,
          top: size * 0.10,
          width: size * 0.34,
          height: size * 0.80,
          borderWidth: stroke,
          borderColor: color,
          borderRightWidth: 0,
          borderTopLeftRadius: size * 0.06,
          borderBottomLeftRadius: size * 0.06,
        }}
      />
      {/* 가로 화살표 본체 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.34,
          top: (size - stroke) / 2,
          width: size * 0.55,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      {/* 화살촉 */}
      <Stroke cx={size * 0.78} cy={size * 0.36} length={size * 0.28} thickness={stroke} color={color} rotate={-45} />
      <Stroke cx={size * 0.78} cy={size * 0.64} length={size * 0.28} thickness={stroke} color={color} rotate={45} />
    </View>
  );
}

// 초승달 (dark-mode)
export function DarkModeIcon({ size = 20, color = "#000", style }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: size * 0.18,
          borderColor: color,
          borderTopColor: "transparent",
          borderRightColor: "transparent",
          transform: [{ rotate: "-30deg" }],
        }}
      />
    </View>
  );
}

// info-outline
export function InfoIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  const t = Math.max(1.8, size / 9);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* 위 점 */}
      <View
        style={{
          position: "absolute",
          left: size / 2 - t / 2,
          top: size * 0.22,
          width: t,
          height: t,
          borderRadius: t / 2,
          backgroundColor: color,
        }}
      />
      {/* 아래 막대 */}
      <View
        style={{
          position: "absolute",
          left: size / 2 - t / 2,
          top: size * 0.42,
          width: t,
          height: size * 0.34,
          borderRadius: t / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// 문서 (description)
export function DescriptionIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 12);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: "absolute",
          left: size * 0.16,
          top: size * 0.06,
          width: size * 0.68,
          height: size * 0.88,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.06,
        }}
      />
      {[0.28, 0.46, 0.64].map((y, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: size * 0.26,
            top: size * y,
            width: size * 0.48,
            height: stroke,
            backgroundColor: color,
            borderRadius: stroke / 2,
          }}
        />
      ))}
    </View>
  );
}

// 도움말 (?)
export function HelpIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  const t = Math.max(1.6, size / 9);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 외곽 원 */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* ?의 곡선부 — 작은 원의 위쪽 호만 */}
      <View
        style={{
          position: "absolute",
          left: size * 0.32,
          top: size * 0.20,
          width: size * 0.36,
          height: size * 0.36,
          borderRadius: size * 0.18,
          borderWidth: t,
          borderColor: color,
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
        }}
      />
      {/* ?의 아래 막대 */}
      <View
        style={{
          position: "absolute",
          left: size / 2 - t / 2,
          top: size * 0.50,
          width: t,
          height: size * 0.16,
          backgroundColor: color,
          borderRadius: t / 2,
        }}
      />
      {/* 점 */}
      <View
        style={{
          position: "absolute",
          left: size / 2 - t / 2,
          top: size * 0.74,
          width: t,
          height: t,
          borderRadius: t / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// 기어 (settings)
export function SettingsIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  const center = size / 2;
  const ringR = size * 0.18;
  const toothW = size * 0.13;
  const toothH = size * 0.16;
  const r = size * 0.36;
  const teeth = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * (Math.PI / 180);
    const x = center + r * Math.sin(angle);
    const y = center - r * Math.cos(angle);
    teeth.push(
      <View
        key={i}
        style={{
          position: "absolute",
          width: toothW,
          height: toothH,
          backgroundColor: color,
          borderRadius: 2,
          left: x - toothW / 2,
          top: y - toothH / 2,
          transform: [{ rotate: `${i * 45}deg` }],
        }}
      />
    );
  }
  return (
    <View style={[{ width: size, height: size }, style]}>
      {teeth}
      <View
        style={{
          position: "absolute",
          width: ringR * 2,
          height: ringR * 2,
          borderRadius: ringR,
          borderWidth: stroke,
          borderColor: color,
          left: center - ringR,
          top: center - ringR,
        }}
      />
    </View>
  );
}

// 시계 (schedule)
export function ClockIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.5, size / 11);
  const t = Math.max(1.4, size / 12);
  const center = size / 2;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* 시침 (3시 방향) */}
      <View
        style={{
          position: "absolute",
          left: center,
          top: center - t / 2,
          width: size * 0.22,
          height: t,
          backgroundColor: color,
          borderRadius: t / 2,
        }}
      />
      {/* 분침 (12시 방향) */}
      <View
        style={{
          position: "absolute",
          left: center - t / 2,
          top: size * 0.20,
          width: t,
          height: size * 0.32,
          backgroundColor: color,
          borderRadius: t / 2,
        }}
      />
    </View>
  );
}

// 캘린더 + 체크 (event-available)
export function EventAvailableIcon({ size = 20, color = "#000", style }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <CalendarIcon size={size} color={color} />
      {/* 안쪽 점 위에 체크 표시 (점을 가리고 체크 표시) */}
      <View
        style={{
          position: "absolute",
          left: size * 0.20,
          top: size * 0.42,
          width: size * 0.60,
          height: size * 0.50,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckIcon size={size * 0.50} color={color} />
      </View>
    </View>
  );
}

// 🔍 돋보기 (검색) — 렌즈(원) + 손잡이(대각선 막대)
export function SearchIcon({ size = 20, color = "#000", style }) {
  const stroke = Math.max(1.6, size / 9);
  const lens = size * 0.64; // 렌즈 지름 (좀 더 큰 원)
  const cx = size * 0.40;
  const cy = size * 0.40;
  // 손잡이 시작점을 렌즈 테두리 두께의 한가운데로 → 둥근 끝이 테두리 안에 들어가 자연스럽게 합쳐짐.
  // (렌즈 외곽 반지름 lens/2, 내부 반지름 lens/2 - stroke. 그 가운데 = lens/2 - stroke/2)
  const startDist = lens / 2 - stroke / 2;
  const hx0 = cx + startDist * 0.7071;
  const hy0 = cy + startDist * 0.7071;
  const hx1 = size * 0.82; // 손잡이 먼 끝 (짧게)
  const hy1 = size * 0.82;
  const handleLen = Math.hypot(hx1 - hx0, hy1 - hy0);

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* 손잡이 (먼저 그려서 렌즈 테두리가 둥근 끝을 덮도록) */}
      <Stroke
        cx={(hx0 + hx1) / 2}
        cy={(hy0 + hy1) / 2}
        length={handleLen}
        thickness={stroke}
        color={color}
        rotate={45}
      />
      {/* 렌즈 (위에 덮어서 손잡이 둥근 끝을 가림) */}
      <View
        style={{
          position: "absolute",
          left: cx - lens / 2,
          top: cy - lens / 2,
          width: lens,
          height: lens,
          borderRadius: lens / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
    </View>
  );
}

// ↩ 되돌리기 (Today로 돌아가기) — 가로 윗선에서 우측이 매끄러운 1/4 원으로 휘어 내려오고 좌측에 화살촉
export function ReturnIcon({ size = 20, color = "#000", style }) {
  const t = Math.max(1.8, size / 9);
  // 곡선 반지름 = 높이 → 직선 세로부 없이 매끈한 swoop
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: "absolute",
          left: size * 0.24,
          top: size * 0.36,
          width: size * 0.54,
          height: size * 0.24,
          borderColor: color,
          borderTopWidth: t,
          borderRightWidth: t,
          borderTopRightRadius: size * 0.24,
        }}
      />
      {/* 화살촉 (가로선 좌측 끝에 결합) */}
      <Stroke
        cx={size * 0.325}
        cy={size * 0.275}
        length={size * 0.24}
        thickness={t}
        color={color}
        rotate={-45}
      />
      <Stroke
        cx={size * 0.325}
        cy={size * 0.445}
        length={size * 0.24}
        thickness={t}
        color={color}
        rotate={45}
      />
    </View>
  );
}

export default {
  CalendarIcon,
  AddIcon,
  SearchIcon,
  ReturnIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowBackIcon,
  DeleteIcon,
  RefreshIcon,
  CopyIcon,
  PersonIcon,
  PeopleIcon,
  PersonAddIcon,
  KeyIcon,
  AccountCircleIcon,
  EditIcon,
  LogoutIcon,
  DarkModeIcon,
  InfoIcon,
  DescriptionIcon,
  HelpIcon,
  SettingsIcon,
  ClockIcon,
  EventAvailableIcon,
};
