// SharedCalendarScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { GroupCalendarService } from "../services/GroupCalendarService";
import { GroupEventService } from "../services/GroupEventService";
import { FriendService } from "../services/FriendService";
import { getKoreanHolidaysForYear } from "../constants/koreanHolidays";
import CalendarView from "../components/CalendarView";

export default function SharedCalendarScreen() {
  const theme = useTheme();
  const [groupCalendars, setGroupCalendars] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // 그룹 캘린더 목록 로드
  useEffect(() => {
    loadGroupCalendars();
    loadFriends();
  }, []);

  const loadGroupCalendars = async () => {
    try {
      const groups = await GroupCalendarService.getUserGroupCalendars();
      setGroupCalendars(groups);
      setLoading(false);
    } catch (error) {
      console.error("Error loading group calendars:", error);
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const friendsList = await FriendService.getFriendsList();
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("오류", "방 이름을 입력해주세요");
      return;
    }

    try {
      const groupId = await GroupCalendarService.createGroupCalendar(
        groupName,
        selectedFriends
      );
      setGroupName("");
      setSelectedFriends([]);
      setShowCreateModal(false);
      loadGroupCalendars();
      setSelectedGroup(groupId);
      Alert.alert("성공", "달력방이 생성되었습니다");
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("오류", "달력방 생성에 실패했습니다");
    }
  };

  const toggleFriendSelection = (friendId) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  if (selectedGroup) {
    return (
      <SharedCalendarView
        groupId={selectedGroup}
        groupName={
          groupCalendars.find((g) => g.id === selectedGroup)?.name || "달력방"
        }
        onBack={() => {
          setSelectedGroup(null);
          loadGroupCalendars();
        }}
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          로드 중...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          공유 캘린더
        </Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.tint }]}
          onPress={() => setShowCreateModal(true)}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>방 만들기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.groupList}>
        {groupCalendars.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name="event"
              size={64}
              color={theme.colors.text}
              style={{ opacity: 0.3, marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>
              공유 달력방이 없습니다
            </Text>
          </View>
        ) : (
          groupCalendars.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupItem,
                {
                  backgroundColor:
                    theme.mode === "dark" ? "#222431ff" : "#f5f5f5",
                  borderColor: theme.colors.tint,
                },
              ]}
              onPress={() => setSelectedGroup(group.id)}
            >
              <View style={styles.groupInfo}>
                <MaterialIcons
                  name="calendar-today"
                  size={28}
                  color={theme.colors.tint}
                  style={{ marginRight: 12 }}
                />
                <View>
                  <Text
                    style={[styles.groupName, { color: theme.colors.text }]}
                  >
                    {group.name}
                  </Text>
                  <Text
                    style={[
                      styles.memberCount,
                      { color: theme.colors.text, opacity: 0.6 },
                    ]}
                  >
                    멤버 {group.members?.length || 0}명
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name="keyboard-arrow-right"
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 방 만들기 모달 */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxHeight: "80%",
            }}
          >
            <Text
              style={[
                {
                  fontSize: 20,
                  fontWeight: "700",
                  marginBottom: 20,
                  color: theme.colors.text,
                },
              ]}
            >
              달력방 만들기
            </Text>

            {/* 방 이름 입력 */}
            <Text
              style={[
                {
                  fontSize: 14,
                  fontWeight: "600",
                  marginBottom: 8,
                  color: theme.colors.text,
                },
              ]}
            >
              방 이름
            </Text>
            <TextInput
              placeholder="방 이름 입력"
              value={groupName}
              onChangeText={setGroupName}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.tint,
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                color: theme.colors.text,
                backgroundColor: theme.mode === "dark" ? "#444" : "#f5f5f5",
              }}
            />

            {/* 친구 선택 */}
            <Text
              style={[
                {
                  fontSize: 14,
                  fontWeight: "600",
                  marginBottom: 12,
                  color: theme.colors.text,
                },
              ]}
            >
              초대할 친구
            </Text>

            <ScrollView style={{ maxHeight: 250, marginBottom: 20 }}>
              {friends.length === 0 ? (
                <Text
                  style={[
                    {
                      color: theme.colors.text,
                      opacity: 0.6,
                      textAlign: "center",
                      paddingVertical: 16,
                    },
                  ]}
                >
                  친구가 없습니다
                </Text>
              ) : (
                friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.userId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor:
                        theme.mode === "dark" ? "#555" : "#eee",
                    }}
                    onPress={() => toggleFriendSelection(friend.userId)}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 2,
                        borderColor: theme.colors.tint,
                        borderRadius: 4,
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                        backgroundColor: selectedFriends.includes(friend.userId)
                          ? theme.colors.tint
                          : "transparent",
                      }}
                    >
                      {selectedFriends.includes(friend.userId) && (
                        <MaterialIcons name="check" size={16} color="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          {
                            fontSize: 16,
                            color: theme.colors.text,
                            fontWeight: "500",
                          },
                        ]}
                      >
                        {friend.displayName || "(미설정)"}
                      </Text>
                      <Text
                        style={[
                          {
                            fontSize: 12,
                            color: theme.colors.text,
                            opacity: 0.6,
                          },
                        ]}
                      >
                        @{friend.scId || friend.userId.substring(0, 8)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* 버튼 */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: "#ccc",
                  alignItems: "center",
                }}
                onPress={() => {
                  setShowCreateModal(false);
                  setGroupName("");
                  setSelectedFriends([]);
                }}
              >
                <Text
                  style={{ color: "#000", fontSize: 16, fontWeight: "600" }}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.tint,
                  alignItems: "center",
                }}
                onPress={handleCreateGroup}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                >
                  생성
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 단체 달력 보기 컴포넌트
function SharedCalendarView({ groupId, groupName, onBack }) {
  const theme = useTheme();
  const [groupEvents, setGroupEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [groupMembers, setGroupMembers] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteSelections, setInviteSelections] = useState([]);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const holidayEvents = [
    ...getKoreanHolidaysForYear(new Date().getFullYear()),
    ...getKoreanHolidaysForYear(new Date().getFullYear() + 1),
  ];

  useEffect(() => {
    const unsubscribe = GroupEventService.listenGroupEvents(
      groupId,
      setGroupEvents
    );
    return unsubscribe;
  }, [groupId]);

  const loadGroupInfo = useCallback(async () => {
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const currentUser = auth.currentUser;

      const group = await GroupCalendarService.getGroupCalendar(groupId);
      const members = group?.members || [];
      setGroupMembers(members);
      setIsCreator(currentUser?.uid === group?.createdBy);

      // 멤버 프로필 동기 로드
      const { UserService } = await import("../services/UserService");
      const profiles = await Promise.all(
        members.map(async (uid) => {
          try {
            const profile = await UserService.getUserProfile(uid);
            return {
              userId: uid,
              displayName: profile?.displayName || "(미설정)",
              scId: profile?.scId || uid.substring(0, 8),
            };
          } catch (err) {
            console.error("Error fetching member profile", uid, err);
            return {
              userId: uid,
              displayName: "(알 수 없음)",
              scId: uid.substring(0, 8),
            };
          }
        })
      );
      setMemberProfiles(profiles);
    } catch (error) {
      console.error("Error loading group info:", error);
    }
  }, [groupId]);

  const loadFriends = useCallback(async () => {
    try {
      const friendsList = await FriendService.getFriendsList();
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends for invite:", error);
    }
  }, []);

  useEffect(() => {
    loadGroupInfo();
    loadFriends();
  }, [loadGroupInfo, loadFriends]);

  const toggleInviteSelection = (friendId) => {
    setInviteSelections((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleInviteFriends = async () => {
    if (inviteSelections.length === 0) {
      Alert.alert("안내", "초대할 친구를 선택해주세요");
      return;
    }

    try {
      for (const friendId of inviteSelections) {
        await GroupCalendarService.addMember(groupId, friendId);
      }
      await loadGroupInfo();
      setInviteSelections([]);
      setInviteModalVisible(false);
      Alert.alert("성공", "친구를 초대했습니다");
    } catch (error) {
      console.error("Error inviting friends:", error);
      Alert.alert("오류", error.message || "초대에 실패했습니다");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await GroupEventService.deleteGroupEvent(eventId);
    } catch (error) {
      console.error("Error deleting event:", error);
      Alert.alert("오류", "일정 삭제에 실패했습니다");
    }
  };

  const handleEditEvent = async (eventData) => {
    try {
      await GroupEventService.updateGroupEvent(eventData.id, {
        title: eventData.title,
        date: eventData.date,
        endDate: eventData.endDate || eventData.date,
        dotColor: eventData.dotColor,
      });

      // 연결된 개인 일정도 업데이트
      const event = groupEvents.find((e) => e.id === eventData.id);
      if (event?.linkedPersonalEventId) {
        const { PersonalEventService } = await import(
          "../services/PersonalEventService"
        );
        await PersonalEventService.updatePersonalEvent(
          event.linkedPersonalEventId,
          {
            title: eventData.title,
            date: eventData.date,
            endDate: eventData.endDate || eventData.date,
            dotColor: eventData.dotColor,
          }
        );
      }

      Alert.alert("성공", "일정이 수정되었습니다");
    } catch (error) {
      console.error("Error editing event:", error);
      Alert.alert("오류", "일정 수정에 실패했습니다");
    }
  };

  const handleAddEvent = async (eventData) => {
    try {
      const { getAuth } = await import("firebase/auth");
      const { getFirestore, collection, addDoc } = await import(
        "firebase/firestore"
      );

      const auth = getAuth();
      const db = getFirestore();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert("오류", "로그인이 필요합니다");
        return;
      }

      // 개인 캘린더에 먼저 일정 추가
      const personalEventsRef = collection(db, "personalEvents");
      const personalEventDoc = await addDoc(personalEventsRef, {
        title: eventData.title,
        date: eventData.date,
        endDate: eventData.endDate || eventData.date,
        userId: currentUser.uid,
        linkedGroupEventIds: [],
        dotColor: eventData.dotColor,
        createdAt: new Date(),
      });

      // 그룹 캘린더에 일정 추가 (개인 일정과 연결)
      const groupEventId = await GroupEventService.addEventToGroup({
        title: eventData.title,
        date: eventData.date,
        endDate: eventData.endDate || eventData.date,
        groupCalendarId: groupId,
        linkedPersonalEventId: personalEventDoc.id,
        dotColor: eventData.dotColor,
      });

      // 개인 일정에 그룹 일정 ID 연결
      const { updateDoc, doc } = await import("firebase/firestore");
      const personalEventRef = doc(db, "personalEvents", personalEventDoc.id);
      await updateDoc(personalEventRef, {
        linkedGroupEventIds: [groupEventId],
      });

      Alert.alert("성공", "일정이 추가되었습니다");
    } catch (error) {
      console.error("Error adding event:", error);
      Alert.alert("오류", "일정 추가에 실패했습니다");
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert(
      "달력방 삭제",
      "정말 삭제하시겠습니까? 모든 일정이 함께 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await GroupCalendarService.deleteGroupCalendar(groupId);
              Alert.alert("성공", "달력방이 삭제되었습니다");
              onBack();
            } catch (error) {
              console.error("Error deleting group:", error);
              Alert.alert(
                "오류",
                error.message || "달력방 삭제에 실패했습니다"
              );
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    Alert.alert("달력방 나가기", "정말 나가시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "나가기",
        style: "destructive",
        onPress: async () => {
          try {
            const { getAuth } = await import("firebase/auth");
            const auth = getAuth();
            const currentUser = auth.currentUser;

            await GroupCalendarService.removeMember(groupId, currentUser.uid);
            Alert.alert("성공", "달력방에서 나왔습니다");
            onBack();
          } catch (error) {
            console.error("Error leaving group:", error);
            Alert.alert(
              "오류",
              error.message || "달력방 나가기에 실패했습니다"
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, flex: 1 }]}>
          {groupName}
        </Text>
        <TouchableOpacity
          onPress={() => setInviteModalVisible(true)}
          style={{ padding: 8 }}
        >
          <MaterialIcons
            name="person-add"
            size={24}
            color={theme.colors.tint}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isCreator ? handleDeleteGroup : handleLeaveGroup}
          style={{ padding: 8 }}
        >
          <MaterialIcons
            name={isCreator ? "delete" : "exit-to-app"}
            size={24}
            color="#395fa5ff"
          />
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => setMembersModalVisible(true)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <MaterialIcons
            name="group"
            size={18}
            color={theme.colors.text}
            style={{ marginRight: 6, opacity: 0.7 }}
          />
          <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
            멤버 {groupMembers.length}명
          </Text>
        </TouchableOpacity>
      </View>

      {/* CalendarView 컴포넌트 사용 */}
      <CalendarView
        selectedDate={selectedDate}
        events={[...groupEvents, ...holidayEvents]}
        onSelectDate={setSelectedDate}
        onAddEvent={handleAddEvent}
        isShared={true}
        title=""
        onDeleteEvent={handleDeleteEvent}
        onEditEvent={handleEditEvent}
      />

      {/* 멤버 목록 모달 */}
      <Modal
        visible={membersModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMembersModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxHeight: "70%",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 12,
                color: theme.colors.text,
              }}
            >
              멤버 목록
            </Text>

            <ScrollView style={{ maxHeight: 320, marginBottom: 12 }}>
              {memberProfiles.length === 0 ? (
                <Text
                  style={{
                    color: theme.colors.text,
                    opacity: 0.6,
                    textAlign: "center",
                    paddingVertical: 12,
                  }}
                >
                  멤버가 없습니다
                </Text>
              ) : (
                memberProfiles.map((member) => (
                  <View
                    key={member.userId}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor:
                        theme.mode === "dark" ? "#555" : "#eee",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: theme.colors.text,
                        fontWeight: "600",
                      }}
                    >
                      {member.displayName || "(미설정)"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.colors.text,
                        opacity: 0.6,
                        marginTop: 2,
                      }}
                    >
                      @{member.scId || member.userId.substring(0, 8)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={{
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: theme.colors.tint,
                alignItems: "center",
              }}
              onPress={() => setMembersModalVisible(false)}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                닫기
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 친구 초대 모달 */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxHeight: "80%",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 16,
                color: theme.colors.text,
              }}
            >
              친구 초대
            </Text>

            <ScrollView style={{ maxHeight: 320, marginBottom: 16 }}>
              {friends.filter((f) => !groupMembers.includes(f.userId))
                .length === 0 ? (
                <Text
                  style={{
                    color: theme.colors.text,
                    opacity: 0.6,
                    textAlign: "center",
                    paddingVertical: 12,
                  }}
                >
                  초대 가능한 친구가 없습니다
                </Text>
              ) : (
                friends
                  .filter((f) => !groupMembers.includes(f.userId))
                  .map((friend) => (
                    <TouchableOpacity
                      key={friend.userId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor:
                          theme.mode === "dark" ? "#555" : "#eee",
                      }}
                      onPress={() => toggleInviteSelection(friend.userId)}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderWidth: 2,
                          borderColor: theme.colors.tint,
                          borderRadius: 4,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                          backgroundColor: inviteSelections.includes(
                            friend.userId
                          )
                            ? theme.colors.tint
                            : "transparent",
                        }}
                      >
                        {inviteSelections.includes(friend.userId) && (
                          <MaterialIcons name="check" size={16} color="#fff" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            color: theme.colors.text,
                            fontWeight: "500",
                          }}
                        >
                          {friend.displayName || "(미설정)"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.colors.text,
                            opacity: 0.6,
                          }}
                        >
                          @{friend.scId || friend.userId.substring(0, 8)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.mode === "dark" ? "#444" : "#e0e0e0",
                  alignItems: "center",
                }}
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteSelections([]);
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.tint,
                  alignItems: "center",
                }}
                onPress={handleInviteFriends}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                >
                  초대하기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  groupList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 13,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    margin: 16,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
