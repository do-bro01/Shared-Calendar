// iOS 캘린더 앱 스타일 휠 피커.
// 중앙 행이 선택값이고, 위/아래로 갈수록 원통처럼 휘어 보이며 흐려짐.
// 시각 효과는 모두 Animated.scrollY 기반 interpolation으로 처리해
// 스크롤 중에도 끊김 없이 부드럽게 변함.
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Platform } from "react-native";

const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_VISIBLE_COUNT = 7; // 가운데 + 위3 + 아래3

export default function WheelPicker({
  items,
  selectedIndex,
  onChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  width,
  textColor = "#ffffff",
  highlightColor = "rgba(255,255,255,0.08)",
  fontSize = 19,
  selectedFontSize = 22,
}) {
  const scrollRef = useRef(null);
  const lastReportedIndexRef = useRef(selectedIndex);
  const scrollY = useRef(
    new Animated.Value(selectedIndex * itemHeight)
  ).current;

  const sideCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;
  const padding = itemHeight * sideCount;

  // 외부 selectedIndex가 바뀌면 스크롤 위치 동기화
  useEffect(() => {
    if (!scrollRef.current) return;
    const y = selectedIndex * itemHeight;
    scrollRef.current.scrollTo({ y, animated: false });
    scrollY.setValue(y);
    lastReportedIndexRef.current = selectedIndex;
  }, [selectedIndex, itemHeight, scrollY]);

  const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));

  const handleMomentumEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = clamp(Math.round(offsetY / itemHeight));
    if (idx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = idx;
      onChange(idx);
    }
    // 살짝 어긋난 경우 스냅 보정
    scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: true });
  };

  // 웹은 모멘텀 이벤트가 잘 안 발생할 수 있어 onScrollEndDrag로 보조
  const handleScrollEndDrag = (e) => {
    if (Platform.OS !== "web") return;
    handleMomentumEnd(e);
  };

  // 네이티브 드라이버는 web에서는 무시되지만, 안전하게 플래그로 분기
  const useNative = Platform.OS !== "web";

  return (
    <View
      style={{
        height: containerHeight,
        width,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 중앙 강조 알약 배경 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: sideCount * itemHeight,
          left: 6,
          right: 6,
          height: itemHeight,
          backgroundColor: highlightColor,
          borderRadius: itemHeight / 2,
        }}
      />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={1}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: useNative }
        )}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{
          paddingTop: padding,
          paddingBottom: padding,
        }}
      >
        {items.map((item, idx) => {
          // 현재 항목 중심 y좌표 = idx * itemHeight
          // ±3 행까지 보간 → 그 너머는 clamp
          const inputRange = [
            (idx - 3) * itemHeight,
            (idx - 2) * itemHeight,
            (idx - 1) * itemHeight,
            idx * itemHeight,
            (idx + 1) * itemHeight,
            (idx + 2) * itemHeight,
            (idx + 3) * itemHeight,
          ];

          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.08, 0.18, 0.5, 1, 0.5, 0.18, 0.08],
            extrapolate: "clamp",
          });
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.78, 0.86, 0.94, 1, 0.94, 0.86, 0.78],
            extrapolate: "clamp",
          });
          // 원통(drum) 휘는 느낌의 X축 회전. perspective와 함께 사용해야 입체감.
          const rotateX = scrollY.interpolate({
            inputRange,
            outputRange: [
              "60deg",
              "42deg",
              "22deg",
              "0deg",
              "-22deg",
              "-42deg",
              "-60deg",
            ],
            extrapolate: "clamp",
          });
          // 회전 시 중심 축으로 살짝 당기는 듯한 미세한 y 보정 (시각적으로 더 자연스러움)
          const translateY = scrollY.interpolate({
            inputRange,
            outputRange: [6, 4, 2, 0, -2, -4, -6],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={`${idx}-${item.value}`}
              style={{
                height: itemHeight,
                justifyContent: "center",
                alignItems: "center",
                opacity,
                transform: [
                  { perspective: 700 },
                  { rotateX },
                  { translateY },
                  { scale },
                ],
              }}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: selectedFontSize,
                  fontWeight: "500",
                  letterSpacing: 0.2,
                  // iOS 시스템 폰트 느낌 강조
                  ...(Platform.OS === "ios"
                    ? { fontFamily: "System" }
                    : null),
                }}
                // 회전된 텍스트가 흐릿하게 그려지지 않도록 보조 힌트
                allowFontScaling={false}
              >
                {item.label}
              </Text>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}
