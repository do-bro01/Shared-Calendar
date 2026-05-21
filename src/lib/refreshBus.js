// 화면 간 새로고침 신호를 전달하는 단순 pub/sub 버스.
// 설정 화면의 새로고침 버튼이 emit 하면, 구독 중인 다른 화면들이 데이터를 다시 불러옴.
const listeners = new Set();

export const refreshBus = {
  emit() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("refreshBus listener error:", e);
      }
    });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export default refreshBus;
