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

  // 웹에선 CSS scroll-snap을 직접 깐다.
  // react-native-web의 snapToInterval은 mandatory를 켜지만 자식의 snap-align을
  // 안 깔아서, 애매한 위치에서 브라우저가 (0,0)으로 스냅해 "맨 위로" 튀는 문제를 일으킴.
  // 우리가 직접 컨테이너와 자식 모두에 scroll-snap을 적용해 정확한 스냅 포인트를 정의한다.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = scrollRef.current?.getScrollableNode?.() ?? scrollRef.current;
    if (!node || !node.style) return;
    node.style.scrollSnapType = "y mandatory";
    node.style.WebkitOverflowScrolling = "touch";
    // 자식(각 항목 wrapper)에 center 스냅 부여
    const children = node.children?.[0]?.children ?? [];
    for (const child of children) {
      if (child && child.style) {
        child.style.scrollSnapAlign = "center";
      }
    }
  }, [items.length]);

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
    // 웹에서는 우리가 scrollTo를 호출하면 iOS Safari의 momentum/터치 상태와
    // 충돌해 위치가 튀는 문제가 있음. 시각적 스냅은 snapToInterval(=CSS
    // scroll-snap)에 맡기고 여기서는 index만 부모에 알림.
    if (Platform.OS !== "web") {
      snapTo(idx, true);
    }
  };

  // 웹은 momentum 이벤트가 누락될 수 있으니, 스크롤이 멈춘 직후 한 번 더
  // index를 커밋해 부모 상태와 휠 위치가 어긋나지 않게 한다. scrollTo는 부르지 않음.
  const scheduleWebCommit = (offsetY) => {
    if (Platform.OS !== "web") return;
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const idx = clamp(Math.round(offsetY / itemHeight));
      commitIndex(idx);
    }, SNAP_DEBOUNCE_MS);
  };

  // 네이티브 드라이버는 web에서는 무시되지만, 안전하게 플래그로 분기
  const useNative = Platform.OS !== "web";

  const handleScrollListener = (e) => {
    scheduleWebCommit(e.nativeEvent.contentOffset.y);
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
