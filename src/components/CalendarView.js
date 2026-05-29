// SC/src/components/CalendarView.js
import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Animated,
  PanResponder,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EventModal from "./EventModal";
import Button from "./Button";
import { useTheme } from "../context/ThemeContext";
import { Typography, Spacing, Radius, Shadow } from "../../constants/theme";

// MainTabNavigator의 tabBarStyle: bottom 12 + height 72
const TAB_BAR_TOP_FROM_SCREEN_BOTTOM = 12 + 72;
const GAP_ABOVE_TAB_BAR = 10;

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const formatGreetingDate = (date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const wd = WEEKDAY_KO[date.getDay()];
  return `${m}월 ${d}일 (${wd})`;
};

// ─────────────────────────────────────────────────────────────
// 월 페이저 (손가락 따라 드래그 → 스냅)
// 핵심: "보여줄 월"은 부모의 state(month)로 관리하고, 스와이프는 transform(translateX)만 움직임.
// 브라우저 스크롤 위치(initialScrollIndex/scrollLeft)에 의존하지 않으므로 모바일 위치 버그가 없음.
// prev/current/next 3개월을 가로로 깔고, 가운데(-width)가 기본. 드래그/화살표로 ±1달 스냅.
// ─────────────────────────────────────────────────────────────
const firstOfMonthDate = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonthsDate = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const toMonthString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const SWIPE_DURATION = 220;

