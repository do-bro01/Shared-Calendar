import { supabase } from "../lib/supabaseClient";
import { toCamel, toCamelArray } from "../lib/caseHelpers";

export class GroupCalendarService {
  /**
   * 새로운 단체 달력 생성
   * @param {string} name - 달력방 이름
   * @param {string[]} memberIds - 초대할 멤버 ID 배열 (생성자 자신 포함)
   */
  static async createGroupCalendar(name, memberIds = []) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const members = Array.from(new Set([user.id, ...memberIds]));

      const { data, error: insertError } = await supabase
        .from("group_calendars")
        .insert([
          {
            name,
            members,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;
      return data?.id;
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
      const { data, error } = await supabase
        .from("group_calendars")
        .select("*")
        .eq("id", groupId)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? toCamel(data[0]) : null;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data, error } = await supabase
        .from("group_calendars")
        .select("*")
        .contains("members", [user.id]);

      if (error) throw error;
      return toCamelArray(data || []);
    } catch (error) {
      console.error("GroupCalendarService.getUserGroupCalendars error:", error);
      throw error;
    }
  }

  /**
   * 단체 달력에 멤버 추가
   */
  static async addMember(groupId, memberId) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data: group, error: fetchError } = await supabase
        .from("group_calendars")
        .select("*")
        .eq("id", groupId)
        .limit(1);

      if (fetchError) throw fetchError;
      if (!group || group.length === 0)
        throw new Error("달력방을 찾을 수 없습니다");

      const groupData = group[0];
      if (!groupData.members.includes(user.id)) {
        throw new Error("권한이 없습니다");
      }

      const updatedMembers = Array.from(
        new Set([...groupData.members, memberId]),
      );

      const { error: updateError } = await supabase
        .from("group_calendars")
        .update({
          members: updatedMembers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      if (updateError) throw updateError;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data: group, error: fetchError } = await supabase
        .from("group_calendars")
        .select("*")
        .eq("id", groupId)
        .limit(1);

      if (fetchError) throw fetchError;
      if (!group || group.length === 0)
        throw new Error("달력방을 찾을 수 없습니다");

      const groupData = group[0];
      if (user.id !== groupData.created_by && user.id !== memberId) {
        throw new Error("권한이 없습니다");
      }

      // 자기 자신 제거(나가기)는 SECURITY DEFINER RPC를 사용해 RLS WITH CHECK 회피
      if (memberId === user.id) {
        const { error: rpcError } = await supabase.rpc(
          "leave_group_calendar",
          { group_id: groupId },
        );
        if (rpcError) throw rpcError;
        return;
      }

      const updatedMembers = groupData.members.filter((id) => id !== memberId);

      const { error: updateError } = await supabase
        .from("group_calendars")
        .update({
          members: updatedMembers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      if (updateError) throw updateError;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data: group, error: fetchError } = await supabase
        .from("group_calendars")
        .select("*")
        .eq("id", groupId)
        .limit(1);

      if (fetchError) throw fetchError;
      if (!group || group.length === 0)
        throw new Error("달력방을 찾을 수 없습니다");

      const groupData = group[0];
      const members = groupData.members || [];
      if (!members.includes(user.id)) {
        throw new Error("권한이 없습니다");
      }
      if (members.length > 1) {
        throw new Error(
          "다른 멤버가 남아있어 삭제할 수 없습니다. 먼저 방에서 나가주세요"
        );
      }

      const { data: events, error: eventsError } = await supabase
        .from("group_events")
        .select("id")
        .eq("group_calendar_id", groupId);

      if (eventsError) throw eventsError;

      if (events && events.length > 0) {
        const { error: deleteEventsError } = await supabase
          .from("group_events")
          .delete()
          .eq("group_calendar_id", groupId);

        if (deleteEventsError) throw deleteEventsError;
      }

      const { error: deleteError } = await supabase
        .from("group_calendars")
        .delete()
        .eq("id", groupId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error("GroupCalendarService.deleteGroupCalendar error:", error);
      throw error;
    }
  }

}

export default GroupCalendarService;
