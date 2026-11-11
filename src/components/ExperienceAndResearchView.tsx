'use client';

import React, { useState } from 'react';
import {
  Category,
  CompanyResearch,
  Experience,
  ExperienceBreakdown,
  ExperienceTier,
  JobSimilarity,
  Question,
  ResearchSource,
} from '../types';
import { PRIORITY_META, TYPE_TAG_META } from '../constants';
import {
  Award,
  AlertCircle,
  Plus,
  Trash2,
  GitBranch,
  List,
  Building2,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface ExperienceViewProps {
  experiences: Experience[];
  selectedExpId: string | null;
  onSelectExp: (id: string) => void;
  questions: Question[];
  categories: Category[];
  isEditMode: boolean;
  onAddExperience: () => void;
  onUpdateExperience: (id: string, patch: Partial<Experience>) => void;
  onDeleteExperience: (id: string) => void;
  onNavigateToQuestion: (categoryId: string, questionId: string) => void;
}

const BREAKDOWN_FIELDS: { key: keyof ExperienceBreakdown; label: string; placeholder: string }[] = [
  {
    key: 'oneLineSummary',
    label: '1. 한 줄 요약 (무엇을 해서 어떤 숫자가 됐나)',
    placeholder: '무엇을 해서 어떤 결과(숫자·변화)가 됐는지 한 줄로 요약하세요',
  },
  {
    key: 'requester',
    label: '2. 누구의 요구였나',
    placeholder: '자발적 문제의식 / 담당자 요청 / 자격·과제 목표 등',
  },
  {
    key: 'goalProblemRole',
    label: '3. 당시 목표·문제·내 역할',
    placeholder: '당시 해결하려던 문제와 본인이 직접 맡은 역할',
  },
  {
    key: 'comparisonRef',
    label: '4. 무엇과 비교·참고했나',
    placeholder: '타 항공사 사례, 원문서 매뉴얼, 이전 기준 등 비교 대상',
  },
  {
    key: 'metricDetail',
    label: '5. 결과 숫자 (전 → 후)',
    placeholder: '정량적 변화나 검증한 기준 숫자 (미측정 시 솔직한 확인 범위)',
  },
  {
    key: 'keyAction',
    label: '6. 가장 강조할 행동',
    placeholder: '내가 직접 수행한 관찰·대조·분석·제안 행동',
  },
  {
    key: 'resourceSaved',
    label: '7. 시간·비용·인원을 어떻게 줄였나',
    placeholder: '시행착오 감소, 재계산 방지, 안내 시간 단축 등',
  },
  {
    key: 'persuasion',
    label: '8. 누구를 어떻게 설득했나',
    placeholder: '근거 자료·비교표를 통해 담당자나 면접관을 설득한 논리',
  },
  {
    key: 'lessonLearned',
    label: '9. 다시 쓸 수 있는 배운 점',
    placeholder: '운항기술 실무에 그대로 적용할 수 있는 원칙과 배운 점',
  },
  {
    key: 'ifRedo',
    label: '10. 다시 한다면',
    placeholder: '다시 수행한다면 더 보완하고 싶은 검증·측정 방법',
  },
];

const TIER_STYLE: Record<ExperienceTier, string> = {
  필살기: 'bg-rose-50 text-rose-700 border-rose-300',
  비살기: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  밉살기: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const ExperienceBankView: React.FC<ExperienceViewProps> = ({
  experiences,
  selectedExpId,
  onSelectExp,
  questions,
  categories,
  isEditMode,
  onAddExperience,
  onUpdateExperience,
  onDeleteExperience,
  onNavigateToQuestion,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'mindmap'>('mindmap');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeExp = experiences.find((e) => e.id === selectedExpId) || experiences[0] || null;
  const topTierCount = experiences.filter((e) => e.tier === '필살기').length;

  const linkedQuestions = activeExp
    ? questions.filter((q) => q.linkedExperienceIds.includes(activeExp.id))
    : [];

  const getCategoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name || '미분류';

  return (
    <div className="space-y-4">
      {topTierCount < 2 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>핵심 경험(필살기 등급)을 2개 이상 준비하세요. 현재 필살기 경험: {topTierCount}개</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Column: Experience List */}
        <div className="md:col-span-5 xl:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">내 경험 (경험 뱅크)</h2>
              <p className="text-xs text-slate-500">모든 면접 세트가 함께 쓰는 공통 핵심 경험입니다.</p>
            </div>
            {isEditMode && (
              <button
                type="button"
                onClick={onAddExperience}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4" /> 경험 추가
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {experiences.map((exp) => {
              const isSelected = activeExp?.id === exp.id;
              const count = questions.filter((q) => q.linkedExperienceIds.includes(exp.id)).length;
              const missingMetric = !exp.resultMetric.trim() || !exp.breakdown.metricDetail.trim();

              return (
                <div
                  key={exp.id}
                  onClick={() => onSelectExp(exp.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/60 border-[#3B5BDB] ring-2 ring-[#3B5BDB]/15 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-xs font-bold ${TIER_STYLE[exp.tier]}`}
                      >
                        {exp.tier}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        직무유사도: {exp.jobSimilarity}
                      </span>
                      {missingMetric && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold">
                          숫자 필요
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-[#3B5BDB]">연결 질문 {count}개</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{exp.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{exp.resultMetric}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {exp.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Experience Detail + 10-step Breakdown + Mindmap */}
        <div className="md:col-span-7 xl:col-span-8">
          {activeExp ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditMode ? (
                      <>
                        <select
                          value={activeExp.tier}
                          onChange={(e) =>
                            onUpdateExperience(activeExp.id, { tier: e.target.value as ExperienceTier })
                          }
                          className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                        >
                          <option value="필살기">등급: 필살기</option>
                          <option value="비살기">등급: 비살기</option>
                          <option value="밉살기">등급: 밉살기</option>
                        </select>
                        <select
                          value={activeExp.jobSimilarity}
                          onChange={(e) =>
                            onUpdateExperience(activeExp.id, {
                              jobSimilarity: e.target.value as JobSimilarity,
                            })
                          }
                          className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                        >
                          <option value="상">직무 유사도: 상</option>
                          <option value="중">직무 유사도: 중</option>
                          <option value="하">직무 유사도: 하</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${
                            TIER_STYLE[activeExp.tier]
                          }`}
                        >
                          <Award className="w-3.5 h-3.5 inline mr-1" />
                          {activeExp.tier}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                          직무 유사도: {activeExp.jobSimilarity}
                        </span>
                      </>
                    )}
                    {(!activeExp.resultMetric.trim() || !activeExp.breakdown.metricDetail.trim()) && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> 숫자 필요 (전 → 후 결과 숫자를 입력해 주세요)
                      </span>
                    )}
                  </div>

                  {isEditMode ? (
                    <div className="space-y-2 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">경험 이름</label>
                        <input
                          type="text"
                          value={activeExp.name}
                          onChange={(e) => onUpdateExperience(activeExp.id, { name: e.target.value })}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-lg font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">내 역할</label>
                          <input
                            type="text"
                            value={activeExp.role}
                            onChange={(e) => onUpdateExperience(activeExp.id, { role: e.target.value })}
                            className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                            보여줄 수 있는 키워드 (쉼표 구분)
                          </label>
                          <input
                            type="text"
                            value={activeExp.keywords.join(', ')}
                            onChange={(e) =>
                              onUpdateExperience(activeExp.id, {
                                keywords: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                          결과 숫자 (전 → 후)
                        </label>
                        <input
                          type="text"
                          value={activeExp.resultMetric}
                          onChange={(e) =>
                            onUpdateExperience(activeExp.id, { resultMetric: e.target.value })
                          }
                          placeholder="예: 조건 미확인 재계산 발생 → 5대 적용조건 사전 대조로 오류 0건"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-slate-900">{activeExp.name}</h3>
                      <p className="text-sm text-slate-600">
                        <strong className="text-slate-800">내 역할:</strong> {activeExp.role}
                      </p>
                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-sm text-indigo-950 font-semibold">
                        <span className="text-xs font-bold text-[#3B5BDB] block mb-0.5">
                          결과 숫자 (전 → 후)
                        </span>
                        {activeExp.resultMetric || '결과 숫자를 입력해 주세요.'}
                      </div>
                    </>
                  )}
                </div>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(activeExp.id)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 경험 삭제
                  </button>
                )}
              </div>

              {/* 경험 분해표 (10칸) */}
              <div className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>경험 분해표 (10단계 해부)</span>
                  <span className="text-xs font-normal text-slate-500">
                    어떤 꼬리질문이 와도 흔들리지 않도록 경험을 분해해 둡니다.
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BREAKDOWN_FIELDS.map(({ key, label, placeholder }) => (
                    <div
                      key={key}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="text-xs font-bold text-slate-700">{label}</div>
                      {isEditMode ? (
                        <textarea
                          rows={2}
                          value={activeExp.breakdown[key] || ''}
                          placeholder={placeholder}
                          onChange={(e) =>
                            onUpdateExperience(activeExp.id, {
                              breakdown: {
                                ...activeExp.breakdown,
                                [key]: e.target.value,
                              },
                            })
                          }
                          className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                      ) : (
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {activeExp.breakdown[key] || (
                            <span className="text-slate-400">비어 있음</span>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 이 경험으로 답하는 질문 (목록 & 마인드맵 보기) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-slate-900">
                    이 경험으로 답하는 질문 ({linkedQuestions.length}개)
                  </h4>
                  <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setViewMode('mindmap')}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                        viewMode === 'mindmap'
                          ? 'bg-white text-[#3B5BDB] shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5" /> 경험 중심 마인드맵
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                        viewMode === 'list' ? 'bg-white text-[#3B5BDB] shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" /> 목록 보기
                    </button>
                  </div>
                </div>

                {linkedQuestions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-sm text-slate-500">
                    아직 이 경험에 연결된 질문이 없습니다. 질문 상세 화면에서 경험을 연결해 보세요.
                  </div>
                ) : viewMode === 'mindmap' ? (
                  /* 경험을 중심에 두고 연결된 질문이 가지로 뻗는 마인드맵 */
                  <div className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 overflow-x-auto">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-8 min-w-[300px]">
                      {/* Center Experience Node */}
                      <div className="md:w-64 shrink-0 p-4 rounded-2xl bg-slate-900 text-white shadow-md border-2 border-[#3B5BDB]">
                        <span className="text-[11px] font-bold text-indigo-300 uppercase">
                          중심 경험 ({activeExp.tier})
                        </span>
                        <h5 className="text-sm font-bold mt-1 leading-snug">{activeExp.name}</h5>
                        <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">
                          {activeExp.breakdown.oneLineSummary}
                        </p>
                      </div>

                      {/* Branches to Linked Questions */}
                      <div className="flex-1 space-y-2.5 pl-4 border-l-2 border-[#3B5BDB]/40">
                        {linkedQuestions.map((q) => {
                          const isPrimary = q.linkedExperienceIds[0] === activeExp.id;
                          const pm = PRIORITY_META[q.priority];
                          return (
                            <div
                              key={q.id}
                              onClick={() => onNavigateToQuestion(q.categoryId, q.id)}
                              className="group p-3 rounded-xl bg-white border border-slate-200 hover:border-[#3B5BDB] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${pm.bg} ${pm.text} ${pm.border}`}
                                  >
                                    {q.priority}등급
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      isPrimary
                                        ? 'bg-[#3B5BDB] text-white'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {isPrimary ? '주 경험' : '예비 경험'}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">
                                    {getCategoryName(q.categoryId)}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-slate-900 group-hover:text-[#3B5BDB]">
                                  {q.questionNumber ? `Q${q.questionNumber}. ` : ''}
                                  {q.content}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#3B5BDB] shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
                    {linkedQuestions.map((q) => {
                      const isPrimary = q.linkedExperienceIds[0] === activeExp.id;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => onNavigateToQuestion(q.categoryId, q.id)}
                          className="w-full p-3.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs font-bold text-[#3B5BDB]">
                                [{isPrimary ? '주 경험' : '예비 경험'}]
                              </span>
                              <span className="text-xs text-slate-500">
                                {getCategoryName(q.categoryId)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {q.questionNumber ? `Q${q.questionNumber}. ` : ''}
                              {q.content}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">이 경험을 삭제할까요?</h3>
            <p className="text-sm text-slate-600">
              삭제된 경험은 휴지통으로 이동하며 30일 안에 복원할 수 있습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExperience(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2) 회사 조사 노트 (세트마다 하나)
 * ========================================================================== */
interface ResearchViewProps {
  setName: string;
  research: CompanyResearch;
  experiences: Experience[];
  isEditMode: boolean;
  onUpdateResearch: (patch: Partial<CompanyResearch>) => void;
  onNavigateToExperience: (expId: string) => void;
}

const SOURCES: ResearchSource[] = ['기사', '후기', '현직자', '방문'];

export const CompanyResearchView: React.FC<ResearchViewProps> = ({
  setName,
  research,
  experiences,
  isEditMode,
  onUpdateResearch,
  onNavigateToExperience,
}) => {
  const linkedExp = experiences.find((e) => e.id === research.linkedExperienceId);

  const renderSourceBadgeOrSelect = (
    value: ResearchSource,
    onChange: (next: ResearchSource) => void
  ) => {
    if (isEditMode) {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ResearchSource)}
          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              출처: {s}
            </option>
          ))}
        </select>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
        출처: {value}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#3B5BDB] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{setName} — 회사 조사 노트</h2>
              <p className="text-xs text-slate-500">
                L 유형(지원동기·로열티) 질문에 답변할 핵심 근거와 출처를 관리합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 1. 회사의 핵심 경쟁력 (숫자 포함) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-bold text-slate-900">
              1. 회사의 핵심 경쟁력 (숫자 포함)
            </label>
            {renderSourceBadgeOrSelect(research.coreCompetency.source, (source) =>
              onUpdateResearch({
                coreCompetency: { ...research.coreCompetency, source },
              })
            )}
          </div>
          {isEditMode ? (
            <textarea
              rows={3}
              value={research.coreCompetency.text}
              onChange={(e) =>
                onUpdateResearch({
                  coreCompetency: { ...research.coreCompetency, text: e.target.value },
                })
              }
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-base"
            />
          ) : (
            <p className="text-base text-slate-800 leading-relaxed">
              {research.coreCompetency.text}
            </p>
          )}
        </div>

        {/* 2. 경쟁사와 비교한 차별점 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-bold text-slate-900">2. 경쟁사와 비교한 차별점</label>
            {renderSourceBadgeOrSelect(research.differentiation.source, (source) =>
              onUpdateResearch({
                differentiation: { ...research.differentiation, source },
              })
            )}
          </div>
          {isEditMode ? (
            <textarea
              rows={3}
              value={research.differentiation.text}
              onChange={(e) =>
                onUpdateResearch({
                  differentiation: { ...research.differentiation, text: e.target.value },
                })
              }
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-base"
            />
          ) : (
            <p className="text-base text-slate-800 leading-relaxed">
              {research.differentiation.text}
            </p>
          )}
        </div>

        {/* 3. 최근 뉴스 3개 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              3. 최근 뉴스 3개 (제목, 날짜, 한 줄 요약, 링크)
            </span>
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {research.recentNews.filter((n) => n.title.trim()).length}/3 채워짐 (D-day 자동 체크 연동)
            </span>
          </div>
          <div className="space-y-3">
            {research.recentNews.map((news, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#3B5BDB]">뉴스 #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{news.date}</span>
                    {renderSourceBadgeOrSelect(news.source, (source) => {
                      const next = [...research.recentNews] as CompanyResearch['recentNews'];
                      next[idx] = { ...news, source };
                      onUpdateResearch({ recentNews: next });
                    })}
                  </div>
                </div>
                {isEditMode ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="뉴스 제목"
                        value={news.title}
                        onChange={(e) => {
                          const next = [...research.recentNews] as CompanyResearch['recentNews'];
                          next[idx] = { ...news, title: e.target.value };
                          onUpdateResearch({ recentNews: next });
                        }}
                        className="sm:col-span-2 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold"
                      />
                      <input
                        type="date"
                        value={news.date}
                        onChange={(e) => {
                          const next = [...research.recentNews] as CompanyResearch['recentNews'];
                          next[idx] = { ...news, date: e.target.value };
                          onUpdateResearch({ recentNews: next });
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="한 줄 요약"
                      value={news.summary}
                      onChange={(e) => {
                        const next = [...research.recentNews] as CompanyResearch['recentNews'];
                        next[idx] = { ...news, summary: e.target.value };
                        onUpdateResearch({ recentNews: next });
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                    <input
                      type="url"
                      placeholder="링크 URL (https://...)"
                      value={news.link}
                      onChange={(e) => {
                        const next = [...research.recentNews] as CompanyResearch['recentNews'];
                        next[idx] = { ...news, link: e.target.value };
                        onUpdateResearch({ recentNews: next });
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 text-base">{news.title}</div>
                    <p className="text-sm text-slate-700">{news.summary}</p>
                    {news.link && (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#3B5BDB] hover:underline"
                      >
                        원문 링크 열기 <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. 고객 후기의 공통 단어 3개 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-bold text-slate-900">4. 고객 후기의 공통 단어 3개</label>
            {renderSourceBadgeOrSelect(research.reviewKeywords.source, (source) =>
              onUpdateResearch({
                reviewKeywords: { ...research.reviewKeywords, source },
              })
            )}
          </div>
          {isEditMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="text"
                  value={research.reviewKeywords.words[i] || ''}
                  onChange={(e) => {
                    const words = [...research.reviewKeywords.words] as [string, string, string];
                    words[i] = e.target.value;
                    onUpdateResearch({
                      reviewKeywords: { ...research.reviewKeywords, words },
                    });
                  }}
                  placeholder={`공통 단어 ${i + 1}`}
                  className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {research.reviewKeywords.words.map((w, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-[#3B5BDB]"
                >
                  #{w}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 5. 직접 써 보거나 방문한 경험 */}
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="text-sm font-bold text-slate-900">
                5. 직접 써 보거나 방문한 경험
              </label>
              <p className="text-xs font-bold text-amber-800 mt-0.5">
                ※ 실제로 한 일만 적으세요. 꼬리질문 한 번이면 드러납니다.
              </p>
            </div>
            {renderSourceBadgeOrSelect(research.directExperience.source, (source) =>
              onUpdateResearch({
                directExperience: { ...research.directExperience, source },
              })
            )}
          </div>
          {isEditMode ? (
            <textarea
              rows={3}
              value={research.directExperience.text}
              onChange={(e) =>
                onUpdateResearch({
                  directExperience: { ...research.directExperience, text: e.target.value },
                })
              }
              className="w-full p-3 rounded-xl border border-amber-300 bg-white text-base"
            />
          ) : (
            <p className="text-base text-slate-800 leading-relaxed">
              {research.directExperience.text}
            </p>
          )}
        </div>

        {/* 6. 연결할 내 경험 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="block text-sm font-bold text-slate-900">
            6. 연결할 내 경험 (내 경험 뱅크에서 선택)
          </label>
          {isEditMode ? (
            <select
              value={research.linkedExperienceId}
              onChange={(e) => onUpdateResearch({ linkedExperienceId: e.target.value })}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
            >
              {experiences.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  [{exp.tier}] {exp.name}
                </option>
              ))}
            </select>
          ) : linkedExp ? (
            <button
              type="button"
              onClick={() => onNavigateToExperience(linkedExp.id)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#3B5BDB] text-[#3B5BDB] text-sm font-bold flex items-center gap-2 hover:bg-indigo-50"
            >
              <span>[{linkedExp.tier}] {linkedExp.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* 7. 완성 문장 (경쟁력 + 내 기여) */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-[#3B5BDB]/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-bold text-[#3B5BDB] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> 7. 완성 문장 (회사 경쟁력 + 내 기여)
            </label>
            <span className="text-xs text-slate-500">
              L 유형 질문 상세 화면에서 이 문장을 첫 문장으로 바로 복사할 수 있습니다.
            </span>
          </div>
          {isEditMode ? (
            <textarea
              rows={3}
              value={research.completedSentence}
              onChange={(e) => onUpdateResearch({ completedSentence: e.target.value })}
              className="w-full p-3 rounded-xl border border-indigo-300 bg-white text-base font-bold text-slate-900"
            />
          ) : (
            <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              “{research.completedSentence}”
            </p>
          )}
        </div>

        {/* 하단 고정 점검용 꼬리질문 2개 */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> 회사 조사 점검용 고정 꼬리질문 2개
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700">
              <div className="text-sm font-bold text-white mb-1">Q1. “그건 어떻게 확인했나요?”</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                단순 검색이 아니라 부산 항공산업엑스포 현직자 상담, AIP·기상 관측자료 대조, 채용공고 직무 기술서를 통해 직접 확인한 출처를 구체적으로 답하세요.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700">
              <div className="text-sm font-bold text-white mb-1">Q2. “다른 회사는요?”</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                일관된 지원 기준(항공기 성능·운항기준·EFB 데이터 검증 역량 발휘 및 청주 거점 A320 단일 기단 표준화 기여)을 흔들림 없이 답하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
