'use client';

import React, { useState, useMemo } from 'react';
import {
  Category,
  Experience,
  FollowUp,
  InterviewSet,
  PriorityGrade,
  Question,
  StudyProgress,
} from '../types';
import {
  ANSWER_FRAMEWORKS,
  APP_CONFIG,
  FOLLOWUP_TYPE_META,
  PRIORITY_META,
  STUDY_STATUS_META,
  TYPE_TAG_META,
} from '../constants';
import { getTodayStr } from '../services/storage';
import { Printer, ArrowLeft, AlertTriangle, FileText, Sparkles } from 'lucide-react';

interface Props {
  activeSet: InterviewSet;
  profile: string;
  categories: Category[];
  questions: Question[];
  followUps: FollowUp[];
  experiences: Experience[];
  getProgress: (questionId: string) => StudyProgress;
  onClose: () => void;
}

type PrintFormat = 'full' | 'summary';
type PrintScope = 'all' | 'category' | 'priority' | 'unconfident' | 'weakness';

export const PrintPreviewView: React.FC<Props> = ({
  activeSet,
  profile,
  categories,
  questions,
  followUps,
  experiences,
  getProgress,
  onClose,
}) => {
  const [format, setFormat] = useState<PrintFormat>('full');
  const [scope, setScope] = useState<PrintScope>('all');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(categories.map((c) => c.id));
  const [selectedPriorities, setSelectedPriorities] = useState<PriorityGrade[]>(['S', 'A', 'B', 'C']);

  // 포함 항목 (기본값: 질문 의도만 끄고 나머지는 켠다)
  const [incIntent, setIncIntent] = useState(false);
  const [incFirstSentence, setIncFirstSentence] = useState(true);
  const [incAnswer, setIncAnswer] = useState(true);
  const [incFollowUps, setIncFollowUps] = useState(true);
  const [incFollowUpDetails, setIncFollowUpDetails] = useState(true);
  const [incLinkedExp, setIncLinkedExp] = useState(true);

  const [followUpDepthLimit, setFollowUpDepthLimit] = useState<'all' | '2'>('all');
  const [fontSize, setFontSize] = useState<'normal' | 'small'>('normal');
  const [memoMargin, setMemoMargin] = useState(false);

  const todayStr = getTodayStr();

  // Filter questions according to scope
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const prog = getProgress(q.id);
      if (scope === 'category') return selectedCatIds.includes(q.categoryId);
      if (scope === 'priority') return selectedPriorities.includes(q.priority);
      if (scope === 'unconfident') return prog.status !== 'confident';
      if (scope === 'weakness') return prog.isWeakness;
      return true;
    });
  }, [questions, scope, selectedCatIds, selectedPriorities, getProgress]);

  // Group by category, sorted by priority high first inside each category
  const categoryGroups = useMemo(() => {
    const sortedCats = [...categories].sort((a, b) => a.order - b.order);
    return sortedCats
      .map((cat, idx) => {
        const qs = filteredQuestions
          .filter((q) => q.categoryId === cat.id)
          .sort((a, b) => {
            const pa = PRIORITY_META[a.priority].order;
            const pb = PRIORITY_META[b.priority].order;
            if (pa !== pb) return pa - pb;
            return a.order - b.order;
          });
        return {
          cat,
          catNum: idx + 1,
          questions: qs,
        };
      })
      .filter((g) => g.questions.length > 0);
  }, [categories, filteredQuestions]);

  const totalConfidentCount = useMemo(
    () => questions.filter((q) => getProgress(q.id).status === 'confident').length,
    [questions, getProgress]
  );

  // Data for Format B: 1-page Day-of Summary
  const selfIntroQ = useMemo(() => {
    const introCat = categories.find((c) => c.name.includes('1분 자기소개'));
    return questions.find((q) => q.categoryId === introCat?.id) || questions[0];
  }, [categories, questions]);

  const topExperiences = useMemo(
    () => experiences.filter((e) => e.tier === '필살기'),
    [experiences]
  );

  const sGradeQuestions = useMemo(
    () => questions.filter((q) => q.priority === 'S'),
    [questions]
  );

  const closingQuestions = useMemo(() => {
    const closeCat = categories.find((c) => c.name.includes('마무리'));
    return questions.filter((q) => q.categoryId === closeCat?.id);
  }, [categories, questions]);

  const summaryOverflows = sGradeQuestions.length > 14;

  // Recursive follow-up tree renderer for Print
  const renderPrintFollowUpTree = (parentId: string, depth: number): React.ReactNode => {
    if (followUpDepthLimit === '2' && depth > 2) return null;
    const children = followUps
      .filter((f) => f.parentId === parentId && !f.isSuggestion)
      .sort((a, b) => a.order - b.order);
    if (children.length === 0) return null;

    return (
      <div className="mt-1.5 space-y-1.5 pl-4 border-l border-black">
        {children.map((child) => (
          <div key={child.id} className="space-y-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="inline-block px-1.5 py-0.2 border border-black text-[9pt] font-bold">
                {child.code ? `${child.code} · ` : ''}
                {FOLLOWUP_TYPE_META[child.type].label}
              </span>
              <span className="font-bold text-black">{child.content}</span>
            </div>
            {incFollowUpDetails && (
              <div className="text-[9pt] text-black pl-1 space-y-0.5">
                {child.keywords.length > 0 && (
                  <div>
                    <span className="font-semibold">키워드:</span> {child.keywords.join(', ')}
                  </div>
                )}
                {child.answer && (
                  <div>
                    <span className="font-semibold">답변:</span> {child.answer}
                  </div>
                )}
              </div>
            )}
            {renderPrintFollowUpTree(child.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Screen-only Options Sidebar + Toolbar (hidden in @media print) */}
      <div className="no-print max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> 화면으로 돌아가기
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">A4 인쇄 미리보기</h1>
              <p className="text-xs text-slate-500">
                현재 세트({activeSet.name}) · 프로필({profile}) 기준 인쇄본입니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" /> 인쇄하기 / PDF 저장
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Options Panel */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5 lg:sticky lg:top-6">
            {/* Format Switch */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">인쇄 형식 선택</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('full')}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 ${
                    format === 'full'
                      ? 'bg-indigo-50 border-[#3B5BDB] text-[#3B5BDB]'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>형식 A: 전체 인쇄본</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('summary')}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 ${
                    format === 'summary'
                      ? 'bg-indigo-50 border-[#3B5BDB] text-[#3B5BDB]'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>형식 B: 당일용 한 장 요약</span>
                </button>
              </div>
            </div>

            {format === 'full' ? (
              <>
                {/* 포함 범위 */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">포함 범위</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as PrintScope)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    <option value="all">전체 질문 ({questions.length}개)</option>
                    <option value="category">카테고리 선택</option>
                    <option value="priority">우선순위 등급 선택</option>
                    <option value="unconfident">자신 없는 질문만</option>
                    <option value="weakness">약점 질문만</option>
                  </select>

                  {scope === 'category' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 max-h-44 overflow-y-auto">
                      {categories.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={selectedCatIds.includes(c.id)}
                            onChange={(e) => {
                              setSelectedCatIds((prev) =>
                                e.target.checked
                                  ? [...prev, c.id]
                                  : prev.filter((id) => id !== c.id)
                              );
                            }}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {scope === 'priority' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['S', 'A', 'B', 'C'] as PriorityGrade[]).map((p) => (
                        <label
                          key={p}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPriorities.includes(p)}
                            onChange={(e) => {
                              setSelectedPriorities((prev) =>
                                e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)
                              );
                            }}
                          />
                          <span>{p}등급</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 포함 항목 체크 */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">포함 항목 선택</label>
                  <div className="space-y-1.5 text-xs font-semibold text-slate-800">
                    {[
                      { label: '질문 의도', val: incIntent, set: setIncIntent },
                      { label: '첫 문장 (두괄식)', val: incFirstSentence, set: setIncFirstSentence },
                      { label: '답변 본문', val: incAnswer, set: setIncAnswer },
                      { label: '꼬리질문 트리', val: incFollowUps, set: setIncFollowUps },
                      {
                        label: '꼬리질문의 키워드·답변',
                        val: incFollowUpDetails,
                        set: setIncFollowUpDetails,
                      },
                      { label: '연결 경험 이름', val: incLinkedExp, set: setIncLinkedExp },
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.val}
                          onChange={(e) => item.set(e.target.checked)}
                          className="w-4 h-4 accent-[#3B5BDB]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 꼬리질문 깊이 / 글자 크기 / 메모 여백 */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">꼬리질문 깊이</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFollowUpDepthLimit('all')}
                        className={`min-h-[38px] rounded-lg border text-xs font-bold ${
                          followUpDepthLimit === 'all'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        전체 깊이
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpDepthLimit('2')}
                        className={`min-h-[38px] rounded-lg border text-xs font-bold ${
                          followUpDepthLimit === '2'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        2단계까지
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">글자 크기</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFontSize('normal')}
                        className={`min-h-[38px] rounded-lg border text-xs font-bold ${
                          fontSize === 'normal'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        보통 (11pt)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFontSize('small')}
                        className={`min-h-[38px] rounded-lg border text-xs font-bold ${
                          fontSize === 'small'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        작게 (9.5pt)
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">
                      오른쪽 손필기 메모 여백 칸 추가
                    </span>
                    <input
                      type="checkbox"
                      checked={memoMargin}
                      onChange={(e) => setMemoMargin(e.target.checked)}
                      className="w-4 h-4 accent-[#3B5BDB]"
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>당일용 한 장 요약(형식 B)</strong>은 면접 대기실에서 마지막으로 볼 수 있도록 1분 자기소개 전문, 최고 등급(필살기) 경험 요약, S등급 질문과 첫 문장, 마무리 역질문을 A4 한 장에 압축합니다.
                </p>
                {summaryOverflows && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      S 등급 질문이 많아({sGradeQuestions.length}개) 글자 크기를 자동으로 축소했으며, 한 쪽을 넘습니다.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Preview Container (screen wrapper around the printable document) */}
          <div className="lg:col-span-8 overflow-x-auto">
            <div className="text-xs text-slate-500 mb-2 font-medium">
              아래 미리보기는 실제 A4 흑백 인쇄 결과와 동일하게 배경색 대신 테두리와 글자로 구분됩니다.
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ACTUAL PRINTABLE A4 DOCUMENT ==================== */}
      <div
        className={`print-document-root max-w-[210mm] mx-auto bg-white text-black shadow-lg print:shadow-none ${
          fontSize === 'small' ? 'text-[9.5pt]' : 'text-[11pt]'
        }`}
      >
        {format === 'full' ? (
          <>
            {/* -------------------- 1쪽: 표지 (Cover Page) -------------------- */}
            <section className="print-page min-h-[267mm] p-[15mm] flex flex-col items-center justify-center text-center border-b border-slate-200 print:border-none">
              <div className="space-y-6 max-w-xl">
                <div className="text-xs font-bold tracking-widest uppercase border border-black px-3 py-1 inline-block">
                  INTERVIEW PREPARATION BOOK
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-black leading-tight">
                  {activeSet.name}
                </h1>
                <div className="w-16 h-0.5 bg-black mx-auto" />
                <div className="space-y-1.5 text-sm font-medium text-black">
                  {activeSet.interviewDate && <div>면접 예정일: {activeSet.interviewDate}</div>}
                  <div>프로필(닉네임): {profile}</div>
                  <div>출력일: {todayStr}</div>
                </div>
                <div className="pt-4 text-sm font-bold border-t border-black inline-block px-6">
                  질문 총 {filteredQuestions.length}개 · 자신 있음 {totalConfidentCount}개
                </div>
              </div>
            </section>

            {/* -------------------- 2쪽: 목차 (Table of Contents) -------------------- */}
            <section className="print-page print-break-before p-[15mm] border-b border-slate-200 print:border-none space-y-5">
              <div className="border-b-2 border-black pb-2 flex items-baseline justify-between">
                <h2 className="text-2xl font-black text-black">목차 (Table of Contents)</h2>
                <span className="text-xs font-semibold">
                  쪽 번호 대신 질문 고유 번호(1-1, 2-1…)로 본문에서 찾습니다.
                </span>
              </div>

              <div className="space-y-4">
                {categoryGroups.map(({ cat, catNum, questions: qs }) => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="font-bold text-base border-b border-black pb-0.5 flex items-center justify-between">
                      <span>
                        {catNum}. {cat.name}
                      </span>
                      <span className="text-xs font-semibold">질문 {qs.length}개</span>
                    </div>
                    <div className="pl-3 space-y-0.5 text-[9.5pt]">
                      {qs.map((q, qIdx) => (
                        <div key={q.id} className="flex items-baseline gap-2">
                          <span className="font-bold shrink-0 w-10">
                            {catNum}-{qIdx + 1}
                          </span>
                          <span className="border border-black px-1 text-[8pt] font-bold shrink-0">
                            {q.priority}등급
                          </span>
                          <span className="truncate">{q.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* -------------------- 3쪽부터: 카테고리별 본문 -------------------- */}
            {categoryGroups.map(({ cat, catNum, questions: qs }) => (
              <section
                key={cat.id}
                className="print-page print-break-before p-[15mm] border-b border-slate-200 print:border-none space-y-4"
              >
                <div className="border-b-2 border-black pb-2 flex items-baseline justify-between print-keep-with-next">
                  <h2 className="text-xl font-black text-black">
                    {catNum}. {cat.name}
                  </h2>
                  <span className="text-xs font-bold">총 {qs.length}문항 (우선순위 높은 순)</span>
                </div>

                <div className="space-y-4">
                  {qs.map((q, qIdx) => {
                    const prog = getProgress(q.id);
                    const qNumStr = `${catNum}-${qIdx + 1}`;
                    const linkedExpNames = q.linkedExperienceIds
                      .map((id) => experiences.find((e) => e.id === id)?.name)
                      .filter(Boolean);
                    const fw = ANSWER_FRAMEWORKS[q.framework || 'result_first'];

                    return (
                      <article
                        key={q.id}
                        className={`print-avoid-break border border-black p-3 ${
                          memoMargin ? 'grid grid-cols-12 gap-3' : ''
                        }`}
                      >
                        <div className={memoMargin ? 'col-span-8 space-y-1.5' : 'space-y-1.5'}>
                          {/* 첫 줄: 질문 번호, 우선순위, 유형 태그, 회독수, 상태 */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[9pt]">
                            <span className="font-black text-sm mr-1">{qNumStr}</span>
                            <span className="border border-black px-1.5 py-0.2 font-bold">
                              {PRIORITY_META[q.priority].shortLabel}
                            </span>
                            <span className="border border-black px-1.5 py-0.2 font-semibold">
                              {TYPE_TAG_META[q.typeTag].shortLabel}
                            </span>
                            <span className="border border-black px-1.5 py-0.2">
                              회독: {prog.readCount}/{APP_CONFIG.targetReadCount}회
                            </span>
                            <span className="border border-black px-1.5 py-0.2 font-bold">
                              상태: {STUDY_STATUS_META[prog.status].label}
                            </span>
                            {prog.isWeakness && (
                              <span className="border border-black px-1.5 py-0.2 font-bold">
                                ★약점
                              </span>
                            )}
                          </div>

                          {/* 질문 내용(굵게) */}
                          <h3 className="font-bold text-black text-[11.5pt] leading-snug">
                            {q.content}
                          </h3>

                          {/* 질문 의도 (옵션) */}
                          {incIntent && q.intent && (
                            <div className="text-[9.5pt]">
                              <span className="font-bold">질문 의도:</span> {q.intent}
                            </div>
                          )}

                          {/* 키워드 (쉼표로 나열) */}
                          {q.keywords.length > 0 && (
                            <div className="text-[9.5pt]">
                              <span className="font-bold">키워드:</span> {q.keywords.join(', ')}
                            </div>
                          )}

                          {/* 연결 경험 이름 (옵션) */}
                          {incLinkedExp && linkedExpNames.length > 0 && (
                            <div className="text-[9.5pt]">
                              <span className="font-bold">연결 경험:</span>{' '}
                              {linkedExpNames.join(' / ')}
                            </div>
                          )}

                          {/* 첫 문장 (옵션) */}
                          {incFirstSentence && q.firstSentence && (
                            <div className="text-[10pt] border-l-2 border-black pl-2 py-0.5">
                              <span className="font-bold">[첫 문장]</span> {q.firstSentence}
                            </div>
                          )}

                          {/* 답변 내용 (옵션) */}
                          {incAnswer && q.answer && (
                            <div className="text-[10pt] space-y-1">
                              <div>
                                <span className="font-bold">[답변 ({fw.label})]</span> {q.answer}
                              </div>
                            </div>
                          )}

                          {/* 꼬리질문 들여쓰기 트리 (옵션) */}
                          {incFollowUps && renderPrintFollowUpTree(q.id, 1)}
                        </div>

                        {/* 메모 여백 칸 */}
                        {memoMargin && (
                          <div className="col-span-4 border-l border-dashed border-black pl-3 flex flex-col justify-between min-h-[100px]">
                            <span className="text-[8.5pt] font-bold uppercase">MEMO / 손필기 노트</span>
                            <div className="border-b border-dotted border-black/40 flex-1 my-1" />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <footer className="pt-4 border-t border-black text-[8.5pt] flex justify-between">
                  <span>{activeSet.name}</span>
                  <span>
                    카테고리 {catNum}. {cat.name}
                  </span>
                </footer>
              </section>
            ))}
          </>
        ) : (
          /* -------------------- 형식 B: 당일용 한 장 요약 -------------------- */
          <section
            className={`print-page p-[12mm] space-y-3 ${
              summaryOverflows ? 'text-[8.5pt]' : 'text-[9.5pt]'
            }`}
          >
            <div className="border-b-2 border-black pb-2 flex items-baseline justify-between">
              <div>
                <h1 className="text-xl font-black text-black">
                  {activeSet.name} — 면접 당일 한 장 요약
                </h1>
                <p className="text-[8.5pt]">
                  대기실에서 마지막으로 첫 문장과 핵심 숫자만 점검하세요. ({profile} · {todayStr})
                </p>
              </div>
              {activeSet.interviewDate && (
                <span className="border border-black px-2 py-0.5 font-bold text-xs">
                  면접일: {activeSet.interviewDate}
                </span>
              )}
            </div>

            {/* 1. 1분 자기소개 답변 전문 */}
            {selfIntroQ && (
              <div className="border border-black p-2.5 space-y-1">
                <div className="font-black text-xs uppercase border-b border-black pb-0.5">
                  1. 1분 자기소개 전문
                </div>
                <p className="leading-snug font-medium">{selfIntroQ.answer}</p>
              </div>
            )}

            {/* 2. 최고 등급(필살기) 경험의 한 줄 요약과 결과 숫자 */}
            <div className="border border-black p-2.5 space-y-1.5">
              <div className="font-black text-xs uppercase border-b border-black pb-0.5">
                2. 최고 등급(필살기) 핵심 경험 요약 및 결과 숫자
              </div>
              <div className="space-y-1.5">
                {topExperiences.map((exp) => (
                  <div key={exp.id} className="leading-snug">
                    <div className="font-bold">
                      • {exp.name}{' '}
                      <span className="font-normal">({exp.breakdown.oneLineSummary})</span>
                    </div>
                    <div className="pl-2 font-semibold">→ 결과 숫자: {exp.resultMetric}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. S 등급 질문과 그 첫 문장 */}
            <div className="border border-black p-2.5 space-y-1.5">
              <div className="font-black text-xs uppercase border-b border-black pb-0.5">
                3. S 등급 (반드시 나옴) 핵심 질문 & 두괄식 첫 문장 ({sGradeQuestions.length}문항)
              </div>
              <div className="space-y-1">
                {sGradeQuestions.map((q, idx) => (
                  <div key={q.id} className="leading-snug border-b border-dotted border-black/40 pb-1 last:border-none">
                    <div className="font-bold">
                      S-{idx + 1}. {q.content}
                    </div>
                    <div className="pl-2">→ {q.firstSentence}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 마무리 카테고리의 역질문 */}
            <div className="border border-black p-2.5 space-y-1">
              <div className="font-black text-xs uppercase border-b border-black pb-0.5">
                4. 마무리 (마지막 할 말 · 면접관 역질문)
              </div>
              {closingQuestions.map((q) => (
                <div key={q.id} className="leading-snug">
                  <span className="font-bold">• {q.content}:</span> {q.firstSentence}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
