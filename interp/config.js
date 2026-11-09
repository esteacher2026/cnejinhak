// 상담 통역 패드 설정 — 이 파일만 센터 환경에 맞게 수정합니다.
window.INTERP_CONFIG = {
  // Cloudflare Worker 주소. 비워 두면 "데모 모드"(브라우저 내장 음성인식 + 가짜 번역 + 같은 브라우저 탭 간 동기화)
  WORKER_URL: "https://interp-pad.cnejinhak2025.workers.dev",

  // Firebase 웹 앱 설정(콘솔 > 프로젝트 설정 > 내 앱). null이면 같은 브라우저 탭 사이에서만 동기화(데모)
  FIREBASE: { apiKey: "AIzaSyCmwTpreva1gwUX7s29s4s0pVE8FFM25Mw", authDomain: "interp-pad.firebaseapp.com", projectId: "interp-pad", appId: "1:867717921917:web:164f161891a08fec04c514" },
  // 예시:
  // FIREBASE: { apiKey: "...", authDomain: "xxx.firebaseapp.com", projectId: "xxx", appId: "..." },

  // 정밀 번역(Claude) 적용 방향. 한국어→내담자 언어는 켬, 내담자 언어→한국어는 끔(속도 우선)
  REFINE_KO_TO_X: true,
  REFINE_X_TO_KO: false,

  // 식별정보(이름·연락처 등)를 말할 때 정밀 번역(해외 API)을 잠시 끄는 토글을 상담사 화면에 표시
  SHOW_PRIVACY_TOGGLE: true,

  // 말 멈춤을 문장 끝으로 판단하는 시간(ms). 짧을수록 빠르지만 문장이 잘게 끊김
  SEGMENT_SILENCE_MS: 650,

  // 용어 뒤 한국어 발음 병기 표시(용어집 term에 이미 포함된 경우 그대로 사용)
  SHOW_KO_READING: true,

  // 센터 이름(화면 상단·내보내기 파일에 표시)
  CENTER_NAME: "충남진로진학상담센터",
};
