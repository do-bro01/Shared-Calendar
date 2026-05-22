// iOS 캘린더 앱 스타일 휠 피커.
// 중앙 행이 선택값이고, 위/아래로 갈수록 원통처럼 휘어 보이며 흐려짐.
// 시각 효과는 모두 Animated.scrollY 기반 interpolation으로 처리해
// 스크롤 중에도 끊김 없이 부드럽게 변함.
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Platform } from "react-native";

// EventModal 등 외부에서 단일 하이라이트를 그릴 때 위치 계산에 사용.
export const WHEEL_ITEM_HEIGHT = 28;
export const WHEEL_VISIBLE_COUNT = 7;

const DEFAULT_ITEM_HEIGHT = WHEEL_ITEM_HEIGHT;
const DEFAULT_VISIBLE_COUNT = WHEEL_VISIBLE_COUNT; // 가운데 + 위3 + 아래3

// 스크롤이 멈춘 직후 가장 가까운 항목으로 스냅하기 위한 디바운스 시간 (ms)
const SNAP_DEBOUNCE_MS = 140;

export default function WheelPicker({
  items,
  selectedIndex,
  onChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  width,
  textColor = "#ffffff",
  highlightColor = "rgba(255,255,255,0.08)",
  // 부모가 가로로 이어진 단일 하이라이트를 그릴 때는 false로 끔.
  showHighlight = true,
  fontSize = 17,
  selectedFontSize = 19,
}) {
  const scrollRef = useRef(null);
  const lastReportedIndexRef = useRef(selectedIndex);
  const snapTimerRef = useRef(null);
  const scrollY = useRef(
    new Animated.Value(selectedIndex * itemHeight),
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

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));

  const commitIndex = (idx) => {
    if (idx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = idx;
      onChange(idx);
    }
  };

  const snapTo = (idx, animated = true) => {
    scrollRef.current?.scrollTo({ y: idx * itemHeight, animated });
  };

  const handleMomentumEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = clamp(Math.round(offsetY / itemHeight));
    commitIndex(idx);
    // 웹에서는 scheduleWebSnap이 이어서 보정하므로 여기서 또 scrollTo를 부르면
    // 같은 위치로 두 번 애니메이션이 걸려 "새로고침"처럼 끊겨 보임. 네이티브에서만 스냅.
    if (Platform.OS !== "web") {
      snapTo(idx, true);
    }
  };

  // 웹은 모멘텀 이벤트가 안 발생할 수 있어 onScroll에서 디바운스로 스냅 보조.
  const scheduleWebSnap = (offsetY) => {
    if (Platform.OS !== "web") return;
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const idx = clamp(Math.round(offsetY / itemHeight));
      commitIndex(idx);
      // animated:true로 보정하면 iOS Safari에서 별도 스크롤 애니메이션이
      // 다시 시작되어 "새로고침"처럼 끊겨 보임. animated:false라서 어긋난
      // 경우 즉시 미세 보정만 들어가고, 이미 맞아 있으면 no-op.
      snapTo(idx, false);
    }, SNAP_DEBOUNCE_MS);
  };

  // 네이티브 드라이버는 web에서는 무시되지만, 안전하게 플래그로 분기
  const useNative = Platform.OS !== "web";

  // 웹용 디바운스 스냅을 위해 스크롤 오프셋을 받아 타이머를 다시 깐다.
  const handleScrollListener = (e) => {
    scheduleWebSnap(e.nativeEvent.contentOffset.y);
  };

  return (
    <View
      style={{
        height: containerHeight,
        width,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 중앙 강조 알약 배경 (부모가 단일 하이라이트를 그릴 때는 끔) */}
      {showHighlight && (
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
      )}

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        scrollEventThrottle={1}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: useNative, listener: handleScrollListener },
        )}
        onMomentumScrollEnd={handleMomentumEnd}
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
                  fontWeight: "400",
                  letterSpacing: 0.1,
                  // iOS 시스템 폰트 느낌 강조
                  ...(Platform.OS === "ios" ? { fontFamily: "System" } : null),
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
