import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { GroupCalendarService } from "../services/GroupCalendarService";
import { ChatService } from "../services/ChatService";

// 챗봇 풀스크린 모달
//   상단 헤더 + 그룹 칩바 → 본문 메시지 리스트 → 하단 입력
//   그룹을 바꾸면 그 그룹의 최근 세션과 대화가 자동 복원됨
export default function ChatModal({ visible, onClose }) {
  const theme = useTheme();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // 모달 열림 → 그룹 목록 로드
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const list = await GroupCalendarService.getUserGroupCalendars();
        setGroups(list);
        if (list.length > 0) {
          setSelectedGroupId((prev) => prev ?? list[0].id);
        }
      } catch (err) {
        setError(err.message || "그룹 목록을 불러오지 못했습니다");
      }
    })();
  }, [visible]);

  // 그룹 변경 → 최근 세션 + 메시지 로드
  useEffect(() => {
    if (!visible || !selectedGroupId) return;
    let cancelled = false;
    (async () => {
      setLoadingGroup(true);
      setError(null);
      try {
        const sess = await ChatService.getLatestSession(selectedGroupId);
        if (cancelled) return;
        if (sess) {
          setSessionId(sess.id);
          const msgs = await ChatService.getMessages(sess.id);
          if (cancelled) return;
          setMessages(msgs);
        } else {
          setSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "대화 불러오기 실패");
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedGroupId]);

  // 메시지 추가 시 하단으로 스크롤
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !selectedGroupId) return;

    // optimistic: 사용자 메시지 + 어시스턴트 placeholder 즉시 표시
    const tempUser = { role: "user", content: text, _temp: true };
    const placeholder = {
      role: "assistant",
      content: "",
      _temp: true,
      _loading: true,
    };
    setMessages((prev) => [...prev, tempUser, placeholder]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const result = await ChatService.ask({
        sessionId,
        groupCalendarId: selectedGroupId,
        message: text,
      });
      setSessionId(result.session_id);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m._temp);
        return [
          ...withoutTemp,
          { role: "user", content: text },
          {
            role: "assistant",
            content: result.answer,
            retrieved_chunks: result.sources,
          },
        ];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m._temp));
      setError(err.message || "응답 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
  };

  const canSend = !!input.trim() && !loading && !!selectedGroupId;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        {/* 헤더 */}
        <View
          style={[styles.header, { borderBottomColor: theme.colors.border }]}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <MaterialIcons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            챗봇
          </Text>
          <TouchableOpacity
            onPress={handleNewSession}
            style={styles.headerBtn}
            accessibilityLabel="새 대화"
          >
            <MaterialIcons
              name="add-comment"
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* 그룹 칩바 */}
        <View
          style={[styles.chipBar, { borderBottomColor: theme.colors.border }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipBarContent}
          >
            {groups.length === 0 ? (
              <Text
                style={{
                  color: theme.colors.muted,
                  padding: 8,
                  fontSize: 13,
                }}
              >
                참여한 공유 일정방이 없어요
              </Text>
            ) : (
              groups.map((g) => {
                const isActive = g.id === selectedGroupId;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setSelectedGroupId(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive
                          ? theme.colors.tint
                          : theme.colors.card,
                        borderColor: isActive
                          ? theme.colors.tint
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isActive ? "#fff" : theme.colors.text,
                        fontSize: 14,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* 메시지 리스트 */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
        >
          {loadingGroup && (
            <ActivityIndicator
              color={theme.colors.tint}
              style={{ marginTop: 24 }}
            />
          )}
          {!loadingGroup && messages.length === 0 && (
            <View style={styles.emptyWrap}>
              <MaterialIcons
                name="auto-awesome"
                size={40}
                color={theme.colors.muted}
              />
              <Text
                style={{
                  color: theme.colors.muted,
                  marginTop: 12,
                  fontSize: 14,
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                선택한 일정방의 메모를 바탕으로 답해줘요{"\n"}
                예시: "지난번에 뭐 먹기로 했지?"
              </Text>
            </View>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} theme={theme} />
          ))}
          {error && (
            <Text
              style={{
                color: theme.colors.danger,
                padding: 12,
                fontSize: 13,
              }}
            >
              {error}
            </Text>
          )}
        </ScrollView>

        {/* 입력 */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="질문을 입력하세요"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
              },
            ]}
            multiline
            editable={!loading && !!selectedGroupId}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend
                  ? theme.colors.tint
                  : theme.colors.border,
                opacity: canSend ? 1 : 0.5,
              },
            ]}
          >
            <MaterialIcons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MessageBubble({ message, theme }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  return (
    <View
      style={[
        styles.bubbleWrap,
        { alignItems: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.tint : theme.colors.card,
            maxWidth: "85%",
          },
        ]}
      >
        {message._loading ? (
          <ActivityIndicator size="small" color={theme.colors.text} />
        ) : (
          <Text
            style={{
              color: isUser ? "#fff" : theme.colors.text,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {message.content}
          </Text>
        )}
      </View>
      {isAssistant &&
        message.retrieved_chunks &&
        message.retrieved_chunks.length > 0 && (
          <View style={styles.sourcesWrap}>
            {message.retrieved_chunks.slice(0, 3).map((c, i) => (
              <View
                key={i}
                style={[
                  styles.sourceCard,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.muted, fontSize: 11 }}>
                  {c.date}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 13,
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {c.title}
                </Text>
                {c.snippet && (
                  <Text
                    style={{
                      color: theme.colors.muted,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {c.snippet}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Platform.OS === "ios" ? 56 : 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700" },
  chipBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  chipBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 32 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  bubbleWrap: { width: "100%", marginVertical: 4 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  sourcesWrap: {
    marginTop: 6,
    width: "85%",
  },
  sourceCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
