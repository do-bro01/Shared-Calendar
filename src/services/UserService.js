import { supabase } from "../lib/supabaseClient";
import { userToCamel } from "../lib/caseHelpers";

export class UserService {
  /**
   * 6자리 랜덤 SC ID 생성 (중복 체크 포함)
   * @returns {Promise<string>} 고유한 6자리 코드
   */
  static async generateUniqueScId() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = 6;
    let scId = "";
    let isUnique = false;

    while (!isUnique) {
      scId = "";
      for (let i = 0; i < length; i++) {
        scId += characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
      }

      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("sc_id", scId)
        .limit(1);

      isUnique = !error && (!data || data.length === 0);
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
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("sc_id", scId.toUpperCase())
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? userToCamel(data[0]) : null;
    } catch (error) {
      console.error("UserService.findUserByScId error:", error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 생성 또는 업데이트
   * @param {string} userId - Supabase Auth UID
   * @param {string} displayName - 사용자가 설정한 이름
   */
  static async createOrUpdateUserProfile(userId, displayName = "") {
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", userId)
        .limit(1);

      if (fetchError) throw fetchError;

      if (existingUser && existingUser.length > 0) {
        if (displayName) {
          const { error: updateError } = await supabase
            .from("users")
            .update({ display_name: displayName })
            .eq("auth_id", userId);

          if (updateError) throw updateError;
        }
      } else {
        const scId = await this.generateUniqueScId();
        const { error: insertError } = await supabase.from("users").insert([
          {
            auth_id: userId,
            display_name: displayName || "",
            sc_id: scId,
            created_at: new Date().toISOString(),
          },
        ]);

        if (insertError) throw insertError;
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
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", userId)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? userToCamel(data[0]) : null;
    } catch (error) {
      console.error("UserService.getUserProfile error:", error);
      throw error;
    }
  }

  /**
   * 현재 사용자 프로필
   */
  static async getCurrentUserProfile() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return null;

      return this.getUserProfile(user.id);
    } catch (error) {
      console.error("UserService.getCurrentUserProfile error:", error);
      throw error;
    }
  }

  /**
   * displayName 업데이트
   */
  static async updateDisplayName(userId, displayName) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: displayName })
        .eq("auth_id", userId);

      if (error) throw error;
    } catch (error) {
      console.error("UserService.updateDisplayName error:", error);
      throw error;
    }
  }

}

export default UserService;
