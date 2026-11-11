'use client';

import React, { useState, useMemo } from 'react';
import {
  AppDatabase,
  Category,
  FollowUp,
  FollowUpType,
  InterviewSet,
  PriorityGrade,
  Question,
  QuestionTypeTag,
  StudyProgress,
  TrashItem,
} from '../types';
import {
  CONVERSION_FORMULAS,
  CORE_ONE_SENTENCE,
  FINAL_TEN_CHECKLIST,
  FOLLOWUP_TYPE_META,
  PRIORITY_META,
  TYPE_TAG_META,
} from '../constants';
import {
  X,
  Upload,
  Download,
  RotateCcw,
  Copy,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Sparkles,
  FolderPlus,
  Inbox,
  BookOpen,
} from 'lucide-react';

/* ============================================================================
 * 1) 질문 일괄 가져오기 (3-6)
 * ========================================================================== */
export interface ParsedBulkItem {
  tempId: string;
  content: string;
  priority: PriorityGrade;
  categoryId: string;
  typeTag: QuestionTypeTag;
  isDuplicate: boolean;
  followUps: string[];
}

interface BulkImportModalProps {
  categories: Category[];
  existingQuestions: Question[];
  onClose: () => void;
  onConfirmImport: (items: ParsedBulkItem[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  categories,
  existingQuestions,
  onClose,
  onConfirmImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [previewItems, setPreviewItems] = useState<ParsedBulkItem[] | null>(null);

  const autoClassify = (text: string): { categoryId: string; typeTag: QuestionTypeTag } => {
    for (const cat of categories) {
      for (const kw of cat.autoKeywords) {
        if (kw && text.includes(kw)) {
          let tag: QuestionTypeTag = 'K';
          if (cat.name.includes('지원동기') || cat.name.includes('마무리')) tag = 'L';
          else if (cat.name.includes('인성') || cat.name.includes('압박')) tag = 'M';
          return { categoryId: cat.id, typeTag: tag };
        }
      }
    }
    return { categoryId: 'unclassified', typeTag: 'K' };
  };

  const handleParse = () => {
    const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
    const parsed: ParsedBulkItem[] = [];
    const existingSet = new Set(existingQuestions.map((q) => q.content.trim()));

    for (const line of lines) {
      const isIndented = /^(\s{2,}|\t|\s*[-└↳•]\s+)/.test(line);
      const trimmed = line.replace(/^(\s*[-└↳•]\s*)/, '').trim();
      if (!trimmed) continue;

      if (isIndented && parsed.length > 0) {
        parsed[parsed.length - 1].followUps.push(trimmed);
        continue;
      }

      let priority: PriorityGrade = 'B';
      let content = trimmed;
      const prioMatch = content.match(/^\[(S|A|B|C)(?:급)?\]\s*(.+)$/i);
      if (prioMatch) {
        priority = prioMatch[1].toUpperCase() as PriorityGrade;
        content = prioMatch[2].trim();
      }

      const { categoryId, typeTag } = autoClassify(content);
      parsed.push({
        tempId: `bulk_${Date.now()}_${parsed.length}`,
        content,
        priority,
        categoryId,
        typeTag,
        isDuplicate: existingSet.has(content),
        followUps: [],
      });
    }
    setPreviewItems(parsed);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">질문 일괄 가져오기</h3>
            <p className="text-xs text-slate-500">
              한 줄을 질문 하나로 인식합니다. 줄 앞의 [S]·[A]는 우선순위로, 들여쓰기 된 줄은 바로 위 질문의 꼬리질문으로 자동 인식합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!previewItems ? (
          <div className="space-y-3">
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`예시:\n[S] A320 항공기에서 MEL 적용 시 운항기술팀이 확인해야 할 사항은?\n  구체적으로 성능 제한과 어떻게 연결되나요?\n[A] 입사 후 EFB 데이터 오류를 예방하기 위한 본인만의 방법은?`}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm font-mono leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!rawText.trim()}
                onClick={handleParse}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#3B5BDB] disabled:opacity-40 text-white text-sm font-bold"
              >
                자동 분류 및 미리보기 표 확인 →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-2.5">상태</th>
                    <th className="p-2.5">질문 내용 & 꼬리질문</th>
                    <th className="p-2.5">카테고리</th>
                    <th className="p-2.5">우선순위</th>
                    <th className="p-2.5">유형</th>
                    <th className="p-2.5">제외</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.map((it, idx) => (
                    <tr key={it.tempId} className={it.isDuplicate ? 'bg-amber-50/50' : ''}>
                      <td className="p-2.5 whitespace-nowrap">
                        {it.isDuplicate ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                            중복
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                            신규
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900 text-sm">{it.content}</div>
                        {it.followUps.length > 0 && (
                          <div className="mt-1 pl-3 border-l-2 border-indigo-200 text-slate-500 space-y-0.5">
                            {it.followUps.map((f, fi) => (
                              <div key={fi}>↳ 꼬리: {f}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={it.categoryId}
                          onChange={(e) => {
                            const next = [...previewItems];
                            next[idx] = { ...it, categoryId: e.target.value };
                            setPreviewItems(next);
                          }}
                          className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          <option value="unclassified">미분류 (자동 생성)</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={it.priority}
                          onChange={(e) => {
                            const next = [...previewItems];
                            next[idx] = { ...it, priority: e.target.value as PriorityGrade };
                            setPreviewItems(next);
                          }}
                          className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold"
                        >
                          <option value="S">S등급</option>
                          <option value="A">A등급</option>
                          <option value="B">B등급</option>
                          <option value="C">C등급</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={it.typeTag}
                          onChange={(e) => {
                            const next = [...previewItems];
                            next[idx] = { ...it, typeTag: e.target.value as QuestionTypeTag };
                            setPreviewItems(next);
                          }}
                          className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold"
                        >
                          <option value="K">K 직무·경험</option>
                          <option value="M">M 인성·태도</option>
                          <option value="L">L 지원동기</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewItems(previewItems.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setPreviewItems(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                ← 텍스트 다시 수정
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={previewItems.length === 0}
                  onClick={() => onConfirmImport(previewItems)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#3B5BDB] text-white text-sm font-bold"
                >
                  {previewItems.length}개 질문 저장하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2) 회사별 세트 관리 및 복제 모달 (4단계-1)
 * ========================================================================== */
interface SetManagerModalProps {
  sets: InterviewSet[];
  activeSetId: string;
  onSelectSet: (id: string) => void;
  onCreateSet: (name: string, interviewDate?: string) => void;
  onUpdateSet: (id: string, patch: Partial<InterviewSet>) => void;
  onDuplicateSet: (
    sourceSetId: string,
    newName: string,
    copyLevel: 'questions_only' | 'with_followups' | 'with_answers'
  ) => void;
  onDeleteSet: (id: string) => void;
  onClose: () => void;
}

export const SetManagerModal: React.FC<SetManagerModalProps> = ({
  sets,
  activeSetId,
  onSelectSet,
  onCreateSet,
  onUpdateSet,
  onDuplicateSet,
  onDeleteSet,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [dupTargetId, setDupTargetId] = useState<string | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupLevel, setDupLevel] = useState<'questions_only' | 'with_followups' | 'with_answers'>(
    'with_followups'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">회사·직무별 면접 세트 관리</h3>
            <p className="text-xs text-slate-500">
              세트마다 카테고리·질문·진도·조사노트·복기록·면접일이 따로 관리되며, 내 경험과 말하기 시간은 공유됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing sets */}
        <div className="space-y-3">
          {sets.map((s) => {
            const isActive = s.id === activeSetId;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border space-y-3 ${
                  isActive ? 'border-[#3B5BDB] bg-indigo-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => onUpdateSet(s.id, { name: e.target.value })}
                      className="min-h-[40px] px-3 py-1 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSelectSet(s.id)}
                        className="min-h-[38px] px-3 py-1 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold"
                      >
                        전환
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDupTargetId(s.id);
                        setDupName(`${s.name} (복제본)`);
                      }}
                      className="min-h-[38px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> 복제
                    </button>
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSet(s.id)}
                        className="min-h-[38px] px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="font-bold text-slate-600">면접일 (D-day 계산):</label>
                  <input
                    type="date"
                    value={s.interviewDate || ''}
                    onChange={(e) =>
                      onUpdateSet(s.id, { interviewDate: e.target.value || undefined })
                    }
                    className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold"
                  />
                </div>

                {/* Duplication Options Box */}
                {dupTargetId === s.id && (
                  <div className="p-3.5 rounded-xl bg-white border-2 border-[#3B5BDB] space-y-3">
                    <div className="text-xs font-bold text-[#3B5BDB]">
                      ‘{s.name}’ 세트 복제 옵션 (학습 진도는 복제하지 않고 0에서 시작합니다)
                    </div>
                    <input
                      type="text"
                      value={dupName}
                      onChange={(e) => setDupName(e.target.value)}
                      placeholder="새 세트 이름"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {[
                        { id: 'questions_only', label: '카테고리와 질문만' },
                        { id: 'with_followups', label: '꼬리질문까지' },
                        { id: 'with_answers', label: '첫 문장과 답변까지' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setDupLevel(
                              opt.id as 'questions_only' | 'with_followups' | 'with_answers'
                            )
                          }
                          className={`min-h-[40px] p-2 rounded-lg border font-bold ${
                            dupLevel === opt.id
                              ? 'bg-indigo-50 border-[#3B5BDB] text-[#3B5BDB]'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDupTargetId(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!dupName.trim()) return;
                          onDuplicateSet(s.id, dupName.trim(), dupLevel);
                          setDupTargetId(null);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#3B5BDB] text-white text-xs font-bold"
                      >
                        복제 실행
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new empty set */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <FolderPlus className="w-4 h-4 text-[#3B5BDB]" /> 새 면접 세트 추가 (기본 7개 카테고리 자동 생성)
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="예: 대한항공 운항기술 면접"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[200px] min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm"
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
            />
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={() => {
                onCreateSet(newName.trim(), newDate || undefined);
                setNewName('');
                setNewDate('');
              }}
              className="min-h-[42px] px-4 py-1.5 rounded-xl bg-[#3B5BDB] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> 세트 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3) D-1 / 당일 [마지막 점검] 모달 (4단계-2)
 * ========================================================================== */
interface FinalCheckModalProps {
  questions: Question[];
  getProgress: (questionId: string) => StudyProgress;
  onSelectQuestion: (categoryId: string, questionId: string) => void;
  onClose: () => void;
}

export const FinalCheckModal: React.FC<FinalCheckModalProps> = ({
  questions,
  getProgress,
  onSelectQuestion,
  onClose,
}) => {
  const targetQuestions = useMemo(() => {
    return questions.filter((q) => q.priority === 'S' || getProgress(q.id).isWeakness);
  }, [questions, getProgress]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase">D-1 · 당일 집중 모드</span>
            <h3 className="text-xl font-black text-slate-900">
              마지막 점검 (S 등급 필수 질문 + 약점 질문 {targetQuestions.length}개)
            </h3>
            <p className="text-xs text-slate-500">
              면접 직전에는 긴 원고 대신 질문·키워드·두괄식 첫 문장만 빠르게 훑어보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {targetQuestions.map((q) => {
            const prog = getProgress(q.id);
            return (
              <div
                key={q.id}
                onClick={() => {
                  onSelectQuestion(q.categoryId, q.id);
                  onClose();
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-[#3B5BDB] bg-slate-50/60 cursor-pointer space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold">
                    {q.priority}등급
                  </span>
                  {prog.isWeakness && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                      ★약점 표시됨
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {q.questionNumber ? `Q${q.questionNumber}. ` : ''}
                  {q.content}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {q.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full bg-white border border-indigo-200 text-xs font-bold text-[#3B5BDB]"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-white border border-indigo-100 text-sm font-bold text-slate-900">
                  <span className="text-[#3B5BDB] mr-1.5">[첫 문장]</span>
                  {q.firstSentence}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4) 휴지통 모달 (7단계-1) & 꼬리질문 제안함 모달 (7단계-3) & 백업 모달 (3-7)
 * ========================================================================== */
interface TrashModalProps {
  trash: TrashItem[];
  onRestore: (trashId: string) => void;
  onEmptyTrash: () => void;
  onClose: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  trash,
  onRestore,
  onEmptyTrash,
  onClose,
}) => {
  const typeLabels: Record<TrashItem['itemType'], string> = {
    set: '면접 세트',
    category: '카테고리',
    question: '질문',
    followup: '꼬리질문',
    experience: '내 경험',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">휴지통 ({trash.length})</h3>
            <p className="text-xs text-slate-500">
              삭제된 항목은 30일간 보관된 뒤 자동으로 영구 삭제됩니다. 복원하면 원래 자리로 돌아갑니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trash.length > 0 && (
              <button
                type="button"
                onClick={onEmptyTrash}
                className="min-h-[38px] px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
              >
                휴지통 비우기
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {trash.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl">
            휴지통이 비어 있습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {trash.map((item) => (
              <div
                key={item.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-bold">
                      {typeLabels[item.itemType]}
                    </span>
                    <span className="text-xs text-slate-400">
                      삭제: {item.deletedBy} · {new Date(item.deletedAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(item.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 복원
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface SuggestionInboxModalProps {
  suggestions: FollowUp[];
  questions: Question[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNavigateToSuggestion: (question: Question, followUpId: string) => void;
  onClose: () => void;
}

export const SuggestionInboxModal: React.FC<SuggestionInboxModalProps> = ({
  suggestions,
  questions,
  onApprove,
  onReject,
  onNavigateToSuggestion,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#3B5BDB]" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                꼬리질문 제안함 ({suggestions.length})
              </h3>
              <p className="text-xs text-slate-500">
                보기 모드에서 제안된 꼬리질문을 승인하면 정식 마인드맵 노드로 전환됩니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {suggestions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl">
            대기 중인 꼬리질문 제안이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => {
              const rootQ = questions.find((q) => q.id === s.rootQuestionId);
              const meta = FOLLOWUP_TYPE_META[s.type];
              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl border border-amber-300 bg-amber-50/40 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded border text-xs font-bold ${meta.bg} ${meta.text} ${meta.border}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        제안자: {s.suggestedBy || '익명'} ·{' '}
                        {s.suggestedAt ? new Date(s.suggestedAt).toLocaleString('ko-KR') : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onApprove(s.id)}
                        className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> 승인
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(s.id)}
                        className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> 거절
                      </button>
                    </div>
                  </div>
                  <div className="text-base font-bold text-slate-900">{s.content}</div>
                  {rootQ && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToSuggestion(rootQ, s.id);
                        onClose();
                      }}
                      className="text-xs font-semibold text-[#3B5BDB] hover:underline text-left"
                    >
                      원래 질문 보기: {rootQ.content} →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface BackupModalProps {
  db: AppDatabase;
  onImportDb: (newDb: AppDatabase) => void;
  onResetDb: () => void;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  db,
  onImportDb,
  onResetDb,
  onClose,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `면접준비마인드맵_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppDatabase;
        if (!parsed.sets || !parsed.questions || !parsed.categories) {
          throw new Error('유효한 백업 파일 형식이 아닙니다.');
        }
        onImportDb(parsed);
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">데이터 백업 (JSON 내보내기 / 불러오기)</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          전체 세트, 135문항 질문·꼬리질문, 내 경험, 회사 조사 노트, 복기록, 학습 진도를 JSON 파일로 저장하거나 복원합니다.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#3B5BDB] hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> 전체 데이터 JSON 파일로 내보내기
          </button>

          <label className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> JSON 백업 파일 불러오기
            <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          </label>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    '초기 에어로케이 운항객실기술 2차면접 135문항 기본 데이터로 초기화할까요?'
                  )
                ) {
                  onResetDb();
                  onClose();
                }
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 초기 135문항 기본 데이터로 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5) 에어로케이 운항기술 답변 전환 공식 & 면접 직전 10계명 가이드 모달
 * ========================================================================== */
export const ConversionGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#3B5BDB]" />
            <h3 className="text-lg font-bold text-slate-900">
              에어로케이 운항기술 2차면접 — 답변 전환 공식 & 최종 점검 10계명
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
          <div className="text-xs font-bold text-[#3B5BDB] uppercase">핵심 한 문장</div>
          <p className="text-base font-bold text-slate-900 leading-relaxed">
            “{CORE_ONE_SENTENCE}”
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">
            1차 피드백 반영: 운항통제식 표현 → 운항기술식 표현 전환 공식
          </h4>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-rose-700">운항통제식으로 들리는 표현 (지양)</th>
                  <th className="p-3 text-[#3B5BDB]">운항기술식으로 바꿀 표현 (권장)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CONVERSION_FORMULAS.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-slate-600 line-through decoration-rose-400">
                      {row.dispatchStyle}
                    </td>
                    <td className="p-3 font-bold text-slate-900 bg-indigo-50/30">
                      {row.engineeringStyle}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">면접 직전 최종 점검 10개 항목</h4>
          <div className="grid grid-cols-1 gap-2">
            {FINAL_TEN_CHECKLIST.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 flex items-start gap-2"
              >
                <span className="font-bold text-[#3B5BDB] shrink-0">{idx + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
