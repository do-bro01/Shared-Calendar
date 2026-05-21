import { supabase } from "../lib/supabaseClient";
import { toCamelArray } from "../lib/caseHelpers";

export class PersonalEventService {
  /**
   * 개인 일정 추가
   */
  static async addPersonalEvent({
    title,
    date,
    endDate,
    linkedGroupEventIds = [],
    dotColor = "#395fa5ff",
    allDay = true,
    startTime = null,
    endTime = null,
  }) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인되지 않음");

      const { data, error } = await supabase
        .from("personal_events")
        .insert([
          {
            title,
            date,
            end_date: endDate || date,
            user_id: user.id,
            linked_group_event_ids: linkedGroupEventIds,
            dot_color: dotColor,
            all_day: allDay,
            start_time: allDay ? null : startTime,
            end_time: allDay ? null : endTime,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data && data.length > 0 ? data[0].id : null;
    } catch (error) {
      console.error("PersonalEventService.addPersonalEvent error:", error);
      throw error;
    }
  }

  /**
   * 개인 일정의 연결된 그룹 일정 ID 목록 업데이트
   */
  static async updateLinkedGroupEventIds(eventId, linkedGroupEventIds) {
    const { error } = await supabase
      .from("personal_events")
      .update({
        linked_group_event_ids: linkedGroupEventIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    if (error) throw error;
  }

  /**
   * 개인 일정 수정
   */
  static async updatePersonalEvent(
    eventId,
    { title, date, endDate, dotColor, allDay, startTime, endTime },
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

      // 시간 관련 필드는 호출자가 명시할 때만 업데이트
      if (typeof allDay === "boolean") {
        updateData.all_day = allDay;
        updateData.start_time = allDay ? null : startTime ?? null;
        updateData.end_time = allDay ? null : endTime ?? null;
      }

      const { error } = await supabase
        .from("personal_events")
        .update(updateData)
        .eq("id", eventId);

      if (error) throw error;
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
      if (!skipCascade) {
        const { data: event, error: fetchError } = await supabase
          .from("personal_events")
          .select("*")
          .eq("id", eventId)
          .limit(1);

        if (fetchError) throw fetchError;

        if (
          event &&
          event.length > 0 &&
          event[0].linked_group_event_ids &&
          event[0].linked_group_event_ids.length > 0
        ) {
          const { GroupEventService } = await import("./GroupEventService");
          for (const groupEventId of event[0].linked_group_event_ids) {
            try {
              await GroupEventService.deleteGroupEvent(groupEventId, true);
            } catch (error) {
              console.error(
                `Error deleting linked group event ${groupEventId}:`,
                error,
              );
            }
          }
        }
      }

      const { error: deleteError } = await supabase
        .from("personal_events")
        .delete()
        .eq("id", eventId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error("PersonalEventService.deletePersonalEvent error:", error);
      throw error;
    }
  }

  /**
   * 개인 일정 실시간 구독
   */
  static listenPersonalEvents(callback) {
    let channel;

    const setup = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return;

      const fetchAll = async () => {
        const { data, error } = await supabase
          .from("personal_events")
          .select("*")
          .eq("user_id", user.id);
        if (!error && data) callback(toCamelArray(data));
      };

      await fetchAll();

      channel = supabase
        .channel("personal_events_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "personal_events" },
          fetchAll
        )
        .subscribe();
    };

    setup().catch((err) =>
      console.error("PersonalEventService.listenPersonalEvents error:", err)
    );

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }
}

export default PersonalEventService;