function MonthPager({ month, onChangeMonth, renderMonth }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const monthRef = useRef(month);
  monthRef.current = month;
  const onChangeRef = useRef(onChangeMonth);
  onChangeRef.current = onChangeMonth;

  const setWidthSafe = (w) => {
    if (w > 0 && w !== widthRef.current) {
      widthRef.current = w;
      setWidth(w);
      translateX.setValue(-w); // 가운데 패널로 정렬
    }
  };

  // 월이 바뀐 뒤(스와이프/화살표로 onChangeMonth 호출) 가운데로 재정렬.
  // useLayoutEffect는 DOM 커밋 후 paint 전에 실행 → 다른 달이 한 프레임 보이는 깜빡임 방지.
  useLayoutEffect(() => {
    translateX.setValue(-widthRef.current);
  }, [month, translateX]);

  const animateAndChange = (toValue, delta) => {
    if (animatingRef.current || widthRef.current === 0) return;
    animatingRef.current = true;
    Animated.timing(translateX, {
      toValue,
      duration: SWIPE_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      animatingRef.current = false;
      if (finished && delta !== 0) {
        onChangeRef.current?.(addMonthsDate(monthRef.current, delta));
      }
    });
  };

  const goPrev = () => animateAndChange(0, -1);
  const goNext = () => animateAndChange(-2 * widthRef.current, 1);

  const pan = useRef(
    PanResponder.create({
      // 가로 의도일 때만 가로 페이징을 가로챔 → 세로 스크롤은 바깥 ScrollView에 양보
      onMoveShouldSetPanResponder: (_, g) =>
        !animatingRef.current &&
        Math.abs(g.dx) > 9 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(-widthRef.current + g.dx);
      },
      onPanResponderRelease: (_, g) => {
        const w = widthRef.current;
        if (w === 0) return;
        const threshold = Math.min(48, w * 0.2);
        if (g.dx <= -threshold) animateAndChange(-2 * w, 1); // 다음 달
        else if (g.dx >= threshold) animateAndChange(0, -1); // 이전 달
        else animateAndChange(-w, 0); // 임계값 미달 → 원위치
      },
      onPanResponderTerminate: () => {
        Animated.timing(translateX, {
          toValue: -widthRef.current,
          duration: 150,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const prevM = addMonthsDate(month, -1);
  const nextM = addMonthsDate(month, 1);

  return (
    <View
      style={{ overflow: "hidden" }}
      onLayout={(e) => setWidthSafe(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 && (
        <Animated.View
          style={{
            flexDirection: "row",
            width: width * 3,
            transform: [{ translateX }],
            // 웹: 세로 스크롤은 브라우저가, 가로 제스처는 우리 PanResponder가 처리하도록.
            // (iOS WebKit에서 가로 스와이프 중 세로 스크롤이 끼어들어 끊기는 문제 해결)
            ...(Platform.OS === "web" ? { touchAction: "pan-y" } : null),
          }}
          {...pan.panHandlers}
        >
          {[prevM, month, nextM].map((m) => (
            <View key={toMonthString(m)} style={{ width }}>
              {renderMonth(m, goPrev, goNext)}
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

export default function CalendarView({
  selectedDate,
  events,
  onSelectDate,
  onAddEvent,
  isShared = false,
  title = "캘린더",
  useGreeting = false,
  greetingName,
  onDeleteEvent,
  onEditEvent,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  // 캘린더에 보여줄 "월"을 상태로 관리(스크롤 위치가 아님). 초기값 = selectedDate(오늘)의 달.
  // 스와이프/화살표는 이 상태를 ±1달 바꿀 뿐 → 모바일 위치 버그 없음. [[MonthPager]]
  const [displayMonth, setDisplayMonth] = useState(() => {
    const m = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || "")
      ? (() => {
          const [y, mo] = selectedDate.split("-").map(Number);
          return new Date(y, mo - 1, 1);
        })()
      : firstOfMonthDate(new Date());
    return m;
  });

  const addButtonMarginBottom = Math.max(
    8,
    TAB_BAR_TOP_FROM_SCREEN_BOTTOM + GAP_ABOVE_TAB_BAR - insets.bottom,
  );

  const handleEventPress = (event) => {
    if (event.isHoliday) {
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
      };
      const dateText =
        event.endDate && event.endDate !== event.date
          ? `${formatDate(event.date)} ~ ${formatDate(event.endDate)}`
          : formatDate(event.date);
      Alert.alert(event.title, dateText, [{ text: "확인", style: "cancel" }]);
      return;
    }

    setEditingEvent(event);
    setModalVisible(true);
  };

  // 시작일과 종료일 사이의 모든 날짜를 생성하는 함수 (문자열 기반)
  const getDateRange = (startDate, endDate) => {
    const dates = [];
    const current = new Date(startDate + "T00:00:00Z");
    const end = new Date((endDate || startDate) + "T00:00:00Z");

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // markedDates 생성 (multi-period: 여러 날짜를 가로지르는 색 바 형태)
  // 겹치는 일정은 자동으로 다른 lane에 쌓이도록 greedy lane assignment 적용
  const getMarkedDates = () => {
    const marked = {};

    const sorted = [...events].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aEnd = a.endDate || a.date;
      const bEnd = b.endDate || b.date;
      return bEnd.localeCompare(aEnd);
    });

    const lanes = [];
    const eventLane = new Map();

    for (const ev of sorted) {
      const start = ev.date;
      const end = ev.endDate || ev.date;
      let assigned = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] < start) {
          assigned = i;
          lanes[i] = end;
          break;
        }
      }
      if (assigned === -1) {
        assigned = lanes.length;
        lanes.push(end);
      }
      eventLane.set(ev.id, assigned);
    }

    const totalLanes = lanes.length;

    for (const ev of sorted) {
      const lane = eventLane.get(ev.id);
      const start = ev.date;
      const end = ev.endDate || ev.date;
      const dates = getDateRange(start, end);
      for (const date of dates) {
        if (!marked[date]) {
          marked[date] = { periods: new Array(totalLanes).fill(null) };
        }
        if (!marked[date].periods) {
          marked[date].periods = new Array(totalLanes).fill(null);
        }
        while (marked[date].periods.length < totalLanes) {
          marked[date].periods.push(null);
        }
        marked[date].periods[lane] = {
          startingDay: date === start,
          endingDay: date === end,
          color: ev.isHoliday ? "#e53935" : ev.dotColor || colors.tint,
        };
      }
    }

    for (const date in marked) {
      marked[date].periods = marked[date].periods.map(
        (p) => p || { color: "transparent" },
      );
    }

    if (!marked[selectedDate]) {
      marked[selectedDate] = { selected: true, selectedColor: colors.tint };
    } else {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = colors.tint;
    }

    return marked;
  };

  // 그리팅 헤더용: 오늘 일정 개수 (공휴일 제외)
  const greetingMeta = useMemo(() => {
    if (!useGreeting) return null;
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    const todayEvents = events.filter((ev) => {
      if (ev.isHoliday) return false;
      const startDate = ev.date;
      const endDate = ev.endDate || ev.date;
      return todayKey >= startDate && todayKey <= endDate;
    });
    return {
      dateLabel: formatGreetingDate(today),
      count: todayEvents.length,
    };
  }, [events, useGreeting]);

  const renderHeader = () => {
    if (useGreeting && greetingMeta) {
      const titleText = greetingName
        ? `안녕하세요, ${greetingName}님!`
        : "안녕하세요!";
      return (
        <View style={styles.greetingHeader}>
          <Text style={[styles.greetingTitle, { color: colors.text }]}>
            {titleText}
          </Text>
          <Text style={[styles.greetingSubtitle, { color: colors.muted }]}>
            오늘 일정 {greetingMeta.count}개 · {greetingMeta.dateLabel}
          </Text>
        </View>
      );
    }

    if (!title) return null;

    return (
      <Text
        style={[
          isShared ? styles.headerTitleShared : styles.headerTitle,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>
    );
  };

  // 3개월 패널이 공유하도록 한 번만 계산
  const calendarMarkedDates = getMarkedDates();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        <View
          style={[
            styles.calendarWrapper,
            {
              backgroundColor: colors.background,
            },
          ]}
        >
          <MonthPager
            // 테마 변경 시 Calendar는 스타일을 마운트 시 한 번만 계산하므로(useRef) 전체 리마운트로 재테마.
            key={theme.mode}
            month={displayMonth}
            onChangeMonth={setDisplayMonth}
            renderMonth={(monthDate, goPrev, goNext) => (
              <Calendar
                initialDate={toMonthString(monthDate)}
                onDayPress={(day) => onSelectDate(day.dateString)}
                onPressArrowLeft={goPrev}
                onPressArrowRight={goNext}
                markingType={"multi-period"}
                markedDates={calendarMarkedDates}
                theme={{
                  calendarBackground: colors.background,
                  monthTextColor: colors.text,
                  textSectionTitleColor: colors.text,
                  textDayColor: colors.text,
                  selectedDayBackgroundColor: colors.tint,
                  selectedDayTextColor: "#fff",
                  todayTextColor: colors.tint,
                  todayBackgroundColor: "transparent",
                  arrowColor: colors.tint,
                  textMonthFontSize: Typography.headline,
                  textMonthFontWeight: Typography.weights.bold,
                  textDayFontWeight: Typography.weights.medium,
                  textDayHeaderFontWeight: Typography.weights.semibold,
                  textDayHeaderFontSize: Typography.caption,
                  textMonthFontFamily: Typography.fontFamily,
                  textDayFontFamily: Typography.fontFamily,
                  textDayHeaderFontFamily: Typography.fontFamily,
                }}
              />
            )}
          />
        </View>

        <View style={styles.titleRow}>
          <MaterialIcons
            name="calendar-today"
            size={18}
            color={colors.tint}
            style={{ marginRight: 6, marginTop: -1 }}
          />
          <Text style={[styles.titleText, { color: colors.text }]}>
            {selectedDate} 일정
          </Text>
        </View>

        <View
          style={[styles.eventList, { backgroundColor: colors.background }]}
        >
          {events.filter((ev) => {
            const startDate = ev.date;
            const endDate = ev.endDate || ev.date;
            return selectedDate >= startDate && selectedDate <= endDate;
          }).length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="event-available"
                size={40}
                color={colors.text}
                style={{ opacity: 0.3 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                일정 없음
              </Text>
              <Text style={[styles.emptyHint, { color: colors.muted }]}>
                아래 버튼으로 새 일정을 추가해보세요
              </Text>
            </View>
          ) : (
            events
              .filter((ev) => {
                const startDate = ev.date;
                const endDate = ev.endDate || ev.date;
                return selectedDate >= startDate && selectedDate <= endDate;
              })
              .map((ev) => {
                const formatDate = (dateStr) => {
                  const date = new Date(dateStr);
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  return `${month}월${day}일`;
                };

                const trimTime = (t) =>
                  typeof t === "string" ? t.slice(0, 5) : t;

                const baseDateText =
                  ev.endDate && ev.endDate !== ev.date
                    ? `${formatDate(ev.date)}~${formatDate(ev.endDate)}`
                    : formatDate(ev.date);

                const dateText =
                  !ev.isHoliday &&
                  ev.allDay === false &&
                  ev.startTime &&
                  ev.endTime
                    ? `${baseDateText}  ${trimTime(ev.startTime)} ~ ${trimTime(ev.endTime)}`
                    : baseDateText;

                // 좌측 컬러 바 색상: 공휴일은 빨강, 그 외는 일정 dotColor 또는 브랜드 컬러
                const accentColor = ev.isHoliday
                  ? "#e53935"
                  : ev.dotColor || colors.tint;

                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[
                      styles.eventItem,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleEventPress(ev)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.eventAccentBar,
                        { backgroundColor: accentColor },
                      ]}
                    />
                    <View style={styles.eventContent}>
                      <Text
                        style={[
                          styles.eventText,
                          {
                            color: ev.isHoliday ? "#e53935" : colors.text,
                            fontWeight: ev.isHoliday
                              ? Typography.weights.bold
                              : Typography.weights.semibold,
                          },
                        ]}
                      >
                        {ev.title}
                      </Text>
                      <Text
                        style={[
                          styles.eventDate,
                          {
                            color: colors.muted,
                            opacity: ev.isHoliday ? 0.95 : 1,
                          },
                        ]}
                      >
                        {dateText}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.addButtonWrapper,
          { marginBottom: addButtonMarginBottom },
        ]}
      >
        <Button
          title="일정 추가"
          variant="primary"
          size="lg"
          onPress={() => setModalVisible(true)}
          icon={<MaterialIcons name="add" size={18} color="#fff" />}
          style={{ width: "50%", paddingVertical: 8 }}
        />
      </View>

      <EventModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingEvent(null);
        }}
        defaultDate={selectedDate}
        isShared={isShared}
        editMode={!!editingEvent}
        eventToEdit={editingEvent}
        onSave={(data) => {
          if (editingEvent) {
            onEditEvent && onEditEvent(data);
          } else {
            onAddEvent(data);
          }
          setModalVisible(false);
          setEditingEvent(null);
        }}
        onDelete={
          onDeleteEvent
            ? (eventId) => {
                onDeleteEvent(eventId);
                setEditingEvent(null);
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: Typography.title1,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    textAlign: "center",
    alignSelf: "stretch",
  },
  headerTitleShared: {
    fontSize: Typography.title1,
    fontWeight: Typography.weights.bold,
    marginBottom: -Spacing.xl,
    marginTop: 0,
    textAlign: "center",
    alignSelf: "stretch",
  },
  greetingHeader: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: 2,
  },
  greetingTitle: {
    fontSize: Typography.title1,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    fontSize: Typography.subhead,
    fontWeight: Typography.weights.regular,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  titleText: {
    fontSize: Typography.headline,
    fontWeight: Typography.weights.bold,
  },
  calendarWrapper: {
    borderRadius: Radius.md,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  eventList: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.weights.semibold,
    opacity: 0.6,
  },
  emptyHint: {
    fontSize: Typography.footnote,
  },
  eventItem: {
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 0,
    borderRadius: Radius.md,
    marginBottom: 10,
    marginHorizontal: 0,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    overflow: "hidden",
    ...Shadow.sm,
  },
  eventAccentBar: {
    width: 4,
    alignSelf: "stretch",
    marginRight: 12,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  eventContent: {
    flex: 1,
    justifyContent: "center",
  },
  eventText: {
    fontSize: Typography.body,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  eventDate: {
    fontSize: Typography.caption,
    letterSpacing: -0.1,
  },
  addButtonWrapper: {
    marginTop: 0,
    marginHorizontal: 30,
    alignItems: "center",
  },
});
