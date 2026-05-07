import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { Radius, Spacing } from "../../constants/theme";

/**
 * 통일된 버튼 컴포넌트
 *
 * variant:
 *   - "primary"   : 채움(tint 배경, 흰 텍스트) - 메인 액션
 *   - "secondary" : 테두리(transparent 배경, tint 텍스트) - 보조 액션
 *   - "ghost"     : 텍스트만 - 가벼운 액션 (취소 등)
 *   - "danger"    : 채움(danger 배경) - 파괴적 액션
 *
 * size:
 *   - "sm" : 작음
 *   - "md" : 기본
 *   - "lg" : 큼 (메인 CTA)
 */
export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon = null, // <Icon /> 컴포넌트
  style,
  fullWidth = false,
}) {
  const theme = useTheme();
  const colors = theme.colors;

  const sizing = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontSize: 13 },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, fontSize: 15 },
    lg: { paddingVertical: 14, paddingHorizontal: Spacing.xl, fontSize: 16 },
  }[size];

  const variantStyle = (() => {
    switch (variant) {
      case "secondary":
        return {
          container: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.tint,
          },
          text: { color: colors.tint, fontWeight: "600" },
        };
      case "ghost":
        return {
          container: { backgroundColor: "transparent" },
          text: { color: colors.tint, fontWeight: "600" },
        };
      case "danger":
        return {
          container: { backgroundColor: colors.danger },
          text: { color: "#fff", fontWeight: "700" },
        };
      case "primary":
      default:
        return {
          container: { backgroundColor: colors.tint },
          text: { color: "#fff", fontWeight: "700" },
        };
    }
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        {
          paddingVertical: sizing.paddingVertical,
          paddingHorizontal: sizing.paddingHorizontal,
          borderRadius: Radius.sm,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : undefined,
        },
        variantStyle.container,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text.color} />
      ) : (
        <>
          {icon ? <View style={{ marginRight: Spacing.sm }}>{icon}</View> : null}
          <Text style={[{ fontSize: sizing.fontSize }, variantStyle.text]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
