import { INITIAL_DATABASE } from '../data/aeroKSeedData';
import {
  AppDatabase,
  FollowUp,
  Question,
  StudyProgress,
  StudyStatus,
} from '../types';
import { APP_CONFIG } from '../constants';

const DB_STORAGE_KEY = 'interview_mindmap_db_v1';
const PROFILE_STORAGE_KEY = 'interview_mindmap_profile_v1';
const ACTIVE_SET_STORAGE_KEY = 'interview_mindmap_active_set_v1';
const EDIT_UNLOCKED_KEY = 'interview_mindmap_edit_unlocked_v1';

export type SyncStatus = 'saved' | 'saving' | 'offline';

export function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysStr(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function diffDaysFromToday(targetDateStr?: string): number | null {
  if (!targetDateStr) return null;
  const todayStr = getTodayStr();
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [cy, cm, cd] = todayStr.split('-').map(Number);
  if (!ty || !tm || !td) return null;
  const target = new Date(ty, tm - 1, td).getTime();
  const current = new Date(cy, cm - 1, cd).getTime();
  return Math.round((target - current) / 86400000);
}

export function calculateNextReviewDate(
  status: StudyStatus,
  consecutiveConfident: number,
  interviewDate?: string
): string | undefined {
  if (status === 'none') return undefined;
  const today = getTodayStr();
  let intervalDays = 1;
  if (status === 'stuck') {
    intervalDays = 1;
  } else if (status === 'vague') {
    intervalDays = 3;
  } else if (status === 'confident') {
    if (consecutiveConfident <= 1) intervalDays = 7;
    else if (consecutiveConfident === 2) intervalDays = 14;
    else intervalDays = 30;
  }

  let nextDate = addDaysStr(today, intervalDays);

  // 면접일이 있으면 다음 복습일은 면접 전날을 넘지 않게 당긴다 (4단계 명세)
  if (interviewDate) {
    const dayBeforeInterview = addDaysStr(interviewDate, -1);
    if (dayBeforeInterview >= today && nextDate > dayBeforeInterview) {
      nextDate = dayBeforeInterview;
    }
  }
  return nextDate;
}

export function loadDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }
    const parsed = JSON.parse(raw) as AppDatabase;
    // Clean up trash items older than 30 days
    const cutoff = Date.now() - APP_CONFIG.trashRetentionDays * 86400000;
    parsed.trash = (parsed.trash || []).filter((t) => {
      const ts = new Date(t.deletedAt).getTime();
      return isNaN(ts) || ts >= cutoff;
    });
    if (!parsed.editPasscode) parsed.editPasscode = APP_CONFIG.defaultPasscode;
    return parsed;
  } catch {
    return INITIAL_DATABASE;
  }
}

export function saveDatabase(db: AppDatabase): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save database to localStorage', e);
  }
}

export function resetToInitialDatabase(): AppDatabase {
  saveDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

export function loadProfile(): string | null {
  try {
    return localStorage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveProfile(nickname: string): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, nickname.trim());
  } catch {
    // ignore
  }
}

export function loadActiveSetId(fallbackId: string): string {
  try {
    return localStorage.getItem(ACTIVE_SET_STORAGE_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function saveActiveSetId(setId: string): void {
  try {
    localStorage.setItem(ACTIVE_SET_STORAGE_KEY, setId);
  } catch {
    // ignore
  }
}

export function isDeviceEditUnlocked(): boolean {
  try {
    return localStorage.getItem(EDIT_UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDeviceEditUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) localStorage.setItem(EDIT_UNLOCKED_KEY, 'true');
    else localStorage.removeItem(EDIT_UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

export function getQuestionProgress(
  db: AppDatabase,
  profile: string,
  setId: string,
  questionId: string
): StudyProgress {
  const key = `${profile}:${questionId}`;
  return (
    db.progress[key] || {
      profile,
      setId,
      questionId,
      readCount: 0,
      status: 'none',
      consecutiveConfident: 0,
      isWeakness: false,
    }
  );
}

export function getFollowUpStats(
  questionId: string,
  allFollowUps: FollowUp[],
  includeSuggestions = false
): { count: number; maxDepth: number } {
  const relevant = allFollowUps.filter(
    (f) => f.rootQuestionId === questionId && (includeSuggestions || !f.isSuggestion)
  );
  if (relevant.length === 0) return { count: 0, maxDepth: 0 };

  const childrenMap = new Map<string, FollowUp[]>();
  for (const f of relevant) {
    const list = childrenMap.get(f.parentId) || [];
    list.push(f);
    childrenMap.set(f.parentId, list);
  }

  let maxDepth = 0;
  function dfs(parentId: string, depth: number) {
    const ch = childrenMap.get(parentId) || [];
    for (const c of ch) {
      if (depth + 1 > maxDepth) maxDepth = depth + 1;
      dfs(c.id, depth + 1);
    }
  }
  dfs(questionId, 0);
  return { count: relevant.length, maxDepth };
}

export function needsFollowUpReinforcement(question: Question, allFollowUps: FollowUp[]): boolean {
  if (question.priority !== 'S' && question.priority !== 'A') return false;
  const { maxDepth } = getFollowUpStats(question.id, allFollowUps, false);
  return maxDepth < 2;
}

export function estimateSpeakingSeconds(text: string): number {
  if (!text || !text.trim()) return 0;
  // 한국어 면접 말하기 속도: 공백 포함 약 5.2자/초 (분당 약 310자)
  const cleanLen = text.trim().length;
  return Math.max(1, Math.round(cleanLen / 5.2));
}

export function findCautionMatches(text: string): string[] {
  if (!text) return [];
  return APP_CONFIG.cautionPhrases.filter((phrase) => text.includes(phrase));
}

export function collectDescendantFollowUpIds(parentId: string, allFollowUps: FollowUp[]): string[] {
  const result: string[] = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const f of allFollowUps) {
      if (f.parentId === curr) {
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}
