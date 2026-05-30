import { supabase } from "../lib/supabaseClient";
import { toCamel, toCamelArray } from "../lib/caseHelpers";

export class GroupEventService {
  /**
   * 단체 달력에 이벤트 추가
   * @param {object} event - { title, date, endDate, groupCalendarId, linkedPersonalEventId, dotColor }
   */
  static async addEventToGroup(event) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const allDay = event.allDay !== false;
      const { data, error } = await supabase
        .from("group_events")
        .insert([
          {
            title: event.title,
            date: event.date,
            end_date: event.endDate || event.date,
            group_calendar_id: event.groupCalendarId,
            user_id: user.id,
            linked_personal_event_id: event.linkedPersonalEventId || null,
            dot_color: event.dotColor || "#395fa5ff",
            all_day: allDay,
            start_time: allDay ? null : event.startTime ?? null,
            end_time: allDay ? null : event.endTime ?? null,
            memo: event.memo ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data && data.length > 0 ? data[0].id : null;
    } catch (error) {
      console.error("GroupEventService.addEventToGroup error:", error);
      throw error;
    }
  }

  /**
   * 특정 단체 달력의 모든 이벤트 실시간 리스너
   */
  static listenGroupEvents(groupCalendarId, callback) {
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("group_events")
        .select("*")
        .eq("group_calendar_id", groupCalendarId);
      if (!error && data) callback(toCamelArray(data));
    };

    fetchAll();

    const channel = supabase
      .channel(`group_events_${groupCalendarId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_events" },
        fetchAll
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  /**
   * 그룹 일정 조회
   */
  static async getGroupEvent(eventId) {
    try {
      const { data, error } = await supabase
        .from("group_events")
        .select("*")
        .eq("id", eventId)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? toCamel(data[0]) : null;
    } catch (error) {
      console.error("GroupEventService.getGroupEvent error:", error);
      throw error;
    }
  }

  /**
   * 그룹 일정 수정
   */
  static async updateGroupEvent(
    eventId,
    { title, date, endDate, dotColor, allDay, startTime, endTime, memo },
  ) {
    try {
      const updateData = {
        title,
        date,
        end_date: endDate || date,
        updated_at: new Date().toISOString(),
      };

      if (dotColor) {
        updateData.dot_color = dotColor;
      }

      if (typeof allDay === "boolean") {
        updateData.all_day = allDay;
        updateData.start_time = allDay ? null : startTime ?? null;
        updateData.end_time = allDay ? null : endTime ?? null;
      }

      if (memo !== undefined) {
        updateData.memo = memo;
      }

      const { error } = await supabase
        .from("group_events")
        .update(updateData)
        .eq("id", eventId);

      if (error) throw error;
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      if (!skipCascade) {
        const { data: event, error: fetchError } = await supabase
          .from("group_events")
          .select("*")
          .eq("id", eventId)
          .limit(1);

        if (fetchError) throw fetchError;

        if (event && event.length > 0 && event[0].linked_personal_event_id) {
          try {
            const { PersonalEventService } =
              await import("./PersonalEventService");
            await PersonalEventService.deletePersonalEvent(
              event[0].linked_personal_event_id,
              true,
            );
          } catch (error) {
            console.error(`Error deleting linked personal event:`, error);
          }
        }
      }

      const { error: deleteError } = await supabase
        .from("group_events")
        .delete()
        .eq("id", eventId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error("GroupEventService.deleteGroupEvent error:", error);
      throw error;
    }
  }
}

export default GroupEventService;
