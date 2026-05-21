import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import Button from "./Button";
import { MaterialIcons } from "@expo/vector-icons";
import { GroupCalendarService } from "../services/GroupCalendarService";
import { useTheme } from "../context/ThemeContext";
import WheelPicker from "./WheelPicker";

const COLOR_OPTIONS = [
  { name: "기본", value: "#395fa5ff" },
  { name: "빨간색", value: "#da4a47ff" },
  { name: "노란색", value: "#fbc02d" },
  { name: "초록색", value: "#66bb6a" },
  { name: "검정색", value: "#424242" },
  { name: "회색", value: "#bdbdbd" },
];

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 시·분 휠 옵션 (한 번만 만들면 됨)
const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, "0"),
}));
const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, "0"),
}));

// 하루종일 ON 휠용 년/월 옵션 (고정 범위로 두면 휠 위치가 흔들리지 않음)
const YEAR_MIN = 2010;
const YEAR_MAX = 2060;
const YEAR_ITEMS = Array.from(
  { length: YEAR_MAX - YEAR_MIN + 1 },
  (_, i) => ({ value: YEAR_MIN + i, label: `${YEAR_MIN + i}년` })
);
const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}월`,
}));
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const buildDayItems = (year, month) =>
  Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}일`,
  }));

// 하루종일 OFF 휠용 — 오늘 기준 ±2년 일자 리스트
const DATE_RANGE_DAYS = 730;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const buildDateItems = () => {
  const today = startOfDay(new Date());
  const items = [];
  for (let offset = -DATE_RANGE_DAYS; offset <= DATE_RANGE_DAYS; offset++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + offset);
    items.push({
      value: dt.toISOString().split("T")[0],
      label:
        offset === 0
          ? "오늘"
          : `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${DAY_NAMES[dt.getDay()]}`,
    });
  }
  return items;
};

