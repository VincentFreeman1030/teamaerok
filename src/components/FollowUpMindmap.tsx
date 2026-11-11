'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FollowUp, FollowUpType, Question } from '../types';
import { FOLLOWUP_TYPE_META, QUICK_FOLLOWUP_TEMPLATES } from '../constants';
import { collectDescendantFollowUpIds } from '../services/storage';
import { CautionHighlightedText } from './CautionHighlightedText';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Maximize2,
  ZoomIn,
  ZoomOut,
  MessageSquarePlus,
  Trash2,
  Edit3,
  Lightbulb,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface Props {
  question: Question;
  followUps: FollowUp[]; // all followUps for this question (including suggestions)
  selectedFollowUpId: string | null;
  onSelectFollowUp: (id: string | null) => void;
  isEditMode: boolean;
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
  onApproveSuggestion?: (id: string) => void;
  onRejectSuggestion?: (id: string) => void;
}

interface LayoutNode {
  id: string;
  isRoot: boolean;
  title: string;
  followUp?: FollowUp;
  depth: number;
  x: number;
  y: number;
  children: LayoutNode[];
  totalChildrenCount: number;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 96;
const LEVEL_GAP_X = 330;
const LEAF_GAP_Y = 124;

export const FollowUpMindmap: React.FC<Props> = ({
  question,
  followUps,
  selectedFollowUpId,
  onSelectFollowUp,
  isEditMode,
  onAddFollowUp,
  onUpdateFollowUp,
  onDeleteFollowUp,
  onApproveSuggestion,
  onRejectSuggestion,
}) => {
  // Expanded node IDs: by default expand root and depth-1 nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const init = new Set<string>([question.id]);
    followUps.forEach((f) => {
      if (f.parentId === question.id) init.add(f.id);
    });
    return init;
  });

  // Ensure ancestors of selectedFollowUpId are always expanded
  useEffect(() => {
    if (!selectedFollowUpId) return;
    const byId = new Map(followUps.map((f) => [f.id, f]));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(question.id);
      let curr = byId.get(selectedFollowUpId);
      while (curr) {
        next.add(curr.parentId);
        curr = byId.get(curr.parentId);
      }
      return next;
    });
  }, [selectedFollowUpId, followUps, question.id]);

  // Reset expanded on question change
  useEffect(() => {
    const next = new Set<string>([question.id]);
    followUps.forEach((f) => {
      if (f.parentId === question.id) next.add(f.id);
    });
    setExpandedIds(next);
  }, [question.id]);

  // Canvas Pan & Zoom state
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchDistRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add / Suggest Modal state
  const [addingTarget, setAddingTarget] = useState<{
    parentId: string;
    parentTitle: string;
    isSuggestion: boolean;
  } | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<FollowUpType>('dig');
  const [formKeywords, setFormKeywords] = useState('');
  const [formFirstSentence, setFormFirstSentence] = useState('');
  const [formAnswer, setFormAnswer] = useState('');

  // Delete confirmation state
  const [deletingNode, setDeletingNode] = useState<{ id: string; title: string; childCount: number } | null>(null);

  // Inspector reveal states for selected follow-up in View mode
  const [showFirstSentence, setShowFirstSentence] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setShowFirstSentence(false);
    setShowAnswer(false);
  }, [selectedFollowUpId]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, FollowUp[]>();
    const sorted = [...followUps].sort((a, b) => a.order - b.order);
    for (const f of sorted) {
      const list = map.get(f.parentId) || [];
      list.push(f);
      map.set(f.parentId, list);
    }
    return map;
  }, [followUps]);

  // Build visible hierarchical layout tree
  const { rootLayout, flatNodes, edges, canvasWidth, canvasHeight } = useMemo(() => {
    function buildTree(id: string, isRoot: boolean, depth: number, f?: FollowUp): LayoutNode {
      const rawChildren = childrenMap.get(id) || [];
      const isExpanded = expandedIds.has(id);
      const visibleChildren = isExpanded
        ? rawChildren.map((child) => buildTree(child.id, false, depth + 1, child))
        : [];
      return {
        id,
        isRoot,
        title: isRoot ? question.content : f!.content,
        followUp: f,
        depth,
        x: depth * LEVEL_GAP_X + 24,
        y: 0,
        children: visibleChildren,
        totalChildrenCount: rawChildren.length,
      };
    }

    const root = buildTree(question.id, true, 0);

    let leafIndex = 0;
    function assignY(node: LayoutNode): number {
      if (node.children.length === 0) {
        const y = leafIndex * LEAF_GAP_Y + 32;
        leafIndex += 1;
        node.y = y;
        return y;
      }
      const childYs = node.children.map((c) => assignY(c));
      const minY = Math.min(...childYs);
      const maxY = Math.max(...childYs);
      node.y = (minY + maxY) / 2;
      return node.y;
    }
    assignY(root);

    const nodes: LayoutNode[] = [];
    const edgeList: { from: LayoutNode; to: LayoutNode }[] = [];
    let maxX = NODE_WIDTH + 60;
    let maxY = NODE_HEIGHT + 60;

    function collect(n: LayoutNode) {
      nodes.push(n);
      if (n.x + NODE_WIDTH + 60 > maxX) maxX = n.x + NODE_WIDTH + 60;
      if (n.y + NODE_HEIGHT + 60 > maxY) maxY = n.y + NODE_HEIGHT + 60;
      for (const c of n.children) {
        edgeList.push({ from: n, to: c });
        collect(c);
      }
    }
    collect(root);

    return {
      rootLayout: root,
      flatNodes: nodes,
      edges: edgeList,
      canvasWidth: Math.max(760, maxX),
      canvasHeight: Math.max(360, maxY),
    };
  }, [question.id, question.content, childrenMap, expandedIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fitToScreen = () => {
    if (!containerRef.current) {
      setPan({ x: 24, y: 24 });
      setZoom(1);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 40) / canvasWidth;
    const scaleY = (rect.height - 40) / canvasHeight;
    const newZoom = Math.min(1.1, Math.max(0.45, Math.min(scaleX, scaleY)));
    setZoom(Number(newZoom.toFixed(2)));
    setPan({ x: 20, y: 20 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-card="true"]')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Number(Math.min(1.6, Math.max(0.4, z + delta)).toFixed(2)));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      if ((e.target as HTMLElement).closest('[data-node-card="true"]')) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      setZoom((z) => Number(Math.min(1.6, Math.max(0.4, z * ratio)).toFixed(2)));
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchDistRef.current = null;
  };

  const openAddModal = (parentId: string, parentTitle: string, isSuggestion: boolean) => {
    setAddingTarget({ parentId, parentTitle, isSuggestion });
    setFormContent('');
    setFormType('dig');
    setFormKeywords('');
    setFormFirstSentence('');
    setFormAnswer('');
  };

  const submitAddModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingTarget || !formContent.trim()) return;
    const kw = formKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onAddFollowUp(addingTarget.parentId, {
      content: formContent.trim(),
      type: formType,
      keywords: kw.length > 0 ? kw : ['원문서 확인', '적용조건'],
      firstSentence: formFirstSentence.trim(),
      answer: formAnswer.trim(),
      isSuggestion: addingTarget.isSuggestion,
    });
    setExpandedIds((prev) => new Set(prev).add(addingTarget.parentId));
    setAddingTarget(null);
  };

  const selectedFollowUp = useMemo(
    () => followUps.find((f) => f.id === selectedFollowUpId) || null,
    [followUps, selectedFollowUpId]
  );

  // Recursive mobile vertical tree renderer
  const renderMobileTreeNode = (nodeId: string, depth: number): React.ReactNode => {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return null;
    return (
      <div className="space-y-2.5 mt-2.5">
        {children.map((child) => {
          const grandChildren = childrenMap.get(child.id) || [];
          const isExpanded = expandedIds.has(child.id);
          const isSelected = selectedFollowUpId === child.id;
          const meta = FOLLOWUP_TYPE_META[child.type];
          const descendantsCount = collectDescendantFollowUpIds(child.id, followUps).length;

          return (
            <div key={child.id} className="relative pl-4 border-l-2 border-indigo-200">
              <div
                onClick={() => {
                  onSelectFollowUp(child.id);
                  if (grandChildren.length > 0 && !isExpanded) toggleExpand(child.id);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  child.isSuggestion ? 'border-dashed border-amber-400 bg-amber-50/40' : ''
                } ${
                  isSelected
                    ? 'border-[#3B5BDB] bg-indigo-50/60 ring-2 ring-[#3B5BDB]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {child.code && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                        {child.code}
                      </span>
                    )}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.text} ${meta.border}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{depth}단계</span>
                    {child.isSuggestion && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        제안 대기 ({child.suggestedBy || '익명'})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {grandChildren.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(child.id);
                        }}
                        className="min-h-[36px] px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        하위 {grandChildren.length}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-base font-semibold text-slate-900 leading-snug">{child.content}</p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  {isEditMode ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddModal(child.id, child.content, false);
                        }}
                        className="min-h-[40px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#3B5BDB] text-white flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> 꼬리질문 추가
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingNode({ id: child.id, title: child.content, childCount: descendantsCount });
                        }}
                        className="min-h-[40px] px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModal(child.id, child.content, true);
                      }}
                      className="min-h-[40px] px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" /> 꼬리질문 제안
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && renderMobileTreeNode(child.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">꼬리질문 마인드맵</span>
          <span className="text-xs text-slate-500">
            노드를 선택하면 대응 팁·키워드·답변이 아래에 표시되고 상단 이동 경로가 갱신됩니다.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <button
              type="button"
              onClick={() => openAddModal(question.id, question.content, false)}
              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#3B5BDB] hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" /> 본질문에 꼬리질문 추가
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAddModal(question.id, question.content, true)}
              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <MessageSquarePlus className="w-4 h-4 text-[#3B5BDB]" /> 꼬리질문 제안
            </button>
          )}
        </div>
      </div>

      {/* 1. MOBILE VIEW (<= 767px): 세로 들여쓰기 트리 */}
      <div className="block md:hidden">
        <div className="p-3.5 rounded-xl bg-slate-900 text-white">
          <div className="text-xs text-indigo-300 font-semibold mb-1">중심 질문 (본질문)</div>
          <div className="text-base font-bold leading-snug">{question.content}</div>
        </div>
        {followUps.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl mt-2">
            등록된 꼬리질문이 없습니다. 꼬리질문을 추가하거나 제안해 보세요.
          </div>
        ) : (
          renderMobileTreeNode(question.id, 1)
        )}
      </div>

      {/* 2. TABLET & LAPTOP VIEW (>= 768px): 가로 마인드맵 캔버스 */}
      <div className="hidden md:block relative bg-slate-50/80 border border-slate-200 rounded-2xl overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setZoom((z) => Number(Math.max(0.4, z - 0.12).toFixed(2)))}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 px-1.5 min-w-[46px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Number(Math.min(1.6, z + 0.12).toFixed(2)))}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={fitToScreen}
            className="min-h-[38px] px-2.5 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1"
          >
            <Maximize2 className="w-3.5 h-3.5" /> 화면에 맞추기
          </button>
        </div>

        {/* Interactive Surface */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`mindmap-dot-grid w-full h-[430px] overflow-hidden select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            className="origin-top-left relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: canvasWidth,
              height: canvasHeight,
            }}
          >
            {/* SVG Connecting Curves */}
            <svg
              width={canvasWidth}
              height={canvasHeight}
              className="absolute inset-0 pointer-events-none overflow-visible"
            >
              {edges.map(({ from, to }) => {
                const x1 = from.x + NODE_WIDTH;
                const y1 = from.y + NODE_HEIGHT / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_HEIGHT / 2;
                const cx1 = x1 + (x2 - x1) * 0.45;
                const cx2 = x1 + (x2 - x1) * 0.55;
                const isSuggestionEdge = to.followUp?.isSuggestion;
                const isSelectedEdge = selectedFollowUpId === to.id;
                return (
                  <path
                    key={`${from.id}->${to.id}`}
                    d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isSelectedEdge ? '#3B5BDB' : isSuggestionEdge ? '#f59e0b' : '#94a3b8'}
                    strokeWidth={isSelectedEdge ? 2.5 : 1.8}
                    strokeDasharray={isSuggestionEdge ? '5,5' : undefined}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {flatNodes.map((node) => {
              if (node.isRoot) {
                return (
                  <div
                    key={node.id}
                    data-node-card="true"
                    onClick={() => onSelectFollowUp(null)}
                    style={{
                      left: node.x,
                      top: node.y,
                    }}
                    className={`absolute w-[260px] min-h-[96px] p-3.5 rounded-2xl bg-slate-900 text-white shadow-md border-2 transition-all cursor-pointer ${
                      selectedFollowUpId === null ? 'border-[#3B5BDB] ring-4 ring-[#3B5BDB]/20' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                        본질문 {question.questionNumber ? `#${question.questionNumber}` : ''}
                      </span>
                      {isEditMode ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(question.id, question.content, false);
                          }}
                          className="px-2 py-0.5 rounded bg-[#3B5BDB] hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> 추가
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(question.id, question.content, true);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 flex items-center gap-0.5"
                        >
                          <MessageSquarePlus className="w-3 h-3" /> 제안
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-snug line-clamp-3">{node.title}</p>
                  </div>
                );
              }

              const f = node.followUp!;
              const meta = FOLLOWUP_TYPE_META[f.type];
              const isSelected = selectedFollowUpId === f.id;
              const isExpanded = expandedIds.has(f.id);
              const descendantsCount = collectDescendantFollowUpIds(f.id, followUps).length;

              return (
                <div
                  key={node.id}
                  data-node-card="true"
                  onClick={() => {
                    onSelectFollowUp(f.id);
                    if (node.totalChildrenCount > 0 && !isExpanded) {
                      toggleExpand(f.id);
                    }
                  }}
                  style={{
                    left: node.x,
                    top: node.y,
                  }}
                  className={`absolute w-[260px] min-h-[96px] p-3 rounded-2xl bg-white shadow-xs transition-all cursor-pointer border-2 ${
                    f.isSuggestion ? 'border-dashed border-amber-400 bg-amber-50/40' : ''
                  } ${
                    isSelected
                      ? 'border-[#3B5BDB] ring-4 ring-[#3B5BDB]/20 shadow-md'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {f.code && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                          {f.code}
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}
                      >
                        {meta.label}
                      </span>
                      {f.isSuggestion && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          제안
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditMode ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModal(f.id, f.content, false);
                            }}
                            className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-[#3B5BDB]"
                            title="하위 꼬리질문 추가"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingNode({ id: f.id, title: f.content, childCount: descendantsCount });
                            }}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                            title="꼬리질문 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(f.id, f.content, true);
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-medium text-slate-600"
                          title="이어지는 꼬리질문 제안"
                        >
                          +제안
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">{f.content}</p>

                  {/* Expand/Collapse pill on right edge if node has children */}
                  {node.totalChildrenCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(f.id);
                      }}
                      className={`absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border shadow-xs flex items-center justify-center text-[11px] font-bold transition-colors ${
                        isExpanded
                          ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title={isExpanded ? '하위 꼬리질문 접기' : '하위 꼬리질문 펼치기'}
                    >
                      {isExpanded ? '−' : node.totalChildrenCount}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Follow-Up Node Inspector Panel */}
      {selectedFollowUp && (
        <div className="bg-white border-2 border-[#3B5BDB]/30 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedFollowUp.code && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                  {selectedFollowUp.code}
                </span>
              )}
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  FOLLOWUP_TYPE_META[selectedFollowUp.type].bg
                } ${FOLLOWUP_TYPE_META[selectedFollowUp.type].text} ${
                  FOLLOWUP_TYPE_META[selectedFollowUp.type].border
                }`}
              >
                꼬리질문 유형: {FOLLOWUP_TYPE_META[selectedFollowUp.type].label}
              </span>
              {selectedFollowUp.isSuggestion && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                  제안 대기 중 (제안자: {selectedFollowUp.suggestedBy || '익명'})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditMode && selectedFollowUp.isSuggestion && onApproveSuggestion && onRejectSuggestion && (
                <>
                  <button
                    type="button"
                    onClick={() => onApproveSuggestion(selectedFollowUp.id)}
                    className="min-h-[40px] px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> 제안 승인
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectSuggestion(selectedFollowUp.id)}
                    className="min-h-[40px] px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> 거절
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onSelectFollowUp(null)}
                className="min-h-[40px] px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                선택 해제
              </button>
            </div>
          </div>

          {/* Coaching tip for this follow-up type */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-sm">
            <Lightbulb className="w-4 h-4 text-[#3B5BDB] shrink-0" />
            <div>
              <strong className="font-bold">[{FOLLOWUP_TYPE_META[selectedFollowUp.type].label} 대응 팁]</strong>{' '}
              {FOLLOWUP_TYPE_META[selectedFollowUp.type].tip}
            </div>
          </div>

          {isEditMode ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">꼬리질문 내용</label>
                <input
                  type="text"
                  value={selectedFollowUp.content}
                  onChange={(e) => onUpdateFollowUp(selectedFollowUp.id, { content: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-base font-semibold"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">꼬리질문 유형</label>
                  <select
                    value={selectedFollowUp.type}
                    onChange={(e) =>
                      onUpdateFollowUp(selectedFollowUp.id, { type: e.target.value as FollowUpType })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {(Object.keys(FOLLOWUP_TYPE_META) as FollowUpType[]).map((t) => (
                      <option key={t} value={t}>
                        {FOLLOWUP_TYPE_META[t].label} — {FOLLOWUP_TYPE_META[t].tip}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">키워드 (쉼표 구분)</label>
                  <input
                    type="text"
                    value={selectedFollowUp.keywords.join(', ')}
                    onChange={(e) =>
                      onUpdateFollowUp(selectedFollowUp.id, {
                        keywords: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">두괄식 첫 문장</label>
                <input
                  type="text"
                  value={selectedFollowUp.firstSentence}
                  onChange={(e) => onUpdateFollowUp(selectedFollowUp.id, { firstSentence: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">꼬리질문 답변</label>
                <textarea
                  rows={4}
                  value={selectedFollowUp.answer}
                  onChange={(e) => onUpdateFollowUp(selectedFollowUp.id, { answer: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <>
              <h4 className="text-lg font-bold text-slate-900">{selectedFollowUp.content}</h4>
              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5">
                {selectedFollowUp.keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
              {/* First sentence */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-600">두괄식 첫 문장</span>
                  <button
                    type="button"
                    onClick={() => setShowFirstSentence((v) => !v)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  >
                    {showFirstSentence ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showFirstSentence ? '가리기' : '첫 문장 보기'}
                  </button>
                </div>
                {showFirstSentence ? (
                  <CautionHighlightedText
                    text={selectedFollowUp.firstSentence || '등록된 첫 문장이 없습니다.'}
                    className="text-base font-semibold text-slate-900 mt-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFirstSentence(true)}
                    className="w-full text-left py-2 text-sm text-slate-500 hover:text-slate-800"
                  >
                    눌러서 두괄식 첫 문장 확인하기 (먼저 입으로 첫 문장을 말해 보세요)
                  </button>
                )}
              </div>
              {/* Full answer */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-600">꼬리질문 모범답변</span>
                  <button
                    type="button"
                    onClick={() => setShowAnswer((v) => !v)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  >
                    {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showAnswer ? '답변 접기' : '답변 보기'}
                  </button>
                </div>
                {showAnswer ? (
                  <CautionHighlightedText
                    text={selectedFollowUp.answer || '등록된 답변이 없습니다.'}
                    className="text-base text-slate-800 mt-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="w-full text-left py-2 text-sm text-slate-500 hover:text-slate-800"
                  >
                    [답변 보기]를 눌러 전체 모범답변 확인하기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Add FollowUp / Suggestion Modal */}
      {addingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {addingTarget.isSuggestion ? '꼬리질문 제안하기' : '꼬리질문 추가하기'}
              </h3>
              <button
                type="button"
                onClick={() => setAddingTarget(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="font-bold text-slate-800">상위 질문:</span> {addingTarget.parentTitle}
            </div>

            {addingTarget.isSuggestion && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
                “면접관이라면 이 답을 듣고 무엇이 궁금할까요?” — 제안하신 꼬리질문은 마인드맵에 점선 노드로 표시되며 편집 모드 제안함에서 승인할 수 있습니다.
              </div>
            )}

            {/* Quick templates */}
            <div>
              <div className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#3B5BDB]" /> 빠른 문구에서 고르기
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FOLLOWUP_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormContent(tpl.text);
                      setFormType(tpl.type);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-[#3B5BDB] text-xs font-medium text-slate-700 border border-slate-200 transition-colors"
                  >
                    {tpl.text}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submitAddModal} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">꼬리질문 내용 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 실제 계산 결과가 매뉴얼과 다르면 무엇부터 확인하겠습니까?"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-base"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">꼬리질문 유형</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as FollowUpType)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {(Object.keys(FOLLOWUP_TYPE_META) as FollowUpType[]).map((t) => (
                    <option key={t} value={t}>
                      {FOLLOWUP_TYPE_META[t].label} — {FOLLOWUP_TYPE_META[t].tip}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">핵심 키워드 (쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="예: 원문서 확인, 적용조건, 선배 검토"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">두괄식 첫 문장 (선택)</label>
                <input
                  type="text"
                  placeholder="결론부터 한 문장으로 적어 보세요"
                  value={formFirstSentence}
                  onChange={(e) => setFormFirstSentence(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">답변 메모 (선택)</label>
                <textarea
                  rows={3}
                  placeholder="키워드와 논리 흐름 중심으로 답변을 적어 보세요"
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddingTarget(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3B5BDB] text-white text-sm font-semibold"
                >
                  {addingTarget.isSuggestion ? '제안 등록' : '꼬리질문 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingNode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">꼬리질문을 삭제할까요?</h3>
            <p className="text-sm text-slate-700 font-medium">“{deletingNode.title}”</p>
            {deletingNode.childCount > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                주의: 이 꼬리질문에 연결된 하위 {deletingNode.childCount}개 꼬리질문도 함께 휴지통으로 삭제됩니다.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingNode(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFollowUp(deletingNode.id);
                  if (selectedFollowUpId === deletingNode.id) onSelectFollowUp(null);
                  setDeletingNode(null);
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
