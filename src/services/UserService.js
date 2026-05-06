import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export class UserService {
  static db = getFirestore();
  static auth = getAuth();

  /**
   * 6자리 랜덤 SC ID 생성 (중복 체크 포함)
   * @returns {Promise<string>} 고유한 6자리 코드
   */
  static async generateUniqueScId() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 가능한 문자 제외 (I, O, 0, 1)
    const length = 6;
    let scId = "";
    let isUnique = false;

    while (!isUnique) {
      scId = "";
      for (let i = 0; i < length; i++) {
        scId += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      // 중복 체크
      const usersRef = collection(this.db, "users");
      const q = query(usersRef, where("scId", "==", scId));
      const querySnapshot = await getDocs(q);
      isUnique = querySnapshot.empty;
    }

    return scId;
  }

  /**
   * SC ID로 사용자 검색
   * @param {string} scId - 검색할 SC ID
   * @returns {Promise<object|null>} 사용자 프로필 또는 null
   */
  static async findUserByScId(scId) {
    try {
      const usersRef = collection(this.db, "users");
      const q = query(usersRef, where("scId", "==", scId.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return {
          id: userDoc.id,
          ...userDoc.data(),
        };
      }
      return null;
    } catch (error) {
      console.error("UserService.findUserByScId error:", error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 생성 또는 업데이트
   * @param {string} userId - Firebase Auth UID
   * @param {string} displayName - 사용자가 설정한 이름
   */
  static async createOrUpdateUserProfile(userId, displayName = "") {
    try {
      const userRef = doc(this.db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // displayName만 업데이트
        if (displayName) {
          await updateDoc(userRef, { displayName });
        }
      } else {
        // 새로운 사용자 프로필 생성 - 짧은 SC ID 생성
        const scId = await this.generateUniqueScId();
        await setDoc(userRef, {
          displayName: displayName || "",
          scId: scId, // 6자리 랜덤 코드
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("UserService.createOrUpdateUserProfile error:", error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 조회
   * @param {string} userId
   */
  static async getUserProfile(userId) {
    try {
      const userRef = doc(this.db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data(),
        };
      }
      return null;
    } catch (error) {
      console.error("UserService.getUserProfile error:", error);
      throw error;
    }
  }

  /**
   * 현재 사용자 프로필
   */
  static async getCurrentUserProfile() {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return null;

    return this.getUserProfile(currentUser.uid);
  }

  /**
   * displayName 업데이트
   */
  static async updateDisplayName(userId, displayName) {
    try {
      const userRef = doc(this.db, "users", userId);
      await updateDoc(userRef, { displayName });
    } catch (error) {
      console.error("UserService.updateDisplayName error:", error);
      throw error;
    }
  }

  /**
   * SC ID 업데이트 (마이그레이션용)
   * @param {string} userId - Firebase Auth UID
   * @param {string} newScId - 새로운 SC ID
   */
  static async updateScId(userId, newScId) {
    try {
      const userRef = doc(this.db, "users", userId);
      await updateDoc(userRef, { scId: newScId });
    } catch (error) {
      console.error("UserService.updateScId error:", error);
      throw error;
    }
  }
}

export default UserService;