const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateDisplay = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일 (${DAY_NAMES[date.getDay()]})`;
};

const formatTimeDisplay = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

const parseDateInput = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return new Date(d);
  // "YYYY-MM-DD" 같은 날짜 전용 문자열은 로컬타임 자정으로 해석
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  const maybe = new Date(d);
  if (!isNaN(maybe)) return maybe;
  return new Date(d + "T00:00:00");
};

const EventModal = ({
  visible,
  onClose,
  onSave,
  onDelete,
  defaultDate,
  isShared,
  editMode = false,
  eventToEdit = null,
}) => {
  const { mode, colors } = useTheme();
  const isDark = mode === "dark";

  const palette = {
    surface: isDark ? "#23252b" : "#ffffff",
    field: isDark ? "#2a2d33" : "#f5f5f5",
    innerCard: isDark ? "#2f3138" : "#ffffff",
    border: isDark ? "#3a3d44" : "#dddddd",
    softBorder: isDark ? "#33363d" : "#cccccc",
    label: isDark ? "#a8acb5" : "#666666",
    muted: isDark ? "#8d919a" : "#999999",
    placeholder: isDark ? "#7a7e87" : "#aaaaaa",
    selectedBg: isDark ? "#2a4263" : "#e3f2fd",
    selectedBorder: colors.tint,
    text: colors.text,
    handle: isDark ? "#3a3d44" : "#d0d0d0",
    wheelHighlight: isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.06)",
    pillBg: isDark ? "#ffffff" : "#1f2026",
    pillText: isDark ? "#1f2026" : "#ffffff",
    pillBorderOff: isDark ? "#5a5e68" : "#aab0bb",
  };

  const [title, setTitle] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groupCalendars, setGroupCalendars] = useState([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#395fa5ff");

  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(() =>
    parseDateInput(defaultDate)
  );
  const [endDate, setEndDate] = useState(() => parseDateInput(defaultDate));
  // 어떤 날짜를 편집 중인지: "start" | "end" | null
  const [editing, setEditing] = useState(null);

  // 휠 영역이 펼쳐졌을 때 보이도록 스크롤하기 위한 refs
  const scrollRef = useRef(null);
  const pickerYRef = useRef(0);

  // 그룹 캘린더 로드
  useEffect(() => {
    if (visible && !isShared) {
      loadGroupCalendars();
    }
  }, [visible, isShared]);

  const loadGroupCalendars = async () => {
    setLoadingGroups(true);
    try {
      const groups = await GroupCalendarService.getUserGroupCalendars();
      setGroupCalendars(groups);
    } catch (error) {
      console.error("Error loading group calendars:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (!visible) return;
    if (editMode && eventToEdit) {
      setTitle(eventToEdit.title || "");
      const start = parseDateInput(eventToEdit.date);
      const end = parseDateInput(eventToEdit.endDate || eventToEdit.date);
      // 편집 시 시간 정보 복원
      const isAllDay = eventToEdit.allDay !== false;
      setAllDay(isAllDay);
      if (!isAllDay) {
        if (eventToEdit.startTime) {
          const [h, m] = eventToEdit.startTime.split(":").map(Number);
          start.setHours(h || 0, m || 0, 0, 0);
        }
        if (eventToEdit.endTime) {
          const [h, m] = eventToEdit.endTime.split(":").map(Number);
          end.setHours(h || 0, m || 0, 0, 0);
        }
      } else {
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
      }
      setStartDate(start);
      setEndDate(end);
      setSelectedGroups(eventToEdit.linkedGroupCalendarIds || []);
      setSelectedColor(eventToEdit.dotColor || "#395fa5ff");
    } else {
      setTitle("");
      const d = parseDateInput(defaultDate);
      d.setHours(0, 0, 0, 0);
      setStartDate(new Date(d));
      setEndDate(new Date(d));
      setAllDay(true);
      setSelectedGroups([]);
      setSelectedColor("#395fa5ff");
    }
    setEditing(null);
    setShowGroupSelector(false);
  }, [visible, editMode, eventToEdit, defaultDate]);

  const dateItems = useMemo(() => buildDateItems(), []);

  const onToggleAllDay = () => {
    setAllDay((prev) => {
      const next = !prev;
      if (next) {
        // ON으로 전환: 시간 제거
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(0, 0, 0, 0);
        setStartDate(s);
        setEndDate(e);
      } else {
        // OFF로 전환: 기본 시간 0:00 / 23:59
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 0, 0);
        setStartDate(s);
        setEndDate(e);
      }
      return next;
    });
  };

  const toggleEditing = (which) => {
    setEditing((cur) => (cur === which ? null : which));
  };

  // 시작/종료 날짜를 터치해서 휠이 펼쳐지면 그 영역이 보이도록 스크롤
  useEffect(() => {
    if (!editing) return;
    // 렌더 끝난 다음에 측정된 위치로 스크롤
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(pickerYRef.current - 12, 0),
        animated: true,
      });
    }, 50);
    return () => clearTimeout(id);
  }, [editing, allDay]);

  // 현재 편집 중인 날짜 객체
  const currentEditDate = editing === "start" ? startDate : endDate;
  const setCurrentEditDate = (newDate) => {
    if (editing === "start") {
      setStartDate(newDate);
      // 시작이 종료보다 늦어지면 종료도 같이 밀어줌
      if (newDate > endDate) {
        // allDay인지 OFF인지에 따라 시간 처리
        setEndDate(new Date(newDate));
      }
    } else if (editing === "end") {
      setEndDate(newDate);
      if (newDate < startDate) {
        setStartDate(new Date(newDate));
      }
    }
  };

  // 하루종일 ON: 년/월/일 휠 데이터
  const editYear = currentEditDate.getFullYear();
  const editMonth = currentEditDate.getMonth() + 1; // 1..12
  const dayItems = useMemo(
    () => buildDayItems(editYear, editMonth),
    [editYear, editMonth]
  );

  // 휠에서 년/월/일 변경 시
  const onYearChange = (idx) => {
    const newYear = YEAR_ITEMS[idx].value;
    const d = new Date(currentEditDate);
    d.setFullYear(newYear);
    // 일자 보정 (예: 윤년 → 평년 2/29)
    const maxDay = daysInMonth(newYear, d.getMonth() + 1);
    if (d.getDate() > maxDay) d.setDate(maxDay);
    setCurrentEditDate(d);
  };
  const onMonthChange = (idx) => {
    const newMonth = MONTH_ITEMS[idx].value;
    const d = new Date(currentEditDate);
    d.setMonth(newMonth - 1);
    const maxDay = daysInMonth(d.getFullYear(), newMonth);
    if (d.getDate() > maxDay) d.setDate(maxDay);
    setCurrentEditDate(d);
  };
  const onDayChange = (idx) => {
    const newDay = dayItems[idx].value;
    const d = new Date(currentEditDate);
    d.setDate(newDay);
    setCurrentEditDate(d);
  };

  // 하루종일 OFF: 날짜/시/분 휠 데이터
  const currentDateKey = dateKey(currentEditDate);
  const dateIndex = useMemo(() => {
    const idx = dateItems.findIndex((it) => it.value === currentDateKey);
    return idx >= 0 ? idx : DATE_RANGE_DAYS; // 오늘 위치
  }, [dateItems, currentDateKey]);

  const onDateOffsetChange = (idx) => {
    const picked = dateItems[idx];
    if (!picked) return;
    const [y, m, day] = picked.value.split("-").map(Number);
    const d = new Date(currentEditDate);
    d.setFullYear(y);
    d.setMonth(m - 1);
    d.setDate(day);
    setCurrentEditDate(d);
  };
  const onHourChange = (idx) => {
    const d = new Date(currentEditDate);
    d.setHours(idx);
    setCurrentEditDate(d);
  };
  const onMinuteChange = (idx) => {
    const d = new Date(currentEditDate);
    d.setMinutes(idx);
    setCurrentEditDate(d);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("오류", "제목을 입력해주세요");
      return;
    }

    // 시간 검증 (하루종일 OFF, 같은 날일 때 시작 > 종료 방지)
    if (!allDay) {
      if (endDate < startDate) {
        Alert.alert("오류", "종료 시각이 시작보다 빨라요");
        return;
      }
    }

    const payload = {
      ...(editMode && eventToEdit ? { id: eventToEdit.id } : {}),
      title: title.trim(),
      date: dateKey(startDate),
      endDate: dateKey(endDate),
      dotColor: selectedColor,
      allDay,
      startTime: allDay ? null : formatTimeDisplay(startDate),
      endTime: allDay ? null : formatTimeDisplay(endDate),
      alsoShare: false,
    };

    if (!isShared) {
      payload.groupCalendarIds = selectedGroups;
    }

    onSave(payload);
    onClose();
  };

  const handleDelete = () => {
    if (!editMode || !eventToEdit?.id || !onDelete) return;
    const confirmDelete = () => {
      onDelete(eventToEdit.id);
      onClose();
    };
    if (Platform.OS === "web") {
      if (window.confirm("정말 삭제하시겠습니까?")) confirmDelete();
      return;
    }
    Alert.alert("일정 삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: confirmDelete },
    ]);
  };

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // ─────────────────────────────────────────────────
  // 날짜 줄 한쪽 (시작 또는 종료)
  // ─────────────────────────────────────────────────
  const DateChunk = ({ which }) => {
    const d = which === "start" ? startDate : endDate;
    const active = editing === which;
    const labelStyle = {
      color: palette.text,
      fontSize: 16,
      fontWeight: active ? "700" : "400",
      opacity: active ? 1 : 0.7,
    };
    return (
      <TouchableOpacity
        onPress={() => toggleEditing(which)}
        style={{ flex: 1, paddingVertical: 4 }}
        activeOpacity={0.7}
      >
        <Text style={labelStyle}>{formatDateDisplay(d)}</Text>
        {!allDay && (
          <Text
            style={{
              color: palette.text,
              fontSize: 20,
              fontWeight: active ? "700" : "500",
              opacity: active ? 1 : 0.85,
              marginTop: 2,
            }}
          >
            {formatTimeDisplay(d)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────
  // 휠 피커 영역
  // ─────────────────────────────────────────────────
  const PickerArea = () => {
    if (!editing) return null;

    const wheelText = palette.text;

    if (allDay) {
      const yearIdx = YEAR_ITEMS.findIndex(
        (it) => it.value === currentEditDate.getFullYear()
      );
      const monthIdx = currentEditDate.getMonth(); // 0-based, MONTH_ITEMS도 0..11 위치
      const dayIdx = currentEditDate.getDate() - 1;

      return (
        <View
          style={{
            flexDirection: "row",
            marginTop: 8,
            marginBottom: 16,
            paddingHorizontal: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <WheelPicker
              items={YEAR_ITEMS}
              selectedIndex={Math.max(0, yearIdx)}
              onChange={onYearChange}
              textColor={wheelText}
              highlightColor={palette.wheelHighlight}
            />
          </View>
          <View style={{ flex: 1 }}>
            <WheelPicker
              items={MONTH_ITEMS}
              selectedIndex={monthIdx}
              onChange={onMonthChange}
              textColor={wheelText}
              highlightColor={palette.wheelHighlight}
            />
          </View>
          <View style={{ flex: 1 }}>
            <WheelPicker
              items={dayItems}
              selectedIndex={Math.min(dayIdx, dayItems.length - 1)}
              onChange={onDayChange}
              textColor={wheelText}
              highlightColor={palette.wheelHighlight}
            />
          </View>
        </View>
      );
    }

    // 하루종일 OFF: 날짜 / 시 / 분
    return (
      <View
        style={{
          flexDirection: "row",
          marginTop: 8,
          marginBottom: 16,
          paddingHorizontal: 8,
        }}
      >
        <View style={{ flex: 2 }}>
          <WheelPicker
            items={dateItems}
            selectedIndex={dateIndex}
            onChange={onDateOffsetChange}
            textColor={wheelText}
            highlightColor={palette.wheelHighlight}
            fontSize={16}
            selectedFontSize={17}
          />
        </View>
        <View style={{ flex: 1 }}>
          <WheelPicker
            items={HOUR_ITEMS}
            selectedIndex={currentEditDate.getHours()}
            onChange={onHourChange}
            textColor={wheelText}
            highlightColor={palette.wheelHighlight}
          />
        </View>
        <View style={{ flex: 1 }}>
          <WheelPicker
            items={MINUTE_ITEMS}
            selectedIndex={currentEditDate.getMinutes()}
            onChange={onMinuteChange}
            textColor={wheelText}
            highlightColor={palette.wheelHighlight}
          />
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        {/* 바깥 영역 탭 → 닫기 */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 20,
            maxHeight: "92%",
          }}
        >
          {/* 드래그 핸들 */}
          <View style={{ alignItems: "center", marginBottom: 6 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette.handle,
              }}
            />
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* 헤더 */}
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: palette.text,
                marginBottom: 12,
              }}
            >
              {editMode ? "일정 수정" : "일정 추가"}
            </Text>

            {/* 제목 입력 */}
            <TextInput
              placeholder="제목"
              placeholderTextColor={palette.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                fontSize: 22,
                fontWeight: "600",
                color: palette.text,
                paddingVertical: 8,
                marginBottom: 12,
              }}
            />

            {/* 날짜 + 하루종일 줄 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
              }}
            >
              <MaterialIcons
                name="schedule"
                size={20}
                color={palette.label}
                style={{ marginRight: 10 }}
              />
              <DateChunk which="start" />
              <Text
                style={{
                  fontSize: 16,
                  color: palette.text,
                  opacity: 0.5,
                  marginHorizontal: 4,
                }}
              >
                {">"}
              </Text>
              <DateChunk which="end" />
              <TouchableOpacity
                onPress={onToggleAllDay}
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: allDay ? palette.pillBg : "transparent",
                  borderWidth: 1,
                  borderColor: allDay ? palette.pillBg : palette.pillBorderOff,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: allDay ? palette.pillText : palette.label,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  하루종일
                </Text>
              </TouchableOpacity>
            </View>

            {/* 휠 피커 (시작/종료를 탭해야 펼쳐짐) */}
            <View
              onLayout={(e) => {
                pickerYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <PickerArea />
            </View>

            {/* 색상 */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                marginBottom: 10,
                marginTop: 4,
                color: palette.label,
                letterSpacing: 0.3,
              }}
            >
              일정 색상
            </Text>
            <View
              style={{
                flexDirection: "row",
                marginBottom: 18,
                gap: 10,
              }}
            >
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  onPress={() => setSelectedColor(color.value)}
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: color.value,
                    borderRadius: 17,
                    borderWidth: selectedColor === color.value ? 2.5 : 1,
                    borderColor:
                      selectedColor === color.value
                        ? palette.text
                        : palette.border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {selectedColor === color.value && (
                    <MaterialIcons
                      name="check"
                      size={16}
                      color={
                        color.value === "#fbc02d" ||
                        color.value === "#66bb6a" ||
                        color.value === "#bdbdbd"
                          ? "#000"
                          : "#fff"
                      }
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* 일정 공유 (개인 달력에서만) */}
            {!isShared && (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    marginBottom: 10,
                    color: palette.label,
                    letterSpacing: 0.3,
                  }}
                >
                  일정 공유
                </Text>

                <TouchableOpacity
                  onPress={() => setShowGroupSelector(!showGroupSelector)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                    backgroundColor: palette.field,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        selectedGroups.length > 0
                          ? palette.text
                          : palette.muted,
                    }}
                  >
                    {selectedGroups.length > 0
                      ? `${selectedGroups.length}개 방 선택`
                      : "공유할 방 선택"}
                  </Text>
                  <MaterialIcons
                    name={showGroupSelector ? "expand-less" : "expand-more"}
                    size={20}
                    color={palette.label}
                  />
                </TouchableOpacity>

                {showGroupSelector && (
                  <View style={{ marginBottom: 12 }}>
                    {loadingGroups ? (
                      <Text
                        style={{
                          color: palette.label,
                          textAlign: "center",
                          paddingVertical: 16,
                        }}
                      >
                        로드 중...
                      </Text>
                    ) : groupCalendars.length === 0 ? (
                      <Text
                        style={{
                          color: palette.muted,
                          textAlign: "center",
                          paddingVertical: 16,
                        }}
                      >
                        공유 방이 없습니다
                      </Text>
                    ) : (
                      groupCalendars.map((group) => (
                        <TouchableOpacity
                          key={group.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 12,
                            marginBottom: 8,
                            backgroundColor: selectedGroups.includes(group.id)
                              ? palette.selectedBg
                              : palette.field,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: selectedGroups.includes(group.id)
                              ? palette.selectedBorder
                              : palette.border,
                          }}
                          onPress={() => toggleGroupSelection(group.id)}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderWidth: 2,
                              borderColor: colors.tint,
                              borderRadius: 4,
                              justifyContent: "center",
                              alignItems: "center",
                              marginRight: 10,
                              backgroundColor: selectedGroups.includes(group.id)
                                ? colors.tint
                                : "transparent",
                            }}
                          >
                            {selectedGroups.includes(group.id) && (
                              <MaterialIcons
                                name="check"
                                size={14}
                                color="#fff"
                              />
                            )}
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              color: palette.text,
                            }}
                          >
                            {group.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* 하단 액션 버튼 (시트 안쪽 고정) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              marginTop: 4,
            }}
          >
            {editMode && onDelete ? (
              <Button
                title="삭제"
                variant="danger"
                size="sm"
                onPress={handleDelete}
              />
            ) : (
              <View />
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title="취소"
                variant="ghost"
                size="sm"
                onPress={onClose}
              />
              <Button
                title={editMode ? "수정" : "저장"}
                variant="primary"
                size="sm"
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default EventModal;
