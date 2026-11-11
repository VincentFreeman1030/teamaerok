import { AnswerFramework, FollowUpType, PriorityGrade, QuestionTypeTag, StudyStatus } from './types';

export const APP_CONFIG = {
  siteName: '면접 준비 마인드맵',
  defaultSetName: '에어로케이 운항객실기술 2차면접',
  targetReadCount: 5,
  dailyPracticeGoalMinutes: 30,
  accentColor: '#3B5BDB',
  cautionPhrases: ['라고 생각합니다', '했던 것 같습니다', '열심히'],
  defaultPasscode: '1234',
  trashRetentionDays: 30,
};

export const PRIORITY_META: Record<
  PriorityGrade,
  { label: string; shortLabel: string; desc: string; bg: string; text: string; border: string; order: number }
> = {
  S: {
    label: 'S 반드시 나옴',
    shortLabel: 'S등급',
    desc: '반드시 나옴',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
    order: 0,
  },
  A: {
    label: 'A 자주 나옴',
    shortLabel: 'A등급',
    desc: '자주 나옴',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    order: 1,
  },
  B: {
    label: 'B 나올 수 있음',
    shortLabel: 'B등급',
    desc: '나올 수 있음',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    order: 2,
  },
  C: {
    label: 'C 여유 있으면',
    shortLabel: 'C등급',
    desc: '여유 있으면',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    order: 3,
  },
};

export const TYPE_TAG_META: Record<
  QuestionTypeTag,
  { label: string; shortLabel: string; bg: string; text: string; border: string }
