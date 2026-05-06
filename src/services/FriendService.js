import { supabase } from "../lib/supabaseClient";
import { userToCamel } from "../lib/caseHelpers";
import UserService from "./UserService";

export class FriendService {
  /**
   * SC ID로 친구 추가
   * @param {string} scId - 친구의 SC ID (6자리 코드)
   */
  static async addFriendByScId(scId) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const targetUser = await UserService.findUserByScId(scId);
      if (!targetUser) {
        throw new Error("존재하지 않는 SC ID입니다");
      }

      if (user.id === targetUser.auth_id) {
        throw new Error("자신을 친구로 추가할 수 없습니다");
      }

      const [user1, user2] = [user.id, targetUser.auth_id].sort();
      const friendshipId = `${user1}_${user2}`;

      const { data: existing, error: checkError } = await supabase
        .from("friendships")
        .select("id")
        .eq("id", friendshipId)
        .limit(1);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        throw new Error("이미 친구입니다");
      }

      const { error: insertError } = await supabase.from("friendships").insert([
        {
          id: friendshipId,
          user1,
          user2,
          requester: user.id,
          status: "active",
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;
      return targetUser;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      if (user.id === targetUserId) {
        throw new Error("자신을 친구로 추가할 수 없습니다");
      }

      const [user1, user2] = [user.id, targetUserId].sort();
      const friendshipId = `${user1}_${user2}`;

      const { error: insertError } = await supabase.from("friendships").insert([
        {
          id: friendshipId,
          user1,
          user2,
          requester: user.id,
          status: "active",
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const [user1, user2] = [user.id, friendUserId].sort();
      const friendshipId = `${user1}_${user2}`;

      const { error: deleteError } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (deleteError) throw deleteError;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("*")
        .eq("status", "active");

      if (friendshipsError) throw friendshipsError;

      const friends = [];

      for (const friendship of friendships) {
        if (friendship.user1 !== user.id && friendship.user2 !== user.id) {
          continue;
        }

        const friendAuthId =
          friendship.user1 === user.id ? friendship.user2 : friendship.user1;

        const { data: friendData, error: friendError } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", friendAuthId)
          .limit(1);

        if (!friendError && friendData && friendData.length > 0) {
          friends.push({
            friendshipId: friendship.id,
            ...userToCamel(friendData[0]),
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
    let channel;

    const setup = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        callback([]);
        return;
      }

      const fetchFriends = async () => {
        const friends = await FriendService.getFriendsList();
        callback(friends);
      };

      await fetchFriends();

      channel = supabase
        .channel("friendships_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships" },
          fetchFriends
        )
        .subscribe();
    };

    setup().catch((err) =>
      console.error("FriendService.listenFriendsList error:", err)
    );

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }

  /**
   * 특정 사용자와의 친구 관계 확인
   */
  static async isFriend(userId) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return false;

      const [user1, user2] = [user.id, userId].sort();
      const friendshipId = `${user1}_${user2}`;

      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("id", friendshipId)
        .limit(1);

      return !error && data && data.length > 0 && data[0].status === "active";
    } catch (error) {
      console.error("FriendService.isFriend error:", error);
      return false;
    }
  }
}

export default FriendService;
