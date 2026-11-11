'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Category,
  FollowUp,
  InterviewReview,
  PriorityGrade,
  Question,
  QuestionTypeTag,
  ReviewQuestionItem,
  StudyProgress,
  StudyStatus,
} from '../types';
import {
  FOLLOWUP_TYPE_META,
  PRIORITY_META,
  SELF_INTRO_CONDITION_CARDS,
  STUDY_STATUS_META,
  TYPE_TAG_META,
} from '../constants';
import { getTodayStr } from '../services/storage';
import {
  Mic,
  Square,
  Play,
  ChevronRight,
  Flag,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  FileCheck2,
  ArrowUpCircle,
  RotateCcw,
} from 'lucide-react';

interface MockInterviewProps {
  questions: Question[];
  categories: Category[];
  followUps: FollowUp[];
  getProgress: (questionId: string) => StudyProgress;
  onRecordPracticeSeconds: (seconds: number) => void;
  onIncrementReadWithStatus: (questionId: string, status: StudyStatus) => void;
  onToggleWeakness: (questionId: string, forceValue?: boolean) => void;
}

type ScopeType = 'all' | 'category' | 'unconfident' | 'today_review' | 'weakness';

const SELF_CHECKS = [
  '결론부터 말했나 (두괄식 첫 문장)',
  '숫자나 검증 가능한 사실이 들어갔나',
  '내 행동(적용조건·원문서 확인·비교)이 드러났나',
  '권장 시간 안에 끝났나',
];

