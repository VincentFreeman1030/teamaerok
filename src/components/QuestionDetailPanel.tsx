'use client';

import React, { useState, useEffect } from 'react';
import {
  AnswerFramework,
  Category,
  CompanyResearch,
  Experience,
  FollowUp,
  FollowUpType,
  InterviewSet,
  PriorityGrade,
  Question,
  QuestionTypeTag,
  StudyProgress,
  StudyStatus,
} from '../types';
import {
  ANSWER_FRAMEWORKS,
  APP_CONFIG,
  PRIORITY_META,
  STUDY_STATUS_META,
  TYPE_TAG_META,
} from '../constants';
import {
  estimateSpeakingSeconds,
  getFollowUpStats,
  needsFollowUpReinforcement,
} from '../services/storage';
import { CautionHighlightedText } from './CautionHighlightedText';
import { FollowUpMindmap } from './FollowUpMindmap';
import {
  Flag,
  Eye,
  EyeOff,
  GitBranch,
  Clock,
  Link2,
  Building2,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Plus,
  Minus,
  Sparkles,
  FolderInput,
} from 'lucide-react';

interface Props {
  question: Question;
  categories: Category[];
  allSets: InterviewSet[];
  progress: StudyProgress;
  followUps: FollowUp[];
  experiences: Experience[];
  companyResearch?: CompanyResearch;
  selectedFollowUpId: string | null;
  onSelectFollowUp: (id: string | null) => void;
  isEditMode: boolean;
  onIncrementReadWithStatus: (questionId: string, status: StudyStatus) => void;
  onAdjustReadCount: (questionId: string, delta: number) => void;
  onChangeStatusOnly: (questionId: string, status: StudyStatus) => void;
  onToggleWeakness: (questionId: string) => void;
  onUpdateQuestion: (questionId: string, patch: Partial<Question>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onCopyQuestionToSet: (questionId: string, targetSetId: string) => void;
  onNavigateToExperience: (expId: string) => void;
  onNavigateToResearch: () => void;
  onAddFollowUp: (
    parentId: string,
    data: {
      content: string;
      type: FollowUpType;
      keywords: string[];
      firstSentence: string;
      answer: string;
      isSuggestion?: boolean;
    }
  ) => void;
  onUpdateFollowUp: (
    id: string,
    data: Partial<Pick<FollowUp, 'content' | 'type' | 'keywords' | 'firstSentence' | 'answer'>>
  ) => void;
  onDeleteFollowUp: (id: string) => void;
  onApproveSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
}

export const QuestionDetailPanel: React.FC<Props> = ({
  question,
  categories,
  allSets,
  progress,
  followUps,
  experiences,
  companyResearch,
  selectedFollowUpId,
  onSelectFollowUp,
  isEditMode,
  onIncrementReadWithStatus,
  onAdjustReadCount,
  onChangeStatusOnly,
  onToggleWeakness,
  onUpdateQuestion,
  onDeleteQuestion,
  onCopyQuestionToSet,
  onNavigateToExperience,
  onNavigateToResearch,
  onAddFollowUp,
  onUpdateFollowUp,
  onDeleteFollowUp,
  onApproveSuggestion,
  onRejectSuggestion,
}) => {
  const [showStatusPrompt, setShowStatusPrompt] = useState(false);
  const [revealFirstSentence, setRevealFirstSentence] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [showMindmap, setShowMindmap] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copySetModal, setCopySetModal] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Reset hidden state when switching questions
  useEffect(() => {
    setRevealFirstSentence(false);
    setRevealAnswer(false);
    setShowStatusPrompt(false);
    setConfirmDelete(false);
  }, [question.id]);

  // Auto-open mindmap if a followUp is selected
  useEffect(() => {
    if (selectedFollowUpId) setShowMindmap(true);
  }, [selectedFollowUpId]);

  const questionFollowUps = followUps.filter((f) => f.rootQuestionId === question.id);
  const { count: followUpCount, maxDepth } = getFollowUpStats(question.id, followUps, false);
  const needReinforce = needsFollowUpReinforcement(question, followUps);

  const prioMeta = PRIORITY_META[question.priority];
  const typeMeta = TYPE_TAG_META[question.typeTag];
  const fwMeta = ANSWER_FRAMEWORKS[question.framework || 'result_first'];

  const speakingSec = estimateSpeakingSeconds(question.answer);
  const recSec = question.recommendedTime === 'short' ? 30 : 60;

