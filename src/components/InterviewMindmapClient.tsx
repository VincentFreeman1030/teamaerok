'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AppDatabase,
  Category,
  CompanyResearch,
  Experience,
  FollowUp,
  FollowUpType,
  InterviewReview,
  InterviewSet,
  PriorityGrade,
  Question,
  QuestionTypeTag,
  StudyProgress,
  StudyStatus,
  TrashItem,
} from '../types';
import {
  APP_CONFIG,
  CORE_ONE_SENTENCE,
  DDAY_STAGES,
  PRIORITY_META,
  STUDY_STATUS_META,
  TYPE_TAG_META,
} from '../constants';
import {
  addDaysStr,
  calculateNextReviewDate,
  collectDescendantFollowUpIds,
  diffDaysFromToday,
  getFollowUpStats,
  getQuestionProgress,
  getTodayStr,
  isDeviceEditUnlocked,
  loadActiveSetId,
  loadProfile,
  needsFollowUpReinforcement,
  resetToInitialDatabase,
  saveActiveSetId,
  saveDatabase,
  saveProfile,
  setDeviceEditUnlocked,
  SyncStatus,
} from '../services/storage';
import {
  applyGranularMutationsAction,
  fetchLatestMindmapAction,
  GranularMutation,
} from '../app/(frontend)/actions';
import { QuestionDetailPanel } from './QuestionDetailPanel';
import { ExperienceBankView, CompanyResearchView } from './ExperienceAndResearchView';
import { MockInterviewView, InterviewReviewLogView } from './MockInterviewAndReviewView';
import { PrintPreviewView } from './PrintPreviewView';
import {
  BackupModal,
  BulkImportModal,
  ConversionGuideModal,
  FinalCheckModal,
  ParsedBulkItem,
  SetManagerModal,
  SuggestionInboxModal,
  TrashModal,
} from './AdminModals';
import {
  Home,
  RefreshCw,
  Mic,
  Search,
  MoreHorizontal,
  Printer,
  Edit3,
  Check,
  ChevronRight,
  Flag,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Award,
  Building2,
  FileCheck2,
  Inbox,
  Upload,
  Download,
  FolderKanban,
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  User,
  Lock,
  Unlock,
  BookOpen,
  ArrowLeft,
  ChevronDown,
  Share2,
} from 'lucide-react';

type ScreenType =
  | 'home'
  | 'category'
  | 'review'
  | 'mock'
  | 'search'
  | 'experience'
  | 'research'
  | 'review_log'
  | 'more'
  | 'print';

const OFFLINE_QUEUE_KEY = 'interview_mindmap_offline_queue_v1';

interface Props {
  initialDb: AppDatabase;
}

