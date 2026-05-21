import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import Button from "./Button";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { GroupCalendarService } from "../services/GroupCalendarService";
import { useTheme } from "../context/ThemeContext";

const COLOR_OPTIONS = [
  { name: "기본", value: "#395fa5ff" },
  { name: "빨간색", value: "#da4a47ff" },
  { name: "노란색", value: "#fbc02d" },
  { name: "초록색", value: "#66bb6a" },
  { name: "검정색", value: "#424242" },
  { name: "회색", value: "#bdbdbd" },
];

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
  // 다크모드에서 배경(#17181b)보다 단계적으로 밝아지는 표면 색
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
  };

  const [title, setTitle] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groupCalendars, setGroupCalendars] = useState([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#395fa5ff");

  const parseDefault = (d) => {
    if (!d) return new Date();
    const maybe = new Date(d);
    if (maybe instanceof Date && !isNaN(maybe)) return maybe;
    const withTime = new Date(d + "T00:00:00");
    return withTime;
  };

  const [startDate, setStartDate] = useState(parseDefault(defaultDate));
  const [endDate, setEndDate] = useState(parseDefault(defaultDate));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

  useEffect(() => {
    const defaultDt = parseDefault(defaultDate);
    setStartDate(defaultDt);
    setEndDate(defaultDt);
  }, [defaultDate]);

  // 편집 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (visible && editMode && eventToEdit) {
      setTitle(eventToEdit.title || "");
      setStartDate(parseDefault(eventToEdit.date));
      setEndDate(parseDefault(eventToEdit.endDate || eventToEdit.date));
      setSelectedGroups(eventToEdit.linkedGroupCalendarIds || []);
      setSelectedColor(eventToEdit.dotColor || "#395fa5ff");
    } else if (visible && !editMode) {
      // 추가 모드일 때는 초기화
      setTitle("");
      const defaultDt = parseDefault(defaultDate);
      setStartDate(defaultDt);
      setEndDate(defaultDt);
      setSelectedGroups([]);
      setSelectedColor("#395fa5ff");
    }
  }, [visible, editMode, eventToEdit, defaultDate]);

  const handleStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || startDate;
    if (currentDate instanceof Date && !isNaN(currentDate)) {
      setStartDate(currentDate);
      if (currentDate > endDate) {
        setEndDate(currentDate);
      }
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || endDate;
    if (currentDate instanceof Date && !isNaN(currentDate)) {
      setEndDate(currentDate);
      if (currentDate < startDate) {
        setStartDate(currentDate);
      }
    }
  };

  const formatDateDisplay = (date) => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("오류", "제목을 입력해주세요");
      return;
    }

    const startFormatted = startDate.toISOString().split("T")[0];
    const endFormatted = endDate.toISOString().split("T")[0];

    if (isShared) {
      // 공유 달력에 추가/수정
      onSave({
        ...(editMode && eventToEdit ? { id: eventToEdit.id } : {}),
        title: title.trim(),
        date: startFormatted,
        endDate: endFormatted,
        dotColor: selectedColor,
        alsoShare: false,
      });
    } else {
      // 개인 달력에 추가/수정 + 선택된 그룹들에 추가
      onSave({
        ...(editMode && eventToEdit ? { id: eventToEdit.id } : {}),
        title: title.trim(),
        date: startFormatted,
        endDate: endFormatted,
        dotColor: selectedColor,
        groupCalendarIds: selectedGroups,
        alsoShare: false,
      });
    }

    setTitle("");
    setStartDate(new Date());
    setEndDate(new Date());
    setShowStartPicker(false);
    setShowEndPicker(false);
    setSelectedGroups([]);
    setSelectedColor("#395fa5ff");
    onClose();
  };

  const handleDelete = () => {
    if (!editMode || !eventToEdit?.id || !onDelete) return;

    const confirmDelete = () => {
      onDelete(eventToEdit.id);
      onClose();
    };

    if (Platform.OS === "web") {
      if (window.confirm("정말 삭제하시겠습니까?")) {
        confirmDelete();
      }
      return;
    }

    Alert.alert("일정 삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: confirmDelete },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: palette.surface,
            padding: 20,
            width: "100%",
            borderRadius: 10,
            maxHeight: "90%",
          }}
        >
          <ScrollView showsVerticalScrollIndicator={true}>
            <Text
              style={{ fontSize: 20, marginBottom: 10, color: palette.text }}
            >
              {editMode ? "일정 수정" : "일정 추가"}
            </Text>

            {/* 제목 입력 */}
            <TextInput
              placeholder="일정 제목"
              placeholderTextColor={palette.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                borderWidth: 1,
                borderColor: palette.softBorder,
                padding: 10,
                marginBottom: 15,
                borderRadius: 5,
                color: palette.text,
                backgroundColor: palette.field,
              }}
            />

            {/* 날짜 범위 선택 */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "bold",
                marginBottom: 10,
                color: palette.text,
              }}
            >
              날짜 선택
            </Text>

            {/* 날짜 범위 표시 및 선택 버튼 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 15,
                backgroundColor: palette.field,
                padding: 12,
                borderRadius: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowStartPicker(!showStartPicker)}
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: palette.innerCard,
                  borderRadius: 5,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color: palette.text,
                  }}
                >
                  {formatDateDisplay(startDate)}
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  marginHorizontal: 8,
                  color: palette.text,
                }}
              >
                &gt;
              </Text>

              <TouchableOpacity
                onPress={() => setShowEndPicker(!showEndPicker)}
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: palette.innerCard,
                  borderRadius: 5,
                  marginLeft: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color: palette.text,
                  }}
                >
                  {formatDateDisplay(endDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 시작 날짜 선택 피커 */}
            {showStartPicker && (
              <View style={{ marginBottom: 15 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.label,
                    marginBottom: 8,
                  }}
                >
                  시작 날짜
                </Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={startDate.toISOString().split("T")[0]}
                    onChange={(e) => {
                      const picked = new Date(e.target.value);
                      if (picked instanceof Date && !isNaN(picked)) {
                        handleStartDateChange(null, picked);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 5,
                      border: `1px solid ${palette.softBorder}`,
                      boxSizing: "border-box",
                      maxWidth: "100%",
                      backgroundColor: palette.field,
                      color: palette.text,
                      colorScheme: isDark ? "dark" : "light",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      ...(Platform.OS === "ios" ? { height: 200 } : {}),
                    }}
                  >
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleStartDateChange}
                      textColor={palette.text}
                    />
                  </View>
                )}
              </View>
            )}

            {/* 종료 날짜 선택 피커 */}
            {showEndPicker && (
              <View style={{ marginBottom: 15 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.label,
                    marginBottom: 8,
                  }}
                >
                  종료 날짜
                </Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={endDate.toISOString().split("T")[0]}
                    onChange={(e) => {
                      const picked = new Date(e.target.value);
                      if (picked instanceof Date && !isNaN(picked)) {
                        handleEndDateChange(null, picked);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 5,
                      border: `1px solid ${palette.softBorder}`,
                      boxSizing: "border-box",
                      maxWidth: "100%",
                      backgroundColor: palette.field,
                      color: palette.text,
                      colorScheme: isDark ? "dark" : "light",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      ...(Platform.OS === "ios" ? { height: 200 } : {}),
                    }}
                  >
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleEndDateChange}
                      textColor={palette.text}
                    />
                  </View>
                )}
              </View>
            )}

            {/* 점 색상 선택 */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "bold",
                marginBottom: 10,
                color: palette.text,
              }}
            >
              일정 색상
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-start",
                marginBottom: 15,
                gap: 8,
              }}
            >
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  onPress={() => setSelectedColor(color.value)}
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: color.value,
                    borderRadius: 16,
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

            {/* 공유 방 선택 (개인 달력에서만) */}
            {!isShared && (
              <>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "bold",
                    marginBottom: 10,
                    color: palette.text,
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
                    marginBottom: 15,
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

                {/* 그룹 선택 목록 */}
                {showGroupSelector && (
                  <View style={{ marginBottom: 15 }}>
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

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default EventModal;
