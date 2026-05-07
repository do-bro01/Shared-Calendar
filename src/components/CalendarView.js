// SC/src/components/CalendarView.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { MaterialIcons } from "@expo/vector-icons";
import EventModal from "./EventModal";
import Button from "./Button";
import { useTheme } from "../context/ThemeContext";

export default function CalendarView({
  selectedDate,
  events,
  onSelectDate,
  onAddEvent,
  isShared = false,
  title = "캘린더",
  onDeleteEvent,
  onEditEvent,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const theme = useTheme();
  const colors = theme?.colors || { tint: "#395fa5ff" };

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

    // 시작일 빠른 순, 같으면 긴 일정 먼저 (lane 안정적 배치)
    const sorted = [...events].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aEnd = a.endDate || a.date;
      const bEnd = b.endDate || b.date;
      return bEnd.localeCompare(aEnd);
    });

    // lane[i] = 그 lane에서 마지막 일정의 종료일
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

    // 각 날짜에 lane 수만큼 슬롯 만들고, 해당 lane에 period 배치
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

    // 빈 lane은 투명 placeholder로 채워 lane 정렬 유지
    for (const date in marked) {
      marked[date].periods = marked[date].periods.map(
        (p) => p || { color: "transparent" }
      );
    }

    // 선택된 날짜
    if (!marked[selectedDate]) {
      marked[selectedDate] = { selected: true, selectedColor: colors.tint };
    } else {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = colors.tint;
    }

    return marked;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text
        style={[
          isShared ? styles.headerTitleShared : styles.headerTitle,
          { color: theme.mode === "dark" ? "#ffffff" : "#000000" },
        ]}
      >
        {title}
      </Text>
      <View
        style={[
          styles.calendarWrapper,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Calendar
          key={theme.mode}
          onDayPress={(day) => onSelectDate(day.dateString)}
          markingType={"multi-period"}
          markedDates={getMarkedDates()}
          theme={{
            calendarBackground:
              theme.mode === "dark" ? theme.colors.background : "#ffffff",
            monthTextColor: theme.mode === "dark" ? "#ffffff" : "#000000",
            textSectionTitleColor:
              theme.mode === "dark" ? "#ffffff" : "#000000",
            textDayColor: theme.colors.text,
            selectedDayBackgroundColor: colors.tint,
            selectedDayTextColor: "#fff",
            todayTextColor: colors.tint,
            todayBackgroundColor: "transparent",
            arrowColor: colors.tint,
            textMonthFontSize: 18,
            textMonthFontWeight: "700",
            textDayFontWeight: "500",
            textDayHeaderFontWeight: "600",
            textDayHeaderFontSize: 12,
          }}
        />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        🗓️ {selectedDate} 일정
      </Text>

      <ScrollView
        style={[styles.eventList, { backgroundColor: theme.colors.background }]}
      >
        {events.filter((ev) => {
          // 선택된 날짜가 일정의 시작일과 종료일 사이에 있는지 확인 (문자열 비교)
          const startDate = ev.date;
          const endDate = ev.endDate || ev.date;
          return selectedDate >= startDate && selectedDate <= endDate;
        }).length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="event-available"
              size={40}
              color={theme.colors.text}
              style={{ opacity: 0.3 }}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              일정 없음
            </Text>
            <Text style={[styles.emptyHint, { color: theme.colors.text }]}>
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
              // 날짜 포맷팅
              const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return `${month}월${day}일`;
              };

              const dateText =
                ev.endDate && ev.endDate !== ev.date
                  ? `${formatDate(ev.date)}~${formatDate(ev.endDate)}`
                  : formatDate(ev.date);

              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[
                    styles.eventItem,
                    {
                      backgroundColor: theme.mode === "dark" ? "#222431ff" : "#EEE",
                    },
                  ]}
                  onPress={() => handleEventPress(ev)}
                >
                  <View style={styles.eventContent}>
                    <Text
                      style={[
                        styles.eventText,
                        {
                          color: ev.isHoliday ? "#e53935" : theme.colors.text,
                          fontWeight: ev.isHoliday ? "700" : "400",
                        },
                      ]}
                    >
                      • {ev.title}
                    </Text>
                    <Text
                      style={[
                        styles.eventDate,
                        {
                          color: theme.colors.text,
                          opacity: ev.isHoliday ? 0.9 : 0.7,
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
      </ScrollView>

      {/* 일정 추가 버튼 */}
      <View style={styles.addButtonWrapper}>
        <Button
          title="일정 추가"
          variant="primary"
          size="lg"
          onPress={() => setModalVisible(true)}
          icon={<MaterialIcons name="add" size={18} color="#fff" />}
          fullWidth
        />
      </View>

      {/* Event Modal */}
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
    padding: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 16,
    marginTop: 8,
    textAlign: "center",
    alignSelf: "stretch",
    height: 40,
    lineHeight: 40,
  },
  headerTitleShared: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: -20,
    marginTop: 0,
    textAlign: "center",
    alignSelf: "stretch",
    height: 40,
    lineHeight: 40,
  },
  title: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: "bold",
    paddingLeft: 8,
  },
  calendarWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  eventList: {
    flex: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  noEvent: {
    fontSize: 16,
    color: "#666",
    marginTop: 20,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.6,
  },
  emptyHint: {
    fontSize: 13,
    opacity: 0.4,
  },
  eventItem: {
    padding: 14,
    backgroundColor: "#EEE",
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  eventContent: {
    flex: 1,
  },
  eventText: {
    fontSize: 16,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  addButtonWrapper: {
    marginTop: 0,
    marginBottom: 110,
    marginHorizontal: 30,
  },
});
