// iOS 캘린더 앱 스타일 휠 피커.
// 중앙 행이 선택값이고, 위/아래로 갈수록 원통처럼 휘어 보이며 흐려짐.
// 시각 효과는 모두 Animated.scrollY 기반 interpolation으로 처리.
// 웹에선 iOS Safari가 momentum 감속 도중 scroll 이벤트를 띄우지 않아 보간이 얼었다가
// 끝에 한꺼번에 catch-up되는 끊김이 있음 → rAF로 직접 scrollTop을 폴링해 우회.
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Platform } from "react-native";

// EventModal 등 외부에서 단일 하이라이트를 그릴 때 위치 계산에 사용.
export const WHEEL_ITEM_HEIGHT = 28;
export const WHEEL_VISIBLE_COUNT = 7;

const DEFAULT_ITEM_HEIGHT = WHEEL_ITEM_HEIGHT;
const DEFAULT_VISIBLE_COUNT = WHEEL_VISIBLE_COUNT; // 가운데 + 위3 + 아래3

// 스크롤이 정말 멈췄다고 판단할 정지 프레임 수 (~133ms @ 60fps)
const STILL_FRAMES = 8;

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
  const scrollY = useRef(
    new Animated.Value(selectedIndex * itemHeight),
  ).current;
  // rAF effect가 매 렌더마다 재실행되지 않도록 onChange는 ref로 들고 다닌다.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

  // 웹: 스크롤러에 CSS scroll-snap을 직접 깐다.
  // - proximity는 momentum이 자연스럽게 감속한 뒤 가까운 항목에만 부드럽게 안착(mandatory와 달리 강제 점프가 없음).
  // - scroll-behavior: smooth → CSS scroll-snap의 안착이 instant jump가 아니라 애니메이션으로 일어남.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = scrollRef.current?.getScrollableNode?.() ?? scrollRef.current;
    if (!node || !node.style) return;
    node.style.scrollSnapType = "y proximity";
    node.style.scrollBehavior = "smooth";
    node.style.WebkitOverflowScrolling = "touch";
  }, []);

  // 웹: rAF로 scrollTop을 매 프레임 폴링 → Animated.Value 동기화 + 정지 감지 후 commit.
  // 왜:
  // - iOS Safari는 momentum 감속 동안 scroll 이벤트를 띄우지 않을 수 있음. onScroll에 의존하면
  //   휠 보간(rotateX/scale/opacity)이 얼어붙다가 모멘텀 끝나는 순간 한꺼번에 갱신되어 "툭" 끊겨 보임.
  // - rAF는 이벤트와 무관하게 매 프레임 돌기 때문에 보간이 끊김 없이 따라감.
  // - 또한 정지 프레임이 일정 수 쌓이면 그 시점에 onChange를 호출 → setTimeout 기반 commit이
  //   "이벤트가 안 뜨는 환경"에서 잘못된 시점에 commit하던 버그도 회피.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = scrollRef.current?.getScrollableNode?.() ?? scrollRef.current;
    if (!node) return;

    let rafId = 0;
    let lastTop = typeof node.scrollTop === "number" ? node.scrollTop : 0;
    let stillFrames = 0;
    let dirty = false; // 한 번이라도 움직였고 아직 commit 안 된 상태

    const tick = () => {
      const current = typeof node.scrollTop === "number" ? node.scrollTop : 0;
      if (current !== lastTop) {
        lastTop = current;
        stillFrames = 0;
        dirty = true;
        scrollY.setValue(current);
      } else if (dirty) {
        stillFrames++;
        if (stillFrames >= STILL_FRAMES) {
          const idx = Math.max(
            0,
            Math.min(items.length - 1, Math.round(current / itemHeight)),
          );
          if (idx !== lastReportedIndexRef.current) {
            lastReportedIndexRef.current = idx;
            onChangeRef.current?.(idx);
          }
          dirty = false;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollY, itemHeight, items.length]);

  const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));

  // 네이티브 전용: 모멘텀 끝났을 때 정렬 + commit (web에선 rAF가 담당).
  const handleMomentumEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = clamp(Math.round(offsetY / itemHeight));
    if (idx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = idx;
      onChangeRef.current?.(idx);
    }
    scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: true });
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
        // 웹은 rAF로 scrollY를 직접 갱신하므로 onScroll에 Animated.event를 묶을 필요 없음.
        onScroll={
          Platform.OS === "web"
            ? undefined
            : Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true },
              )
        }
        onMomentumScrollEnd={
          Platform.OS === "web" ? undefined : handleMomentumEnd
        }
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
                // 웹: 각 항목 중심이 컨테이너 중심에 스냅 + GPU 컴포지터로 올려 페인트 가속.
                ...(Platform.OS === "web"
                  ? {
                      scrollSnapAlign: "center",
                      willChange: "transform",
                      backfaceVisibility: "hidden",
                    }
                  : null),
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
