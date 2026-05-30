// src/context/OverlayContext.js
//
// OverlayHost / Portal — App.js 최상단에 OverlayHost를 두고, 임의의 위치에서 Portal로
// JSX를 그 최상단 레이어에 텔레포트해서 그린다.
//
// 만들어진 이유: iOS native <Modal>은 transparent=true여도 슬라이드/페이드 중에는
// modal view가 상태바 영역까지 풀스크린으로 확장되지 않아 dim 오버레이가 상태바 영역만
// 늦게 따라온다. Portal로 NavigationContainer 위에 absoluteFill 레이어를 깔면
// 그 레이어는 상태바·하단 탭바까지 포함한 전체 화면을 자유롭게 덮을 수 있다.
//
// 구현 노트:
// - 상태(portals 맵)는 외부 store에 두고 PortalLayer만 useSyncExternalStore로 구독한다.
//   → Portal 사용 컴포넌트가 갱신될 때 OverlayHost/NavigationContainer가 같이 리렌더되지 않음.
// - Portal은 children을 매 렌더마다 store에 set한다. 같은 자리 같은 컴포넌트면 React가
//   reconcile하므로 Reanimated 상태/transform은 유지된다.
// - Portal이 unmount되면 store에서 제거되며, Reanimated의 exiting 애니메이션은
//   네이티브 측에서 정상 재생된다.

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { StyleSheet, View } from "react-native";

const createPortalStore = () => {
  let portals = new Map();
  const listeners = new Set();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return portals;
    },
    set(id, node) {
      portals = new Map(portals);
      portals.set(id, node);
      listeners.forEach((l) => l());
    },
    delete(id) {
      if (portals.has(id)) {
        portals = new Map(portals);
        portals.delete(id);
        listeners.forEach((l) => l());
      }
    },
  };
};

const PortalStoreContext = createContext(null);

export const OverlayHost = ({ children }) => {
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createPortalStore();

  return (
    <PortalStoreContext.Provider value={storeRef.current}>
      <View style={styles.root}>
        {children}
        <PortalLayer store={storeRef.current} />
      </View>
    </PortalStoreContext.Provider>
  );
};

const PortalLayer = ({ store }) => {
  const portals = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (portals.size === 0) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      // iOS: Modal 없이 자체 레이어로 dim/sheet를 그리는 이상, 안드로이드 elevation 영향을 받지 않도록 충분히 큰 zIndex.
    >
      {Array.from(portals).map(([id, node]) => (
        <React.Fragment key={id}>{node}</React.Fragment>
      ))}
    </View>
  );
};

export const Portal = ({ children }) => {
  const store = useContext(PortalStoreContext);
  const id = useId();

  // 매 렌더마다 최신 children을 store에 반영 (clojure 갱신 포함).
  // React 측에서 같은 컴포넌트면 reconcile되어 마운트 유지된다.
  useEffect(() => {
    if (store) store.set(id, children);
  });

  // 언마운트 시 store에서 제거.
  useEffect(() => {
    return () => {
      if (store) store.delete(id);
    };
  }, [id, store]);

  return null;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
