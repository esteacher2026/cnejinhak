(function () {
  const totalPages = 60;
  const pageTexts = Array.isArray(window.PAGE_TEXT) ? window.PAGE_TEXT : [];
  const byPage = new Map(pageTexts.map((item) => [item.page, item.text || ""]));

  const colors = {
    "국어": { accent: "#4d9a63", soft: "#edf8f0" },
    "수학": { accent: "#2468b2", soft: "#edf4fb" },
    "영어": { accent: "#d97821", soft: "#fff3e8" },
    "총평": { accent: "#008fa3", soft: "#eaf7f9" },
  };

  const multiPageSpans = {
    39: [39, 40],
    44: [44, 45],
    50: [50, 51],
    52: [52, 53],
    54: [54, 55, 56],
    57: [57, 58, 59],
  };

  const diagnosis = [
    {
      subject: "국어",
      title: "연계 체감은 높고, 판단은 더 촘촘해짐",
      summary: "독서와 문학 모두 평이한 흐름이지만, 상위권 변별은 지문 세부와 선지 논리 검증에서 발생했습니다.",
      bullets: [
        "독서: SQ3R, 노비제와 민권, 온라인 정보 비대칭, 라플라스 식 등 연계 소재가 뚜렷함",
        "문학: 갈래복합 22번, 고전소설 29번에서 작품 간 대비와 공간별 갈등 구조가 변별",
        "화작·언매: 자료 활용, 문법 요소 복합 판단처럼 선지 분할 검증이 중요",
      ],
      tags: ["지문 세부", "선지 논리", "연계"],
      page: 9,
    },
    {
      subject: "수학",
      title: "공통 후반과 선택 후반에서 구조 해석이 승부",
      summary: "평균 난도는 안정적이지만, 만점권은 수열·그래프·합성함수·이차곡선의 낯선 조건 해석에서 갈렸습니다.",
      bullets: [
        "공통: 21번 그래프 추론, 22번 귀납적 수열과 경우의 수 아이디어가 핵심",
        "미적분: 역함수, 급수, 합성함수의 미분가능성 조건을 식으로 번역하는 능력 필요",
        "선택: 확통은 경우 분류, 기하는 정의 기반 거리 관계와 내적의 기하적 의미가 중요",
      ],
      tags: ["구조 해석", "조건 번역", "후반부"],
      page: 25,
    },
    {
      subject: "영어",
      title: "지문 난도보다 매력적인 오답 선지가 변별",
      summary: "신유형은 없지만 빈칸, 순서, 삽입 문항에서 미세한 논리 뉘앙스와 대명사 지칭 판단이 강하게 작동했습니다.",
      bullets: [
        "21번: 부정 의문문과 함축 의미가 결합되어 주장 반대 진술을 골라야 함",
        "31·34번: 배경지식보다 지문 내부 논리와 개념 차이를 끝까지 유지해야 함",
        "36~39번: 명시적 표지어보다 문맥 전환점, 대명사 지칭, 예시 전개가 중요",
      ],
      tags: ["선지 매력도", "정밀 독해", "논리 흐름"],
      page: 47,
    },
  ];

  const focusItems = [
    item("국어", "독서", "8번", "서양 노예제 해방 담론과 지문 관점 비교", 12, "외적 준거와 지문 속 사상가의 인간관을 비교해야 했습니다.", "성취라는 키워드를 사회 제도 변화의 능동성과 성급히 연결하기 쉬웠습니다.", "인물별 핵심 주장, 전제, 제도 변화 논리를 표로 나누어 검증합니다.", ["인문", "비교", "오답 유도"]),
    item("국어", "독서", "12번", "상반된 이론의 공통 전제 도출", 13, "대립 구조를 넘어 두 이론이 공유하는 기본권 전제를 찾아야 했습니다.", "사전·사후, 주체·대상 같은 조건을 유사 어휘만 보고 판단하기 쉽습니다.", "차이점과 함께 공통 전제를 별도로 표시하며 읽는 훈련이 필요합니다.", ["사회", "공통 전제"]),
    item("국어", "독서", "13번", "법률 조항을 구체적 사례에 적용", 14, "의무의 주체와 헌법재판소 의견을 상황에 맞게 연결해야 했습니다.", "정보 제공자와 사업자를 명칭만 보고 같은 지위로 처리하기 쉽습니다.", "법·규정 지문은 행위 주체, 규제 대상, 제재 조건을 분리합니다.", ["사회", "적용", "71.3%"]),
    item("국어", "문학", "22번", "갈래복합 세 작품의 공통 표현상 특징", 17, "개별 시구가 아니라 세 작품을 관통하는 상황의 대비를 잡아야 했습니다.", "중심 시어의 표면 의미에 머물면 공통 구조를 놓치기 쉽습니다.", "작품별 중심 소재, 정서, 대비 관계를 한 줄로 병렬 정리합니다.", ["문학", "갈래복합", "57.1%"]),
    item("국어", "문학", "29번", "고전소설 공간별 특징과 갈등 양상", 18, "홍길동전의 두 공간에서 사건 전개와 갈등이 어떻게 달라지는지 비교했습니다.", "전체 줄거리 배경지식에 기대면 제시 지문의 공간 기능을 놓칩니다.", "인물 이동에 따라 공간, 사건, 갈등 표면화 방식을 함께 표시합니다.", ["고전소설", "41.7%"]),
    item("국어", "화법과 작문", "45번", "복합 자료 활용과 초고 보완", 21, "자료 세부 정보를 어느 문단에 어떻게 보강할지 따지는 문항입니다.", "동일 편성 기준 좌석 수 증가를 편성 증가로 오독하는 식의 인과 오류가 매력적입니다.", "선지를 전제와 결론으로 나누어 자료 대응 여부를 단계적으로 검증합니다.", ["화작", "자료 활용"]),
    item("국어", "언어와 매체", "37번", "문법 요소의 복합 실현 판단", 24, "관형사형 어미, 부사어, 연결 어미, 보조 용언 등 여러 조건을 동시에 확인했습니다.", "하나의 문법 요소만 맞아도 전체 선지가 맞다고 착각하기 쉽습니다.", "예문마다 문장 성분과 문법 요소 체크리스트를 만들어 누락을 줄입니다.", ["언매", "문법"]),

    item("수학", "수학 I", "12번", "등비수열의 구조와 계산 최적화", 27, "첫째항과 공비를 식으로 바꾸고 최종식의 구조를 보아야 했습니다.", "모든 미지수를 끝까지 구하려 하면 계산이 늘어납니다.", "최종적으로 필요한 값의 형태를 먼저 확인하고 계산 설계도를 세웁니다.", ["수열", "3점"]),
    item("수학", "수학 I", "14번", "삼각함수의 대칭성과 교점 개수", 28, "주기성과 대칭성을 이용해 상수함수와의 교점 조건을 추론했습니다.", "그래프 전체 구조보다 국소 계산에 매달리면 조건을 놓칩니다.", "주기, 대칭축, 교점 개수를 한 그림에 고정해 해석합니다.", ["삼각함수", "4점"]),
    item("수학", "수학 I", "20번", "지수·로그 빈칸 추론의 대수적 연립", 29, "기하적 직관보다 식 전환과 연립 과정이 중요했습니다.", "빈칸 주변 형태만 맞추려 하면 핵심 조건이 흩어집니다.", "주어진 관계를 좌표·식·조건으로 분해해 연립 가능한 형태로 바꿉니다.", ["지수로그", "단답"]),
    item("수학", "수학 I", "22번", "귀납적 수열과 수형도형 역추적", 30, "하나의 항에서 여러 항이 동시에 결정되는 낯선 점화 구조였습니다.", "일반적인 전진·역추적 수열 풀이만 적용하면 경우를 누락하기 쉽습니다.", "초기항에서 목표값까지 연산 조합과 항 번호 증가 배수를 수형도로 정리합니다.", ["수열", "최고난도"]),
    item("수학", "수학 II", "11번", "극한값 존재 여부와 미정계수 결정", 31, "분모가 0으로 갈 때 분자의 수렴값을 비교해 조건을 도출했습니다.", "존재한다와 존재하지 않는다를 같은 방식으로 처리하면 조건이 뒤섞입니다.", "분자·분모의 수렴값을 각각 0과 비교하는 식 세우기를 반복합니다.", ["극한", "4점"]),
    item("수학", "수학 II", "13번", "정적분 차이와 함수 대칭성", 32, "정적분 관계를 계산보다 그래프 대칭성으로 해석해야 했습니다.", "식 전개만으로 밀어붙이면 부호와 구간 구조가 복잡해집니다.", "적분식이 나타내는 넓이와 대칭 이동 관계를 그림으로 확인합니다.", ["적분", "4점"]),
    item("수학", "수학 II", "15번", "절댓값 정적분 부등식의 부호 변화", 33, "부등식을 x축 교차와 평행이동 관점으로 번역해야 했습니다.", "절댓값을 단순 계산으로만 처리하면 경우가 과도하게 늘어납니다.", "부호가 바뀌는 지점과 그래프 위치 관계를 먼저 정합니다.", ["적분", "그래프"]),
    item("수학", "수학 II", "19번", "함수 조건의 실전적 해석", 34, "주어진 조건을 함수의 형태와 계수 관계로 정리해야 했습니다.", "조건을 순서대로 계산만 하면 필요한 구조가 늦게 보입니다.", "조건이 지시하는 함수값, 기울기, 구간 정보를 표로 정리합니다.", ["미분", "조건 해석"]),
    item("수학", "수학 II", "21번", "움직이는 그래프와 불연속 조건", 35, "독립변수에 따라 움직이는 함수와 원래 함수의 교점 변화를 관찰했습니다.", "불연속점 1개라는 조건을 단순 대입으로만 보면 접하는 상황을 찾기 어렵습니다.", "함수족의 이동, 접점, 교점 개수 변화를 한 좌표평면에서 추적합니다.", ["미분", "그래프"]),
    item("수학", "미적분", "28번", "새로 정의된 함수와 역함수 관계", 36, "교점으로 정의된 두 함수의 대응 방향을 읽어 역함수 구조를 발견해야 했습니다.", "함수식을 직접 구하려고 하면 계산량이 커집니다.", "교점 조건은 대응 관계부터 해석하고 합성 관계를 확인합니다.", ["역함수", "미분"]),
    item("수학", "미적분", "29번", "수열과 급수 조건의 구조화", 37, "극한과 급수의 조건을 필요한 항의 관계로 정리해야 했습니다.", "항별 계산에 치우치면 수렴 조건의 핵심을 놓치기 쉽습니다.", "수렴·발산 조건을 식의 크기 비교와 항의 형태로 바꿉니다.", ["급수", "조건"]),
    item("수학", "미적분", "30번", "합성함수 미분가능성과 극값 조건", 38, "세제곱근 내부식의 근과 중복도, 극값 조건을 함께 해석했습니다.", "미분가능성 조건을 단순 성질로 넘기면 함수의 인수 구조를 놓칩니다.", "내부식의 근, 도함수의 근, 극값 위치를 계수 조건으로 변환합니다.", ["합성함수", "고난도"]),
    item("수학", "확률과 통계", "28번", "카드 상태 변화와 홀짝성", 39, "주사위 결과가 여러 카드의 상태를 동시에 바꾸는 조건을 분석했습니다.", "뒤집힘 횟수와 최종 상태의 홀짝 관계를 놓치면 경우가 섞입니다.", "각 카드별 변화 조건을 홀수·짝수 기준으로 먼저 정리합니다.", ["확통", "상태 변화"]),
    item("수학", "확률과 통계", "29번", "조건부 확률의 표본공간 재설정", 41, "곱이 홀수라는 조건이 모든 눈을 홀수로 제한한다는 점이 핵심입니다.", "조건을 사후 필터처럼 처리하면 표본공간을 잘못 잡습니다.", "조건부 확률에서는 조건 사건이 만든 새 표본공간을 먼저 확정합니다.", ["조건부확률", "경우의 수"]),
    item("수학", "확률과 통계", "30번", "이웃하지 않는 조건의 공간 배치", 42, "검은색 공을 기준으로 공간을 나누고 중복조합을 활용했습니다.", "색 공을 개별 객체처럼 세면 중복과 누락이 발생합니다.", "구별 여부와 배치 공간을 먼저 결정한 뒤 분배 조건을 적용합니다.", ["배치", "중복조합"]),
    item("수학", "기하", "28번", "타원의 정의와 넓이 조건 연결", 43, "초점 거리의 합, 길이 비율, 삼각형 넓이를 종합했습니다.", "표준형 공식에 바로 넣으려 하면 도형 속 거리 관계가 보이지 않습니다.", "정의에서 출발해 모든 선분을 하나의 문자로 표현합니다.", ["타원", "넓이"]),
    item("수학", "기하", "29번", "쌍곡선·포물선 정의와 교점 조건", 44, "초점 거리 차와 준선 거리 관계를 같은 y좌표 조건과 연결했습니다.", "공식 암기만으로는 두 이차곡선의 정의가 결합되는 지점을 찾기 어렵습니다.", "교점 위치와 준선을 그림에 표시하고 정의식을 동시에 세웁니다.", ["이차곡선", "정의"]),
    item("수학", "기하", "30번", "벡터 내적의 기하적 의미", 46, "내적 조건을 길이, 끼인각, 정사영의 의미로 해석했습니다.", "좌표 계산만 고집하면 원의 성질과 대칭성이 늦게 드러납니다.", "내적식을 도형 조건으로 바꾸고 움직이는 점의 범위를 추적합니다.", ["벡터", "최댓값"]),

    item("영어", "함축 의미", "21번", "동물 의식 인정과 인간 중심 의식관 비판", 50, "부정 의문문 구조와 밑줄 표현의 함축 의미가 결합되었습니다.", "give up 표현과 글쓴이 주장 방향을 반대로 잡기 쉽습니다.", "밑줄 문장만 보지 않고 앞문장의 논리 전환과 주장 방향을 함께 확인합니다.", ["함축", "3점"]),
    item("영어", "빈칸", "31번", "conservation과 preservation의 개념 차이", 52, "유의어처럼 보이는 두 개념의 미묘한 차이가 정답 근거였습니다.", "상식적 보존 개념으로 접근하면 지문 내부의 desired 의미를 놓칩니다.", "배경지식을 접고 지문이 정의한 개념 차이를 끝까지 유지합니다.", ["빈칸", "개념 대비"]),
    item("영어", "빈칸", "34번", "예술품 가치 변동성과 수집가의 확신", 54, "미학적 가치의 유동성 속에서도 미래 방향 예측의 확신을 읽어야 했습니다.", "불확실성 서술이 길어 핵심 결론을 잃기 쉽습니다.", "양보 흐름과 결론 문장의 주체·행위를 표시하며 읽습니다.", ["빈칸", "추상 소재"]),
    item("영어", "순서", "37번", "구경거리의 문화적 속성과 창작 전략", 57, "문화적 전략, 문학 비유, 관습과 혁신의 확장 관계가 연결됩니다.", "By extension 같은 연결 표지를 보아도 앞선 비유의 대상이 흐려질 수 있습니다.", "각 문단의 역할을 화두, 확장, 결론으로 압축해 순서를 판단합니다.", ["순서", "논리 연결"]),
  ];

  const subjectSections = {
    "국어": [
      section("전체 총평", "국어는 전반적으로 평이했으나 지문 세부와 선지의 논리 관계를 정확히 판별하는 능력이 변별 요소였습니다.", "3-8쪽", 3, ["독서·문학 연계 체감", "고난도 선지 판단", "상위권 변별"]),
      section("독서", "SQ3R, 인문 통합, 사회 이론, 과학·기술 지문으로 구성되며 8·12·13번에서 고난도 변별이 나타났습니다.", "9-14쪽", 9, ["EBS 연계", "이론 비교", "사례 적용"]),
      section("문학", "현대소설, 갈래복합, 고전소설, 고전시가로 구성되며 작품 간 공통 구조와 공간별 갈등 파악이 중요했습니다.", "15-18쪽", 15, ["갈래복합 22번", "고전소설 29번"]),
      section("화법과 작문", "익숙한 틀이지만 45번의 복합 자료 활용에서 자료와 초고의 인과 관계 검증이 필요했습니다.", "19-21쪽", 19, ["자료 해석", "선지 분할"]),
      section("언어와 매체", "언어는 여러 문법 요소의 실현 판단, 매체는 자료 비교와 종합 판단이 중심입니다.", "22-24쪽", 22, ["문법 요소", "매체 자료"]),
    ],
    "수학": [
      section("배점 구성", "공통 22문항 74점, 선택 8문항 26점 구조이며 4점 문항이 전체 변별을 이끕니다.", "25쪽", 25, ["공통 74점", "선택 26점"]),
      section("과목별 총평", "교과 개념의 본질 이해와 조건을 식·그래프로 번역하는 실전적 해석력이 요구되었습니다.", "26쪽", 26, ["개념 이해", "조건 번역"]),
      section("수학 I", "수열, 지수·로그, 삼각함수에서 구조 파악과 낯선 점화식 해석이 핵심입니다.", "27-30쪽", 27, ["12번", "14번", "20번", "22번"]),
      section("수학 II", "극한, 미분, 적분 조건을 그래프와 부호 변화로 해석하는 문항들이 배치되었습니다.", "31-35쪽", 31, ["11번", "13번", "15번", "19번", "21번"]),
      section("미적분", "역함수, 급수, 합성함수 미분가능성 등 함수 구조를 먼저 파악해야 하는 문항이 많았습니다.", "36-38쪽", 36, ["28번", "29번", "30번"]),
      section("확률과 통계", "상태 변화, 조건부 확률, 이웃하지 않는 배치처럼 분류 기준을 세우는 능력이 중요했습니다.", "39-42쪽", 39, ["28번", "29번", "30번"]),
      section("기하", "이차곡선 정의와 벡터 내적의 기하적 의미를 도형 조건으로 연결해야 했습니다.", "43-46쪽", 43, ["28번", "29번", "30번"]),
    ],
    "영어": [
      section("주요 유형별 분석", "신유형 없이 안정적인 구성이지만 함축, 빈칸, 순서·삽입에서 선지 판단의 정밀도가 요구되었습니다.", "47-49쪽", 47, ["함축", "빈칸", "순서", "삽입"]),
      section("21번", "동물 의식 인정의 당위성과 인간 중심 의식관 비판을 다룬 함축 의미 추론 문항입니다.", "50-51쪽", 50, ["함축 의미", "부정 의문문"]),
      section("31번", "conservation과 preservation의 개념 차이를 바탕으로 빈칸을 판단하는 문항입니다.", "52-53쪽", 52, ["빈칸", "개념 차이"]),
      section("34번", "예술 작품 가치의 유동성과 수집가의 미래 확신을 읽어야 하는 추상 소재 빈칸 문항입니다.", "54-56쪽", 54, ["빈칸", "추상 논리"]),
      section("37번", "구경거리의 문화적 속성과 창작 전략을 문단 순서로 연결하는 문항입니다.", "57-59쪽", 57, ["순서", "문맥 연결"]),
    ],
  };

  const mathRows = [
    row("공통", "수학 I", "I. 지수함수와 로그함수", "1", "16", "10, 20", "4문항(13점)"),
    row("공통", "수학 I", "II. 삼각함수", "", "6, 8", "14", "3문항(10점)"),
    row("공통", "수학 I", "III. 수열", "", "3, 18", "12, 22", "4문항(14점)"),
    row("공통", "수학 II", "I. 함수의 극한과 연속", "", "4", "11", "2문항(7점)"),
    row("공통", "수학 II", "II. 미분", "2", "5, 7, 19", "21", "5문항(15점)"),
    row("공통", "수학 II", "III. 적분", "", "17", "9, 13, 15", "4문항(15점)"),
    row("합계", "", "", "2문항", "10문항", "10문항", "22문항(74점)", true),
    row("선택", "확률과 통계", "I. 경우의 수", "23", "25, 27", "30", ""),
    row("선택", "확률과 통계", "II. 확률", "", "24, 26", "28, 29", ""),
    row("선택", "확률과 통계", "III. 통계", "", "", "", ""),
    row("선택", "미적분", "I. 수열의 극한", "23", "25", "29", ""),
    row("선택", "미적분", "II. 미분법", "", "24, 26, 27", "28, 30", ""),
    row("선택", "미적분", "III. 적분법", "", "", "", ""),
    row("선택", "기하", "I. 이차곡선", "", "24, 26", "28, 29", ""),
    row("선택", "기하", "II. 평면벡터", "23", "25, 27", "30", ""),
    row("선택", "기하", "III. 공간도형과 공간좌표", "", "", "", ""),
    row("전체", "", "", "3문항", "14문항", "13문항", "30문항(100점)", true),
  ];

  let activeSubject = "all";
  let focusSubject = "all";
  let subjectTab = "국어";
  let currentPage = 1;

  const els = {
    diagnosisGrid: document.getElementById("diagnosisGrid"),
    focusGrid: document.getElementById("focusGrid"),
    focusSegment: document.getElementById("focusSegment"),
    subjectTabs: document.getElementById("subjectTabs"),
    subjectPanel: document.getElementById("subjectPanel"),
    subjectFilter: document.getElementById("subjectFilter"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    mathRows: document.getElementById("mathRows"),
    pageGrid: document.getElementById("pageGrid"),
    pageJump: document.getElementById("pageJump"),
    jumpButton: document.getElementById("jumpButton"),
    dialog: document.getElementById("pageDialog"),
    dialogPages: document.getElementById("dialogPages"),
    dialogTitle: document.getElementById("dialogTitle"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    closeDialog: document.getElementById("closeDialog"),
  };

  function item(subject, area, number, title, page, signal, pitfall, strategy, tags) {
    return { subject, area, number, title, page, signal, pitfall, strategy, tags };
  }

  function section(title, summary, range, page, tags) {
    return { title, summary, range, page, tags };
  }

  function row(group, course, unit, two, three, four, total, isTotal) {
    return { group, course, unit, two, three, four, total, isTotal };
  }

  function pagePath(page) {
    return `assets/pages/page-${String(page).padStart(2, "0")}.jpg`;
  }

  function pagesForCard(card) {
    return multiPageSpans[card.page] || [card.page];
  }

  function pagesForSection(sectionItem) {
    const numbers = (sectionItem.range || "").match(/\d+/g)?.map(Number) || [];
    if (numbers.length >= 2 && numbers[1] > numbers[0]) {
      return Array.from({ length: numbers[1] - numbers[0] + 1 }, (_, index) => numbers[0] + index);
    }
    return [sectionItem.page];
  }

  function pagesAttr(pages) {
    return pages.join(",");
  }

  function pageRangeLabel(pages) {
    if (pages.length === 1) return `${pages[0]}쪽`;
    return `${pages[0]}-${pages[pages.length - 1]}쪽`;
  }

  function pageSubject(page) {
    if (page >= 9 && page <= 24) return "국어";
    if (page >= 25 && page <= 46) return "수학";
    if (page >= 47 && page <= 59) return "영어";
    return "총평";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function textForSearch(item) {
    return Object.values(item)
      .flat()
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function query() {
    return els.searchInput.value.trim().toLowerCase();
  }

  function colorStyle(subject) {
    const c = colors[subject] || colors["총평"];
    return `--accent:${c.accent};--accent-soft:${c.soft}`;
  }

  function renderDiagnosis() {
    els.diagnosisGrid.innerHTML = diagnosis
      .map((d) => `
        <article class="diagnosis-card" style="${colorStyle(d.subject)}">
          <div class="label">${d.subject}</div>
          <h3>${escapeHtml(d.title)}</h3>
          <p>${escapeHtml(d.summary)}</p>
          <ul>${d.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
          <div class="tag-row">${d.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="card-actions">
            <button class="text-button primary" type="button" data-page="${d.page}">
              ${openIcon()} 원문
            </button>
          </div>
        </article>
      `)
      .join("");
  }

  function renderFocus() {
    const q = query();
    const filtered = focusItems.filter((card) => {
      const subjectOk = focusSubject === "all" || card.subject === focusSubject;
      const sideOk = activeSubject === "all" || card.subject === activeSubject;
      const queryOk = !q || textForSearch(card).includes(q);
      return subjectOk && sideOk && queryOk;
    });

    els.focusGrid.innerHTML = filtered.length
      ? filtered
          .map((card) => {
            const pages = pagesForCard(card);
            return `
              <article class="focus-card" style="${colorStyle(card.subject)}">
                <div class="focus-head">
                  <div>
                    <div class="label">${escapeHtml(card.subject)} · ${escapeHtml(card.area)}</div>
                    <h3>${escapeHtml(card.number)} ${escapeHtml(card.title)}</h3>
                  </div>
                  <span class="badge">${pageRangeLabel(pages)}</span>
                </div>
                <dl>
                  <dt>핵심</dt>
                  <dd>${escapeHtml(card.signal)}</dd>
                  <dt>오답 포인트</dt>
                  <dd>${escapeHtml(card.pitfall)}</dd>
                  <dt>대비전략</dt>
                  <dd>${escapeHtml(card.strategy)}</dd>
                </dl>
                <div class="tag-row">${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
                <div class="card-actions">
                  <button class="text-button primary" type="button" data-pages="${pagesAttr(pages)}">
                    ${openIcon()} 원문
                  </button>
                </div>
              </article>
            `;
          })
          .join("")
      : empty("조건에 맞는 고난도 문항이 없습니다.");
  }

  function renderSubjectPanel() {
    const rows = subjectSections[subjectTab] || [];
      els.subjectPanel.innerHTML = rows
        .map((s) => {
          const pages = pagesForSection(s);
          return `
            <article class="subject-item" style="${colorStyle(subjectTab)}">
              <div class="label">${escapeHtml(subjectTab)}</div>
              <h3>${escapeHtml(s.title)}</h3>
              <p>${escapeHtml(s.summary)}</p>
              <div class="tag-row">${s.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
              <span class="page-range">${escapeHtml(s.range)}</span>
              <div class="card-actions">
                <button class="text-button primary" type="button" data-pages="${pagesAttr(pages)}">
                  ${openIcon()} 원문
                </button>
              </div>
            </article>
          `;
        })
      .join("");
  }

  function renderMathRows() {
    els.mathRows.innerHTML = mathRows
      .map((r) => `
        <tr class="${r.isTotal ? "total-row" : ""}">
          <td>${escapeHtml(r.group)}</td>
          <td>${escapeHtml(r.course)}</td>
          <td>${escapeHtml(r.unit)}</td>
          <td>${escapeHtml(r.two)}</td>
          <td>${escapeHtml(r.three)}</td>
          <td>${escapeHtml(r.four)}</td>
          <td>${escapeHtml(r.total)}</td>
        </tr>
      `)
      .join("");
  }

  function renderPageGrid() {
    const q = query();
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((page) => {
      const subjectOk = activeSubject === "all" || pageSubject(page) === activeSubject;
      const textOk = !q || (byPage.get(page) || "").toLowerCase().includes(q);
      return subjectOk && textOk;
    });

    els.pageGrid.innerHTML = pages.length
      ? pages
          .map((page) => `
            <button class="page-card" type="button" data-page="${page}">
              <img loading="lazy" src="${pagePath(page)}" alt="${page}쪽 원문" />
              <span><b>${page}쪽</b><em>${pageSubject(page)}</em></span>
            </button>
          `)
          .join("")
      : empty("조건에 맞는 원문 페이지가 없습니다.");
  }

  function renderSearchResults() {
    const q = query();
    if (!q) {
      els.searchResults.innerHTML = "";
      return;
    }

    const pageMatches = pageTexts
      .filter((p) => {
        const subjectOk = activeSubject === "all" || pageSubject(p.page) === activeSubject;
        return subjectOk && (p.text || "").toLowerCase().includes(q);
      })
      .slice(0, 10);

    const cardMatches = focusItems
      .filter((card) => {
        const subjectOk = activeSubject === "all" || card.subject === activeSubject;
        return subjectOk && textForSearch(card).includes(q);
      })
      .slice(0, 6);

    const blocks = [];
    if (cardMatches.length) {
      blocks.push(`<p class="panel-title">문항</p>`);
      blocks.push(...cardMatches.map((card) => resultButton(card.page, `${card.subject} ${card.area} ${card.number}`, card.title)));
    }
    if (pageMatches.length) {
      blocks.push(`<p class="panel-title">페이지</p>`);
      blocks.push(...pageMatches.map((p) => resultButton(p.page, `${p.page}쪽 · ${pageSubject(p.page)}`, snippet(p.text, q))));
    }
    els.searchResults.innerHTML = blocks.length ? blocks.join("") : `<p class="panel-title">검색 결과 없음</p>`;
  }

  function resultButton(page, title, body) {
    return `
      <button class="result-button" type="button" data-page="${page}">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(body)}</small>
      </button>
    `;
  }

  function snippet(text, q) {
    const source = text || "";
    const index = source.toLowerCase().indexOf(q);
    if (index < 0) return source.slice(0, 100);
    const start = Math.max(0, index - 45);
    const end = Math.min(source.length, index + q.length + 75);
    return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
  }

  function empty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function openIcon() {
    return `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>`;
  }

  function normalizePages(pages) {
    return pages
      .map((page) => Math.min(totalPages, Math.max(1, Number(page) || 1)))
      .filter((page, index, list) => list.indexOf(page) === index);
  }

  function openPage(page) {
    openPages([page]);
  }

  function openPages(pages) {
    const normalized = normalizePages(pages);
    currentPage = normalized[0] || 1;
    els.dialogPages.innerHTML = normalized
      .map((page) => `<img class="dialog-page" src="${pagePath(page)}" alt="${page}쪽 원문" />`)
      .join("");
    els.dialogTitle.textContent = `${pageRangeLabel(normalized)} · ${pageSubject(currentPage)}`;
    els.pageJump.value = currentPage;
    if (typeof els.dialog.showModal === "function" && !els.dialog.open) {
      els.dialog.showModal();
    } else {
      els.dialog.setAttribute("open", "");
    }
  }

  function closePage() {
    if (typeof els.dialog.close === "function") {
      els.dialog.close();
    } else {
      els.dialog.removeAttribute("open");
    }
  }

  function setChipActive(container, value) {
    container.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.subject === value);
    });
  }

  function rerenderFiltered() {
    renderFocus();
    renderPageGrid();
    renderSearchResults();
  }

  function setupEvents() {
    document.addEventListener("click", (event) => {
      const pagesButton = event.target.closest("[data-pages]");
      if (pagesButton) {
        openPages(pagesButton.dataset.pages.split(","));
        return;
      }

      const pageButton = event.target.closest("[data-page]");
      if (pageButton) {
        openPage(pageButton.dataset.page);
      }
    });

    els.subjectFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (!button) return;
      activeSubject = button.dataset.subject;
      setChipActive(els.subjectFilter, activeSubject);
      rerenderFiltered();
    });

    els.focusSegment.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (!button) return;
      focusSubject = button.dataset.subject;
      setChipActive(els.focusSegment, focusSubject);
      renderFocus();
    });

    els.subjectTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (!button) return;
      subjectTab = button.dataset.subject;
      setChipActive(els.subjectTabs, subjectTab);
      renderSubjectPanel();
    });

    els.searchInput.addEventListener("input", rerenderFiltered);
    els.jumpButton.addEventListener("click", () => openPage(els.pageJump.value));
    els.pageJump.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openPage(els.pageJump.value);
    });
    els.prevPage.addEventListener("click", () => openPage(currentPage - 1));
    els.nextPage.addEventListener("click", () => openPage(currentPage + 1));
    els.closeDialog.addEventListener("click", closePage);
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog) closePage();
    });
    document.addEventListener("keydown", (event) => {
      if (!els.dialog.open) return;
      if (event.key === "ArrowLeft") openPage(currentPage - 1);
      if (event.key === "ArrowRight") openPage(currentPage + 1);
    });

    const links = [...document.querySelectorAll(".toc-link")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.2, 0.5] }
    );
    document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
  }

  renderDiagnosis();
  renderFocus();
  renderSubjectPanel();
  renderMathRows();
  renderPageGrid();
  setupEvents();
})();