> = {
  K: {
    label: 'K 직무·경험 검증',
    shortLabel: 'K 직무·경험',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
  },
  M: {
    label: 'M 인성·태도',
    shortLabel: 'M 인성·태도',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
  },
  L: {
    label: 'L 지원동기·로열티',
    shortLabel: 'L 동기·로열티',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
};

export const STUDY_STATUS_META: Record<
  StudyStatus,
  { label: string; intervalText: string; bg: string; text: string; border: string; dot: string }
> = {
  none: {
    label: '미학습',
    intervalText: '학습 전',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  stuck: {
    label: '막힘',
    intervalText: '1일 뒤 복습',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  vague: {
    label: '애매',
    intervalText: '3일 뒤 복습',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  confident: {
    label: '자신 있음',
    intervalText: '7일 뒤(연속 시 14·30일)',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
  },
};

export const ANSWER_FRAMEWORKS: Record<
  AnswerFramework,
  { label: string; description: string; steps: string[] }
> = {
  result_first: {
    label: '결과 먼저',
    description: '결과 → 배경 → 행동 → 배운 점',
    steps: ['결과 (두괄식 결론)', '배경 (상황·문제)', '행동 (내 역할·검증 과정)', '배운 점 (운항기술 적용)'],
  },
  ostar: {
    label: 'O-STAR',
    description: '결론 → 상황·과제 짧게 → 행동·결과',
    steps: ['O (Opinion 결론)', 'ST (상황·과제 짧게)', 'A (구체적 행동·근거)', 'R (결과 및 직무 연결)'],
  },
  oreo: {
    label: 'OREO',
    description: '주장 → 이유 → 사례 → 재주장',
    steps: ['O (핵심 주장)', 'R (근거와 이유)', 'E (경험·학습 사례)', 'O (운항기술 기여 재강조)'],
  },
  pressure: {
    label: '압박 대응',
    description: '반응 → 인정 → 보완 노력',
    steps: ['반응 (침착한 수용)', '인정 (한계·사실 솔직히 인정)', '보완 노력 (검증 절차·학습 행동)'],
  },
  free: {
    label: '자유',
    description: '단계 구분 없이 자유 서술',
    steps: ['전체 답변'],
  },
};

export const FOLLOWUP_TYPE_META: Record<
  FollowUpType,
  { label: string; tip: string; bg: string; text: string; border: string }
> = {
  narrow: {
    label: '좁히기',
    tip: '장황했다는 신호. 경험 하나만, 결론부터 말하세요.',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-300',
  },
  dig: {
    label: '파고들기',
    tip: '진실성 확인. 숫자를 대고 내 역할과 팀 역할을 명확히 구분하세요.',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
  },
  twist: {
    label: '방향 틀기',
    tip: '일관성 검증. 당황해서 기존 입장과 말을 바꾸지 마세요.',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-300',
  },
  other_exp: {
    label: '다른 경험 요구',
    tip: '준비한 예비 경험(기상 아카이빙·키오스크·B737 실기 등)을 바로 꺼내세요.',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-300',
  },
  reask: {
    label: '재질문',
    tip: '답이 빗나갔다는 뜻. 질문의 핵심 단어를 되짚고 다시 결론부터 답하세요.',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  pressure: {
    label: '압박',
    tip: '반박하지 않고 반응 → 인정(미경험/한계) → 보완 노력(원문서·절차 확인) 순으로 답하세요.',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
  },
};

export const QUICK_FOLLOWUP_TEMPLATES: { text: string; type: FollowUpType }[] = [
  { text: '그중 하나만 꼽는다면?', type: 'narrow' },
  { text: '정말 직접 하신 건가요?', type: 'dig' },
  { text: '구체적으로 어떻게 하셨나요?', type: 'dig' },
  { text: '그거 말고 다른 경험은요?', type: 'other_exp' },
  { text: '그 결과는 어떻게 확인했나요?', type: 'dig' },
  { text: '다시 한다면 무엇을 바꾸겠습니까?', type: 'twist' },
];

export const SELF_INTRO_CONDITION_CARDS: string[] = [
  '10초로 압축해서 말해 보세요',
  '장단점 포함 30초 안에 말해 보세요',
  '준비한 것 말고 지금 진솔하게 말해 보세요',
  '실패 경험 중심으로 자기소개해 보세요',
  '우리 회사(에어로케이)만을 위한 자기소개를 해 보세요',
];

export interface DdayStage {
  id: string;
  title: string;
  rangeLabel: string;
  matchFn: (diffDays: number) => boolean;
  items: { id: string; text: string; autoCheckKey?: 'selfIntro' | 'news3' | 'reviewLog' }[];
}

export const DDAY_STAGES: DdayStage[] = [
  {
    id: 'stage_14_7',
    title: 'D-14 ~ D-7 기초 설계 단계',
    rangeLabel: 'D-14~D-7',
    matchFn: (d) => d >= 7,
    items: [
      {
        id: 'dday_1',
        text: '1분 자기소개 원고 쓰기 (인사 + 핵심 경험 2개 + 포부, 50초 안팎)',
        autoCheckKey: 'selfIntro',
      },
      {
        id: 'dday_2',
        text: '회사 조사 노트 채우기 (최근 뉴스 3개, 제품 사용·고객 후기, 경쟁사 비교, 방문·현직자 이야기)',
        autoCheckKey: 'news3',
      },
    ],
  },
  {
    id: 'stage_7_3',
    title: 'D-7 ~ D-3 구조화 및 경험 연결',
    rangeLabel: 'D-7~D-3',
    matchFn: (d) => d >= 3 && d <= 7,
    items: [
      { id: 'dday_3', text: '질문마다 면접관의 의도 확인하기' },
      { id: 'dday_4', text: '인성·압박 질문을 핵심 경험(B737 실기·키오스크·불렛저널 등)에 연결하기' },
      { id: 'dday_5', text: '답변은 외울 원고가 아니라 키워드와 논리 메모(두괄식 첫 문장)로 쓰기' },
    ],
  },
  {
    id: 'stage_7_1',
    title: 'D-7 ~ D-1 실전 말하기 집중 훈련',
    rangeLabel: 'D-7~D-1',
    matchFn: (d) => d >= 1 && d <= 7,
    items: [
      { id: 'dday_6', text: '매일 모의면접으로 입으로 소리 내어 말하기 (하루 30분 목표)' },
      { id: 'dday_7', text: '약점 질문 목록(깃발 표시) 만들어 집중 회독하기' },
      { id: 'dday_8', text: 'S·A 등급 질문의 꼬리질문 2단계 이상 채우기' },
    ],
  },
  {
    id: 'stage_1',
    title: 'D-1 면접 전날 최종 점검',
    rangeLabel: 'D-1',
    matchFn: (d) => d === 1,
    items: [
      { id: 'dday_9', text: '핵심 경험을 1~2개로 최종 압축 및 첫 문장 암기' },
      { id: 'dday_10', text: '복장과 청주 이동 경로·대기 장소 확인' },
      { id: 'dday_11', text: 'A4 인쇄본(또는 당일용 한 장 요약) 뽑기' },
      { id: 'dday_12', text: '취업 커뮤니티·후기 사이트는 보지 않기' },
    ],
  },
  {
    id: 'stage_0',
    title: 'D-Day 면접 당일 원칙',
    rangeLabel: '당일',
    matchFn: (d) => d === 0,
    items: [
      { id: 'dday_13', text: '모든 답변은 결론부터 30~50초 안으로 간결하게' },
      { id: 'dday_14', text: '면접은 대기실 입장부터 귀가까지라는 태도 유지' },
    ],
  },
  {
    id: 'stage_post',
    title: '당일 저녁 ~ D+1 면접 복기',
    rangeLabel: '당일 저녁~D+1',
    matchFn: (d) => d < 0,
    items: [
      { id: 'dday_15', text: '면접 복기록 쓰기 (받은 질문 순서와 유형 분석)', autoCheckKey: 'reviewLog' },
      { id: 'dday_16', text: '막힌 질문의 답 다시 쓰고 말로 연습하기' },
    ],
  },
];

export const CONVERSION_FORMULAS: { dispatchStyle: string; engineeringStyle: string }[] = [
  {
    dispatchStyle: '오늘 운항을 모니터링하고 지연·결항에 대응하겠습니다.',
    engineeringStyle: '운항 전제조건과 기준자료를 검토하고 시스템·문서에 정확히 반영하겠습니다.',
  },
  {
    dispatchStyle: '기상에 따라 당일 비행계획을 조정하겠습니다.',
    engineeringStyle: '계절·시간대별 공항 기상 특성과 성능·접근 조건을 노선·공항 분석에 반영하겠습니다.',
  },
  {
    dispatchStyle: '비행계획을 잘 작성할 수 있습니다.',
    engineeringStyle: '성능표의 적용 조건과 제한사항을 원문서와 대조하고 결과를 검증할 수 있습니다.',
  },
  {
    dispatchStyle: '여러 부서와 소통해 운항을 조정하겠습니다.',
    engineeringStyle: '변경의 영향 범위와 승인·검토·배포 대상을 정리해 관련 부서가 같은 기준으로 판단하도록 하겠습니다.',
  },
  {
    dispatchStyle: '문제가 생기면 빨리 해결하겠습니다.',
    engineeringStyle: '오류를 재현하고 원문서·버전·적용 조건·검증 결과를 추적해 재발을 줄이겠습니다.',
  },
];

export const FINAL_TEN_CHECKLIST: string[] = [
  '지원동기를 PTU나 기종 선호로 끝내지 않고 성능자료·운항기준·EFB·Loading Database 업무로 연결했는가.',
  '운항통제와 운항기술의 차이를 한 문장으로 설명할 수 있는가.',
  'B737 경험을 A320 실무 경험처럼 과장하지 않고, 자료 적용 조건을 확인한 학습 경험으로 설명하는가.',
  'EFB와 Loading Database를 직접 운영한 것처럼 말하지 않고, 배우고 검증할 절차를 설명하는가.',
  '기상 이야기를 당일 지연·결항 대응이 아니라 노선·공항 특성 및 성능 조건 분석으로 연결하는가.',
  '키오스크 경험에서 관찰 → 반복성 확인 → 원인 추정 → 비교 근거 → 제안 → 결과의 흐름이 있는가.',
  '모든 기술 답변에 출처·적용 범위·개정 이력·검증·승인·기록 중 필요한 키워드를 넣었는가.',
  '모르는 수치나 승인 요건을 추측하지 않고 제작사 매뉴얼·회사 기준·관련 규정을 확인하겠다고 말하는가.',
  '안전과 일정이 충돌할 때 자료 사용·배포를 보류하고 보고·검증하는 원칙을 유지하는가.',
  '답변을 길게 설명하기보다 결론을 먼저 말하고 40~60초 안에 마치는가.',
];

export const CORE_ONE_SENTENCE =
  '저는 운항 당일의 결정을 말하는 사람에 머무르지 않고, 그 결정이 정확하게 이루어지도록 성능자료와 운항기준, EFB와 Loading Database의 근거와 변경 이력을 관리하는 운항기술 인력이 되겠습니다.';
