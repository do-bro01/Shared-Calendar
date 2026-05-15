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

      const targetAuthId = targetUser.authId;
      if (!targetAuthId) {
        throw new Error("대상 사용자 정보가 올바르지 않습니다");
      }

      if (user.id === targetAuthId) {
        throw new Error("자신을 친구로 추가할 수 없습니다");
      }

      const [user1, user2] = [user.id, targetAuthId].sort();
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

        if (!friendAuthId) continue;

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

}

export default FriendService;
