// SC/src/components/CalendarView.js
import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Animated,
  PanResponder,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { Calendar } from "react-native-calendars";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EventModal from "./EventModal";
import Button from "./Button";
import { SearchIcon, ReturnIcon } from "./icons";
import { useTheme } from "../context/ThemeContext";
import { Typography, Spacing, Radius, Shadow } from "../../constants/theme";

// MainTabNavigator의 tabBarStyle: bottom 12 + height 72
const TAB_BAR_TOP_FROM_SCREEN_BOTTOM = 12 + 72;
const GAP_ABOVE_TAB_BAR = 10;
// "일정 추가" 버튼 영역의 대략적 높이 (paddingVertical 8 + 텍스트/아이콘). 스크롤이 버튼 뒤로 충분히 지나가도록 여유 포함.
const ADD_BUTTON_AREA_HEIGHT = 56;

// 일정 항목 추가/삭제/이동에 부드러운 전환을 적용하기 위한 Animated TouchableOpacity
const AnimatedTouchable = Reanimated.createAnimatedComponent(TouchableOpacity);
const EVENT_ITEM_ENTERING = FadeIn.duration(180);
const EVENT_ITEM_EXITING = FadeOut.duration(120);
const EVENT_ITEM_LAYOUT = LinearTransition.springify()
  .damping(18)
  .stiffness(180);

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const formatGreetingDate = (date) => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const wd = WEEKDAY_KO[date.getDay()];
  return `${m}월 ${d}일 (${wd})`;
};