  const linkedExps = question.linkedExperienceIds
    .map((id) => experiences.find((e) => e.id === id))
    .filter((e): e is Experience => Boolean(e));

  const renderReadDots = (count: number) => {
    const target = APP_CONFIG.targetReadCount;
    const filled = Math.min(target, count);
    const empty = Math.max(0, target - filled);
    return '●'.repeat(filled) + '○'.repeat(empty);
  };

  const handleFrameworkStepChange = (stepName: string, val: string) => {
    const nextSteps = { ...(question.frameworkSteps || {}), [stepName]: val };
    const joined = fwMeta.steps
      .map((s) => nextSteps[s]?.trim())
      .filter(Boolean)
      .join(' ');
    onUpdateQuestion(question.id, {
      frameworkSteps: nextSteps,
      answer: joined || question.answer,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
      {/* ==================== 1줄: 회독 표시, 상태 3단계, 약점 깃발, 우선순위 배지, 유형 태그 ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
        {/* Left: Read Count & Status 3-Stage */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 말하기 회독 조절 (- / 숫자 / +) */}
          <div className="relative flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => onAdjustReadCount(question.id, -1)}
              disabled={progress.readCount <= 0}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white disabled:opacity-40 text-slate-700 font-bold"
              title="회독수 -1 정정"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="px-2.5 text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="tracking-tighter text-[#3B5BDB]">{renderReadDots(progress.readCount)}</span>
              <span>
                말하기 {progress.readCount}/{APP_CONFIG.targetReadCount}회
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowStatusPrompt((v) => !v)}
              className="min-h-[36px] px-2.5 rounded-lg bg-[#3B5BDB] hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              title="회독 +1 및 상태 기록"
            >
              <Plus className="w-3.5 h-3.5" /> 회독 +1
            </button>

            {/* Popover for [회독 +1] -> 상태 3단계 선택 */}
            {showStatusPrompt && (
              <div className="absolute left-0 top-full mt-2 z-30 bg-white border-2 border-[#3B5BDB] rounded-2xl shadow-xl p-3 w-72 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  방금 말하기 연습 상태는 어땠나요? (회독 +1)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['stuck', 'vague', 'confident'] as StudyStatus[]).map((st) => {
                    const m = STUDY_STATUS_META[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          onIncrementReadWithStatus(question.id, st);
                          setShowStatusPrompt(false);
                        }}
                        className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 ${m.bg} ${m.text} ${m.border}`}
                      >
                        <span>{m.label}</span>
                        <span className="text-[10px] opacity-75 font-normal">
                          {st === 'stuck' ? '1일 뒤' : st === 'vague' ? '3일 뒤' : '7일+ 뒤'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 상태 3단계 직접 변경 버튼 */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
            {(['stuck', 'vague', 'confident'] as StudyStatus[]).map((st) => {
              const active = progress.status === st;
              const m = STUDY_STATUS_META[st];
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onChangeStatusOnly(question.id, st)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    active
                      ? `${m.bg} ${m.text} border ${m.border} shadow-2xs`
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'confident' && active && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* 약점 깃발 */}
          <button
            type="button"
            onClick={() => onToggleWeakness(question.id)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              progress.isWeakness
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="약점 질문 표시"
          >
            <Flag className={`w-3.5 h-3.5 ${progress.isWeakness ? 'fill-rose-600 text-rose-600' : ''}`} />
            {progress.isWeakness ? '약점' : '약점 표시'}
          </button>
        </div>

        {/* Right: 우선순위 배지, 유형 태그, 실제 출제 배지, 다음 복습일 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isEditMode ? (
            <>
              <select
                value={question.priority}
                onChange={(e) =>
                  onUpdateQuestion(question.id, { priority: e.target.value as PriorityGrade })
                }
                className={`min-h-[38px] px-2.5 py-1 rounded-lg border text-xs font-bold ${prioMeta.bg} ${prioMeta.text} ${prioMeta.border}`}
              >
                {(['S', 'A', 'B', 'C'] as PriorityGrade[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
              <select
                value={question.typeTag}
                onChange={(e) =>
                  onUpdateQuestion(question.id, { typeTag: e.target.value as QuestionTypeTag })
                }
                className={`min-h-[38px] px-2.5 py-1 rounded-lg border text-xs font-bold ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}
              >
                {(['K', 'M', 'L'] as QuestionTypeTag[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_TAG_META[t].label}
                  </option>
                ))}
              </select>
              <select
                value={question.categoryId}
                onChange={(e) => onUpdateQuestion(question.id, { categoryId: e.target.value })}
                className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700"
                title="카테고리 이동"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    카테고리: {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${prioMeta.bg} ${prioMeta.text} ${prioMeta.border}`}
              >
                {prioMeta.label}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}
              >
                {typeMeta.shortLabel}
              </span>
              {question.isActualAsked && (
                <span className="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                  실제 출제
                </span>
              )}
            </>
          )}
          {progress.nextReviewDate && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> 복습일: {progress.nextReviewDate}
            </span>
          )}
        </div>
      </div>

      {/* ==================== 2줄: 질문 내용(큰 글씨) + 바로 아래 작은 글씨로 "면접관의 의도: …" ==================== */}
      <div className="space-y-2">
        {isEditMode ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">질문 내용</label>
              <input
                type="text"
                value={question.content}
                onChange={(e) => onUpdateQuestion(question.id, { content: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-lg font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">면접관의 의도</label>
              <input
                type="text"
                value={question.intent}
                onChange={(e) => onUpdateQuestion(question.id, { intent: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-700"
              />
            </div>
          </div>
        ) : (
          <>
            <h2
              className={`text-xl sm:text-2xl font-bold leading-snug ${
                progress.status === 'confident' ? 'text-slate-600' : 'text-slate-900'
              }`}
            >
              {question.questionNumber ? (
                <span className="text-[#3B5BDB] mr-2">Q{question.questionNumber}.</span>
              ) : null}
              {question.content}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              면접관의 의도: <span className="text-slate-700">{question.intent}</span>
            </p>
          </>
        )}
      </div>

      {/* ==================== 3줄: 키워드(칩 형태) & 연결 경험 줄 ==================== */}
      <div className="space-y-3 pt-1">
        {/* Keywords */}
        <div>
          {isEditMode ? (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                핵심 키워드 (쉼표로 구분, 3~5개 권장)
              </label>
              <input
                type="text"
                value={question.keywords.join(', ')}
                onChange={(e) =>
                  onUpdateQuestion(question.id, {
                    keywords: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 mr-1">키워드</span>
              {question.keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-indigo-50 text-[#3B5BDB] border border-indigo-200 text-xs font-bold"
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 연결 경험 줄 (2단계 명세: 키워드 줄 아래에 연결 경험 줄 추가) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Link2 className="w-3.5 h-3.5 text-[#3B5BDB]" />
              <span>연결 경험 (첫 번째 = 주 경험, 나머지 = 예비 경험)</span>
              {question.typeTag === 'K' && linkedExps.length === 0 && (
                <span className="ml-1 px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 경험 미연결
                </span>
              )}
            </div>

            {/* L 유형 질문일 때 [회사 조사 노트 보기] 및 완성 문장 복사 */}
            {question.typeTag === 'L' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onNavigateToResearch}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" /> 회사 조사 노트 보기
                </button>
                {companyResearch?.completedSentence && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateQuestion(question.id, {
                        firstSentence: companyResearch.completedSentence,
                      });
                      setRevealFirstSentence(true);
                      setCopiedNotice('조사 노트의 완성 문장을 첫 문장 칸으로 복사했습니다.');
                      setTimeout(() => setCopiedNotice(null), 3000);
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> 완성 문장 첫 문장으로 복사
                  </button>
                )}
              </div>
            )}
          </div>

          {copiedNotice && (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
              {copiedNotice}
            </div>
          )}

          {linkedExps.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {linkedExps.map((exp, idx) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onNavigateToExperience(exp.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    idx === 0
                      ? 'bg-white border-[#3B5BDB] text-[#3B5BDB] shadow-2xs hover:bg-indigo-50'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      idx === 0 ? 'bg-[#3B5BDB] text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {idx === 0 ? '주 경험' : '예비 경험'}
                  </span>
                  <span>{exp.name}</span>
                  <span className="text-[10px] opacity-75">({exp.tier})</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              연결된 경험이 없습니다. {isEditMode ? '아래에서 경험을 선택해 연결하세요.' : ''}
            </p>
          )}

          {isEditMode && (
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">경험 연결/해제:</span>
              {experiences.map((exp) => {
                const isLinked = question.linkedExperienceIds.includes(exp.id);
                return (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => {
                      const next = isLinked
                        ? question.linkedExperienceIds.filter((id) => id !== exp.id)
                        : [...question.linkedExperienceIds, exp.id];
                      onUpdateQuestion(question.id, { linkedExperienceIds: next });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      isLinked
                        ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {isLinked ? '✓ ' : '+ '}
                    {exp.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ==================== 4줄: 두괄식 첫 문장 ==================== */}
      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#3B5BDB]">
              두괄식 첫 문장
            </span>
            <p className="text-xs text-slate-600 mt-0.5">
              이 한 문장만 정확히 외우고, 나머지는 키워드를 보며 말로 연습하세요.
            </p>
          </div>
          {!isEditMode && (
            <button
              type="button"
              onClick={() => setRevealFirstSentence((v) => !v)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-[#3B5BDB] border border-indigo-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              {revealFirstSentence ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {revealFirstSentence ? '첫 문장 가리기' : '첫 문장 보기'}
            </button>
          )}
        </div>

        {isEditMode ? (
          <textarea
            rows={2}
            value={question.firstSentence}
            onChange={(e) => onUpdateQuestion(question.id, { firstSentence: e.target.value })}
            placeholder="결론부터 말하는 두괄식 첫 문장을 입력하세요"
            className="w-full p-3 rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-900"
          />
        ) : revealFirstSentence ? (
          <div className="pt-1">
            <CautionHighlightedText
              text={question.firstSentence || '등록된 첫 문장이 없습니다.'}
              className="text-base sm:text-lg font-bold text-slate-900"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealFirstSentence(true)}
            className="w-full py-3 px-4 rounded-xl bg-white/80 hover:bg-white border border-dashed border-indigo-300 text-sm font-semibold text-slate-600 text-left flex items-center justify-between"
          >
            <span>먼저 키워드를 보고 첫 문장을 입으로 말한 뒤 눌러서 확인하세요</span>
            <span className="text-xs font-bold text-[#3B5BDB]">탭하여 열기 →</span>
          </button>
        )}
      </div>

      {/* ==================== 5줄: 답변 (답변 틀, 권장 시간, 예상 말하기 시간) ==================== */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">답변 구성</span>
            <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700">
              틀: {fwMeta.label} ({fwMeta.description})
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#3B5BDB]" />
              권장: {question.recommendedTime === 'short' ? '짧게 30초' : '보통 60초'} / 예상 말하기:{' '}
              <strong className={speakingSec > recSec + 10 ? 'text-rose-600' : 'text-[#3B5BDB]'}>
                약 {speakingSec}초
              </strong>{' '}
              ({question.answer.length}자)
            </span>
          </div>
          {!isEditMode && (
            <button
              type="button"
              onClick={() => setRevealAnswer((v) => !v)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              {revealAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {revealAnswer ? '답변 가리기' : '답변 보기'}
            </button>
          )}
        </div>

        {isEditMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">답변 틀 선택</label>
                <select
                  value={question.framework}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, { framework: e.target.value as AnswerFramework })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  {(Object.keys(ANSWER_FRAMEWORKS) as AnswerFramework[]).map((fw) => (
                    <option key={fw} value={fw}>
                      {ANSWER_FRAMEWORKS[fw].label} — {ANSWER_FRAMEWORKS[fw].description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">권장 시간</label>
                <select
                  value={question.recommendedTime}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, {
                      recommendedTime: e.target.value as 'short' | 'normal',
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="short">짧게 30초</option>
                  <option value="normal">보통 60초</option>
                </select>
              </div>
            </div>

            {/* 단계별 입력 칸 */}
            {question.framework !== 'free' && (
              <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-600">
                  {fwMeta.label} 단계별 작성 (입력 시 전체 답변에도 반영됩니다)
                </div>
                {fwMeta.steps.map((stepName) => (
                  <div key={stepName}>
                    <label className="block text-xs font-semibold text-[#3B5BDB] mb-0.5">
                      {stepName}
                    </label>
                    <input
                      type="text"
                      value={question.frameworkSteps?.[stepName] || ''}
                      onChange={(e) => handleFrameworkStepChange(stepName, e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">전체 답변 원고/메모</label>
              <textarea
                rows={5}
                value={question.answer}
                onChange={(e) => onUpdateQuestion(question.id, { answer: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-base leading-relaxed"
              />
            </div>
          </div>
        ) : revealAnswer ? (
          <div className="space-y-3 pt-1">
            {question.framework !== 'free' &&
              question.frameworkSteps &&
              Object.values(question.frameworkSteps).some(Boolean) && (
                <div className="grid grid-cols-1 gap-2 bg-white p-3.5 rounded-xl border border-slate-200">
                  {fwMeta.steps.map((stepName) => {
                    const stepVal = question.frameworkSteps?.[stepName];
                    if (!stepVal) return null;
                    return (
                      <div key={stepName} className="text-sm">
                        <span className="inline-block font-bold text-[#3B5BDB] mr-2">
                          [{stepName}]
                        </span>
                        <span className="text-slate-800">{stepVal}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <CautionHighlightedText
                text={question.answer || '등록된 답변이 없습니다.'}
                className="text-base text-slate-800"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealAnswer(true)}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 border border-dashed border-slate-300 text-sm font-semibold text-slate-600 text-left flex items-center justify-between"
          >
            <span>[답변 보기]를 눌러 전체 답변과 논리 구조를 확인하세요</span>
            <span className="text-xs font-bold text-[#3B5BDB]">답변 펼치기 →</span>
          </button>
        )}
      </div>

      {/* ==================== 6줄: [꼬리질문 N개] 버튼 & 마인드맵 ==================== */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowMindmap((v) => !v)}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              showMindmap
                ? 'bg-[#3B5BDB] text-white shadow-xs'
                : 'bg-indigo-50 text-[#3B5BDB] border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>
              꼬리질문 {followUpCount}개 ({maxDepth}단계 깊이)
            </span>
            <span className="text-xs opacity-80">{showMindmap ? '접기 ▲' : '마인드맵 펼치기 ▼'}</span>
          </button>

          {needReinforce && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              S·A 등급 질문인데 꼬리질문 깊이가 2단계 미만입니다 — 꼬리질문 보강 필요
            </span>
          )}
        </div>

        {showMindmap && (
          <FollowUpMindmap
            question={question}
            followUps={questionFollowUps}
            selectedFollowUpId={selectedFollowUpId}
            onSelectFollowUp={onSelectFollowUp}
            isEditMode={isEditMode}
            onAddFollowUp={onAddFollowUp}
            onUpdateFollowUp={onUpdateFollowUp}
            onDeleteFollowUp={onDeleteFollowUp}
            onApproveSuggestion={onApproveSuggestion}
            onRejectSuggestion={onRejectSuggestion}
          />
        )}
      </div>

      {/* Footer: 마지막 수정 정보 & 편집 모드 시 세트 복사 / 삭제 */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          마지막 수정: {question.updatedBy || '지원자'},{' '}
          {new Date(question.updatedAt).toLocaleString('ko-KR')}
        </span>
        {isEditMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopySetModal(true)}
              className="min-h-[38px] px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
            >
              <FolderInput className="w-3.5 h-3.5" /> 다른 세트로 복사
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[38px] px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> 질문 삭제
            </button>
          </div>
        )}
      </div>

      {/* Delete Question Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">이 질문을 삭제할까요?</h3>
            <p className="text-sm text-slate-700 font-medium">“{question.content}”</p>
            {questionFollowUps.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                하위 꼬리질문 {questionFollowUps.length}개도 함께 휴지통으로 삭제됩니다.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuestion(question.id);
                  setConfirmDelete(false);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy to another Set Modal */}
      {copySetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">다른 세트로 질문 복사</h3>
            {allSets.filter((s) => s.id !== question.setId).length === 0 ? (
              <p className="text-sm text-slate-600">
                현재 다른 면접 세트가 없습니다. 상단 세트 메뉴에서 새 세트를 먼저 추가하거나 복제해 주세요.
              </p>
            ) : (
              <div className="space-y-2">
                {allSets
                  .filter((s) => s.id !== question.setId)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onCopyQuestionToSet(question.id, s.id);
                        setCopySetModal(false);
                        setCopiedNotice(`'${s.name}' 세트로 질문을 복사했습니다.`);
                        setTimeout(() => setCopiedNotice(null), 3000);
                      }}
                      className="w-full min-h-[44px] p-3 rounded-xl border border-slate-200 hover:border-[#3B5BDB] hover:bg-indigo-50 text-left text-sm font-bold text-slate-800 flex items-center justify-between"
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-[#3B5BDB]">여기로 복사 →</span>
                    </button>
                  ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCopySetModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
