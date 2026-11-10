// 온말(ONMAL) 설정 — 이 파일만 센터 환경에 맞게 수정합니다.
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

  // 말 멈춤을 문장 끝으로 판단하는 시간(ms). 짧을수록 빠르지만 문장이 잘게 끊김.
  // 상담사(한국어, 쉼표마다 쉬는 긴 설명)는 900, 내담자(단어를 고르느라 자주 멈춤)는 1050 권장
  SEGMENT_SILENCE_MS: 900,
  SEGMENT_SILENCE_MS_CLIENT: 1050,

  // 용어 뒤 한국어 발음 병기 표시(용어집 term에 이미 포함된 경우 그대로 사용)
  SHOW_KO_READING: true,

  // 상담 시작 후 자동 종료까지의 시간(분). 종료 5분 전에 안내가 뜨고 [30분 연장]을 누를 수 있음. 0이면 끔
  AUTO_END_MIN: 60,

  // 대화가 이 시간(분) 동안 없으면 마이크를 잠시 멈춤(음성 인식은 조용한 시간도 사용 시간으로 계산됨).
  // [시작]을 누르거나 상대가 말하면 다시 켜짐. 0이면 끔
  IDLE_PAUSE_MIN: 10,

  // 말할 때만 보내기: 마이크 소리 중 말이 감지된 구간만 음성 인식(Azure)으로 보낸다(조용한 시간을 보내지 않아 사용 시간이 줄어든다).
  // false면 예전처럼 마이크가 켜져 있는 동안 계속 보낸다. 시험할 때는 주소에 ?gate=1(켬) / ?gate=0(끔)을 붙이면 이 값과 상관없이 바뀐다
  GATED_AUDIO: false,

  // 센터 이름(화면 상단·내보내기 파일에 표시)
  CENTER_NAME: "충남진로진학상담센터",
};
