export type PriorityGrade = 'S' | 'A' | 'B' | 'C';
export type QuestionTypeTag = 'K' | 'M' | 'L';
export type StudyStatus = 'none' | 'stuck' | 'vague' | 'confident';
export type AnswerFramework = 'result_first' | 'ostar' | 'oreo' | 'pressure' | 'free';
export type FollowUpType = 'narrow' | 'dig' | 'twist' | 'other_exp' | 'reask' | 'pressure';
export type ResearchSource = '기사' | '후기' | '현직자' | '방문';
export type ExperienceTier = '필살기' | '비살기' | '밉살기';
export type JobSimilarity = '상' | '중' | '하';

export interface InterviewSet {
  id: string;
  name: string;
  interviewDate?: string; // YYYY-MM-DD
  updatedAt: string;
  updatedBy: string;
}

export interface Category {
  id: string;
  setId: string;
  name: string;
  order: number;
  autoKeywords: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface Question {
  id: string;
  setId: string;
  categoryId: string;
  questionNumber?: number;
  content: string;
  priority: PriorityGrade;
  typeTag: QuestionTypeTag;
  intent: string;
  keywords: string[];
  firstSentence: string;
  framework: AnswerFramework;
  frameworkSteps?: Record<string, string>;
  answer: string;
  recommendedTime: 'short' | 'normal'; // 30s or 60s
  linkedExperienceIds: string[]; // index 0 = 주 경험, 1+ = 예비 경험
  isActualAsked?: boolean;
  order: number;
  updatedAt: string;
  updatedBy: string;
}

export interface FollowUp {
  id: string;
  setId: string;
  parentId: string; // Question.id or parent FollowUp.id
  rootQuestionId: string;
  code?: string; // e.g., F1 ~ F35
  content: string;
  type: FollowUpType;
  keywords: string[];
  firstSentence: string;
  answer: string;
  order: number;
  isSuggestion?: boolean;
  suggestedBy?: string;
  suggestedAt?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StudyProgress {
  profile: string;
  setId: string;
  questionId: string;
  readCount: number;
  status: StudyStatus;
  consecutiveConfident: number;
  isWeakness: boolean;
  lastStudiedAt?: string; // YYYY-MM-DD
  nextReviewDate?: string; // YYYY-MM-DD
}

export interface ExperienceBreakdown {
  oneLineSummary: string;
  requester: string;
  goalProblemRole: string;
  comparisonRef: string;
  metricDetail: string;
  keyAction: string;
  resourceSaved: string;
  persuasion: string;
  lessonLearned: string;
  ifRedo: string;
}

export interface Experience {
  id: string;
  name: string;
  role: string;
  resultMetric: string; // 전 → 후
  jobSimilarity: JobSimilarity;
  tier: ExperienceTier;
  keywords: string[];
  breakdown: ExperienceBreakdown;
  updatedAt: string;
  updatedBy: string;
}

export interface ResearchNewsItem {
  title: string;
  date: string;
  summary: string;
  link: string;
  source: ResearchSource;
}

export interface CompanyResearch {
  setId: string;
  coreCompetency: { text: string; source: ResearchSource };
  differentiation: { text: string; source: ResearchSource };
  recentNews: [ResearchNewsItem, ResearchNewsItem, ResearchNewsItem];
  reviewKeywords: { words: [string, string, string]; source: ResearchSource };
  directExperience: { text: string; source: ResearchSource };
  linkedExperienceId: string;
  completedSentence: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ReviewQuestionItem {
  id: string;
  question: string;
  typeTag: QuestionTypeTag;
  myAnswerSummary: string;
  usedPreparedExp: boolean;
  nextTimeImprove: string;
  addedToQuestionId?: string;
}

export interface InterviewReview {
  id: string;
  setId: string;
  date: string;
  interviewType: '실무' | '임원' | '기타';
  items: ReviewQuestionItem[];
  checks: [boolean, boolean, boolean, boolean, boolean, boolean];
  updatedAt: string;
  updatedBy: string;
}

export interface TrashItem {
  id: string;
  itemType: 'set' | 'category' | 'question' | 'followup' | 'experience';
  title: string;
  setId?: string;
  deletedBy: string;
  deletedAt: string; // ISO string
  payload: unknown;
}

export interface AppDatabase {
  version: number;
  sets: InterviewSet[];
  categories: Category[];
  questions: Question[];
  followUps: FollowUp[];
  progress: Record<string, StudyProgress>; // key: `${profile}:${questionId}`
  experiences: Experience[];
  researches: Record<string, CompanyResearch>; // key: setId
  reviews: InterviewReview[];
  practiceLogs: Record<string, number>; // key: `${profile}:${YYYY-MM-DD}` -> seconds
  checklists: Record<string, string[]>; // key: `${profile}:${setId}` -> checked item IDs
  trash: TrashItem[];
  editPasscode: string;
}
