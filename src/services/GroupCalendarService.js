import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export class GroupCalendarService {
  static db = getFirestore();
  static auth = getAuth();

  /**
   * 새로운 단체 달력 생성
   * @param {string} name - 달력방 이름
   * @param {string[]} memberIds - 초대할 멤버 ID 배열 (생성자 자신 포함)
   */
  static async createGroupCalendar(name, memberIds = []) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      // 생성자도 멤버에 포함
      const members = Array.from(new Set([currentUser.uid, ...memberIds]));

      const groupsRef = collection(this.db, "groupCalendars");
      const newGroupRef = doc(groupsRef);

      await setDoc(newGroupRef, {
        name,
        members,
        createdBy: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return newGroupRef.id;
    } catch (error) {
      console.error("GroupCalendarService.createGroupCalendar error:", error);
      throw error;
    }
  }

  /**
   * 단체 달력 정보 조회
   */
  static async getGroupCalendar(groupId) {
    try {
      const groupRef = doc(this.db, "groupCalendars", groupId);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        return {
          id: groupSnap.id,
          ...groupSnap.data(),
        };
      }
      return null;
    } catch (error) {
      console.error("GroupCalendarService.getGroupCalendar error:", error);
      throw error;
    }
  }

  /**
   * 현재 사용자가 속한 단체 달력 목록 조회
   */
  static async getUserGroupCalendars() {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const groupsRef = collection(this.db, "groupCalendars");
      const q = query(
        groupsRef,
        where("members", "array-contains", currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const groups = [];

      snapshot.forEach((doc) => {
        groups.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return groups;
    } catch (error) {
      console.error("GroupCalendarService.getUserGroupCalendars error:", error);
      throw error;
    }
  }

  /**
   * 현재 사용자가 속한 단체 달력 목록 실시간 리스너
   */
  static listenUserGroupCalendars(callback) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        callback([]);
        return () => {};
      }

      const groupsRef = collection(this.db, "groupCalendars");
      const q = query(
        groupsRef,
        where("members", "array-contains", currentUser.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const groups = [];

        snapshot.forEach((doc) => {
          groups.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        callback(groups);
      });

      return unsubscribe;
    } catch (error) {
      console.error(
        "GroupCalendarService.listenUserGroupCalendars error:",
        error
      );
      return () => {};
    }
  }

  /**
   * 단체 달력에 멤버 추가
   */
  static async addMember(groupId, memberId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const groupRef = doc(this.db, "groupCalendars", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) throw new Error("달력방을 찾을 수 없습니다");

      const group = groupSnap.data();
      if (!group.members.includes(currentUser.uid)) {
        throw new Error("권한이 없습니다");
      }

      await updateDoc(groupRef, {
        members: arrayUnion(memberId),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("GroupCalendarService.addMember error:", error);
      throw error;
    }
  }

  /**
   * 단체 달력에서 멤버 제거
   */
  static async removeMember(groupId, memberId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const groupRef = doc(this.db, "groupCalendars", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) throw new Error("달력방을 찾을 수 없습니다");

      const group = groupSnap.data();
      // 생성자 또는 자신만 제거 가능
      if (currentUser.uid !== group.createdBy && currentUser.uid !== memberId) {
        throw new Error("권한이 없습니다");
      }

      await updateDoc(groupRef, {
        members: arrayRemove(memberId),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("GroupCalendarService.removeMember error:", error);
      throw error;
    }
  }

  /**
   * 단체 달력 삭제 (생성자만 가능)
   */
  static async deleteGroupCalendar(groupId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const groupRef = doc(this.db, "groupCalendars", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) throw new Error("달력방을 찾을 수 없습니다");

      const group = groupSnap.data();
      if (currentUser.uid !== group.createdBy) {
        throw new Error("권한이 없습니다");
      }

      // 관련 groupEvents도 함께 삭제
      const eventsRef = collection(this.db, "groupEvents");
      const eventsQuery = query(
        eventsRef,
        where("groupCalendarId", "==", groupId)
      );
      const eventsSnapshot = await getDocs(eventsQuery);

      const deletePromises = eventsSnapshot.docs.map((eventDoc) =>
        deleteDoc(eventDoc.ref)
      );
      await Promise.all(deletePromises);

      await deleteDoc(groupRef);
    } catch (error) {
      console.error("GroupCalendarService.deleteGroupCalendar error:", error);
      throw error;
    }
  }

  /**
   * 단체 달력 이름 수정
   */
  static async updateGroupCalendarName(groupId, newName) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const groupRef = doc(this.db, "groupCalendars", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) throw new Error("달력방을 찾을 수 없습니다");

      const group = groupSnap.data();
      if (currentUser.uid !== group.createdBy) {
        throw new Error("권한이 없습니다");
      }

      await updateDoc(groupRef, {
        name: newName,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(
        "GroupCalendarService.updateGroupCalendarName error:",
        error
      );
      throw error;
    }
  }
}

export default GroupCalendarService;
