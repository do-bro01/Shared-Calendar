// SC/src/components/CalendarView.js
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { CalendarList } from "react-native-calendars";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EventModal from "./EventModal";
import Button from "./Button";
import { useTheme } from "../context/ThemeContext";
import { Typography, Spacing, Radius, Shadow } from "../../constants/theme";

// MainTabNavigator의 tabBarStyle: bottom 12 + height 72
const TAB_BAR_TOP_FROM_SCREEN_BOTTOM = 12 + 72;
const GAP_ABOVE_TAB_BAR = 10;

// CalendarList horizontal 모드의 페이지 폭 = 화면폭 - 좌우 패딩 16*2
// 정수로 floor — 소수점 폭이면 paging 스크롤 위치가 매번 어긋남
const HORIZONTAL_PADDING = Spacing.lg;
const getCalendarWidth = () =>
  Math.floor(Dimensions.get("window").width - HORIZONTAL_PADDING * 2);

// CalendarList의 pastScrollRange/futureScrollRange. JSX prop과 반드시 동일하게 유지.
// 오늘(=current=initialDate)의 페이지 인덱스 = PAST_SCROLL_RANGE 이므로
// 오늘 달의 스크롤 오프셋 = calendarWidth * PAST_SCROLL_RANGE.
const PAST_SCROLL_RANGE = 24;
const FUTURE_SCROLL_RANGE = 24;

// iOS 홈화면 PWA(standalone)에서는 시스템이 이전 세션의 스크롤 위치를 복원하려 하고,
// 그게 우리의 scrollToDay 보정과 충돌해 캘린더가 양끝까지 "슬라이드"되는 회귀가 생김.
// 이 환경에서는 보정을 건너뛰고 CalendarList의 current + initialScrollIndex 기본 동작에 맡긴다
// (회귀 전, 데스크톱과 동일하게 오늘 달에 잘 안착하던 동작). 데스크톱 브라우저/네이티브는 보정 유지.
const IS_STANDALONE_PWA =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  ((window.navigator && window.navigator.standalone === true) ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches));

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const formatGreetingDate = (date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const wd = WEEKDAY_KO[date.getDay()];
  return `${m}월 ${d}일 (${wd})`;
};

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
  const [calendarWidth, setCalendarWidth] = useState(getCalendarWidth());
  const calendarListRef = useRef(null);
  const calendarWrapperRef = useRef(null); // 웹: 내부 가로 스크롤러 DOM 접근용
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();

  // 최신 selectedDate를 ref로 유지 (이벤트 핸들러가 stale 값을 쓰지 않도록)
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const scrollTimersRef = useRef([]);

  // react-native-calendars의 CalendarList는 horizontal + pagingEnabled 조합에서
  // initialScrollIndex가 종종 무시되어 첫 페이지(과거 끝)부터 시작하는 이슈가 있음.
  // → 데스크톱 브라우저/네이티브에서는 마운트(또는 width 안정화) 직후 ref.scrollToDay로 보정.
  //
  // iOS 홈화면 PWA(standalone)에서는 scrollToDay(=scrollToOffset)가 과거 끝에서 오늘까지
  // "슬라이드" 애니메이션으로 미끄러지고, 시스템 스크롤 복원과도 충돌함. 그래서 PWA에서는
  // 내부 가로 스크롤러의 scrollLeft를 "직접" 즉시 할당한다(DOM scrollLeft setter는 항상 즉발 →
  // 슬라이드 없음). 복원이 늦게 들어와도 여러 시점에 다시 고정하면 마지막엔 오늘 달에 안착.
  const scheduleScroll = React.useCallback(() => {
    scrollTimersRef.current.forEach(clearTimeout);

    if (IS_STANDALONE_PWA) {
      const todayOffset = calendarWidth * PAST_SCROLL_RANGE;
      const pinToToday = () => {
        const root = calendarWrapperRef.current;
        if (!root || typeof root.querySelectorAll !== "function") return;
        // 가로로 넘치는(=49개월 너비) 스크롤 컨테이너 찾기
        for (const el of root.querySelectorAll("div")) {
          if (el.scrollWidth > el.clientWidth + 8) {
            const ox = window.getComputedStyle(el).overflowX;
            if (ox === "auto" || ox === "scroll") {
              el.scrollLeft = todayOffset; // 즉발 점프 (애니메이션 없음)
              break;
            }
          }
        }
      };
      scrollTimersRef.current = [80, 250, 500, 900].map((d) =>
        setTimeout(pinToToday, d),
      );
      return;
    }

    // 데스크톱 브라우저 / 네이티브: 기존 scrollToDay 보정
    const target = selectedDateRef.current;
    const delays = Platform.OS === "web" ? [120, 450] : [80];
    scrollTimersRef.current = delays.map((d) =>
      setTimeout(() => {
        calendarListRef.current?.scrollToDay(target, 0, false);
      }, d),
    );
  }, [calendarWidth]);

  // 마운트 / width 안정화 / 테마 변경 시 보정.
  // selectedDate는 의도적으로 deps에서 제외: 사용자가 다른 월의 날짜를 선택해도
  // 화면을 그쪽으로 강제 스크롤하지 않음. width 안정화/리마운트 시점에만 보정.
  useEffect(() => {
    scheduleScroll();
    return () => scrollTimersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarWidth, theme.mode]);

  // iOS PWA는 "열기"가 콜드 런치가 아니라 백그라운드 복귀인 경우가 많아 위 effect가 안 돌아감.
  // 다시 보일 때마다 오늘 달로 재고정(즉발 scrollLeft라 슬라이드 없음). PWA 한정.
  useEffect(() => {
    if (!IS_STANDALONE_PWA || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleScroll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [scheduleScroll]);

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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={() => setCalendarWidth(getCalendarWidth())}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        <View
          ref={calendarWrapperRef}
          style={[
            styles.calendarWrapper,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <CalendarList
            ref={calendarListRef}
            key={`${theme.mode}-${calendarWidth}`}
            horizontal
            pagingEnabled
            pastScrollRange={PAST_SCROLL_RANGE}
            futureScrollRange={FUTURE_SCROLL_RANGE}
            calendarWidth={calendarWidth}
            showScrollIndicator={false}
            current={selectedDate}
            onDayPress={(day) => onSelectDate(day.dateString)}
            markingType={"multi-period"}
            markedDates={getMarkedDates()}
            theme={{
              calendarBackground: colors.card,
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
    borderWidth: 1,
    ...Shadow.sm,
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
