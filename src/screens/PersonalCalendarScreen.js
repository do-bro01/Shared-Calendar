import React, { useState, useEffect } from "react";
import { Alert } from "react-native";
import CalendarView from "../components/CalendarView";
import { PersonalEventService } from "../services/PersonalEventService";
import { GroupEventService } from "../services/GroupEventService";
import { getKoreanHolidaysForYear } from "../constants/koreanHolidays";

export default function PersonalCalendarScreen() {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    const unsubscribe = PersonalEventService.listenPersonalEvents(setEvents);
    return unsubscribe;
  }, []);

  const handleAddEvent = async (eventData) => {
    try {
      const linkedGroupEventIds = [];

      // 먼저 개인 일정 추가 (linkedGroupEventIds는 나중에 업데이트)
      const personalEventId = await PersonalEventService.addPersonalEvent({
        title: eventData.title,
        date: eventData.date,
        endDate: eventData.endDate || eventData.date,
        linkedGroupEventIds: [],
        dotColor: eventData.dotColor,
      });

      // 선택된 공유 캘린더들에 일정 추가하고 연결
      if (eventData.groupCalendarIds && eventData.groupCalendarIds.length > 0) {
        for (const groupId of eventData.groupCalendarIds) {
          const groupEventId = await GroupEventService.addEventToGroup({
            title: eventData.title,
            date: eventData.date,
            endDate: eventData.endDate || eventData.date,
            groupCalendarId: groupId,
            linkedPersonalEventId: personalEventId,
            dotColor: eventData.dotColor,
          });
          linkedGroupEventIds.push(groupEventId);
        }

        // 개인 일정에 연결된 그룹 일정 ID들 업데이트
        const { updateDoc, doc } = await import("firebase/firestore");
        const { getFirestore } = await import("firebase/firestore");
        const db = getFirestore();
        const personalEventRef = doc(db, "personalEvents", personalEventId);
        await updateDoc(personalEventRef, { linkedGroupEventIds });
      }

      Alert.alert("성공", "일정이 추가되었습니다");
    } catch (error) {
      console.error("Error adding event:", error);
      Alert.alert("오류", "일정 추가에 실패했습니다");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await PersonalEventService.deletePersonalEvent(eventId);
    } catch (error) {
      console.error("Error deleting event:", error);
      Alert.alert("오류", "일정 삭제에 실패했습니다");
    }
  };

  const handleEditEvent = async (eventData) => {
    try {
      const event = events.find((e) => e.id === eventData.id);
      const existingLinkedGroupEventIds = event?.linkedGroupEventIds || [];
      const newGroupCalendarIds = eventData.groupCalendarIds || [];

      // 1. 개인 일정 기본 정보 업데이트
      await PersonalEventService.updatePersonalEvent(eventData.id, {
        title: eventData.title,
        date: eventData.date,
        endDate: eventData.endDate || eventData.date,
        dotColor: eventData.dotColor,
      });

      // 2. 기존 그룹 일정들의 groupCalendarId 매핑 생성
      const existingGroupEventsMap = new Map();
      for (const groupEventId of existingLinkedGroupEventIds) {
        try {
          const groupEvent = await GroupEventService.getGroupEvent(
            groupEventId
          );
          if (groupEvent) {
            existingGroupEventsMap.set(
              groupEvent.groupCalendarId,
              groupEventId
            );
          }
        } catch (error) {
          console.error(`Error fetching group event ${groupEventId}:`, error);
        }
      }

      // 3. 새로운 linkedGroupEventIds 배열
      const updatedLinkedGroupEventIds = [];

      // 4. 각 새로운 그룹 캘린더 ID 처리
      for (const groupId of newGroupCalendarIds) {
        if (existingGroupEventsMap.has(groupId)) {
          // 이미 존재하면 업데이트
          const groupEventId = existingGroupEventsMap.get(groupId);
          await GroupEventService.updateGroupEvent(groupEventId, {
            title: eventData.title,
            date: eventData.date,
            endDate: eventData.endDate || eventData.date,
            dotColor: eventData.dotColor,
          });
          updatedLinkedGroupEventIds.push(groupEventId);
        } else {
          // 새로 추가
          const groupEventId = await GroupEventService.addEventToGroup({
            title: eventData.title,
            date: eventData.date,
            endDate: eventData.endDate || eventData.date,
            groupCalendarId: groupId,
            linkedPersonalEventId: eventData.id,
            dotColor: eventData.dotColor,
          });
          updatedLinkedGroupEventIds.push(groupEventId);
        }
      }

      // 5. 선택 해제된 그룹 일정 삭제
      for (const [groupId, groupEventId] of existingGroupEventsMap.entries()) {
        if (!newGroupCalendarIds.includes(groupId)) {
          await GroupEventService.deleteGroupEvent(groupEventId, true);
        }
      }

      // 6. 개인 일정의 linkedGroupEventIds 업데이트
      const { updateDoc, doc } = await import("firebase/firestore");
      const { getFirestore } = await import("firebase/firestore");
      const db = getFirestore();
      const personalEventRef = doc(db, "personalEvents", eventData.id);
      await updateDoc(personalEventRef, {
        linkedGroupEventIds: updatedLinkedGroupEventIds,
      });

      Alert.alert("성공", "일정이 수정되었습니다");
    } catch (error) {
      console.error("Error editing event:", error);
      Alert.alert("오류", "일정 수정에 실패했습니다");
    }
  };

  const holidays = [
    ...getKoreanHolidaysForYear(new Date().getFullYear()),
    ...getKoreanHolidaysForYear(new Date().getFullYear() + 1),
  ];

  const handleSelectDate = (date) => {
    setSelectedDate(date);
  };

  return (
    <CalendarView
      events={[...events, ...holidays]}
      selectedDate={selectedDate}
      onSelectDate={handleSelectDate}
      isShared={false}
      onAddEvent={handleAddEvent}
      onDeleteEvent={handleDeleteEvent}
      onEditEvent={handleEditEvent}
    />
  );
}