export const InterviewMindmapClient: React.FC<Props> = ({ initialDb }) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Database & Profile state
  const [db, setDb] = useState<AppDatabase>(initialDb);
  const [profile, setProfile] = useState<string>('지원자');
  const [showNicknamePrompt, setShowNicknamePrompt] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // Active Set state
  const [activeSetId, setActiveSetId] = useState<string>(
    initialDb.sets[0]?.id || 'set_aerok'
  );

  // Sync status indicator
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const pendingMutationsRef = useRef<number>(0);
  const lastLocalEditTimeRef = useRef<number>(0);

  // Share toast
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Navigation state
  const [screen, setScreen] = useState<ScreenType>('home');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState<boolean>(false);
  const [mobileBreadcrumbExpanded, setMobileBreadcrumbExpanded] = useState<boolean>(false);

  // Edit mode & Passcode state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Undo toast for Trash (5 seconds)
  const [undoToast, setUndoToast] = useState<{ trashId: string; title: string } | null>(null);

  // Modals
  const [showSetManager, setShowSetManager] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showFinalCheckModal, setShowFinalCheckModal] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Category Screen Filter & Sort state
  const [catFilterPriority, setCatFilterPriority] = useState<PriorityGrade | 'ALL'>('ALL');
  const [catFilterType, setCatFilterType] = useState<QuestionTypeTag | 'ALL'>('ALL');
  const [catFilterStatus, setCatFilterStatus] = useState<StudyStatus | 'ALL'>('ALL');
  const [catFilterWeaknessOnly, setCatFilterWeaknessOnly] = useState<boolean>(false);
  const [catSortBy, setCatSortBy] = useState<'priority' | 'readCount' | 'lastStudied'>('priority');

  // Review Screen Tab, Filter & Sort state
  const [reviewTab, setReviewTab] = useState<'unconfident' | 'today'>('unconfident');
  const [revSortBy, setRevSortBy] = useState<'priority' | 'readCount'>('priority');
  const [revSortDir, setRevSortDir] = useState<'asc' | 'desc'>('desc');
  const [revFilterCatId, setRevFilterCatId] = useState<string>('ALL');
  const [revFilterType, setRevFilterType] = useState<QuestionTypeTag | 'ALL'>('ALL');
  const [revFilterWeaknessOnly, setRevFilterWeaknessOnly] = useState<boolean>(false);

  // Quick status popover in list rows
  const [listRowStatusPromptId, setListRowStatusPromptId] = useState<string | null>(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // D-day expanded stages
  const [expandedDdayStageIds, setExpandedDdayStageIds] = useState<Set<string>>(new Set());

  // Load client profile & activeSetId on mount
  useEffect(() => {
    const savedProf = loadProfile();
    if (savedProf) {
      setProfile(savedProf);
    } else {
      setShowNicknamePrompt(true);
    }
    const savedSet = loadActiveSetId(initialDb.sets[0]?.id || 'set_aerok');
    if (initialDb.sets.some((s) => s.id === savedSet)) {
      setActiveSetId(savedSet);
    }
  }, [initialDb.sets]);

  // Queue & Dispatch Granular Server Mutations (Step 6)
  const dispatchMutations = useCallback(
    (mutations: GranularMutation[]) => {
      if (mutations.length === 0) return;
      lastLocalEditTimeRef.current = Date.now();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        try {
          const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
          const existing: GranularMutation[] = raw ? JSON.parse(raw) : [];
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...existing, ...mutations]));
        } catch {
          // ignore
        }
        return;
      }

      pendingMutationsRef.current += 1;
      setSyncStatus('saving');

      startTransition(async () => {
        const res = await applyGranularMutationsAction(mutations);
        pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
        if (res.ok) {
          setSyncStatus('saved');
          router.refresh();
        } else {
          setSyncStatus('offline');
          try {
            const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
            const existing: GranularMutation[] = raw ? JSON.parse(raw) : [];
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...existing, ...mutations]));
          } catch {
            // ignore
          }
        }
      });
    },
    [router]
  );

  // Flush offline queue when back online
  const flushOfflineQueue = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queued: GranularMutation[] = JSON.parse(raw);
      if (queued.length === 0) return;
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      setSyncStatus('saving');
      const res = await applyGranularMutationsAction(queued);
      if (res.ok) {
        setSyncStatus('saved');
        router.refresh();
      } else {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queued));
        setSyncStatus('offline');
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Real-time / 3-second polling and window focus sync (Step 6: 3초마다 그리고 화면에 다시 돌아올 때 변경분을 불러온다)
  const pollServerChanges = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    if (pendingMutationsRef.current > 0) return;
    // Do not overwrite while the user is actively typing in an input or textarea
    const activeEl = document.activeElement;
    const isTyping =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT');
    if (isTyping || Date.now() - lastLocalEditTimeRef.current < 2500) {
      return;
    }

    await flushOfflineQueue();
    const res = await fetchLatestMindmapAction();
    if (res.ok && res.db && pendingMutationsRef.current === 0) {
      setDb(res.db);
      saveDatabase(res.db);
      setSyncStatus('saved');
    }
  }, [flushOfflineQueue]);

  useEffect(() => {
    const interval = window.setInterval(pollServerChanges, 3500);
    const handleFocus = () => {
      pollServerChanges();
    };
    const handleOnline = () => {
      flushOfflineQueue();
      pollServerChanges();
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pollServerChanges, flushOfflineQueue]);

  const updateDb = useCallback((updater: (prev: AppDatabase) => AppDatabase) => {
    lastLocalEditTimeRef.current = Date.now();
    setDb((prev) => {
      const next = updater(prev);
      saveDatabase(next);
      return next;
    });
  }, []);

  // Current Active Set & Filtered Entities
  const activeSet: InterviewSet = useMemo(
    () => db.sets.find((s) => s.id === activeSetId) || db.sets[0],
    [db.sets, activeSetId]
  );

  useEffect(() => {
    if (activeSet) saveActiveSetId(activeSet.id);
  }, [activeSet]);

  const setCategories = useMemo(
    () =>
      db.categories
        .filter((c) => c.setId === activeSet.id)
        .sort((a, b) => a.order - b.order),
    [db.categories, activeSet.id]
  );

  const setQuestions = useMemo(
    () =>
      db.questions
        .filter((q) => q.setId === activeSet.id)
        .sort((a, b) => a.order - b.order),
    [db.questions, activeSet.id]
  );

  const setFollowUps = useMemo(
    () => db.followUps.filter((f) => f.setId === activeSet.id),
    [db.followUps, activeSet.id]
  );

  const pendingSuggestions = useMemo(
    () => setFollowUps.filter((f) => f.isSuggestion),
    [setFollowUps]
  );

  const setReviews = useMemo(
    () => db.reviews.filter((r) => r.setId === activeSet.id),
    [db.reviews, activeSet.id]
  );

  const currentProfile = profile || '지원자';

  const getProgress = useCallback(
    (questionId: string): StudyProgress =>
      getQuestionProgress(db, currentProfile, activeSet.id, questionId),
    [db, currentProfile, activeSet.id]
  );

  // URL Hash / History Sync
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const sSet = params.get('set');
    const sScreen = params.get('screen') as ScreenType | null;
    const sCat = params.get('cat');
    const sQ = params.get('q');
    const sF = params.get('f');
    const sExp = params.get('exp');
    if (sSet && db.sets.some((s) => s.id === sSet)) setActiveSetId(sSet);
    if (sScreen) setScreen(sScreen);
    if (sCat) setSelectedCategoryId(sCat);
    if (sQ) {
      setSelectedQuestionId(sQ);
      setMobileShowDetail(true);
    }
    if (sF) setSelectedFollowUpId(sF);
    if (sExp) setSelectedExpId(sExp);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('set', activeSet.id);
    params.set('screen', screen);
    if (selectedCategoryId) params.set('cat', selectedCategoryId);
    if (selectedQuestionId) params.set('q', selectedQuestionId);
    if (selectedFollowUpId) params.set('f', selectedFollowUpId);
    if (selectedExpId) params.set('exp', selectedExpId);
    const newHash = `#${params.toString()}`;
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  }, [
    activeSet.id,
    screen,
    selectedCategoryId,
    selectedQuestionId,
    selectedFollowUpId,
    selectedExpId,
  ]);

  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const sSet = params.get('set');
      const sScreen = params.get('screen') as ScreenType | null;
      const sCat = params.get('cat');
      const sQ = params.get('q');
      const sF = params.get('f');
      const sExp = params.get('exp');
      if (sSet && db.sets.some((s) => s.id === sSet)) setActiveSetId(sSet);
      if (sScreen) setScreen(sScreen);
      setSelectedCategoryId(sCat);
      setSelectedQuestionId(sQ);
      setSelectedFollowUpId(sF);
      setSelectedExpId(sExp);
    };
    window.addEventListener('popstate', applyFromHash);
    return () => window.removeEventListener('popstate', applyFromHash);
  }, [db.sets]);

  // D-day auto-expand matching stage
  const ddayDiff = useMemo(
    () => diffDaysFromToday(activeSet.interviewDate),
    [activeSet.interviewDate]
  );

  useEffect(() => {
    if (ddayDiff === null) return;
    const matching = DDAY_STAGES.filter((st) => st.matchFn(ddayDiff)).map((st) => st.id);
    if (matching.length > 0) {
      setExpandedDdayStageIds(new Set(matching));
    } else {
      setExpandedDdayStageIds(new Set([DDAY_STAGES[0].id]));
    }
  }, [ddayDiff, activeSet.id]);

  const autoCheckedMap = useMemo(() => {
    const introCat = setCategories.find((c) => c.name.includes('1분 자기소개'));
    const introQ = setQuestions.find((q) => q.categoryId === introCat?.id);
    const selfIntroDone = Boolean(introQ && introQ.answer.trim().length > 20);
    const res = db.researches[activeSet.id];
    const news3Done = Boolean(
      res && res.recentNews.filter((n) => n.title.trim().length > 0).length === 3
    );
    const reviewLogDone = setReviews.length > 0;
    return {
      selfIntro: selfIntroDone,
      news3: news3Done,
      reviewLog: reviewLogDone,
    };
  }, [setCategories, setQuestions, db.researches, activeSet.id, setReviews]);

  // Today's study stats
  const todayStr = getTodayStr();
  const unconfidentQuestions = useMemo(
    () => setQuestions.filter((q) => getProgress(q.id).status !== 'confident'),
    [setQuestions, getProgress]
  );
  const todayReviewQuestions = useMemo(
    () =>
      setQuestions.filter((q) => {
        const p = getProgress(q.id);
        return Boolean(p.nextReviewDate && p.nextReviewDate <= todayStr);
      }),
    [setQuestions, getProgress, todayStr]
  );
  const confidentCount = setQuestions.length - unconfidentQuestions.length;

  // Speaking practice time stats (last 7 days)
  const last7DaysPractice = useMemo(() => {
    const days: { date: string; label: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysStr(todayStr, -i);
      const sec = db.practiceLogs[`${currentProfile}:${d}`] || 0;
      days.push({
        date: d,
        label: i === 0 ? '오늘' : d.slice(5).replace('-', '/'),
        minutes: Math.round((sec / 60) * 10) / 10,
      });
    }
    return days;
  }, [db.practiceLogs, currentProfile, todayStr]);

  const todayPracticeMinutes = last7DaysPractice[6]?.minutes || 0;

  // Helper to sync a set bundle (set + categories + research + reviews)
  const syncSetBundle = (nextDb: AppDatabase, targetSetId: string) => {
    const s = nextDb.sets.find((x) => x.id === targetSetId);
    if (!s) return;
    dispatchMutations([
      {
        kind: 'upsert_set_bundle',
        set: s,
        categories: nextDb.categories.filter((c) => c.setId === targetSetId),
        research: nextDb.researches[targetSetId],
        reviews: nextDb.reviews.filter((r) => r.setId === targetSetId),
      },
    ]);
  };

  // Study Progress Handlers (synced individually per progress:{닉네임}:{질문id})
  const handleIncrementReadWithStatus = (questionId: string, status: StudyStatus) => {
    const curr = getQuestionProgress(db, currentProfile, activeSet.id, questionId);
    const nextConsecutive =
      status === 'confident'
        ? curr.status === 'confident'
          ? curr.consecutiveConfident + 1
          : 1
        : 0;
    const nextReviewDate = calculateNextReviewDate(
      status,
      nextConsecutive,
      activeSet.interviewDate
    );
    const key = `${currentProfile}:${questionId}`;
    const updatedProg: StudyProgress = {
      ...curr,
      readCount: curr.readCount + 1,
      status,
      consecutiveConfident: nextConsecutive,
      lastStudiedAt: getTodayStr(),
      nextReviewDate,
    };
    updateDb((prev) => ({
      ...prev,
      progress: { ...prev.progress, [key]: updatedProg },
    }));
    dispatchMutations([
      {
        kind: 'upsert_study_record',
        recordKey: `progress:${key}`,
        recordType: 'progress',
        profile: currentProfile,
        setId: activeSet.id,
        payload: updatedProg,
        updatedByNickname: currentProfile,
      },
    ]);
  };

  const handleAdjustReadCount = (questionId: string, delta: number) => {
    const curr = getQuestionProgress(db, currentProfile, activeSet.id, questionId);
    const key = `${currentProfile}:${questionId}`;
    const updatedProg: StudyProgress = {
      ...curr,
      readCount: Math.max(0, curr.readCount + delta),
    };
    updateDb((prev) => ({
      ...prev,
      progress: { ...prev.progress, [key]: updatedProg },
    }));
    dispatchMutations([
      {
        kind: 'upsert_study_record',
        recordKey: `progress:${key}`,
        recordType: 'progress',
        profile: currentProfile,
        setId: activeSet.id,
        payload: updatedProg,
        updatedByNickname: currentProfile,
      },
    ]);
  };

  const handleChangeStatusOnly = (questionId: string, status: StudyStatus) => {
    const curr = getQuestionProgress(db, currentProfile, activeSet.id, questionId);
    const nextConsecutive =
      status === 'confident' ? (curr.status === 'confident' ? curr.consecutiveConfident : 1) : 0;
    const nextReviewDate = calculateNextReviewDate(
      status,
      nextConsecutive,
      activeSet.interviewDate
    );
    const key = `${currentProfile}:${questionId}`;
    const updatedProg: StudyProgress = {
      ...curr,
      status,
      consecutiveConfident: nextConsecutive,
      lastStudiedAt: getTodayStr(),
      nextReviewDate,
    };
    updateDb((prev) => ({
      ...prev,
      progress: { ...prev.progress, [key]: updatedProg },
    }));
    dispatchMutations([
      {
        kind: 'upsert_study_record',
        recordKey: `progress:${key}`,
        recordType: 'progress',
        profile: currentProfile,
        setId: activeSet.id,
        payload: updatedProg,
        updatedByNickname: currentProfile,
      },
    ]);
  };

  const handleToggleWeakness = (questionId: string, forceValue?: boolean) => {
    const curr = getQuestionProgress(db, currentProfile, activeSet.id, questionId);
    const key = `${currentProfile}:${questionId}`;
    const updatedProg: StudyProgress = {
      ...curr,
      isWeakness: forceValue !== undefined ? forceValue : !curr.isWeakness,
    };
    updateDb((prev) => ({
      ...prev,
      progress: { ...prev.progress, [key]: updatedProg },
    }));
    dispatchMutations([
      {
        kind: 'upsert_study_record',
        recordKey: `progress:${key}`,
        recordType: 'progress',
        profile: currentProfile,
        setId: activeSet.id,
        payload: updatedProg,
        updatedByNickname: currentProfile,
      },
    ]);
  };

  const handleRecordPracticeSeconds = (seconds: number) => {
    const key = `${currentProfile}:${getTodayStr()}`;
    const nextSec = (db.practiceLogs[key] || 0) + seconds;
    updateDb((prev) => ({
      ...prev,
      practiceLogs: { ...prev.practiceLogs, [key]: nextSec },
    }));
    dispatchMutations([
      {
        kind: 'upsert_study_record',
        recordKey: `practice:${key}`,
        recordType: 'practice',
        profile: currentProfile,
        setId: activeSet.id,
        payload: { seconds: nextSec },
        updatedByNickname: currentProfile,
      },
    ]);
  };

  // Trash & Undo Helper
  const pushToTrash = (
    itemType: TrashItem['itemType'],
    title: string,
    payload: unknown,
    mutateFn: (prev: AppDatabase) => AppDatabase,
    serverMutations: GranularMutation[]
  ) => {
    const trashId = `trash_${Date.now()}`;
    const trashEntry: TrashItem = {
      id: trashId,
      itemType,
      title,
      setId: activeSet.id,
      deletedBy: currentProfile,
      deletedAt: new Date().toISOString(),
      payload,
    };
    updateDb((prev) => {
      const afterMutate = mutateFn(prev);
      return {
        ...afterMutate,
        trash: [trashEntry, ...afterMutate.trash],
      };
    });
    dispatchMutations([
      ...serverMutations,
      {
        kind: 'upsert_study_record',
        recordKey: `trash:${trashId}`,
        recordType: 'trash',
        profile: currentProfile,
        setId: activeSet.id,
        payload: trashEntry,
        updatedByNickname: currentProfile,
      },
    ]);
    setUndoToast({ trashId, title });
    setTimeout(() => {
      setUndoToast((curr) => (curr?.trashId === trashId ? null : curr));
    }, 5000);
  };

  const handleRestoreFromTrash = (trashId: string) => {
    const item = db.trash.find((t) => t.id === trashId);
    if (!item) return;
    const p = item.payload as Record<string, unknown>;
    const restoreMutations: GranularMutation[] = [
      { kind: 'delete_study_record', recordKey: `trash:${trashId}` },
    ];

    if (item.itemType === 'question') {
      const q = p.question as Question;
      const fList = (p.followUps as FollowUp[]) || [];
      restoreMutations.push({ kind: 'upsert_question', question: q });
      fList.forEach((f) => restoreMutations.push({ kind: 'upsert_followup', followUp: f }));
    } else if (item.itemType === 'followup') {
      const fList = (p.followUps as FollowUp[]) || [];
      fList.forEach((f) => restoreMutations.push({ kind: 'upsert_followup', followUp: f }));
    } else if (item.itemType === 'experience') {
      const exp = p.experience as Experience;
      restoreMutations.push({ kind: 'upsert_experience', experience: exp });
    }

    updateDb((prev) => {
      const remainingTrash = prev.trash.filter((t) => t.id !== trashId);
      if (item.itemType === 'question') {
        const q = p.question as Question;
        const fList = (p.followUps as FollowUp[]) || [];
        return {
          ...prev,
          questions: [...prev.questions, q],
          followUps: [...prev.followUps, ...fList],
          trash: remainingTrash,
        };
      }
      if (item.itemType === 'followup') {
        const fList = (p.followUps as FollowUp[]) || [];
        return {
          ...prev,
          followUps: [...prev.followUps, ...fList],
          trash: remainingTrash,
        };
      }
      if (item.itemType === 'experience') {
        const exp = p.experience as Experience;
        return {
          ...prev,
          experiences: [...prev.experiences, exp],
          trash: remainingTrash,
        };
      }
      return { ...prev, trash: remainingTrash };
    });

    dispatchMutations(restoreMutations);
    setUndoToast(null);
  };

  // Question & FollowUp CRUD
  const handleUpdateQuestion = (questionId: string, patch: Partial<Question>) => {
    const existing = db.questions.find((q) => q.id === questionId);
    if (!existing) return;
    const updated: Question = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: currentProfile,
    };
    updateDb((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === questionId ? updated : q)),
    }));
    dispatchMutations([{ kind: 'upsert_question', question: updated }]);
  };

  const handleAddQuestion = (categoryId: string) => {
    const newId = `q_${Date.now()}`;
    const maxOrder = setQuestions.reduce((m, q) => Math.max(m, q.order), 0);
    const newQ: Question = {
      id: newId,
      setId: activeSet.id,
      categoryId,
      questionNumber: setQuestions.length + 1,
      content: '새 면접 질문을 입력하세요',
      priority: 'A',
      typeTag: 'K',
      intent: '면접관이 확인하려는 의도를 적어 주세요',
      keywords: ['원문서 기준', '적용조건 확인'],
      firstSentence: '',
      framework: 'result_first',
      frameworkSteps: {},
      answer: '',
      recommendedTime: 'normal',
      linkedExperienceIds: [],
      order: maxOrder + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: currentProfile,
    };
    updateDb((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    dispatchMutations([{ kind: 'upsert_question', question: newQ }]);
    setSelectedQuestionId(newId);
    setSelectedFollowUpId(null);
    setMobileShowDetail(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const q = db.questions.find((x) => x.id === questionId);
    if (!q) return;
    const fList = db.followUps.filter((f) => f.rootQuestionId === questionId);
    pushToTrash(
      'question',
      q.content,
      { question: q, followUps: fList },
      (prev) => ({
        ...prev,
        questions: prev.questions.filter((x) => x.id !== questionId),
        followUps: prev.followUps.filter((f) => f.rootQuestionId !== questionId),
      }),
      [{ kind: 'delete_question', questionId }]
    );
    if (selectedQuestionId === questionId) {
      setSelectedQuestionId(null);
      setSelectedFollowUpId(null);
      setMobileShowDetail(false);
    }
  };

  const handleAddFollowUp = (
    parentId: string,
    data: {
      content: string;
      type: FollowUpType;
      keywords: string[];
      firstSentence: string;
      answer: string;
      isSuggestion?: boolean;
    }
  ) => {
    if (!selectedQuestionId) return;
    const newF: FollowUp = {
      id: `f_${Date.now()}`,
      setId: activeSet.id,
      parentId,
      rootQuestionId: selectedQuestionId,
      content: data.content,
      type: data.type,
      keywords: data.keywords,
      firstSentence: data.firstSentence,
      answer: data.answer,
      order: db.followUps.length + 1,
      isSuggestion: data.isSuggestion,
      suggestedBy: data.isSuggestion ? currentProfile : undefined,
      suggestedAt: data.isSuggestion ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: currentProfile,
    };
    updateDb((prev) => ({
      ...prev,
      followUps: [...prev.followUps, newF],
    }));
    dispatchMutations([{ kind: 'upsert_followup', followUp: newF }]);
    setSelectedFollowUpId(newF.id);
  };

  const handleUpdateFollowUp = (
    id: string,
    patch: Partial<Pick<FollowUp, 'content' | 'type' | 'keywords' | 'firstSentence' | 'answer'>>
  ) => {
    const existing = db.followUps.find((f) => f.id === id);
    if (!existing) return;
    const updated: FollowUp = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: currentProfile,
    };
    updateDb((prev) => ({
      ...prev,
      followUps: prev.followUps.map((f) => (f.id === id ? updated : f)),
    }));
    dispatchMutations([{ kind: 'upsert_followup', followUp: updated }]);
  };

  const handleDeleteFollowUp = (id: string) => {
    const target = db.followUps.find((f) => f.id === id);
    if (!target) return;
    const descIds = collectDescendantFollowUpIds(id, db.followUps);
    const allIds = [id, ...descIds];
    const allIdSet = new Set(allIds);
    const removedList = db.followUps.filter((f) => allIdSet.has(f.id));
    pushToTrash(
      'followup',
      target.content,
      { followUps: removedList },
      (prev) => ({
        ...prev,
        followUps: prev.followUps.filter((f) => !allIdSet.has(f.id)),
      }),
      [{ kind: 'delete_followups', followUpIds: allIds }]
    );
  };

  const handleApproveSuggestion = (id: string) => {
    const existing = db.followUps.find((f) => f.id === id);
    if (!existing) return;
    const updated: FollowUp = {
      ...existing,
      isSuggestion: false,
      updatedAt: new Date().toISOString(),
      updatedBy: currentProfile,
    };
    updateDb((prev) => ({
      ...prev,
      followUps: prev.followUps.map((f) => (f.id === id ? updated : f)),
    }));
    dispatchMutations([{ kind: 'upsert_followup', followUp: updated }]);
  };

  const handleRejectSuggestion = (id: string) => {
    handleDeleteFollowUp(id);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareToast('공유 링크가 복사되었습니다! 링크가 있는 누구나 같은 내용을 보고 함께 편집할 수 있습니다.');
    } catch {
      setShareToast('주소창의 URL을 복사해 공유해 주세요.');
    }
    setTimeout(() => setShareToast(null), 4000);
  };

  // Breadcrumb Trail Builder
  const breadcrumbSteps = useMemo(() => {
    const steps: { label: string; onClick: () => void }[] = [
      {
        label: activeSet.name,
        onClick: () => {
          setScreen('home');
          setSelectedQuestionId(null);
          setSelectedFollowUpId(null);
          setMobileShowDetail(false);
        },
      },
    ];

    if (screen === 'category' && selectedCategoryId) {
      const cat = setCategories.find((c) => c.id === selectedCategoryId);
      if (cat) {
        steps.push({
          label: cat.name,
          onClick: () => {
            setScreen('category');
            setSelectedQuestionId(null);
            setSelectedFollowUpId(null);
            setMobileShowDetail(false);
          },
        });
      }
    } else if (screen === 'review') {
      steps.push({
        label: reviewTab === 'today' ? '오늘 복습할 질문' : '아직 자신 없는 질문',
        onClick: () => {
          setScreen('review');
          setSelectedQuestionId(null);
          setSelectedFollowUpId(null);
          setMobileShowDetail(false);
        },
      });
    } else if (screen === 'mock') {
      steps.push({ label: '실전 모의면접', onClick: () => setScreen('mock') });
    } else if (screen === 'search') {
      steps.push({ label: '전체 검색', onClick: () => setScreen('search') });
    } else if (screen === 'experience') {
      steps.push({
        label: '내 경험 (경험 뱅크)',
        onClick: () => setScreen('experience'),
      });
      if (selectedExpId) {
        const exp = db.experiences.find((e) => e.id === selectedExpId);
        if (exp) {
          steps.push({ label: exp.name, onClick: () => setSelectedExpId(exp.id) });
        }
      }
    } else if (screen === 'research') {
      steps.push({ label: '회사 조사 노트', onClick: () => setScreen('research') });
    } else if (screen === 'review_log') {
      steps.push({ label: '면접 복기록', onClick: () => setScreen('review_log') });
    }

    if ((screen === 'category' || screen === 'review') && selectedQuestionId) {
      const q = setQuestions.find((x) => x.id === selectedQuestionId);
      if (q) {
        steps.push({
          label: `“${q.content}”`,
          onClick: () => setSelectedFollowUpId(null),
        });
      }

      if (selectedFollowUpId) {
        const chain: FollowUp[] = [];
        const byId = new Map(setFollowUps.map((f) => [f.id, f]));
        let curr = byId.get(selectedFollowUpId);
        while (curr) {
          chain.unshift(curr);
          curr = byId.get(curr.parentId);
        }
        chain.forEach((fNode) => {
          steps.push({
            label: fNode.content,
            onClick: () => setSelectedFollowUpId(fNode.id),
          });
        });
      }
    }

    return steps;
  }, [
    activeSet.name,
    screen,
    selectedCategoryId,
    selectedQuestionId,
    selectedFollowUpId,
    selectedExpId,
    reviewTab,
    setCategories,
    setQuestions,
    setFollowUps,
    db.experiences,
  ]);

  const handleToggleEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false);
      return;
    }
    if (isDeviceEditUnlocked()) {
      setIsEditMode(true);
      return;
    }
    setPasscodeInput('');
    setPasscodeError('');
    setShowPasscodeModal(true);
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim() === (db.editPasscode || APP_CONFIG.defaultPasscode)) {
      setDeviceEditUnlocked(true);
      setIsEditMode(true);
      setShowPasscodeModal(false);
    } else {
      setPasscodeError('암호가 일치하지 않습니다. (기본 암호: 1234)');
    }
  };

  const activeCategoryQuestions = useMemo(() => {
    const base = setQuestions.filter((q) => q.categoryId === selectedCategoryId);
    const filtered = base.filter((q) => {
      const p = getProgress(q.id);
      if (catFilterPriority !== 'ALL' && q.priority !== catFilterPriority) return false;
      if (catFilterType !== 'ALL' && q.typeTag !== catFilterType) return false;
      if (catFilterStatus !== 'ALL' && p.status !== catFilterStatus) return false;
      if (catFilterWeaknessOnly && !p.isWeakness) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (catSortBy === 'priority') {
        const diff = PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order;
        if (diff !== 0) return diff;
        return a.order - b.order;
      }
      if (catSortBy === 'readCount') {
        return getProgress(a.id).readCount - getProgress(b.id).readCount;
      }
      const la = getProgress(a.id).lastStudiedAt || '';
      const lb = getProgress(b.id).lastStudiedAt || '';
      return lb.localeCompare(la);
    });
  }, [
    setQuestions,
    selectedCategoryId,
    catFilterPriority,
    catFilterType,
    catFilterStatus,
    catFilterWeaknessOnly,
    catSortBy,
    getProgress,
  ]);

  const reviewListQuestions = useMemo(() => {
    const base = reviewTab === 'today' ? todayReviewQuestions : unconfidentQuestions;
    const filtered = base.filter((q) => {
      const p = getProgress(q.id);
      if (revFilterCatId !== 'ALL' && q.categoryId !== revFilterCatId) return false;
      if (revFilterType !== 'ALL' && q.typeTag !== revFilterType) return false;
      if (revFilterWeaknessOnly && !p.isWeakness) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (revSortBy === 'priority') {
        const pa = PRIORITY_META[a.priority].order;
        const pb = PRIORITY_META[b.priority].order;
        if (pa !== pb) {
          return revSortDir === 'desc' ? pa - pb : pb - pa;
        }
        return getProgress(a.id).readCount - getProgress(b.id).readCount;
      } else {
        const ra = getProgress(a.id).readCount;
        const rb = getProgress(b.id).readCount;
        if (ra !== rb) {
          return revSortDir === 'asc' ? ra - rb : rb - ra;
        }
        return PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order;
      }
    });
  }, [
    reviewTab,
    todayReviewQuestions,
    unconfidentQuestions,
    revFilterCatId,
    revFilterType,
    revFilterWeaknessOnly,
    revSortBy,
    revSortDir,
    getProgress,
  ]);

  const searchResults = useMemo(() => {
    const qStr = searchQuery.trim().toLowerCase();
    if (!qStr) return [];
    return setQuestions
      .map((q) => {
        const qFollowUps = setFollowUps.filter((f) => f.rootQuestionId === q.id);
        const matchedFollowUp = qFollowUps.find(
          (f) =>
            f.content.toLowerCase().includes(qStr) ||
            f.answer.toLowerCase().includes(qStr) ||
            f.keywords.some((k) => k.toLowerCase().includes(qStr))
        );
        const directMatch =
          q.content.toLowerCase().includes(qStr) ||
          q.intent.toLowerCase().includes(qStr) ||
          q.firstSentence.toLowerCase().includes(qStr) ||
          q.answer.toLowerCase().includes(qStr) ||
          q.keywords.some((k) => k.toLowerCase().includes(qStr));

        if (!directMatch && !matchedFollowUp) return null;
        return { question: q, matchedFollowUp };
      })
      .filter(Boolean) as { question: Question; matchedFollowUp?: FollowUp }[];
  }, [searchQuery, setQuestions, setFollowUps]);

  const selectedQuestion = useMemo(
    () => setQuestions.find((q) => q.id === selectedQuestionId) || null,
    [setQuestions, selectedQuestionId]
  );

  if (screen === 'print') {
    return (
      <PrintPreviewView
        activeSet={activeSet}
        profile={currentProfile}
        categories={setCategories}
        questions={setQuestions}
        followUps={setFollowUps}
        experiences={db.experiences}
        getProgress={getProgress}
        onClose={() => setScreen('home')}
      />
    );
  }

  const renderQuestionListItem = (q: Question) => {
    const prog = getProgress(q.id);
    const isSelected = selectedQuestionId === q.id;
    const { count: fCount, maxDepth } = getFollowUpStats(q.id, setFollowUps, false);
    const needReinforce = needsFollowUpReinforcement(q, setFollowUps);
    const missingExp = q.typeTag === 'K' && q.linkedExperienceIds.length === 0;
    const pm = PRIORITY_META[q.priority];
    const tm = TYPE_TAG_META[q.typeTag];
    const sm = STUDY_STATUS_META[prog.status];
    const filled = Math.min(APP_CONFIG.targetReadCount, prog.readCount);
    const dots =
      '●'.repeat(filled) + '○'.repeat(Math.max(0, APP_CONFIG.targetReadCount - filled));

    return (
      <div
        key={q.id}
        onClick={() => {
          setSelectedQuestionId(q.id);
          setSelectedFollowUpId(null);
          setMobileShowDetail(true);
        }}
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
          prog.status === 'confident' ? 'opacity-75 bg-slate-50/70' : 'bg-white'
        } ${
          isSelected
            ? 'border-[#3B5BDB] ring-2 ring-[#3B5BDB]/20 shadow-xs'
            : 'border-slate-200 hover:border-indigo-300'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${pm.bg} ${pm.text} ${pm.border}`}
            >
              {q.priority}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${tm.bg} ${tm.text} ${tm.border}`}
            >
              {q.typeTag}
            </span>
            <span className="text-xs font-bold text-[#3B5BDB] tracking-tighter">
              {dots} {prog.readCount}/{APP_CONFIG.targetReadCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              꼬리 {fCount}개·{maxDepth}단계
            </span>
            {needReinforce && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                꼬리질문 보강 필요
              </span>
            )}
            {missingExp && (
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 text-[10px] font-bold">
                경험 미연결
              </span>
            )}
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleToggleWeakness(q.id)}
              className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border ${
                prog.isWeakness
                  ? 'bg-rose-50 border-rose-300 text-rose-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
              title="약점 깃발 표시"
            >
              <Flag className={`w-3.5 h-3.5 ${prog.isWeakness ? 'fill-rose-600' : ''}`} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setListRowStatusPromptId((curr) => (curr === q.id ? null : q.id))
                }
                className={`min-h-[34px] px-2.5 py-0.5 rounded-lg border text-xs font-bold flex items-center gap-1 ${sm.bg} ${sm.text} ${sm.border}`}
              >
                {prog.status === 'confident' && <CheckCircle2 className="w-3 h-3" />}
                <span>{sm.label}</span>
                <span className="text-[10px] opacity-75">+1</span>
              </button>

              {listRowStatusPromptId === q.id && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border-2 border-[#3B5BDB] rounded-xl shadow-lg p-2 flex items-center gap-1 w-48">
                  {(['stuck', 'vague', 'confident'] as StudyStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        handleIncrementReadWithStatus(q.id, st);
                        setListRowStatusPromptId(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border ${STUDY_STATUS_META[st].bg} ${STUDY_STATUS_META[st].text} ${STUDY_STATUS_META[st].border}`}
                    >
                      {STUDY_STATUS_META[st].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-base font-bold leading-snug ${
              prog.status === 'confident'
                ? 'line-through decoration-slate-300 text-slate-600'
                : 'text-slate-900'
            }`}
          >
            {q.questionNumber ? (
              <span className="text-[#3B5BDB] mr-1.5">Q{q.questionNumber}.</span>
            ) : null}
            {q.content}
          </h3>
        </div>
      </div>
    );
  };

  const overallPct =
    setQuestions.length > 0 ? Math.round((confidentCount / setQuestions.length) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-8">
      {/* ==================== TOP STICKY HEADER & BREADCRUMB ==================== */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <select
                value={activeSet.id}
                onChange={(e) => {
                  setActiveSetId(e.target.value);
                  setScreen('home');
                  setSelectedQuestionId(null);
                  setSelectedFollowUpId(null);
                }}
                className="min-h-[40px] max-w-[180px] sm:max-w-[260px] px-2.5 py-1 rounded-xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-bold text-slate-900 truncate"
              >
                {db.sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowSetManager(true)}
                className="min-h-[40px] px-2.5 py-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600 shrink-0 hidden sm:flex items-center gap-1"
                title="회사별 세트 관리 및 복제"
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#3B5BDB]" /> 세트 관리
              </button>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {[
                { id: 'home', label: '홈' },
                {
                  id: 'review',
                  label: `미완료·복습 (${unconfidentQuestions.length})`,
                },
                { id: 'mock', label: '모의면접' },
                { id: 'experience', label: '내 경험' },
                { id: 'research', label: '회사 조사 노트' },
                { id: 'review_log', label: '복기록' },
                { id: 'search', label: '검색' },
              ].map((nav) => (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => {
                    setScreen(nav.id as ScreenType);
                    setMobileShowDetail(false);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    screen === nav.id
                      ? 'bg-[#3B5BDB] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {nav.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sync status badge (6단계: 저장됨 / 저장 중 / 오프라인) */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                syncStatus === 'saved'
                  ? 'bg-emerald-50 text-emerald-700'
                  : syncStatus === 'saving'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'saved'
                    ? 'bg-emerald-500'
                    : syncStatus === 'saving'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              {syncStatus === 'saved' ? '저장됨' : syncStatus === 'saving' ? '저장 중' : '오프라인'}
            </span>

            {/* Profile Nickname */}
            <button
              type="button"
              onClick={() => {
                setNicknameInput(currentProfile);
                setShowNicknamePrompt(true);
              }}
              className="min-h-[40px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1"
              title="프로필(닉네임) 변경"
            >
              <User className="w-3.5 h-3.5 text-[#3B5BDB]" />
              <span className="max-w-[72px] truncate">{currentProfile}</span>
            </button>

            {/* Share Link Button */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3B5BDB] border border-indigo-200 text-xs font-bold flex items-center gap-1"
              title="현재 화면 공유 링크 복사"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">링크 공유</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => setScreen('print')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              title="A4 인쇄 및 당일용 한 장 요약"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">인쇄</span>
            </button>
          </div>
        </div>

        {/* Breadcrumb Bar */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-3 sm:px-6 py-1.5">
          <div className="max-w-[1600px] mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
            {breadcrumbSteps.map((step, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === breadcrumbSteps.length - 1;
              const isMiddle = !isFirst && !isLast;

              if (isMiddle && breadcrumbSteps.length > 2 && !mobileBreadcrumbExpanded) {
                if (idx === 1) {
                  return (
                    <React.Fragment key="mobile-ellipsis">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 md:hidden" />
                      <button
                        type="button"
                        onClick={() => setMobileBreadcrumbExpanded(true)}
                        className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold md:hidden"
                        title="전체 이동 경로 펼치기"
                      >
                        …
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden md:inline" />
                      <button
                        type="button"
                        onClick={step.onClick}
                        className="hidden md:inline-block max-w-[220px] truncate px-1.5 py-0.5 rounded hover:bg-slate-200/70 text-slate-600 font-medium"
                      >
                        {step.label}
                      </button>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden md:inline" />
                    <button
                      type="button"
                      onClick={step.onClick}
                      className="hidden md:inline-block max-w-[220px] truncate px-1.5 py-0.5 rounded hover:bg-slate-200/70 text-slate-600 font-medium"
                    >
                      {step.label}
                    </button>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <button
                    type="button"
                    onClick={step.onClick}
                    className={`max-w-[180px] sm:max-w-[280px] truncate px-1.5 py-0.5 rounded transition-colors ${
                      isLast
                        ? 'font-bold text-[#3B5BDB] bg-indigo-50'
                        : 'font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    {step.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Edit Mode Active Banner */}
        {isEditMode && (
          <div className="bg-amber-500 text-slate-950 px-3 sm:px-6 py-2 shadow-xs">
            <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>
                  편집 모드 활성화됨 — 수정하신 항목은 서버에 개별 저장되어 링크를 가진 모든 사람에게 실시간 반영됩니다.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBulkImport(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" /> 질문 일괄 가져오기
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuggestionModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 flex items-center gap-1"
                >
                  <Inbox className="w-3.5 h-3.5" /> 제안함 ({pendingSuggestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrashModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 휴지통 ({db.trash.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowBackupModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> JSON 백업
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceEditUnlocked(false);
                    setIsEditMode(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-white flex items-center gap-1"
                  title="편집 암호 다시 잠그기"
                >
                  <Lock className="w-3.5 h-3.5" /> 암호 잠금
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {shareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {screen === 'home' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#3B5BDB] text-xs font-bold">
                        {activeSet.name}
                      </span>
                      {ddayDiff !== null && (
                        <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-sm font-black">
                          {ddayDiff > 0
                            ? `D-${ddayDiff}`
                            : ddayDiff === 0
                            ? 'D-Day'
                            : `D+${Math.abs(ddayDiff)}`}
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1.5">
                      자신 있음 {confidentCount} / 전체 {setQuestions.length}문항 ({overallPct}%)
                    </h1>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFinalCheckModal(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" /> 마지막 점검 (S등급·약점)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3B5BDB] rounded-full transition-all duration-300"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {(['S', 'A', 'B', 'C'] as PriorityGrade[]).map((p) => {
                      const pTotal = setQuestions.filter((q) => q.priority === p).length;
                      const pDone = setQuestions.filter(
                        (q) => q.priority === p && getProgress(q.id).status === 'confident'
                      ).length;
                      return (
                        <div
                          key={p}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                        >
                          <div className="font-bold text-slate-700">{PRIORITY_META[p].label}</div>
                          <div className="font-black text-slate-900 mt-0.5">
                            {pDone} / {pTotal} 완료
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['K', 'M', 'L'] as QuestionTypeTag[]).map((t) => {
                      const tTotal = setQuestions.filter((q) => q.typeTag === t).length;
                      const tDone = setQuestions.filter(
                        (q) => q.typeTag === t && getProgress(q.id).status === 'confident'
                      ).length;
                      return (
                        <div
                          key={t}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                        >
                          <div className="font-bold text-slate-600">
                            {TYPE_TAG_META[t].shortLabel}
                          </div>
                          <div className="font-black text-slate-900 mt-0.5">
                            {tDone} / {tTotal} (
                            {tTotal ? Math.round((tTotal / setQuestions.length) * 100) : 0}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewTab('unconfident');
                      setScreen('review');
                      if (unconfidentQuestions[0]) {
                        setSelectedQuestionId(unconfidentQuestions[0].id);
                      }
                      setMobileShowDetail(false);
                    }}
                    className="sm:col-span-2 min-h-[56px] px-5 py-3.5 rounded-2xl bg-[#3B5BDB] hover:bg-indigo-700 text-white font-black text-base flex items-center justify-between shadow-md transition-transform active:scale-[0.99]"
                  >
                    <span>아직 자신 없는 질문 연습하기</span>
                    <span className="px-3 py-1 rounded-full bg-white text-[#3B5BDB] text-sm font-black">
                      {unconfidentQuestions.length}개 남음
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewTab('today');
                      setScreen('review');
                      if (todayReviewQuestions[0]) {
                        setSelectedQuestionId(todayReviewQuestions[0].id);
                      }
                      setMobileShowDetail(false);
                    }}
                    className="min-h-[56px] px-4 py-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 font-bold text-sm flex items-center justify-between"
                  >
                    <span>오늘 복습할 질문</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-black">
                      {todayReviewQuestions.length}개
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScreen('mock')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Mic className="w-4 h-4" /> 모의면접 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('experience')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-[#3B5BDB]" /> 내 경험 ({db.experiences.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('research')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Building2 className="w-4 h-4 text-[#3B5BDB]" /> 회사 조사 노트
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuggestionModal(true)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Inbox className="w-4 h-4 text-[#3B5BDB]" /> 꼬리질문 제안함
                    {pendingSuggestions.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[11px] font-black">
                        {pendingSuggestions.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#3B5BDB]" /> 오늘 입으로 말한 시간
                      </h2>
                      <p className="text-xs text-slate-500">
                        모의면접 타이머와 말하기 연습 시간이 닉네임·날짜별로 서버에 누적됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRecordPracticeSeconds(300)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#3B5BDB] text-xs font-bold"
                    >
                      +5분 수동 기록
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-black text-slate-900">
                      오늘 <span className="text-[#3B5BDB]">{todayPracticeMinutes}분</span>{' '}
                      <span className="text-sm font-semibold text-slate-500">
                        / 목표 {APP_CONFIG.dailyPracticeGoalMinutes}분
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {Math.min(
                        100,
                        Math.round(
                          (todayPracticeMinutes / APP_CONFIG.dailyPracticeGoalMinutes) * 100
                        )
                      )}
                      % 달성
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-2 items-end h-24 pt-4 px-1">
                    {last7DaysPractice.map((d) => {
                      const heightPct = Math.min(
                        100,
                        Math.max(
                          8,
                          Math.round((d.minutes / APP_CONFIG.dailyPracticeGoalMinutes) * 100)
                        )
                      );
                      const isToday = d.label === '오늘';
                      return (
                        <div
                          key={d.date}
                          className="flex flex-col items-center gap-1 h-full justify-end"
                        >
                          <span className="text-[10px] font-bold text-slate-600">
                            {d.minutes}m
                          </span>
                          <div className="w-full bg-slate-100 rounded-t-md h-14 flex items-end overflow-hidden">
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t-md ${
                                isToday ? 'bg-[#3B5BDB]' : 'bg-indigo-300'
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[10px] ${
                              isToday ? 'font-bold text-[#3B5BDB]' : 'text-slate-400'
                            }`}
                          >
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      2차면접 핵심 한 문장 (운항통제 → 운항기술 전환)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowConversionModal(true)}
                      className="text-xs font-bold text-amber-300 hover:underline"
                    >
                      전환 공식 & 10계명 보기 →
                    </button>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-100">
                    “{CORE_ONE_SENTENCE}”
                  </p>
                </div>
              </div>
            </div>

            {/* Category Cards Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">카테고리별 질문 학습</h2>
                <span className="text-xs text-slate-500">
                  카드를 누르면 세부 질문 목록과 꼬리질문 마인드맵으로 이동합니다.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                {setCategories.map((cat, idx) => {
                  const qs = setQuestions.filter((q) => q.categoryId === cat.id);
                  const done = qs.filter((q) => getProgress(q.id).status === 'confident').length;
                  const ratio = qs.length > 0 ? Math.round((done / qs.length) * 100) : 0;
                  const reinforceCount = qs.filter((q) =>
                    needsFollowUpReinforcement(q, setFollowUps)
                  ).length;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setScreen('category');
                        if (qs[0]) {
                          setSelectedQuestionId(qs[0].id);
                        } else {
                          setSelectedQuestionId(null);
                        }
                        setSelectedFollowUpId(null);
                        setMobileShowDetail(false);
                      }}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-[#3B5BDB] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-400">
                            카테고리 0{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 group-hover:bg-indigo-50 group-hover:text-[#3B5BDB] text-xs font-bold text-slate-700">
                            질문 {qs.length}개
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#3B5BDB]">
                          {cat.name}
                        </h3>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">
                            자신 있음 {done}/{qs.length}
                          </span>
                          <span className="font-black text-[#3B5BDB]">{ratio}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3B5BDB] rounded-full transition-all"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        {reinforceCount > 0 && (
                          <div className="text-[11px] font-semibold text-amber-700">
                            꼬리질문 보강 필요 {reinforceCount}개
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D-day Mode Stage Checklists */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#3B5BDB]" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      D-day 단계별 실전 체크리스트
                    </h2>
                    <p className="text-xs text-slate-500">
                      면접일까지 남은 기간에 맞는 단계가 자동으로 펼쳐지며, 앱 데이터로 확인되는 항목은 자동 체크됩니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">면접 예정일:</span>
                  <input
                    type="date"
                    value={activeSet.interviewDate || ''}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      let nextSnapshot: AppDatabase | null = null;
                      updateDb((prev) => {
                        nextSnapshot = {
                          ...prev,
                          sets: prev.sets.map((s) =>
                            s.id === activeSet.id ? { ...s, interviewDate: val } : s
                          ),
                        };
                        return nextSnapshot;
                      });
                      if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
                    }}
                    className="min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {DDAY_STAGES.map((stage) => {
                  const isExpanded = expandedDdayStageIds.has(stage.id);
                  const isCurrentStage = ddayDiff !== null && stage.matchFn(ddayDiff);
                  const userChecked = db.checklists[`${currentProfile}:${activeSet.id}`] || [];

                  return (
                    <div
                      key={stage.id}
                      className={`rounded-2xl border overflow-hidden ${
                        isCurrentStage ? 'border-[#3B5BDB] bg-indigo-50/20' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedDdayStageIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(stage.id)) next.delete(stage.id);
                            else next.add(stage.id);
                            return next;
                          });
                        }}
                        className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              isCurrentStage
                                ? 'bg-[#3B5BDB] text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {stage.rangeLabel}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{stage.title}</span>
                          {isCurrentStage && (
                            <span className="text-xs font-bold text-[#3B5BDB]">
                              (현재 해당 단계)
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100 bg-white">
                          {stage.items.map((item) => {
                            const isAuto =
                              item.autoCheckKey && autoCheckedMap[item.autoCheckKey];
                            const isChecked = isAuto || userChecked.includes(item.id);

                            return (
                              <label
                                key={item.id}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(isChecked)}
                                    onChange={() => {
                                      const key = `${currentProfile}:${activeSet.id}`;
                                      const curr = db.checklists[key] || [];
                                      const next = curr.includes(item.id)
                                        ? curr.filter((x) => x !== item.id)
                                        : [...curr, item.id];
                                      updateDb((prev) => ({
                                        ...prev,
                                        checklists: { ...prev.checklists, [key]: next },
                                      }));
                                      dispatchMutations([
                                        {
                                          kind: 'upsert_study_record',
                                          recordKey: `checklist:${key}`,
                                          recordType: 'checklist',
                                          profile: currentProfile,
                                          setId: activeSet.id,
                                          payload: { checkedIds: next },
                                          updatedByNickname: currentProfile,
                                        },
                                      ]);
                                    }}
                                    className="w-4 h-4 accent-[#3B5BDB]"
                                  />
                                  <span
                                    className={`text-sm font-medium ${
                                      isChecked ? 'line-through text-slate-400' : 'text-slate-800'
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                </div>
                                {isAuto && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold shrink-0">
                                    앱 데이터로 자동 확인됨
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 3-2. 카테고리 화면 -------------------- */}
        {screen === 'category' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <aside className="md:col-span-12 min-[1200px]:col-span-2 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold text-slate-500 uppercase">카테고리 목록</span>
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('추가할 카테고리 이름을 입력하세요:');
                      if (!name || !name.trim()) return;
                      const newCat: Category = {
                        id: `cat_${Date.now()}`,
                        setId: activeSet.id,
                        name: name.trim(),
                        order: setCategories.length + 1,
                        autoKeywords: [],
                        updatedAt: new Date().toISOString(),
                        updatedBy: currentProfile,
                      };
                      let nextSnapshot: AppDatabase | null = null;
                      updateDb((prev) => {
                        nextSnapshot = {
                          ...prev,
                          categories: [...prev.categories, newCat],
                        };
                        return nextSnapshot;
                      });
                      if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
                      setSelectedCategoryId(newCat.id);
                    }}
                    className="px-2 py-0.5 rounded bg-[#3B5BDB] text-white text-[11px] font-bold flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> 추가
                  </button>
                )}
              </div>

              <div className="flex min-[1200px]:flex-col gap-1.5 overflow-x-auto pb-1 min-[1200px]:pb-0">
                {setCategories.map((cat, idx) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const qCount = setQuestions.filter((q) => q.categoryId === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className={`group flex items-center justify-between rounded-xl transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-[#3B5BDB] text-white font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          const firstQ = setQuestions.find((q) => q.categoryId === cat.id);
                          setSelectedQuestionId(firstQ?.id || null);
                          setSelectedFollowUpId(null);
                          setMobileShowDetail(false);
                        }}
                        className="min-h-[42px] px-3 py-2 text-left text-xs flex-1 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{cat.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {qCount}
                        </span>
                      </button>

                      {isEditMode && (
                        <div className="flex items-center pr-1 gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const prevCat = setCategories[idx - 1];
                              if (!prevCat) return;
                              let nextSnapshot: AppDatabase | null = null;
                              updateDb((prev) => {
                                nextSnapshot = {
                                  ...prev,
                                  categories: prev.categories.map((c) => {
                                    if (c.id === cat.id) return { ...c, order: prevCat.order };
                                    if (c.id === prevCat.id) return { ...c, order: cat.order };
                                    return c;
                                  }),
                                };
                                return nextSnapshot;
                              });
                              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
                            }}
                            className="p-1 opacity-75 hover:opacity-100 disabled:opacity-30"
                            title="위로 이동"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === setCategories.length - 1}
                            onClick={() => {
                              const nextCat = setCategories[idx + 1];
                              if (!nextCat) return;
                              let nextSnapshot: AppDatabase | null = null;
                              updateDb((prev) => {
                                nextSnapshot = {
                                  ...prev,
                                  categories: prev.categories.map((c) => {
                                    if (c.id === cat.id) return { ...c, order: nextCat.order };
                                    if (c.id === nextCat.id) return { ...c, order: cat.order };
                                    return c;
                                  }),
                                };
                                return nextSnapshot;
                              });
                              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
                            }}
                            className="p-1 opacity-75 hover:opacity-100 disabled:opacity-30"
                            title="아래로 이동"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            <section
              className={`md:col-span-5 min-[1200px]:col-span-4 space-y-3 ${
                mobileShowDetail && selectedQuestion ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {setCategories.find((c) => c.id === selectedCategoryId)?.name || '질문 목록'} (
                    {activeCategoryQuestions.length})
                  </h2>
                  {isEditMode && selectedCategoryId && (
                    <button
                      type="button"
                      onClick={() => handleAddQuestion(selectedCategoryId)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> 질문 추가
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 gap-1.5 text-xs">
                  <select
                    value={catFilterPriority}
                    onChange={(e) => setCatFilterPriority(e.target.value as PriorityGrade | 'ALL')}
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="ALL">우선순위: 전체</option>
                    <option value="S">S등급만</option>
                    <option value="A">A등급만</option>
                    <option value="B">B등급만</option>
                    <option value="C">C등급만</option>
                  </select>

                  <select
                    value={catFilterType}
                    onChange={(e) => setCatFilterType(e.target.value as QuestionTypeTag | 'ALL')}
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="ALL">유형: 전체</option>
                    <option value="K">K 직무·경험</option>
                    <option value="M">M 인성·태도</option>
                    <option value="L">L 지원동기</option>
                  </select>

                  <select
                    value={catFilterStatus}
                    onChange={(e) => setCatFilterStatus(e.target.value as StudyStatus | 'ALL')}
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="ALL">상태: 전체</option>
                    <option value="none">미학습</option>
                    <option value="stuck">막힘</option>
                    <option value="vague">애매</option>
                    <option value="confident">자신 있음</option>
                  </select>

                  <select
                    value={catSortBy}
                    onChange={(e) =>
                      setCatSortBy(e.target.value as 'priority' | 'readCount' | 'lastStudied')
                    }
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="priority">정렬: 우선순위순</option>
                    <option value="readCount">정렬: 회독수 적은순</option>
                    <option value="lastStudied">정렬: 최근 학습일순</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catFilterWeaknessOnly}
                    onChange={(e) => setCatFilterWeaknessOnly(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#3B5BDB]"
                  />
                  <span>약점 깃발 표시된 질문만 보기</span>
                </label>
              </div>

              <div className="space-y-2.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-0.5">
                {activeCategoryQuestions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
                    조건에 맞는 질문이 없습니다.
                  </div>
                ) : (
                  activeCategoryQuestions.map((q) => renderQuestionListItem(q))
                )}
              </div>
            </section>

            <section
              className={`md:col-span-7 min-[1200px]:col-span-6 ${
                mobileShowDetail && selectedQuestion ? 'block' : 'hidden md:block'
              }`}
            >
              {mobileShowDetail && (
                <button
                  type="button"
                  onClick={() => setMobileShowDetail(false)}
                  className="md:hidden mb-3 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> 질문 목록으로 돌아가기
                </button>
              )}

              {selectedQuestion ? (
                <QuestionDetailPanel
                  question={selectedQuestion}
                  categories={setCategories}
                  allSets={db.sets}
                  progress={getProgress(selectedQuestion.id)}
                  followUps={setFollowUps}
                  experiences={db.experiences}
                  companyResearch={db.researches[activeSet.id]}
                  selectedFollowUpId={selectedFollowUpId}
                  onSelectFollowUp={setSelectedFollowUpId}
                  isEditMode={isEditMode}
                  onIncrementReadWithStatus={handleIncrementReadWithStatus}
                  onAdjustReadCount={handleAdjustReadCount}
                  onChangeStatusOnly={handleChangeStatusOnly}
                  onToggleWeakness={handleToggleWeakness}
                  onUpdateQuestion={handleUpdateQuestion}
                  onDeleteQuestion={handleDeleteQuestion}
                  onCopyQuestionToSet={(qId, targetSetId) => {
                    const q = db.questions.find((x) => x.id === qId);
                    if (!q) return;
                    const targetCats = db.categories.filter((c) => c.setId === targetSetId);
                    const matchingCat =
                      targetCats.find(
                        (c) =>
                          c.name ===
                          setCategories.find((sc) => sc.id === q.categoryId)?.name
                      ) || targetCats[0];
                    if (!matchingCat) return;
                    const copiedQ: Question = {
                      ...q,
                      id: `q_${Date.now()}`,
                      setId: targetSetId,
                      categoryId: matchingCat.id,
                      updatedAt: new Date().toISOString(),
                      updatedBy: currentProfile,
                    };
                    updateDb((prev) => ({
                      ...prev,
                      questions: [...prev.questions, copiedQ],
                    }));
                    dispatchMutations([{ kind: 'upsert_question', question: copiedQ }]);
                  }}
                  onNavigateToExperience={(expId) => {
                    setSelectedExpId(expId);
                    setScreen('experience');
                  }}
                  onNavigateToResearch={() => setScreen('research')}
                  onAddFollowUp={handleAddFollowUp}
                  onUpdateFollowUp={handleUpdateFollowUp}
                  onDeleteFollowUp={handleDeleteFollowUp}
                  onApproveSuggestion={handleApproveSuggestion}
                  onRejectSuggestion={handleRejectSuggestion}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                  왼쪽 목록에서 질문을 선택하면 상세 내용과 꼬리질문 마인드맵이 표시됩니다.
                </div>
              )}
            </section>
          </div>
        )}

        {/* -------------------- 3-5. 아직 자신 없는 질문 / 오늘 복습할 질문 화면 -------------------- */}
        {screen === 'review' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <section
              className={`md:col-span-5 space-y-3 ${
                mobileShowDetail && selectedQuestion ? 'hidden md:block' : 'block'
              }`}
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReviewTab('unconfident')}
                    className={`min-h-[40px] rounded-lg text-xs font-bold ${
                      reviewTab === 'unconfident'
                        ? 'bg-white text-[#3B5BDB] shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    전체 미완료 ({unconfidentQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab('today')}
                    className={`min-h-[40px] rounded-lg text-xs font-bold ${
                      reviewTab === 'today'
                        ? 'bg-white text-[#3B5BDB] shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    오늘 복습할 질문 ({todayReviewQuestions.length})
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      정렬 기준
                    </label>
                    <select
                      value={revSortBy}
                      onChange={(e) => setRevSortBy(e.target.value as 'priority' | 'readCount')}
                      className="w-full min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    >
                      <option value="priority">우선순위 기준</option>
                      <option value="readCount">회독수 기준</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      정렬 방향
                    </label>
                    <select
                      value={revSortDir}
                      onChange={(e) => setRevSortDir(e.target.value as 'asc' | 'desc')}
                      className="w-full min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    >
                      <option value="desc">
                        내림차순 ({revSortBy === 'priority' ? '높은 S→C순' : '회독 많은순'})
                      </option>
                      <option value="asc">
                        오름차순 ({revSortBy === 'priority' ? '낮은 C→S순' : '회독 적은순'})
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    value={revFilterCatId}
                    onChange={(e) => setRevFilterCatId(e.target.value)}
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="ALL">카테고리: 전체</option>
                    {setCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={revFilterType}
                    onChange={(e) => setRevFilterType(e.target.value as QuestionTypeTag | 'ALL')}
                    className="min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="ALL">유형 태그: 전체</option>
                    <option value="K">K 직무·경험</option>
                    <option value="M">M 인성·태도</option>
                    <option value="L">L 지원동기</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revFilterWeaknessOnly}
                    onChange={(e) => setRevFilterWeaknessOnly(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#3B5BDB]"
                  />
                  <span>약점 질문만 보기</span>
                </label>
              </div>

              <div className="space-y-2.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-0.5">
                {reviewListQuestions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
                    해당하는 질문이 없습니다.
                  </div>
                ) : (
                  reviewListQuestions.map((q) => renderQuestionListItem(q))
                )}
              </div>
            </section>

            <section
              className={`md:col-span-7 ${
                mobileShowDetail && selectedQuestion ? 'block' : 'hidden md:block'
              }`}
            >
              {mobileShowDetail && (
                <button
                  type="button"
                  onClick={() => setMobileShowDetail(false)}
                  className="md:hidden mb-3 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> 복습 목록으로 돌아가기
                </button>
              )}
              {selectedQuestion ? (
                <QuestionDetailPanel
                  question={selectedQuestion}
                  categories={setCategories}
                  allSets={db.sets}
                  progress={getProgress(selectedQuestion.id)}
                  followUps={setFollowUps}
                  experiences={db.experiences}
                  companyResearch={db.researches[activeSet.id]}
                  selectedFollowUpId={selectedFollowUpId}
                  onSelectFollowUp={setSelectedFollowUpId}
                  isEditMode={isEditMode}
                  onIncrementReadWithStatus={handleIncrementReadWithStatus}
                  onAdjustReadCount={handleAdjustReadCount}
                  onChangeStatusOnly={handleChangeStatusOnly}
                  onToggleWeakness={handleToggleWeakness}
                  onUpdateQuestion={handleUpdateQuestion}
                  onDeleteQuestion={handleDeleteQuestion}
                  onCopyQuestionToSet={() => {}}
                  onNavigateToExperience={(expId) => {
                    setSelectedExpId(expId);
                    setScreen('experience');
                  }}
                  onNavigateToResearch={() => setScreen('research')}
                  onAddFollowUp={handleAddFollowUp}
                  onUpdateFollowUp={handleUpdateFollowUp}
                  onDeleteFollowUp={handleDeleteFollowUp}
                  onApproveSuggestion={handleApproveSuggestion}
                  onRejectSuggestion={handleRejectSuggestion}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                  왼쪽에서 복습할 질문을 선택하세요.
                </div>
              )}
            </section>
          </div>
        )}

        {/* -------------------- 2-3. 검색 화면 -------------------- */}
        {screen === 'search' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <label className="block text-sm font-bold text-slate-900">
                통합 검색 (질문·의도·키워드·첫 문장·답변·꼬리질문 전체)
              </label>
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어를 입력하세요 (예: EFB, Loading Database, PTU, 복사안개, 키오스크, 불렛저널, 안전)"
                  className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-base font-medium"
                />
              </div>
            </div>

            {searchQuery.trim() && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-500 px-1">
                  검색 결과 {searchResults.length}건
                </div>
                {searchResults.map(({ question: q, matchedFollowUp }) => (
                  <div
                    key={q.id}
                    onClick={() => {
                      setSelectedCategoryId(q.categoryId);
                      setSelectedQuestionId(q.id);
                      setSelectedFollowUpId(matchedFollowUp?.id || null);
                      setScreen('category');
                      setMobileShowDetail(true);
                    }}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#3B5BDB] cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[#3B5BDB]">
                        {setCategories.find((c) => c.id === q.categoryId)?.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                        {q.priority}등급 · {q.typeTag}유형
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {q.questionNumber ? `Q${q.questionNumber}. ` : ''}
                      {q.content}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{q.answer}</p>
                    {matchedFollowUp && (
                      <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 font-semibold">
                        ↳ 일치하는 꼬리질문: {matchedFollowUp.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------- 2단계: 내 경험 (경험 뱅크) -------------------- */}
        {screen === 'experience' && (
          <ExperienceBankView
            experiences={db.experiences}
            selectedExpId={selectedExpId}
            onSelectExp={setSelectedExpId}
            questions={setQuestions}
            categories={setCategories}
            isEditMode={isEditMode}
            onAddExperience={() => {
              const newExp: Experience = {
                id: `exp_${Date.now()}`,
                name: '새 핵심 경험',
                role: '담당 역할 입력',
                resultMetric: '',
                jobSimilarity: '상',
                tier: '비살기',
                keywords: ['핵심키워드'],
                breakdown: {
                  oneLineSummary: '',
                  requester: '',
                  goalProblemRole: '',
                  comparisonRef: '',
                  metricDetail: '',
                  keyAction: '',
                  resourceSaved: '',
                  persuasion: '',
                  lessonLearned: '',
                  ifRedo: '',
                },
                updatedAt: new Date().toISOString(),
                updatedBy: currentProfile,
              };
              updateDb((prev) => ({
                ...prev,
                experiences: [...prev.experiences, newExp],
              }));
              dispatchMutations([{ kind: 'upsert_experience', experience: newExp }]);
              setSelectedExpId(newExp.id);
            }}
            onUpdateExperience={(id, patch) => {
              const existing = db.experiences.find((e) => e.id === id);
              if (!existing) return;
              const updated: Experience = {
                ...existing,
                ...patch,
                updatedAt: new Date().toISOString(),
                updatedBy: currentProfile,
              };
              updateDb((prev) => ({
                ...prev,
                experiences: prev.experiences.map((e) => (e.id === id ? updated : e)),
              }));
              dispatchMutations([{ kind: 'upsert_experience', experience: updated }]);
            }}
            onDeleteExperience={(id) => {
              const target = db.experiences.find((e) => e.id === id);
              if (!target) return;
              pushToTrash(
                'experience',
                target.name,
                { experience: target },
                (prev) => ({
                  ...prev,
                  experiences: prev.experiences.filter((e) => e.id !== id),
                }),
                [{ kind: 'delete_experience', experienceId: id }]
              );
            }}
            onNavigateToQuestion={(catId, qId) => {
              setSelectedCategoryId(catId);
              setSelectedQuestionId(qId);
              setSelectedFollowUpId(null);
              setScreen('category');
              setMobileShowDetail(true);
            }}
          />
        )}

        {/* -------------------- 2단계: 회사 조사 노트 -------------------- */}
        {screen === 'research' && db.researches[activeSet.id] && (
          <CompanyResearchView
            setName={activeSet.name}
            research={db.researches[activeSet.id]}
            experiences={db.experiences}
            isEditMode={isEditMode}
            onUpdateResearch={(patch) => {
              let nextSnapshot: AppDatabase | null = null;
              updateDb((prev) => {
                nextSnapshot = {
                  ...prev,
                  researches: {
                    ...prev.researches,
                    [activeSet.id]: {
                      ...prev.researches[activeSet.id],
                      ...patch,
                      updatedAt: new Date().toISOString(),
                      updatedBy: currentProfile,
                    },
                  },
                };
                return nextSnapshot;
              });
              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
            }}
            onNavigateToExperience={(expId) => {
              setSelectedExpId(expId);
              setScreen('experience');
            }}
          />
        )}

        {/* -------------------- 3단계: 모의면접 모드 -------------------- */}
        {screen === 'mock' && (
          <MockInterviewView
            questions={setQuestions}
            categories={setCategories}
            followUps={setFollowUps}
            getProgress={getProgress}
            onRecordPracticeSeconds={handleRecordPracticeSeconds}
            onIncrementReadWithStatus={handleIncrementReadWithStatus}
            onToggleWeakness={handleToggleWeakness}
          />
        )}

        {/* -------------------- 3단계: 면접 복기록 -------------------- */}
        {screen === 'review_log' && (
          <InterviewReviewLogView
            setName={activeSet.name}
            reviews={setReviews}
            questions={setQuestions}
            onAddReview={(date, interviewType) => {
              const newRev: InterviewReview = {
                id: `rev_${Date.now()}`,
                setId: activeSet.id,
                date,
                interviewType,
                items: [],
                checks: [false, false, false, false, false, false],
                updatedAt: new Date().toISOString(),
                updatedBy: currentProfile,
              };
              let nextSnapshot: AppDatabase | null = null;
              updateDb((prev) => {
                nextSnapshot = {
                  ...prev,
                  reviews: [newRev, ...prev.reviews],
                };
                return nextSnapshot;
              });
              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
            }}
            onUpdateReview={(revId, patch) => {
              let nextSnapshot: AppDatabase | null = null;
              updateDb((prev) => {
                nextSnapshot = {
                  ...prev,
                  reviews: prev.reviews.map((r) =>
                    r.id === revId
                      ? { ...r, ...patch, updatedAt: new Date().toISOString() }
                      : r
                  ),
                };
                return nextSnapshot;
              });
              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
            }}
            onDeleteReview={(revId) => {
              let nextSnapshot: AppDatabase | null = null;
              updateDb((prev) => {
                nextSnapshot = {
                  ...prev,
                  reviews: prev.reviews.filter((r) => r.id !== revId),
                };
                return nextSnapshot;
              });
              if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
            }}
            onPromoteReviewQuestion={(reviewId, item, upgradePriority) => {
              if (upgradePriority) {
                const existing = setQuestions.find(
                  (q) =>
                    q.id === item.addedToQuestionId ||
                    q.content.trim() === item.question.trim()
                );
                if (!existing) return;
                const nextPrio: PriorityGrade =
                  existing.priority === 'C'
                    ? 'B'
                    : existing.priority === 'B'
                    ? 'A'
                    : 'S';
                handleUpdateQuestion(existing.id, {
                  priority: nextPrio,
                  isActualAsked: true,
                });
              } else {
                const newQId = `q_${Date.now()}`;
                const targetCat = setCategories[1] || setCategories[0];
                const newQ: Question = {
                  id: newQId,
                  setId: activeSet.id,
                  categoryId: targetCat.id,
                  questionNumber: setQuestions.length + 1,
                  content: item.question || '복기록에서 추가된 질문',
                  priority: 'A',
                  typeTag: item.typeTag,
                  intent: '실제 면접 출제 질문',
                  keywords: ['실제출제'],
                  firstSentence: item.nextTimeImprove || item.myAnswerSummary,
                  framework: 'result_first',
                  answer: item.nextTimeImprove || item.myAnswerSummary,
                  recommendedTime: 'normal',
                  linkedExperienceIds: [],
                  isActualAsked: true,
                  order: setQuestions.length + 1,
                  updatedAt: new Date().toISOString(),
                  updatedBy: currentProfile,
                };
                let nextSnapshot: AppDatabase | null = null;
                updateDb((prev) => {
                  nextSnapshot = {
                    ...prev,
                    questions: [...prev.questions, newQ],
                    reviews: prev.reviews.map((r) =>
                      r.id === reviewId
                        ? {
                            ...r,
                            items: r.items.map((it) =>
                              it.id === item.id ? { ...it, addedToQuestionId: newQId } : it
                            ),
                          }
                        : r
                    ),
                  };
                  return nextSnapshot;
                });
                dispatchMutations([{ kind: 'upsert_question', question: newQ }]);
                if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
              }
            }}
          />
        )}

        {/* -------------------- 휴대폰 '더보기' 메뉴 화면 -------------------- */}
        {screen === 'more' && (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <h2 className="text-lg font-bold text-slate-900 px-1 mb-2">전체 메뉴 더보기</h2>
            {[
              {
                label: '현재 화면 링크 복사해 다른 사람과 공유하기',
                icon: Share2,
                onClick: handleCopyShareLink,
              },
              {
                label: '내 경험 (경험 뱅크)',
                icon: Award,
                onClick: () => setScreen('experience'),
              },
              {
                label: '회사 조사 노트',
                icon: Building2,
                onClick: () => setScreen('research'),
              },
              {
                label: '면접 복기록',
                icon: FileCheck2,
                onClick: () => setScreen('review_log'),
              },
              {
                label: '운항통제 → 운항기술 답변 전환 공식 & 10계명',
                icon: BookOpen,
                onClick: () => setShowConversionModal(true),
              },
              {
                label: '회사별 면접 세트 관리 및 복제',
                icon: FolderKanban,
                onClick: () => setShowSetManager(true),
              },
              {
                label: `꼬리질문 제안함 (${pendingSuggestions.length})`,
                icon: Inbox,
                onClick: () => setShowSuggestionModal(true),
              },
              {
                label: '질문 일괄 가져오기',
                icon: Upload,
                onClick: () => setShowBulkImport(true),
              },
              {
                label: 'JSON 데이터 백업 / 불러오기',
                icon: Download,
                onClick: () => setShowBackupModal(true),
              },
              {
                label: `휴지통 (${db.trash.length})`,
                icon: Trash2,
                onClick: () => setShowTrashModal(true),
              },
              {
                label: 'A4 인쇄 및 당일용 한 장 요약',
                icon: Printer,
                onClick: () => setScreen('print'),
              },
            ].map((m, idx) => {
              const Icon = m.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={m.onClick}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl hover:bg-slate-50 border border-slate-100 flex items-center justify-between text-left text-sm font-bold text-slate-800"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#3B5BDB]" />
                    {m.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* ==================== FLOATING EDIT BUTTON ==================== */}
      <button
        type="button"
        onClick={handleToggleEditMode}
        className={`no-print fixed right-4 bottom-20 md:bottom-6 md:right-6 z-40 min-h-[48px] px-4 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 transition-all ${
          isEditMode
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-600/20'
            : 'bg-[#3B5BDB] hover:bg-indigo-700 text-white'
        }`}
      >
        {isEditMode ? (
          <>
            <Check className="w-4 h-4" />
            <span>완료</span>
          </>
        ) : (
          <>
            <Edit3 className="w-4 h-4" />
            <span>편집</span>
          </>
        )}
      </button>

      {/* ==================== 5-SECOND UNDO TOAST ON DELETE ==================== */}
      {undoToast && (
        <div className="no-print fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs sm:text-sm font-bold">
          <span>삭제됨 ({undoToast.title.slice(0, 22)})</span>
          <button
            type="button"
            onClick={() => handleRestoreFromTrash(undoToast.trashId)}
            className="px-3 py-1 rounded-lg bg-[#3B5BDB] hover:bg-indigo-500 text-white font-black"
          >
            되돌리기
          </button>
        </div>
      )}

      {/* ==================== MOBILE BOTTOM TAB BAR ==================== */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 h-16">
        {[
          { id: 'home', label: '홈', icon: Home },
          { id: 'review', label: '복습', icon: RefreshCw, badge: todayReviewQuestions.length },
          { id: 'mock', label: '모의면접', icon: Mic },
          { id: 'search', label: '검색', icon: Search },
          { id: 'more', label: '더보기', icon: MoreHorizontal },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setScreen(tab.id as ScreenType);
                setMobileShowDetail(false);
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                active ? 'text-[#3B5BDB]' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="absolute top-1.5 right-4 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* ==================== MODALS ==================== */}
      {showNicknamePrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">프로필 닉네임 설정</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              질문·답변·경험은 링크를 가진 모두가 함께 보고 편집하며, 말하기 회독수·복습 일정·오늘 말한 시간은 입력하신 닉네임별로 서버에 동기화됩니다.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const finalName = nicknameInput.trim() || '지원자';
                setProfile(finalName);
                saveProfile(finalName);
                setShowNicknamePrompt(false);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                placeholder="닉네임 입력 (예: 지원자)"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-base font-bold"
              />
              <button
                type="submit"
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#3B5BDB] text-white text-sm font-bold"
              >
                이 닉네임으로 시작하기
              </button>
            </form>
          </div>
        </div>
      )}

      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-[#3B5BDB]" /> 편집 암호 입력
              </h3>
              <button
                type="button"
                onClick={() => setShowPasscodeModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              실수로 내용이 지워지는 것을 막기 위해 편집 암호를 확인합니다. 한 번 입력하면 이 기기에서 기억합니다. (초기 암호: <strong>1234</strong>)
            </p>
            {passcodeError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                {passcodeError}
              </div>
            )}
            <form onSubmit={handleVerifyPasscode} className="space-y-3">
              <input
                type="password"
                autoFocus
                placeholder="편집 암호 입력 (1234)"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-base font-bold"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#3B5BDB] text-white text-xs font-bold"
                >
                  편집 모드 열기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkImport && (
        <BulkImportModal
          categories={setCategories}
          existingQuestions={setQuestions}
          onClose={() => setShowBulkImport(false)}
          onConfirmImport={(items: ParsedBulkItem[]) => {
            const mutations: GranularMutation[] = [];
            let nextSnapshot: AppDatabase | null = null;

            updateDb((prev) => {
              const nextCats = [...prev.categories];
              let unclassCat = nextCats.find(
                (c) => c.setId === activeSet.id && c.name === '미분류'
              );
              if (items.some((i) => i.categoryId === 'unclassified') && !unclassCat) {
                unclassCat = {
                  id: `cat_unclass_${Date.now()}`,
                  setId: activeSet.id,
                  name: '미분류',
                  order: nextCats.length + 1,
                  autoKeywords: [],
                  updatedAt: new Date().toISOString(),
                  updatedBy: currentProfile,
                };
                nextCats.push(unclassCat);
              }

              const newQs: Question[] = [];
              const newFs: FollowUp[] = [];

              items.forEach((it, idx) => {
                const qId = `q_bulk_${Date.now()}_${idx}`;
                const catId =
                  it.categoryId === 'unclassified' ? unclassCat!.id : it.categoryId;
                const qObj: Question = {
                  id: qId,
                  setId: activeSet.id,
                  categoryId: catId,
                  questionNumber: prev.questions.length + idx + 1,
                  content: it.content,
                  priority: it.priority,
                  typeTag: it.typeTag,
                  intent: '면접관의 질문 의도를 확인하세요',
                  keywords: ['핵심키워드'],
                  firstSentence: '',
                  framework: 'result_first',
                  answer: '',
                  recommendedTime: 'normal',
                  linkedExperienceIds: [],
                  order: prev.questions.length + idx + 1,
                  updatedAt: new Date().toISOString(),
                  updatedBy: currentProfile,
                };
                newQs.push(qObj);
                mutations.push({ kind: 'upsert_question', question: qObj });

                it.followUps.forEach((fText, fi) => {
                  const fObj: FollowUp = {
                    id: `f_bulk_${Date.now()}_${idx}_${fi}`,
                    setId: activeSet.id,
                    parentId: qId,
                    rootQuestionId: qId,
                    content: fText,
                    type: 'dig',
                    keywords: [],
                    firstSentence: '',
                    answer: '',
                    order: fi + 1,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentProfile,
                  };
                  newFs.push(fObj);
                  mutations.push({ kind: 'upsert_followup', followUp: fObj });
                });
              });

              nextSnapshot = {
                ...prev,
                categories: nextCats,
                questions: [...prev.questions, ...newQs],
                followUps: [...prev.followUps, ...newFs],
              };
              return nextSnapshot;
            });

            if (nextSnapshot) syncSetBundle(nextSnapshot, activeSet.id);
            dispatchMutations(mutations);
            setShowBulkImport(false);
          }}
        />
      )}

      {showSetManager && (
        <SetManagerModal
          sets={db.sets}
          activeSetId={activeSet.id}
          onSelectSet={(id) => {
            setActiveSetId(id);
            setScreen('home');
            setShowSetManager(false);
          }}
          onCreateSet={(name, interviewDate) => {
            const newSetId = `set_${Date.now()}`;
            const defaultCatNames = [
              '1분 자기소개',
              '직무 관련 질문',
              '자기소개서 관련 질문',
              '지원동기·입사 후 포부',
              '인성·팀워크·장단점',
              '압박·돌발·상황 질문',
              '마무리(마지막 할 말·역질문)',
            ];
            const newCats: Category[] = defaultCatNames.map((cn, i) => ({
              id: `cat_${newSetId}_${i + 1}`,
              setId: newSetId,
              name: cn,
              order: i + 1,
              autoKeywords: [cn.slice(0, 2)],
              updatedAt: new Date().toISOString(),
              updatedBy: currentProfile,
            }));
            const emptyResearch: CompanyResearch = {
              setId: newSetId,
              coreCompetency: { text: '', source: '기사' },
              differentiation: { text: '', source: '기사' },
              recentNews: [
                { title: '', date: getTodayStr(), summary: '', link: '', source: '기사' },
                { title: '', date: getTodayStr(), summary: '', link: '', source: '기사' },
                { title: '', date: getTodayStr(), summary: '', link: '', source: '기사' },
              ],
              reviewKeywords: { words: ['', '', ''], source: '후기' },
              directExperience: { text: '', source: '방문' },
              linkedExperienceId: db.experiences[0]?.id || '',
              completedSentence: '',
              updatedAt: new Date().toISOString(),
              updatedBy: currentProfile,
            };
            const newSetObj: InterviewSet = {
              id: newSetId,
              name,
              interviewDate,
              updatedAt: new Date().toISOString(),
              updatedBy: currentProfile,
            };
            updateDb((prev) => ({
              ...prev,
              sets: [...prev.sets, newSetObj],
              categories: [...prev.categories, ...newCats],
              researches: { ...prev.researches, [newSetId]: emptyResearch },
            }));
            dispatchMutations([
              {
                kind: 'upsert_set_bundle',
                set: newSetObj,
                categories: newCats,
                research: emptyResearch,
                reviews: [],
              },
            ]);
            setActiveSetId(newSetId);
          }}
          onUpdateSet={(id, patch) => {
            let nextSnapshot: AppDatabase | null = null;
            updateDb((prev) => {
              nextSnapshot = {
                ...prev,
                sets: prev.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
              };
              return nextSnapshot;
            });
            if (nextSnapshot) syncSetBundle(nextSnapshot, id);
          }}
          onDuplicateSet={(sourceSetId, newName, copyLevel) => {
            const newSetId = `set_dup_${Date.now()}`;
            const srcCats = db.categories.filter((c) => c.setId === sourceSetId);
            const srcQs = db.questions.filter((q) => q.setId === sourceSetId);
            const srcFs = db.followUps.filter((f) => f.setId === sourceSetId);

            const catIdMap = new Map<string, string>();
            const newCats: Category[] = srcCats.map((c, idx) => {
              const nid = `cat_${newSetId}_${idx}`;
              catIdMap.set(c.id, nid);
              return { ...c, id: nid, setId: newSetId };
            });

            const qIdMap = new Map<string, string>();
            const newQs: Question[] = srcQs.map((q, idx) => {
              const nid = `q_${newSetId}_${idx}`;
              qIdMap.set(q.id, nid);
              return {
                ...q,
                id: nid,
                setId: newSetId,
                categoryId: catIdMap.get(q.categoryId) || newCats[0]?.id || '',
                firstSentence: copyLevel === 'with_answers' ? q.firstSentence : '',
                answer: copyLevel === 'with_answers' ? q.answer : '',
                frameworkSteps: copyLevel === 'with_answers' ? q.frameworkSteps : {},
              };
            });

            const fIdMap = new Map<string, string>();
            srcFs.forEach((f, idx) => {
              fIdMap.set(f.id, `f_${newSetId}_${idx}`);
            });

            const newFs: FollowUp[] =
              copyLevel === 'questions_only'
                ? []
                : srcFs.map((f) => ({
                    ...f,
                    id: fIdMap.get(f.id)!,
                    setId: newSetId,
                    rootQuestionId: qIdMap.get(f.rootQuestionId) || f.rootQuestionId,
                    parentId:
                      qIdMap.get(f.parentId) || fIdMap.get(f.parentId) || f.parentId,
                    firstSentence: copyLevel === 'with_answers' ? f.firstSentence : '',
                    answer: copyLevel === 'with_answers' ? f.answer : '',
                  }));

            const srcRes = db.researches[sourceSetId];
            const newSetObj: InterviewSet = {
              id: newSetId,
              name: newName,
              updatedAt: new Date().toISOString(),
              updatedBy: currentProfile,
            };
            const newRes = srcRes ? { ...srcRes, setId: newSetId } : undefined;

            updateDb((prev) => ({
              ...prev,
              sets: [...prev.sets, newSetObj],
              categories: [...prev.categories, ...newCats],
              questions: [...prev.questions, ...newQs],
              followUps: [...prev.followUps, ...newFs],
              researches: newRes
                ? { ...prev.researches, [newSetId]: newRes }
                : prev.researches,
            }));

            dispatchMutations([
              {
                kind: 'upsert_set_bundle',
                set: newSetObj,
                categories: newCats,
                research: newRes,
                reviews: [],
              },
              ...newQs.map((q) => ({ kind: 'upsert_question' as const, question: q })),
              ...newFs.map((f) => ({ kind: 'upsert_followup' as const, followUp: f })),
            ]);
            setActiveSetId(newSetId);
          }}
          onDeleteSet={(id) => {
            if (db.sets.length <= 1) return;
            const target = db.sets.find((s) => s.id === id);
            if (!target) return;
            const cats = db.categories.filter((c) => c.setId === id);
            const qs = db.questions.filter((q) => q.setId === id);
            const fs = db.followUps.filter((f) => f.setId === id);
            pushToTrash(
              'set',
              target.name,
              { set: target, categories: cats, questions: qs, followUps: fs },
              (prev) => ({
                ...prev,
                sets: prev.sets.filter((s) => s.id !== id),
                categories: prev.categories.filter((c) => c.setId !== id),
                questions: prev.questions.filter((q) => q.setId !== id),
                followUps: prev.followUps.filter((f) => f.setId !== id),
              }),
              [{ kind: 'delete_set', setId: id }]
            );
            if (activeSet.id === id) {
              const nextSet = db.sets.find((s) => s.id !== id);
              if (nextSet) setActiveSetId(nextSet.id);
            }
          }}
          onClose={() => setShowSetManager(false)}
        />
      )}

      {showFinalCheckModal && (
        <FinalCheckModal
          questions={setQuestions}
          getProgress={getProgress}
          onSelectQuestion={(catId, qId) => {
            setSelectedCategoryId(catId);
            setSelectedQuestionId(qId);
            setSelectedFollowUpId(null);
            setScreen('category');
            setMobileShowDetail(true);
          }}
          onClose={() => setShowFinalCheckModal(false)}
        />
      )}

      {showTrashModal && (
        <TrashModal
          trash={db.trash}
          onRestore={handleRestoreFromTrash}
          onEmptyTrash={() => {
            const ids = db.trash.map((t) => t.id);
            updateDb((prev) => ({ ...prev, trash: [] }));
            dispatchMutations(
              ids.map((id) => ({
                kind: 'delete_study_record' as const,
                recordKey: `trash:${id}`,
              }))
            );
          }}
          onClose={() => setShowTrashModal(false)}
        />
      )}

      {showSuggestionModal && (
        <SuggestionInboxModal
          suggestions={pendingSuggestions}
          questions={setQuestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onNavigateToSuggestion={(q, fId) => {
            setSelectedCategoryId(q.categoryId);
            setSelectedQuestionId(q.id);
            setSelectedFollowUpId(fId);
            setScreen('category');
            setMobileShowDetail(true);
          }}
          onClose={() => setShowSuggestionModal(false)}
        />
      )}

      {showBackupModal && (
        <BackupModal
          db={db}
          onImportDb={(newDb) => {
            saveDatabase(newDb);
            setDb(newDb);
          }}
          onResetDb={() => {
            const fresh = resetToInitialDatabase();
            setDb(fresh);
            setActiveSetId(fresh.sets[0].id);
          }}
          onClose={() => setShowBackupModal(false)}
        />
      )}

      {showConversionModal && (
        <ConversionGuideModal onClose={() => setShowConversionModal(false)} />
      )}
    </div>
  );
};
