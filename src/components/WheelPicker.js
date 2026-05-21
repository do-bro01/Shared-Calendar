// iOS 캘린더 앱처럼 위아래로 스크롤하며 값을 고르는 휠 피커.
// 중앙 행이 현재 선택값이며, 위/아래로 갈수록 흐려짐.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Platform } from "react-native";

const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_VISIBLE_COUNT = 5; // 가운데 + 위2 + 아래2 = 5

export default function WheelPicker({
  items,
  selectedIndex,
  onChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  width,
  textColor = "#ffffff",
  highlightColor = "rgba(255,255,255,0.08)",
  fontSize = 18,
  selectedFontSize = 20,
}) {
  const scrollRef = useRef(null);
  const lastReportedIndexRef = useRef(selectedIndex);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const sideCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;
  const padding = itemHeight * sideCount;

  // 외부에서 selectedIndex가 바뀌면 스크롤 위치 동기화
  useEffect(() => {
    if (!scrollRef.current) return;
    const y = selectedIndex * itemHeight;
    scrollRef.current.scrollTo({ y, animated: false });
    setActiveIndex(selectedIndex);
    lastReportedIndexRef.current = selectedIndex;
  }, [selectedIndex, itemHeight]);

  const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));

  const handleScroll = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = clamp(Math.round(offsetY / itemHeight));
    if (idx !== activeIndex) setActiveIndex(idx);
  };

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

  // 웹에서는 모멘텀 이벤트가 잘 안 발생할 수 있으니 scrollEnd 보조
  const handleScrollEndWeb = (e) => {
    if (Platform.OS !== "web") return;
    handleMomentumEnd(e);
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
      {/* 중앙 강조 알약 배경 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: sideCount * itemHeight,
          left: 8,
          right: 8,
          height: itemHeight,
          backgroundColor: highlightColor,
          borderRadius: itemHeight / 2,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndWeb}
        contentContainerStyle={{
          paddingTop: padding,
          paddingBottom: padding,
        }}
      >
        {items.map((item, idx) => {
          const distance = Math.abs(idx - activeIndex);
          const opacity =
            distance === 0
              ? 1
              : distance === 1
              ? 0.55
              : distance === 2
              ? 0.3
              : 0.15;
          const isActive = distance === 0;
          return (
            <View
              key={`${idx}-${item.value}`}
              style={{
                height: itemHeight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: isActive ? selectedFontSize : fontSize,
                  fontWeight: isActive ? "600" : "400",
                  opacity,
                }}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