// 일정 한 건의 날짜/시간 텍스트 (일정 목록 + 검색 결과 공용)
const formatEventShortDate = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월${date.getDate()}일`;
};
const trimEventTime = (t) => (typeof t === "string" ? t.slice(0, 5) : t);
const buildEventDateText = (ev) => {
  const base =
    ev.endDate && ev.endDate !== ev.date
      ? `${formatEventShortDate(ev.date)}~${formatEventShortDate(ev.endDate)}`
      : formatEventShortDate(ev.date);
  return !ev.isHoliday && ev.allDay === false && ev.startTime && ev.endTime
    ? `${base}  ${trimEventTime(ev.startTime)} ~ ${trimEventTime(ev.endTime)}`
    : base;
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

const MonthPager = forwardRef(function MonthPager(
  { month, onChangeMonth, renderMonth },
  ref,
) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const monthRef = useRef(month);
  monthRef.current = month;
  const onChangeRef = useRef(onChangeMonth);
  onChangeRef.current = onChangeMonth;
  // Today 점프 중 표시할 목표 달 (거리와 무관하게 단 한 장만 슬라이드해서 도착)
  const [jump, setJump] = useState(null); // { target: Date, dir: -1 | 1 } | null

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

  // 임의의 달로 한 번에 슬라이드. 몇 달 차이든 목표 달을 인접 패널에 끼워 넣고
  // 단 한 번의 스와이프로 도착시킨다 (중간 달을 거치지 않음).
  const goToMonth = useCallback(
    (target) => {
      const w = widthRef.current;
      const cur = monthRef.current;
      const diff =
        (target.getFullYear() - cur.getFullYear()) * 12 +
        (target.getMonth() - cur.getMonth());
      if (diff === 0) return;
      if (w === 0 || animatingRef.current) {
        onChangeRef.current?.(target);
        return;
      }
      const dir = diff < 0 ? -1 : 1;
      animatingRef.current = true;
      setJump({ target, dir });
      // 목표 패널이 먼저 렌더된 다음 프레임에 애니메이션 시작 (한 프레임 깜빡임 방지)
      requestAnimationFrame(() => {
        Animated.timing(translateX, {
          toValue: dir < 0 ? 0 : -2 * w,
          duration: SWIPE_DURATION,
          useNativeDriver: false,
        }).start(({ finished }) => {
          animatingRef.current = false;
          setJump(null);
          if (finished) onChangeRef.current?.(target);
        });
      });
    },
    [translateX],
  );

  useImperativeHandle(ref, () => ({ goToMonth }), [goToMonth]);

  const pan = useRef(
    PanResponder.create({
      // 가로 의도일 때만 가로 페이징을 가로챔 → 세로 스크롤은 바깥 ScrollView에 양보
      onMoveShouldSetPanResponder: (_, g) =>
        !animatingRef.current &&
        Math.abs(g.dx) > 6 &&
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
        if (g.dx <= -threshold)
          animateAndChange(-2 * w, 1); // 다음 달
        else if (g.dx >= threshold)
          animateAndChange(0, -1); // 이전 달
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
  // 점프 중에는 진행 방향 쪽 패널을 목표 달로 교체 → 한 번의 슬라이드로 목표에 도착
  const panels =
    jump?.dir === -1
      ? [jump.target, month, nextM]
      : jump?.dir === 1
        ? [prevM, month, jump.target]
        : [prevM, month, nextM];

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
          {panels.map((m) => (
            <View key={toMonthString(m)} style={{ width }}>
              {renderMonth(m, goPrev, goNext)}
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
});

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
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // 검색 dim/시트 페이드·슬라이드 아웃이 끝날 때까지 Modal을 유지하기 위한 마운트 상태.
  // searchVisible=true → Modal mount → dim FadeIn + 시트 SlideInDown 동시에
  // searchVisible=false → dim/시트 unmount(페이드/슬라이드 아웃) → 220ms 뒤 Modal도 unmount
  const [searchMounted, setSearchMounted] = useState(false);
  useEffect(() => {
    if (searchVisible) {
      setSearchMounted(true);
    } else if (searchMounted) {
      const t = setTimeout(() => setSearchMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [searchVisible, searchMounted]);
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const pagerRef = useRef(null);

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

  // 오늘이 속한 달. 지금 보고 있는 달이 오늘 달이면 Today 버튼을 숨긴다.
  const todayMonth = firstOfMonthDate(new Date());
  const isViewingTodayMonth =
    displayMonth.getFullYear() === todayMonth.getFullYear() &&
    displayMonth.getMonth() === todayMonth.getMonth();
  const goToday = () => pagerRef.current?.goToMonth(todayMonth);

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

  // 검색: 제목으로 필터 후 날짜순 정렬 (공휴일도 검색 대상에 포함)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter((ev) => (ev.title || "").toLowerCase().includes(q))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, searchQuery]);

  const closeSearch = () => {
    setSearchVisible(false);
    setSearchQuery("");
  };

  // 검색 결과 선택 → 해당 날짜 선택 + 그 달로 캘린더 이동
  const jumpToEvent = (ev) => {
    closeSearch();
    onSelectDate(ev.date);
    const [y, mo] = ev.date.split("-").map(Number);
    if (y && mo) setDisplayMonth(new Date(y, mo - 1, 1));
  };

  const renderHeader = () => {
    // Today 버튼은 오늘 달이 아닐 때만 노출(보일 때만 동작).
    const headerActions = (
      <View style={styles.headerActions}>
        {!isViewingTodayMonth && (
          <TouchableOpacity
            onPress={goToday}
            style={[styles.todayButton, { borderColor: colors.muted }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="오늘 달로 이동"
          >
            <ReturnIcon size={13} color={colors.muted} />
            <Text style={[styles.todayText, { color: colors.muted }]}>
              Today
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setSearchVisible(true)}
          style={styles.searchButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="일정 검색"
        >
          <SearchIcon size={19} color={colors.muted} />
        </TouchableOpacity>
      </View>
    );

    if (useGreeting && greetingMeta) {
      const titleText = greetingName
        ? `안녕하세요, ${greetingName}님!`
        : "안녕하세요!";
      return (
        <View style={[styles.headerRow, styles.greetingHeader]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>
              {titleText}
            </Text>
            <Text style={[styles.greetingSubtitle, { color: colors.muted }]}>
              오늘 일정 {greetingMeta.count}개 · {greetingMeta.dateLabel}
            </Text>
          </View>
          {headerActions}
        </View>
      );
    }

    // title이 비어 있어도(공유 달력) 액션 버튼은 우상단에 노출
    if (!title) {
      return (
        <View style={[styles.headerRow, styles.searchOnlyRow]}>
          {headerActions}
        </View>
      );
    }

    return (
      <View style={[styles.headerRow, styles.titleHeaderRow]}>
        <Text style={[styles.headerTitleCentered, { color: colors.text }]}>
          {title}
        </Text>
        {headerActions}
      </View>
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
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              Spacing.xl + ADD_BUTTON_AREA_HEIGHT + addButtonMarginBottom,
          },
        ]}
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
            key={`${theme.mode}-${theme.cream ? "cream" : "plain"}`}
            ref={pagerRef}
            month={displayMonth}
            onChangeMonth={setDisplayMonth}
            renderMonth={(monthDate, goPrev, goNext) => (
              <Calendar
                initialDate={toMonthString(monthDate)}
                // 내부 자동 월이동을 막고 우리 displayMonth로 일원화.
                // (overflow 날짜 탭 시 Calendar가 혼자 다른 달로 drift → 부모 state와 어긋나
                //  Today 버튼/스와이프 방향이 깨지던 버그 방지)
                disableMonthChange
                onDayPress={(day) => {
                  onSelectDate(day.dateString);
                  const [y, mo] = day.dateString.split("-").map(Number);
                  if (
                    y !== monthDate.getFullYear() ||
                    mo - 1 !== monthDate.getMonth()
                  ) {
                    setDisplayMonth(new Date(y, mo - 1, 1));
                  }
                }}
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
            <Reanimated.View
              style={styles.emptyState}
              entering={EVENT_ITEM_ENTERING}
              exiting={EVENT_ITEM_EXITING}
              layout={EVENT_ITEM_LAYOUT}
            >
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
            </Reanimated.View>
          ) : (
            events
              .filter((ev) => {
                const startDate = ev.date;
                const endDate = ev.endDate || ev.date;
                return selectedDate >= startDate && selectedDate <= endDate;
              })
              .map((ev) => {
                const dateText = buildEventDateText(ev);

                // 좌측 컬러 바 색상: 공휴일은 빨강, 그 외는 일정 dotColor 또는 브랜드 컬러
                const accentColor = ev.isHoliday
                  ? "#e53935"
                  : ev.dotColor || colors.tint;

                return (
                  <AnimatedTouchable
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
                    entering={EVENT_ITEM_ENTERING}
                    exiting={EVENT_ITEM_EXITING}
                    layout={EVENT_ITEM_LAYOUT}
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
                  </AnimatedTouchable>
                );
              })
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.addButtonWrapper,
          // absolute라서 SafeAreaView paddingBottom이 자동 적용되지 않음 → insets.bottom 직접 보정
          { bottom: addButtonMarginBottom + insets.bottom },
        ]}
        pointerEvents="box-none"
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

      <Modal
        visible={searchMounted}
        animationType="none"
        transparent
        onRequestClose={closeSearch}
      >
        <View style={styles.searchOverlay}>
          {/* dim은 시트와 동시에 페이드 인/아웃 → 시트가 올라오면서 점점 어두워지고, 내려가면서 점점 밝아짐 */}
          {searchVisible && (
            <Reanimated.View
              pointerEvents="none"
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(180)}
              style={styles.searchDim}
            />
          )}

          {/* 바깥 영역 탭 → 닫기 */}
          <Pressable style={{ flex: 1 }} onPress={closeSearch} />

          {/* 시트는 searchVisible로 mount 토글되어 슬라이드 인/아웃 */}
          {searchVisible && (
          <Reanimated.View
            entering={SlideInDown.duration(200)}
            exiting={SlideOutDown.duration(180)}
            style={[
              styles.searchSheet,
              {
                backgroundColor: colors.background,
                paddingBottom: Math.max(Spacing.lg, insets.bottom),
              },
            ]}
          >
            {/* 드래그 핸들 */}
            <View style={styles.sheetHandleWrap}>
              <View
                style={[styles.sheetHandle, { backgroundColor: colors.border }]}
              />
            </View>

            <View style={styles.searchBarRow}>
              <View
                style={[
                  styles.searchInputWrap,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <SearchIcon size={18} color={colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="일정 제목 검색"
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons
                      name="cancel"
                      size={18}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={closeSearch}
                style={styles.searchCancel}
              >
                <Text style={[styles.searchCancelText, { color: colors.tint }]}>
                  취소
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchResultsArea}>
              {searchQuery.trim().length === 0 ? (
                <View style={styles.searchEmpty}>
                  <SearchIcon
                    size={44}
                    color={colors.text}
                    style={{ opacity: 0.25 }}
                  />
                  <Text
                    style={[styles.searchEmptyText, { color: colors.muted }]}
                  >
                    일정 제목으로 검색해보세요
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchEmpty}>
                  <MaterialIcons
                    name="search-off"
                    size={44}
                    color={colors.text}
                    style={{ opacity: 0.25 }}
                  />
                  <Text
                    style={[styles.searchEmptyText, { color: colors.muted }]}
                  >
                    {`'${searchQuery.trim()}' 검색 결과가 없어요`}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.searchListContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={[styles.searchCount, { color: colors.muted }]}>
                    {searchResults.length}개의 일정
                  </Text>
                  {searchResults.map((ev) => {
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
                        onPress={() => jumpToEvent(ev)}
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
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                          <Text
                            style={[styles.eventDate, { color: colors.muted }]}
                          >
                            {buildEventDateText(ev)}
                          </Text>
                        </View>
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color={colors.muted}
                          style={{ alignSelf: "center" }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </Reanimated.View>
          )}
        </View>
      </Modal>
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
    position: "absolute",
    left: 0,
    right: 0,
    marginHorizontal: 30,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchOnlyRow: {
    justifyContent: "flex-end",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  titleHeaderRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headerTitleCentered: {
    flex: 1,
    fontSize: Typography.title1,
    fontWeight: Typography.weights.bold,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  todayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1.2,
    backgroundColor: "transparent",
  },
  todayText: {
    fontSize: Typography.footnote,
    fontWeight: Typography.weights.semibold,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  searchOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  searchDim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  searchSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.sm,
    // 콘텐츠 크기와 무관하게 한 번에 끝까지 올라오고, 안에서 내용이 재배치되도록 고정 높이
    height: "88%",
  },
  sheetHandleWrap: {
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  searchResultsArea: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.body,
    paddingVertical: 0,
  },
  searchCancel: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  searchCancelText: {
    fontSize: Typography.body,
    fontWeight: Typography.weights.semibold,
  },
  searchListContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  searchCount: {
    fontSize: Typography.footnote,
    marginBottom: Spacing.sm,
    marginLeft: 2,
  },
  searchEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  searchEmptyText: {
    fontSize: Typography.subhead,
  },
});
