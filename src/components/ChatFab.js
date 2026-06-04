import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Portal } from "../context/OverlayContext";
import { useTheme } from "../context/ThemeContext";
import ChatModal from "./ChatModal";

// 우하단 고정 동그란 챗봇 진입 버튼.
// - Portal 로 OverlayHost 상단 레이어에 띄워 탭바·화면 위에 오버레이
// - 탭바(bottom 12 + height 72) 위로 약간 띄워 시각적 분리
export default function ChatFab() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Portal>
        <View style={styles.wrap} pointerEvents="box-none">
          <Pressable
            onPress={() => setOpen(true)}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: theme.colors.tint,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityLabel="챗봇 열기"
          >
            <MaterialIcons name="auto-awesome" size={26} color="#fff" />
          </Pressable>
        </View>
      </Portal>
      <ChatModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 20,
    bottom: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