export const MockInterviewView: React.FC<MockInterviewProps> = ({
  questions,
  categories,
  followUps,
  getProgress,
  onRecordPracticeSeconds,
  onIncrementReadWithStatus,
  onToggleWeakness,
}) => {
  const [scope, setScope] = useState<ScopeType>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [isStarted, setIsStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Follow-up chain state for current main question (1~3 follow-ups in depth direction)
  const [followUpChain, setFollowUpChain] = useState<FollowUp[]>([]);
  const [followUpStepIdx, setFollowUpStepIdx] = useState<number>(-1); // -1 means on main question, 0..n means on followUpChain[idx]

  // Timer state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Progressive Hint state: 0 = none, 1 = keywords, 2 = firstSentence, 3 = full answer
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);

  // Self check 4 items
  const [checks, setChecks] = useState<[boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
  ]);
  const [statusRecorded, setStatusRecorded] = useState<StudyStatus | null>(null);
  const [conditionCard, setConditionCard] = useState<string | null>(null);

  const todayStr = getTodayStr();

  // Build sorted queue of questions: priority high first (S > A > B > C), then readCount low first
  const queue = useMemo(() => {
    const filtered = questions.filter((q) => {
      const prog = getProgress(q.id);
      if (scope === 'category') return q.categoryId === selectedCategoryId;
      if (scope === 'unconfident') return prog.status !== 'confident';
      if (scope === 'today_review')
        return Boolean(prog.nextReviewDate && prog.nextReviewDate <= todayStr);
      if (scope === 'weakness') return prog.isWeakness;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const pa = PRIORITY_META[a.priority].order;
      const pb = PRIORITY_META[b.priority].order;
      if (pa !== pb) return pa - pb;
      const ra = getProgress(a.id).readCount;
      const rb = getProgress(b.id).readCount;
      return ra - rb;
    });
  }, [questions, scope, selectedCategoryId, getProgress, todayStr]);

  const currentQuestion = queue[currentIndex] || null;
  const activeFollowUp =
    followUpStepIdx >= 0 && followUpStepIdx < followUpChain.length
      ? followUpChain[followUpStepIdx]
      : null;

  // Build depth-first chain of 1~3 follow-ups for a question
  const buildFollowUpChainForQuestion = (qId: string): FollowUp[] => {
    const chain: FollowUp[] = [];
    let currParentId = qId;
    while (chain.length < 3) {
      const candidates = followUps
        .filter((f) => f.parentId === currParentId && !f.isSuggestion)
        .sort((a, b) => a.order - b.order);
      if (candidates.length === 0) break;
      const chosen = candidates[0];
      chain.push(chosen);
      currParentId = chosen.id;
    }
    return chain;
  };

  const setupQuestionSession = (q: Question | null) => {
    stopTimer(false);
    setElapsedSec(0);
    setHasFinishedSpeaking(false);
    setHintLevel(0);
    setChecks([false, false, false, false]);
    setStatusRecorded(null);
    setFollowUpStepIdx(-1);

    if (!q) {
      setFollowUpChain([]);
      setConditionCard(null);
      return;
    }

    setFollowUpChain(buildFollowUpChainForQuestion(q.id));
    const cat = categories.find((c) => c.id === q.categoryId);
    if (cat && cat.name.includes('1분 자기소개')) {
      const rand =
        SELF_INTRO_CONDITION_CARDS[Math.floor(Math.random() * SELF_INTRO_CONDITION_CARDS.length)];
      setConditionCard(rand);
    } else {
      setConditionCard(null);
    }
  };

  const startSession = () => {
    setCurrentIndex(0);
    setIsStarted(true);
    if (queue[0]) setupQuestionSession(queue[0]);
  };

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setElapsedSec(0);
    setIsSpeaking(true);
    setHasFinishedSpeaking(false);
    timerRef.current = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  };

  const stopTimer = (recordToDaily = true) => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isSpeaking && recordToDaily && elapsedSec > 0) {
      onRecordPracticeSeconds(elapsedSec);
    }
    setIsSpeaking(false);
    if (recordToDaily) {
      setHasFinishedSpeaking(true);
      const recLimit =
        activeFollowUp ? 45 : currentQuestion?.recommendedTime === 'short' ? 30 : 60;
      if (elapsedSec > 0 && elapsedSec <= recLimit) {
        setChecks((prev) => [prev[0], prev[1], prev[2], true]);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const handleMoveToFollowUpOrNext = () => {
    stopTimer(false);
    setElapsedSec(0);
    setHasFinishedSpeaking(false);
    setHintLevel(0);

    if (followUpStepIdx + 1 < followUpChain.length) {
      setFollowUpStepIdx((i) => i + 1);
    } else if (currentIndex + 1 < queue.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupQuestionSession(queue[nextIdx]);
    } else {
      setIsStarted(false);
    }
  };

  const checkedCount = checks.filter(Boolean).length;
  const recSeconds = activeFollowUp
    ? 45
    : currentQuestion?.recommendedTime === 'short'
    ? 30
    : 60;
  const isOverTime = elapsedSec > recSeconds;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Scope Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">실전 모의면접 모드</h2>
            <p className="text-xs text-slate-500">
              우선순위가 높고 회독수가 적은 질문부터 출제되며, 본질문 후 꼬리질문이 1~3단계로 이어집니다.
            </p>
          </div>
          {isStarted && (
            <button
              type="button"
              onClick={() => {
                stopTimer(false);
                setIsStarted(false);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              모의면접 종료
            </button>
          )}
        </div>

        {!isStarted && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">출제 범위 선택</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: '전체 질문' },
                  { id: 'unconfident', label: '자신 없는 질문만' },
                  { id: 'today_review', label: '오늘 복습할 질문만' },
                  { id: 'weakness', label: '약점 질문만' },
                  { id: 'category', label: '카테고리 선택' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScope(opt.id as ScopeType)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                      scope === opt.id
                        ? 'bg-[#3B5BDB] text-white border-[#3B5BDB] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {scope === 'category' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">카테고리</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full sm:w-72 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold text-slate-700">
                선택된 범위 질문: <strong className="text-[#3B5BDB]">{queue.length}개</strong>
              </span>
              <button
                type="button"
                disabled={queue.length === 0}
                onClick={startSession}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <Play className="w-4 h-4 fill-white" /> 모의면접 시작하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Mock Interview Card */}
      {isStarted && currentQuestion && (
        <div className="bg-white rounded-2xl border-2 border-[#3B5BDB]/30 p-5 sm:p-7 shadow-sm space-y-6">
          {/* Progress indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                질문 {currentIndex + 1} / {queue.length}
              </span>
              {activeFollowUp ? (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-[#3B5BDB] border border-indigo-300 text-xs font-bold">
                  연속 꼬리질문 {followUpStepIdx + 1} / {followUpChain.length}단계 (
                  {FOLLOWUP_TYPE_META[activeFollowUp.type].label})
                </span>
              ) : (
                <span
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${
                    PRIORITY_META[currentQuestion.priority].bg
                  } ${PRIORITY_META[currentQuestion.priority].text} ${
                    PRIORITY_META[currentQuestion.priority].border
                  }`}
                >
                  {PRIORITY_META[currentQuestion.priority].label}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 권장 답변 시간: {recSeconds}초 이내
            </span>
          </div>

          {/* Random Condition Card for 1-Minute Self Intro */}
          {!activeFollowUp && conditionCard && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-700 uppercase">
                    1분 자기소개 돌발 조건 카드
                  </div>
                  <div className="text-base font-bold">{conditionCard}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rand =
                    SELF_INTRO_CONDITION_CARDS[
                      Math.floor(Math.random() * SELF_INTRO_CONDITION_CARDS.length)
                    ];
                  setConditionCard(rand);
                }}
                className="min-h-[38px] px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-800 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 다른 조건
              </button>
            </div>
          )}

          {/* Big Question Prompt */}
          <div className="py-4 text-center space-y-2">
            {activeFollowUp && (
              <p className="text-xs font-semibold text-slate-400">
                본질문: {currentQuestion.content}
              </p>
            )}
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
              “{activeFollowUp ? activeFollowUp.content : currentQuestion.content}”
            </h3>
            {activeFollowUp && (
              <p className="text-xs font-semibold text-[#3B5BDB]">
                대응 팁: {FOLLOWUP_TYPE_META[activeFollowUp.type].tip}
              </p>
            )}
          </div>

          {/* Timer Controls: [답변 시작] ~ [답변 끝] */}
          <div
            className={`p-5 rounded-2xl border-2 text-center space-y-3 transition-colors ${
              isOverTime
                ? 'bg-rose-50 border-rose-400 text-rose-900'
                : isSpeaking
                ? 'bg-indigo-50/70 border-[#3B5BDB] text-slate-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
              {Math.floor(elapsedSec / 60)}분 {String(elapsedSec % 60).padStart(2, '0')}초
              <span className="text-sm font-semibold ml-2 opacity-75">/ 권장 {recSeconds}초</span>
            </div>
            {isOverTime && (
              <p className="text-xs font-bold text-rose-700">
                권장 시간을 넘겼습니다! 결론부터 간결하게 마무리하는 연습을 해보세요.
              </p>
            )}
            <div className="flex justify-center gap-3">
              {!isSpeaking ? (
                <button
                  type="button"
                  onClick={startTimer}
                  className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
                >
                  <Mic className="w-4 h-4" /> {hasFinishedSpeaking ? '다시 말하기 시작' : '답변 시작'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => stopTimer(true)}
                  className="min-h-[48px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm animate-pulse"
                >
                  <Square className="w-4 h-4 fill-white" /> 답변 끝 (말한 시간 기록)
                </button>
              )}
            </div>
          </div>

          {/* Progressive Hints: [키워드 힌트] -> [첫 문장] -> [답변 보기] */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHintLevel((l) => (l >= 1 ? l : 1))}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                  hintLevel >= 1
                    ? 'bg-indigo-50 text-[#3B5BDB] border-indigo-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                1단계: 키워드 힌트
              </button>
              <button
                type="button"
                disabled={hintLevel < 1}
                onClick={() => setHintLevel((l) => (l >= 2 ? l : 2))}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border disabled:opacity-40 ${
                  hintLevel >= 2
                    ? 'bg-indigo-50 text-[#3B5BDB] border-indigo-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                2단계: 첫 문장 열기
              </button>
              <button
                type="button"
                disabled={hintLevel < 2}
                onClick={() => setHintLevel(3)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border disabled:opacity-40 ${
                  hintLevel >= 3
                    ? 'bg-indigo-50 text-[#3B5BDB] border-indigo-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                3단계: 답변 보기
              </button>
            </div>

            {hintLevel >= 1 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5">
                {(activeFollowUp ? activeFollowUp.keywords : currentQuestion.keywords).map(
                  (kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-xs font-bold text-[#3B5BDB]"
                    >
                      #{kw}
                    </span>
                  )
                )}
              </div>
            )}
            {hintLevel >= 2 && (
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
                <div className="text-xs font-bold text-[#3B5BDB] mb-1">두괄식 첫 문장</div>
                <p className="text-base font-bold text-slate-900">
                  {activeFollowUp ? activeFollowUp.firstSentence : currentQuestion.firstSentence}
                </p>
              </div>
            )}
            {hintLevel >= 3 && (
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <div className="text-xs font-bold text-slate-500 mb-1">전체 모범답변</div>
                <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {activeFollowUp ? activeFollowUp.answer : currentQuestion.answer}
                </p>
              </div>
            )}
          </div>

          {/* Self Check 4 Items & Status Recording (for Main Question, or FollowUp advance) */}
          {!activeFollowUp ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="text-sm font-bold text-slate-900">답변 후 자기 점검 (4가지 체크)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SELF_CHECKS.map((label, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-indigo-300"
                  >
                    <input
                      type="checkbox"
                      checked={checks[idx]}
                      onChange={(e) => {
                        const next = [...checks] as [boolean, boolean, boolean, boolean];
                        next[idx] = e.target.checked;
                        setChecks(next);
                      }}
                      className="w-4 h-4 accent-[#3B5BDB]"
                    />
                    <span className="text-xs font-semibold text-slate-800">{label}</span>
                  </label>
                ))}
              </div>

              {hasFinishedSpeaking && checkedCount <= 2 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>자기 점검 체크가 {checkedCount}개입니다. 약점 질문으로 표시해 집중 복습할까요?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleWeakness(currentQuestion.id, true)}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Flag className="w-3.5 h-3.5" /> 약점 표시하기
                  </button>
                </div>
              )}

              {/* 상태 3단계 선택 -> 회독 +1 및 다음 복습일 저장 */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-700">
                  이번 질문의 말하기 상태를 선택하면 회독수가 +1 증가하고 다음 복습일이 지정됩니다:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['stuck', 'vague', 'confident'] as StudyStatus[]).map((st) => {
                    const m = STUDY_STATUS_META[st];
                    const isChosen = statusRecorded === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          onIncrementReadWithStatus(currentQuestion.id, st);
                          setStatusRecorded(st);
                        }}
                        className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          isChosen
                            ? 'ring-2 ring-[#3B5BDB] font-extrabold ' + m.bg + ' ' + m.text + ' ' + m.border
                            : m.bg + ' ' + m.text + ' ' + m.border + ' opacity-85 hover:opacity-100'
                        }`}
                      >
                        {m.label} ({m.intervalText})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Next Step Button: 꼬리질문 이어서 출제 or 다음 질문 */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleMoveToFollowUpOrNext}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2"
            >
              <span>
                {followUpStepIdx + 1 < followUpChain.length
                  ? `이어지는 꼬리질문 (${followUpStepIdx + 2}/${followUpChain.length}단계) 받기`
                  : currentIndex + 1 < queue.length
                  ? '다음 본질문으로 이동'
                  : '모의면접 완료'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3) 면접 복기록 (세트마다 따로)
 * ========================================================================== */
interface ReviewLogProps {
  setName: string;
  reviews: InterviewReview[];
  questions: Question[];
  onAddReview: (date: string, interviewType: '실무' | '임원' | '기타') => void;
  onUpdateReview: (reviewId: string, patch: Partial<InterviewReview>) => void;
  onDeleteReview: (reviewId: string) => void;
  onPromoteReviewQuestion: (
    reviewId: string,
    item: ReviewQuestionItem,
    upgradePriority: boolean
  ) => void;
}

const REVIEW_SIX_CHECKS = [
  '1분 자기소개에서 의도한 꼬리질문을 받았나',
  '꼬리질문을 준비한 핵심 경험(B737 실기·키오스크·기상 아카이빙)으로 받아쳤나',
  '답이 결론부터였고 숫자나 사실 근거가 있었나',
  '아쉬운 답을 운항기술 관점으로 다시 써 봤나',
  '회사 조사 노트에 정리한 내용을 실제로 썼나',
  '인성·압박 질문에서 방어적이거나 감정적인 실수는 없었나',
];

export const InterviewReviewLogView: React.FC<ReviewLogProps> = ({
  setName,
  reviews,
  questions,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
  onPromoteReviewQuestion,
}) => {
  const [selectedReviewId, setSelectedReviewId] = useState<string>(reviews[0]?.id || '');
  const [newDate, setNewDate] = useState(getTodayStr());
  const [newType, setNewType] = useState<'실무' | '임원' | '기타'>('실무');

  const activeReview = reviews.find((r) => r.id === selectedReviewId) || reviews[0] || null;

  const typeStats = useMemo(() => {
    if (!activeReview || activeReview.items.length === 0) {
      return { K: 0, M: 0, L: 0, total: 0, lRatio: 0 };
    }
    const counts = { K: 0, M: 0, L: 0 };
    activeReview.items.forEach((it) => {
      counts[it.typeTag] = (counts[it.typeTag] || 0) + 1;
    });
    const total = activeReview.items.length;
    return {
      ...counts,
      total,
      lRatio: Math.round((counts.L / total) * 100),
    };
  }, [activeReview]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{setName} — 면접 복기록</h2>
            <p className="text-xs text-slate-500">
              실제 면접에서 받은 질문을 순서대로 기록하고 K/M/L 유형 비율을 점검합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as '실무' | '임원' | '기타')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
            >
              <option value="실무">실무 면접</option>
              <option value="임원">임원 면접</option>
              <option value="기타">기타 면접</option>
            </select>
            <button
              type="button"
              onClick={() => onAddReview(newDate, newType)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> 새 복기록 추가
            </button>
          </div>
        </div>

        {/* Review Tabs */}
        {reviews.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {reviews.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReviewId(r.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  activeReview?.id === r.id
                    ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>
                  {r.date} ({r.interviewType} 면접 · 질문 {r.items.length}개)
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeReview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
          {/* Type Ratio Bar & L > 50% Coaching Warning */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                받은 질문 유형 분석 (총 {typeStats.total}문항)
              </span>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-indigo-700">
                  K 직무·경험: {typeStats.K}개 (
                  {typeStats.total ? Math.round((typeStats.K / typeStats.total) * 100) : 0}%)
                </span>
                <span className="text-emerald-700">
                  M 인성·태도: {typeStats.M}개 (
                  {typeStats.total ? Math.round((typeStats.M / typeStats.total) * 100) : 0}%)
                </span>
                <span className="text-purple-700">
                  L 지원동기·로열티: {typeStats.L}개 ({typeStats.lRatio}%)
                </span>
              </div>
            </div>

            {typeStats.total > 0 && typeStats.L > typeStats.total / 2 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  L 유형 질문이 절반을 넘었습니다 — 경험이 충분히 전달되지 않았을 수 있어요. 1분 자기소개와 핵심 경험을 점검하세요.
                </span>
              </div>
            )}
          </div>

          {/* Questions List in Review */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">받은 질문 순서별 기록</h3>
              <button
                type="button"
                onClick={() => {
                  const nextItem: ReviewQuestionItem = {
                    id: `ri_${Date.now()}`,
                    question: '',
                    typeTag: 'K',
                    myAnswerSummary: '',
                    usedPreparedExp: true,
                    nextTimeImprove: '',
                  };
                  onUpdateReview(activeReview.id, {
                    items: [...activeReview.items, nextItem],
                  });
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-indigo-50 text-[#3B5BDB] border border-indigo-200 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 받은 질문 행 추가
              </button>
            </div>

            {activeReview.items.map((item, idx) => {
              const matchingQ = questions.find(
                (q) =>
                  q.id === item.addedToQuestionId ||
                  (item.question.trim() && q.content.trim() === item.question.trim())
              );

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <select
                        value={item.typeTag}
                        onChange={(e) => {
                          const next = [...activeReview.items];
                          next[idx] = { ...item, typeTag: e.target.value as QuestionTypeTag };
                          onUpdateReview(activeReview.id, { items: next });
                        }}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-bold ${
                          TYPE_TAG_META[item.typeTag].bg
                        } ${TYPE_TAG_META[item.typeTag].text} ${
                          TYPE_TAG_META[item.typeTag].border
                        }`}
                      >
                        <option value="K">K 직무·경험 검증</option>
                        <option value="M">M 인성·태도</option>
                        <option value="L">L 지원동기·로열티</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const next = [...activeReview.items];
                          next[idx] = { ...item, usedPreparedExp: !item.usedPreparedExp };
                          onUpdateReview(activeReview.id, { items: next });
                        }}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-bold ${
                          item.usedPreparedExp
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        준비한 경험 활용: {item.usedPreparedExp ? 'O' : 'X'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {matchingQ ? (
                        <button
                          type="button"
                          onClick={() =>
                            onPromoteReviewQuestion(activeReview.id, item, true)
                          }
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" /> 실제 출제 표시됨 · 우선순위 한 단계 올리기 ({matchingQ.priority}등급)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onPromoteReviewQuestion(activeReview.id, item, false)
                          }
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-[#3B5BDB] border border-indigo-200 text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> 질문 목록에 추가
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = activeReview.items.filter((_, i) => i !== idx);
                          onUpdateReview(activeReview.id, { items: next });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="면접관에게 받은 질문"
                      value={item.question}
                      onChange={(e) => {
                        const next = [...activeReview.items];
                        next[idx] = { ...item, question: e.target.value };
                        onUpdateReview(activeReview.id, { items: next });
                      }}
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                          내 답 요약
                        </label>
                        <textarea
                          rows={2}
                          value={item.myAnswerSummary}
                          onChange={(e) => {
                            const next = [...activeReview.items];
                            next[idx] = { ...item, myAnswerSummary: e.target.value };
                            onUpdateReview(activeReview.id, { items: next });
                          }}
                          className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#3B5BDB] mb-0.5">
                          다음엔 이렇게 (보완 방향)
                        </label>
                        <textarea
                          rows={2}
                          value={item.nextTimeImprove}
                          onChange={(e) => {
                            const next = [...activeReview.items];
                            next[idx] = { ...item, nextTimeImprove: e.target.value };
                            onUpdateReview(activeReview.id, { items: next });
                          }}
                          className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 하단 복기 점검 6개 체크 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-sm font-bold text-slate-900">복기 점검 6개 체크리스트</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REVIEW_SIX_CHECKS.map((label, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={activeReview.checks[idx] || false}
                    onChange={(e) => {
                      const next = [...activeReview.checks] as InterviewReview['checks'];
                      next[idx] = e.target.checked;
                      onUpdateReview(activeReview.id, { checks: next });
                    }}
                    className="w-4 h-4 accent-[#3B5BDB]"
                  />
                  <span className="text-xs font-semibold text-slate-800">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
