import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export class GroupEventService {
  static db = getFirestore();
  static auth = getAuth();

  /**
   * 단체 달력에 이벤트 추가
   * @param {object} event - { title, date, endDate, groupCalendarId, linkedPersonalEventId, dotColor }
   */
  static async addEventToGroup(event) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const eventsRef = collection(this.db, "groupEvents");
      const newEvent = {
        ...event,
        userId: currentUser.uid,
        linkedPersonalEventId: event.linkedPersonalEventId || null,
        dotColor: event.dotColor || "#395fa5ff",
        createdAt: new Date(),
      };

      const docRef = await addDoc(eventsRef, newEvent);
      return docRef.id;
    } catch (error) {
      console.error("GroupEventService.addEventToGroup error:", error);
      throw error;
    }
  }

  /**
   * 특정 단체 달력의 특정 날짜 이벤트 조회
   */
  static async getGroupEvents(groupCalendarId, date) {
    try {
      const eventsRef = collection(this.db, "groupEvents");
      const q = query(
        eventsRef,
        where("groupCalendarId", "==", groupCalendarId),
        where("date", "==", date)
      );

      const snapshot = await getDocs(q);
      const events = [];

      snapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return events;
    } catch (error) {
      console.error("GroupEventService.getGroupEvents error:", error);
      throw error;
    }
  }

  /**
   * 특정 단체 달력의 모든 이벤트 실시간 리스너
   */
  static listenGroupEvents(groupCalendarId, callback) {
    try {
      const eventsRef = collection(this.db, "groupEvents");
      const q = query(
        eventsRef,
        where("groupCalendarId", "==", groupCalendarId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = [];

        snapshot.forEach((doc) => {
          events.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        callback(events);
      });

      return unsubscribe;
    } catch (error) {
      console.error("GroupEventService.listenGroupEvents error:", error);
      return () => {};
    }
  }

  /**
   * 그룹 일정 조회
   */
  static async getGroupEvent(eventId) {
    try {
      const eventRef = doc(this.db, "groupEvents", eventId);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        return { id: eventSnap.id, ...eventSnap.data() };
      }
      return null;
    } catch (error) {
      console.error("GroupEventService.getGroupEvent error:", error);
      throw error;
    }
  }

  /**
   * 그룹 일정 수정
   */
  static async updateGroupEvent(eventId, { title, date, endDate, dotColor }) {
    try {
      const eventRef = doc(this.db, "groupEvents", eventId);
      const updateData = {
        title,
        date,
        endDate: endDate || date,
        updatedAt: new Date(),
      };

      if (dotColor) {
        updateData.dotColor = dotColor;
      }

      await updateDoc(eventRef, updateData);
    } catch (error) {
      console.error("GroupEventService.updateGroupEvent error:", error);
      throw error;
    }
  }

  /**
   * 그룹 일정 삭제 (연결된 개인 일정도 함께 삭제)
   * @param {string} eventId - 삭제할 일정 ID
   * @param {boolean} skipCascade - true면 연결된 개인 일정 삭제 건너뛰기
   */
  static async deleteGroupEvent(eventId, skipCascade = false) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const eventRef = doc(this.db, "groupEvents", eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists() && !skipCascade) {
        const eventData = eventSnap.data();

        // 연결된 개인 일정 삭제 (cascade 플래그 전달)
        if (eventData.linkedPersonalEventId) {
          try {
            const { PersonalEventService } = await import(
              "./PersonalEventService"
            );
            await PersonalEventService.deletePersonalEvent(
              eventData.linkedPersonalEventId,
              true
            );
          } catch (error) {
            console.error(`Error deleting linked personal event:`, error);
          }
        }
      }

      await deleteDoc(eventRef);
    } catch (error) {
      console.error("GroupEventService.deleteGroupEvent error:", error);
      throw error;
    }
  }
}

export default GroupEventService;
