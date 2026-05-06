import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export class FriendService {
  static db = getFirestore();
  static auth = getAuth();

  /**
   * SC ID로 친구 추가
   * @param {string} scId - 친구의 SC ID (6자리 코드)
   */
  static async addFriendByScId(scId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      // UserService를 import하여 사용
      const { UserService } = await import("./UserService");

      // SC ID로 사용자 검색
      const targetUser = await UserService.findUserByScId(scId);
      if (!targetUser) {
        throw new Error("존재하지 않는 SC ID입니다");
      }

      if (currentUser.uid === targetUser.id) {
        throw new Error("자신을 친구로 추가할 수 없습니다");
      }

      // 친구 ID 생성 (사전식 순서로: userId1 < userId2)
      const [user1, user2] = [currentUser.uid, targetUser.id].sort();
      const friendshipId = `${user1}_${user2}`;

      const friendshipRef = doc(this.db, "friendships", friendshipId);

      // 이미 친구인지 확인
      const friendshipSnap = await getDoc(friendshipRef);
      if (friendshipSnap.exists()) {
        throw new Error("이미 친구입니다");
      }

      await setDoc(friendshipRef, {
        user1,
        user2,
        requester: currentUser.uid,
        status: "active",
        createdAt: new Date(),
      });

      return targetUser; // 추가된 친구 정보 반환
    } catch (error) {
      console.error("FriendService.addFriendByScId error:", error);
      throw error;
    }
  }

  /**
   * 친구 요청 생성 (양방향 저장) - 레거시, UID 기반
   * @param {string} targetUserId - 친구 추가하려는 사용자의 UID
   */
  static async addFriend(targetUserId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      if (currentUser.uid === targetUserId) {
        throw new Error("자신을 친구로 추가할 수 없습니다");
      }

      // 친구 ID 생성 (사전식 순서로: userId1 < userId2)
      const [user1, user2] = [currentUser.uid, targetUserId].sort();
      const friendshipId = `${user1}_${user2}`;

      const friendshipRef = doc(this.db, "friendships", friendshipId);

      await setDoc(friendshipRef, {
        user1,
        user2,
        requester: currentUser.uid,
        status: "active",
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("FriendService.addFriend error:", error);
      throw error;
    }
  }

  /**
   * 친구 삭제
   */
  static async removeFriend(friendUserId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const [user1, user2] = [currentUser.uid, friendUserId].sort();
      const friendshipId = `${user1}_${user2}`;

      const friendshipRef = doc(this.db, "friendships", friendshipId);
      await deleteDoc(friendshipRef);
    } catch (error) {
      console.error("FriendService.removeFriend error:", error);
      throw error;
    }
  }

  /**
   * 친구 목록 조회 (현재 사용자의 모든 친구)
   */
  static async getFriendsList() {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error("로그인되지 않음");

      const friendshipsRef = collection(this.db, "friendships");

      // 현재 사용자가 포함된 모든 친구 관계 조회
      const q = query(friendshipsRef, where("status", "==", "active"));

      const snapshot = await getDocs(q);
      const friends = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // 현재 사용자와 관련된 친구 관계인지 확인
        if (data.user1 !== currentUser.uid && data.user2 !== currentUser.uid) {
          continue;
        }

        // 상대방의 UID 추출
        const friendUserId =
          data.user1 === currentUser.uid ? data.user2 : data.user1;

        // 상대방의 프로필 정보 가져오기
        const friendDocRef = doc(this.db, "users", friendUserId);
        const friendDocSnap = await getDoc(friendDocRef);

        if (friendDocSnap.exists()) {
          friends.push({
            friendshipId: docSnap.id,
            userId: friendUserId,
            ...friendDocSnap.data(),
          });
        }
      }

      return friends;
    } catch (error) {
      console.error("FriendService.getFriendsList error:", error);
      throw error;
    }
  }

  /**
   * 친구 목록 실시간 리스너
   */
  static listenFriendsList(callback) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        callback([]);
        return () => {};
      }

      const friendshipsRef = collection(this.db, "friendships");
      const q = query(friendshipsRef, where("status", "==", "active"));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const friends = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // 현재 사용자와 관련된 친구 관계인지 확인
          if (
            data.user1 !== currentUser.uid &&
            data.user2 !== currentUser.uid
          ) {
            continue;
          }

          const friendUserId =
            data.user1 === currentUser.uid ? data.user2 : data.user1;

          try {
            const friendDocRef = doc(this.db, "users", friendUserId);
            const friendDocSnap = await getDoc(friendDocRef);

            if (friendDocSnap.exists()) {
              friends.push({
                friendshipId: docSnap.id,
                userId: friendUserId,
                ...friendDocSnap.data(),
              });
            }
          } catch (err) {
            console.error("Error fetching friend profile:", err);
          }
        }

        callback(friends);
      });

      return unsubscribe;
    } catch (error) {
      console.error("FriendService.listenFriendsList error:", error);
      return () => {};
    }
  }

  /**
   * 특정 사용자와의 친구 관계 확인
   */
  static async isFriend(userId) {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) return false;

      const [user1, user2] = [currentUser.uid, userId].sort();
      const friendshipId = `${user1}_${user2}`;

      const friendshipRef = doc(this.db, "friendships", friendshipId);
      const friendshipSnap = await getDoc(friendshipRef);

      return (
        friendshipSnap.exists() && friendshipSnap.data().status === "active"
      );
    } catch (error) {
      console.error("FriendService.isFriend error:", error);
      return false;
    }
  }
}

export default FriendService;
