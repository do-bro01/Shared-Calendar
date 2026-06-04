// SC/src/screens/SettingsScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { UserService } from "../services/UserService";
import { FriendService } from "../services/FriendService";
import { ChatService } from "../services/ChatService";
import { logout } from "../services/AuthService";
import { refreshBus } from "../lib/refreshBus";

export default function SettingsScreen() {
  const theme = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [scIdInput, setScIdInput] = useState("");
  const [embedRunning, setEmbedRunning] = useState(false);

  // 프로필 및 친구 목록 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await UserService.getCurrentUserProfile();
        if (profile) {
          setUserProfile(profile);
          setDisplayName(profile.displayName || "");
        } else {
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser();
          if (currentUser) {
            await UserService.createOrUpdateUserProfile(currentUser.id);
            const newProfile = await UserService.getCurrentUserProfile();
            setUserProfile(newProfile);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoadingProfile(false);
      }

      try {
        const friendsList = await FriendService.getFriendsList();
        setFriends(friendsList);
      } catch (error) {
        console.error("Error loading friends:", error);
      }
    };
    loadData();
  }, []);

  const loadFriends = async () => {
    try {
      const friendsList = await FriendService.getFriendsList();
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) {
      Alert.alert("오류", "이름을 입력해주세요");
      return;
    }

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (currentUser) {
        await UserService.updateDisplayName(currentUser.id, displayName);
        setUserProfile({
          ...userProfile,
          displayName: displayName,
        });
        setIsEditingName(false);
        Alert.alert("성공", "이름이 변경되었습니다");
      }
    } catch (error) {
      console.error("Error updating display name:", error);
      Alert.alert("오류", "이름 변경에 실패했습니다");
    }
  };

  const handleCopyScId = async () => {
    const scId = userProfile?.scId;
    if (!scId) return;

    try {
      if (Platform.OS === "web") {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(scId);
        } else {
          const ta = document.createElement("textarea");
          ta.value = scId;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        window.alert(`SC ID가 복사되었습니다: ${scId}`);
      } else {
        Alert.alert("SC ID", scId, [{ text: "확인", style: "cancel" }]);
      }
    } catch (error) {
      console.error("Failed to copy SC ID:", error);
      if (Platform.OS === "web") {
        window.alert(`복사에 실패했습니다. SC ID: ${scId}`);
      } else {
        Alert.alert("SC ID", scId);
      }
    }
  };

  const handleLogout = () => {
    const doLogout = async () => {
      try {
        await logout();
      } catch (error) {
        console.error("Error logging out:", error);
        if (Platform.OS === "web") {
          window.alert("로그아웃에 실패했습니다");
        } else {
          Alert.alert("오류", "로그아웃에 실패했습니다");
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("정말 로그아웃하시겠습니까?")) {
        doLogout();
      }
      return;
    }

    Alert.alert("로그아웃", "정말 로그아웃하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: doLogout },
    ]);
  };

  const handleRemoveFriend = async (friendId) => {
    const doRemove = async () => {
      try {
        await FriendService.removeFriend(friendId);
        loadFriends();
        if (Platform.OS === "web") {
          window.alert("친구가 삭제되었습니다");
        } else {
          Alert.alert("성공", "친구가 삭제되었습니다");
        }
      } catch (error) {
        console.error("Error removing friend:", error);
        if (Platform.OS === "web") {
          window.alert("친구 삭제에 실패했습니다");
        } else {
          Alert.alert("오류", "친구 삭제에 실패했습니다");
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("정말 친구를 삭제하시겠습니까?")) {
        doRemove();
      }
      return;
    }

    Alert.alert("친구 삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: doRemove },
    ]);
  };

  const handleAddFriend = async () => {
    if (!scIdInput.trim()) {
      Alert.alert("오류", "SC ID를 입력해주세요");
      return;
    }

    try {
      const addedFriend = await FriendService.addFriendByScId(
        scIdInput.trim().toUpperCase()
      );
      setShowAddFriendModal(false);
      setScIdInput("");
      loadFriends();
      Alert.alert(
        "성공",
        `${addedFriend.displayName || addedFriend.scId}님을 친구로 추가했습니다`
      );
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("오류", error.message || "친구 추가에 실패했습니다");
    }
  };

  const toggleDarkModeSwitch = () => theme.toggle();
  const toggleCreamModeSwitch = () => theme.toggleCream();

  // 챗봇이 검색에 사용할 메모 임베딩을 일괄 갱신.
  // 새로 작성·수정된 메모만 처리되며 (DB 트리거가 변경 시 자동 무효화),
  // 비용은 메모당 약 $0.000005 수준.
  const handleRunEmbedBatch = async () => {
    setEmbedRunning(true);
    try {
      const { processed, capped } = await ChatService.runEmbedBatch();
      const msg = capped
        ? `${processed}개를 처리했어요. 남은 메모가 있어 한 번 더 눌러주세요.`
        : processed === 0
        ? "새로 알려줄 메모가 없어요"
        : `${processed}개의 새 메모를 챗봇에게 알려줬어요`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("완료", msg);
      }
    } catch (err) {
      console.error("runEmbedBatch failed:", err);
      const msg = err.message || "처리 중 오류가 발생했어요";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("오류", msg);
      }
    } finally {
      setEmbedRunning(false);
    }
  };

  const SettingsItem = ({
    icon,
    title,
    value,
    onValueChange,
    isToggle = false,
    onPress,
  }) => {
    const rowStyle = [
      styles.settingItem,
      {
        backgroundColor: theme.colors.background,
        borderBottomColor: theme.mode === "dark" ? "#555" : "#eee",
      },
    ];

    const left = (
      <View style={styles.itemContent}>
        <MaterialIcons
          name={icon}
          size={24}
          color={theme.colors.tint}
          style={styles.icon}
        />
        <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
      </View>
    );

    // 토글 행: 좌측만 Touchable, Switch는 자체 onValueChange만 사용
    // (부모 TouchableOpacity로 감싸면 Switch 탭 시 핸들러가 두 번 발화해 토글이 상쇄됨)
    if (isToggle) {
      return (
        <View style={rowStyle}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => onValueChange && onValueChange(!value)}
            disabled={!onValueChange}
            activeOpacity={0.6}
          >
            {left}
          </TouchableOpacity>
          <Switch
            trackColor={{ false: "#767577", true: theme.colors.tint }}
            thumbColor="#ffffff"
            ios_backgroundColor="#3e3e3e"
            onValueChange={onValueChange}
            value={value}
            activeThumbColor="#ffffff"
            style={
              Platform.OS === "web"
                ? { accentColor: theme.colors.tint }
                : undefined
            }
          />
        </View>
      );
    }

    return (
      <TouchableOpacity style={rowStyle} onPress={onPress}>
        {left}
        <MaterialIcons name="keyboard-arrow-right" size={24} color="#aaa" />
      </TouchableOpacity>
    );
  };

  if (loadingProfile) {
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <>
          <Text style={[styles.title, { color: theme.colors.text }]}>설정</Text>

          {/* 계정 설정 섹션 */}
          <Text style={[styles.sectionTitle, { color: theme.colors.tint }]}>
            계정
          </Text>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {/* SC ID 표시 */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.colors.background,
                  borderBottomColor: theme.mode === "dark" ? "#555" : "#eee",
                },
              ]}
            >
              <View style={styles.itemContent}>
                <MaterialIcons
                  name="vpn-key"
                  size={24}
                  color={theme.colors.tint}
                  style={styles.icon}
                />
                <View>
                  <Text
                    style={[styles.itemTitle, { color: theme.colors.text }]}
                  >
                    SC ID
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.text,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    {userProfile?.scId || "로드 중..."}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCopyScId}>
                <MaterialIcons name="content-copy" size={20} color="#aaa" />
              </TouchableOpacity>
            </View>

            {/* Display Name 편집 */}
            <View
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.colors.background,
                  borderBottomColor: theme.mode === "dark" ? "#555" : "#eee",
                  flexDirection: "column",
                  alignItems: "flex-start",
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <View style={styles.itemContent}>
                  <MaterialIcons
                    name="account-circle"
                    size={24}
                    color={theme.colors.tint}
                    style={styles.icon}
                  />
                  <Text
                    style={[styles.itemTitle, { color: theme.colors.text }]}
                  >
                    내 이름
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsEditingName(!isEditingName)}
                >
                  <MaterialIcons
                    name={isEditingName ? "check" : "edit"}
                    size={20}
                    color={theme.colors.tint}
                  />
                </TouchableOpacity>
              </View>

              {isEditingName ? (
                <View style={{ width: "100%", marginTop: 10 }}>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="새 이름 입력"
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.tint,
                      borderRadius: 5,
                      padding: 10,
                      color: theme.colors.text,
                      backgroundColor:
                        theme.mode === "dark" ? "#333" : "#f5f5f5",
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      marginTop: 10,
                      gap: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setIsEditingName(false)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 5,
                        backgroundColor: "#ccc",
                      }}
                    >
                      <Text style={{ color: "#000", fontSize: 14 }}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveDisplayName}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 5,
                        backgroundColor: theme.colors.tint,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 14 }}>저장</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.text,
                    marginTop: 4,
                    opacity: 0.7,
                  }}
                >
                  {displayName || "(미설정)"}
                </Text>
              )}
            </View>

            <SettingsItem
              icon="logout"
              title="로그아웃"
              onPress={handleLogout}
            />
          </View>

          {/* 새로고침 버튼 */}
          <TouchableOpacity
            style={{
              backgroundColor: theme.colors.tint,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={async () => {
              // 웹에서는 브라우저 새로고침(cmd+R)과 동일하게 전체 페이지를 다시 로드해
              // 모든 탭이 처음부터 새로 로드되도록 함
              if (Platform.OS === "web") {
                window.location.reload();
                return;
              }
              // 네이티브에서는 현재 화면 데이터 + 다른 탭들을 함께 새로고침
              setLoadingProfile(true);
              const profile = await UserService.getCurrentUserProfile();
              if (profile) {
                setUserProfile(profile);
                setDisplayName(profile.displayName || "");
              }
              await loadFriends();
              setLoadingProfile(false);
              refreshBus.emit();
            }}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              새로고침
            </Text>
          </TouchableOpacity>

          {/* 친구 관리 섹션 */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.tint, marginBottom: 0 },
              ]}
            >
              친구 관리
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddFriendModal(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: theme.colors.tint,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 6,
              }}
            >
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  marginLeft: 4,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                친구 추가
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {friends.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 28,
                  gap: 6,
                }}
              >
                <MaterialIcons
                  name="people-outline"
                  size={36}
                  color={theme.colors.text}
                  style={{ opacity: 0.3 }}
                />
                <Text
                  style={{
                    color: theme.colors.text,
                    opacity: 0.6,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  친구가 없습니다
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    opacity: 0.4,
                    fontSize: 12,
                  }}
                >
                  + 버튼으로 SC ID를 입력해 친구를 추가하세요
                </Text>
              </View>
            ) : (
              friends.map((friend, index) => (
                <View
                  key={friend.userId}
                  style={[
                    styles.settingItem,
                    {
                      backgroundColor: theme.colors.background,
                      borderBottomColor:
                        index === friends.length - 1
                          ? "transparent"
                          : theme.mode === "dark"
                          ? "#555"
                          : "#eee",
                    },
                  ]}
                >
                  <View style={styles.itemContent}>
                    <MaterialIcons
                      name="person"
                      size={20}
                      color={theme.colors.tint}
                      style={styles.icon}
                    />
                    <View>
                      <Text
                        style={[styles.itemTitle, { color: theme.colors.text }]}
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
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveFriend(friend.userId)}
                  >
                    <MaterialIcons name="delete" size={20} color="#395fa5ff" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* 알림 및 표시 섹션 */}
          <Text style={[styles.sectionTitle, { color: theme.colors.tint }]}>
            알림 및 표시
          </Text>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <SettingsItem
              icon="dark-mode"
              title="다크 모드"
              isToggle={true}
              value={theme.mode === "dark"}
              onValueChange={toggleDarkModeSwitch}
            />
            {theme.mode === "light" && (
              <SettingsItem
                icon="local-cafe"
                title="크림 모드"
                isToggle={true}
                value={theme.cream}
                onValueChange={toggleCreamModeSwitch}
              />
            )}
          </View>

          {/* AI 챗봇 섹션 */}
          <Text style={[styles.sectionTitle, { color: theme.colors.tint }]}>
            AI 챗봇
          </Text>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  backgroundColor: theme.colors.background,
                  borderBottomColor: "transparent",
                },
              ]}
              onPress={handleRunEmbedBatch}
              disabled={embedRunning}
              activeOpacity={0.6}
            >
              <View style={styles.itemContent}>
                <MaterialIcons
                  name="auto-awesome"
                  size={24}
                  color={theme.colors.tint}
                  style={styles.icon}
                />
                <View>
                  <Text
                    style={[styles.itemTitle, { color: theme.colors.text }]}
                  >
                    챗봇에게 내 일정 알려주기
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.text,
                      opacity: 0.6,
                      marginTop: 2,
                    }}
                  >
                    새로 작성·수정한 메모를 챗봇이 검색할 수 있게 합니다
                  </Text>
                </View>
              </View>
              {embedRunning ? (
                <ActivityIndicator color={theme.colors.tint} />
              ) : (
                <MaterialIcons name="sync" size={20} color="#aaa" />
              )}
            </TouchableOpacity>
          </View>

          {/* 일반 설정 섹션 */}
          <Text style={[styles.sectionTitle, { color: theme.colors.tint }]}>
            일반
          </Text>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <SettingsItem
              icon="info-outline"
              title="앱 정보"
              onPress={() => console.log("앱 정보 페이지")}
            />
            <SettingsItem
              icon="description"
              title="개인정보 보호 정책"
              onPress={() => console.log("개인정보 정책 보기")}
            />
            <SettingsItem
              icon="help-outline"
              title="고객 지원"
              onPress={() => console.log("고객 지원 페이지")}
            />
          </View>
        </>
      </ScrollView>

      {/* 친구 추가 모달 */}
      <Modal
        visible={showAddFriendModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddFriendModal(false)}
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
              padding: 24,
              borderRadius: 12,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: theme.colors.text,
                marginBottom: 16,
              }}
            >
              친구 추가
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: theme.colors.text,
                opacity: 0.7,
                marginBottom: 12,
              }}
            >
              친구의 SC ID를 입력하세요 (6자리)
            </Text>

            <TextInput
              value={scIdInput}
              onChangeText={(text) => setScIdInput(text.toUpperCase())}
              placeholder="예: ABC123"
              placeholderTextColor={theme.mode === "dark" ? "#888" : "#aaa"}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.tint,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: theme.colors.text,
                backgroundColor: theme.mode === "dark" ? "#333" : "#f5f5f5",
                marginBottom: 20,
                textAlign: "center",
                fontWeight: "600",
                letterSpacing: 2,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowAddFriendModal(false);
                  setScIdInput("");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.mode === "dark" ? "#444" : "#e0e0e0",
                  alignItems: "center",
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
                onPress={handleAddFriend}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.tint,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  추가
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
    backgroundColor: "#f7f7f7",
  },
  scrollContainer: {
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#395fa5ff",
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 6,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 15,
    width: 24,
    textAlign: "center",
  },
  itemTitle: {
    fontSize: 17,
    color: "#333",
  },
  versionText: {
    textAlign: "center",
    fontSize: 14,
    color: "#aaa",
    marginTop: 30,
  },
});
