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
import EventModal from "./EventModal";
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
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    };
    const dateText =
      event.endDate && event.endDate !== event.date
        ? `${formatDate(event.date)} ~ ${formatDate(event.endDate)}`
        : formatDate(event.date);

    if (event.isHoliday) {
      Alert.alert(event.title, dateText, [{ text: "확인", style: "cancel" }]);
      return;
    }

    Alert.alert(event.title, dateText, [
      { text: "취소", style: "cancel" },
      {
        text: "수정",
        onPress: () => {
          setEditingEvent(event);
          setModalVisible(true);
        },
      },
      {
        text: "삭제",
        onPress: () => handleDeleteConfirm(event.id),
        style: "destructive",
      },
    ]);
  };

  const handleDeleteConfirm = (eventId) => {
    Alert.alert("일정 삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", onPress: () => {}, style: "cancel" },
      {
        text: "삭제",
        onPress: () => {
          onDeleteEvent && onDeleteEvent(eventId);
        },
        style: "destructive",
      },
    ]);
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

  // markedDates 생성
  const getMarkedDates = () => {
    const marked = {};

    events.forEach((ev) => {
      const startDate = ev.date;
      const endDate = ev.endDate || ev.date;
      const dateRange = getDateRange(startDate, endDate);

      // 각 날짜마다 점 표시
      dateRange.forEach((date) => {
        const isSelected = date === selectedDate;

        // 기존 마킹이 있으면 병합
        if (!marked[date]) {
          marked[date] = {
            dots: [],
          };
        }

        // 점 추가
        if (!marked[date].dots) {
          marked[date].dots = [];
        }

        // 일정마다 점 추가 (일정 개수만큼 점 표시)
        marked[date].dots.push({
          color: ev.isHoliday ? "#e53935" : ev.dotColor || colors.tint,
        });

        // 선택된 날짜 표시
        if (isSelected) {
          marked[date].selected = true;
          marked[date].selectedColor = colors.tint;
        }
      });
    });

    // 선택된 날짜가 일정이 없으면 추가
    if (!marked[selectedDate]) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: colors.tint,
      };
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
          markingType={"multi-dot"}
          markedDates={getMarkedDates()}
          theme={{
            // calendar background: only apply dark-mode background, keep white in light mode
            calendarBackground:
              theme.mode === "dark" ? theme.colors.background : "#ffffff",
            // month title (e.g. "December 2025")
            monthTextColor: theme.mode === "dark" ? "#ffffff" : "#000000",
            // weekday labels (Mon, Tue...)
            textSectionTitleColor:
              theme.mode === "dark" ? "#ffffff" : "#000000",
            // keep day numbers using theme text color (for contrast)
            textDayColor: theme.colors.text,
            selectedDayBackgroundColor: colors.tint,
            selectedDayTextColor: "#fff",
            todayTextColor: colors.tint,
            todayBackgroundColor: "transparent",
            // arrow colors for month navigation
            arrowColor: "#395fa5ff",
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
          <Text style={[styles.noEvent, { color: theme.colors.text }]}>
            일정 없음
          </Text>
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
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.tint }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>일정 추가</Text>
      </TouchableOpacity>

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
            // 수정 모드
            onEditEvent && onEditEvent(data);
          } else {
            // 추가 모드
            onAddEvent(data);
          }
          setModalVisible(false);
          setEditingEvent(null);
        }}
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
  eventItem: {
    padding: 12,
    backgroundColor: "#EEE",
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  addButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 0,
    marginBottom: 110,
    marginHorizontal: 30,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
