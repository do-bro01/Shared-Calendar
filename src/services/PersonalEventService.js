import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export class PersonalEventService {
  static db = getFirestore();
  static auth = getAuth();

  /**
   * 개인 일정 추가
   */
  static async addPersonalEvent({
    title,
    date,
    endDate,
    linkedGroupEventIds = [],
    dotColor = "#395fa5ff",
  }) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const eventsRef = collection(this.db, "personalEvents");
      const docRef = await addDoc(eventsRef, {
        title,
        date,
        endDate: endDate || date,
        userId: currentUser.uid,
        linkedGroupEventIds,
        dotColor,
        createdAt: new Date(),
      });

      return docRef.id;
    } catch (error) {
      console.error("PersonalEventService.addPersonalEvent error:", error);
      throw error;
    }
  }

  /**
   * 개인 일정 수정
   */
  static async updatePersonalEvent(
    eventId,
    { title, date, endDate, dotColor }
  ) {
    try {
      const { updateDoc } = await import("firebase/firestore");
      const eventRef = doc(this.db, "personalEvents", eventId);
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
      console.error("PersonalEventService.updatePersonalEvent error:", error);
      throw error;
    }
  }

  /**
   * 개인 일정 삭제 (연결된 그룹 일정도 함께 삭제)
   * @param {string} eventId - 삭제할 일정 ID
   * @param {boolean} skipCascade - true면 연결된 그룹 일정 삭제 건너뛰기
   */
  static async deletePersonalEvent(eventId, skipCascade = false) {
    try {
      const eventRef = doc(this.db, "personalEvents", eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists() && !skipCascade) {
        const eventData = eventSnap.data();

        // 연결된 그룹 일정들 삭제 (cascade 플래그 전달)
        if (
          eventData.linkedGroupEventIds &&
          eventData.linkedGroupEventIds.length > 0
        ) {
          const { GroupEventService } = await import("./GroupEventService");
          for (const groupEventId of eventData.linkedGroupEventIds) {
            try {
              await GroupEventService.deleteGroupEvent(groupEventId, true);
            } catch (error) {
              console.error(
                `Error deleting linked group event ${groupEventId}:`,
                error
              );
            }
          }
        }
      }

      await deleteDoc(eventRef);
    } catch (error) {
      console.error("PersonalEventService.deletePersonalEvent error:", error);
      throw error;
    }
  }

  /**
   * 개인 일정 실시간 구독
   */
  static listenPersonalEvents(callback) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const eventsRef = collection(this.db, "personalEvents");
      const q = query(eventsRef, where("userId", "==", currentUser.uid));

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
      console.error("PersonalEventService.listenPersonalEvents error:", error);
      throw error;
    }
  }
}

export default PersonalEventService;
