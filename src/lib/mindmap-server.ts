import { unstable_cache } from 'next/cache'
import { getPayloadClient } from './payload'
import { MINDMAP_CACHE_TAG } from '../hooks/revalidateMindmap'
import { INITIAL_DATABASE } from '../data/aeroKSeedData'
import type {
  AppDatabase,
  Category,
  CompanyResearch,
  Experience,
  FollowUp,
  InterviewReview,
  InterviewSet,
  Question,
  StudyProgress,
  TrashItem,
} from '../types'

export async function fetchMindmapDatabaseUncached(): Promise<AppDatabase> {
  const payload = await getPayloadClient()

  const [setsRes, questionsRes, followUpsRes, experiencesRes, studyRecordsRes] =
    await Promise.all([
      payload.find({
        collection: 'interview-sets',
        overrideAccess: false,
        limit: 100,
        pagination: false,
        sort: 'createdAt',
      }),
      payload.find({
        collection: 'interview-questions',
        overrideAccess: false,
        limit: 1000,
        pagination: false,
        sort: 'order',
      }),
      payload.find({
        collection: 'interview-followups',
        overrideAccess: false,
        limit: 2000,
        pagination: false,
        sort: 'order',
      }),
      payload.find({
        collection: 'experiences',
        overrideAccess: false,
        limit: 200,
        pagination: false,
        sort: 'createdAt',
      }),
      payload.find({
        collection: 'study-records',
        overrideAccess: false,
        limit: 2000,
        pagination: false,
      }),
    ])

  if (setsRes.docs.length === 0 && questionsRes.docs.length === 0) {
    return INITIAL_DATABASE
  }

  const sets: InterviewSet[] = []
  const categories: Category[] = []
  const researches: Record<string, CompanyResearch> = {}
  const reviews: InterviewReview[] = []

  for (const doc of setsRes.docs) {
    const setId = doc.appId
    sets.push({
      id: setId,
      name: doc.name,
      interviewDate: doc.interviewDate ?? undefined,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedByNickname || '지원자',
    })

    const cats = (doc.categoriesJson as Category[] | null) ?? []
    for (const c of cats) {
      categories.push({ ...c, setId })
    }

    if (doc.researchJson) {
      researches[setId] = doc.researchJson as unknown as CompanyResearch
    }

    const revs = (doc.reviewsJson as unknown as InterviewReview[] | null) ?? []
    for (const r of revs) {
      reviews.push({ ...r, setId })
    }
  }

  const questions: Question[] = questionsRes.docs.map((q) => ({
    id: q.appId,
    setId: q.setId,
    categoryId: q.categoryId,
    questionNumber: q.questionNumber ?? undefined,
    content: q.content,
    priority: q.priority,
    typeTag: q.typeTag,
    intent: q.intent ?? '',
    keywords: (q.keywords as string[] | null) ?? [],
    firstSentence: q.firstSentence ?? '',
    framework: q.framework ?? 'result_first',
    frameworkSteps: (q.frameworkSteps as Record<string, string> | null) ?? {},
    answer: q.answer ?? '',
    recommendedTime: q.recommendedTime ?? 'normal',
    linkedExperienceIds: (q.linkedExperienceIds as string[] | null) ?? [],
    isActualAsked: Boolean(q.isActualAsked),
    order: q.order ?? 1,
    updatedAt: q.updatedAt,
    updatedBy: q.updatedByNickname || '지원자',
  }))

  const followUps: FollowUp[] = followUpsRes.docs.map((f) => ({
    id: f.appId,
    setId: f.setId,
    parentId: f.parentId,
    rootQuestionId: f.rootQuestionId,
    code: f.code ?? undefined,
    content: f.content,
    type: f.type,
    keywords: (f.keywords as string[] | null) ?? [],
    firstSentence: f.firstSentence ?? '',
    answer: f.answer ?? '',
    order: f.order ?? 1,
    isSuggestion: Boolean(f.isSuggestion),
    suggestedBy: f.suggestedBy ?? undefined,
    suggestedAt: f.suggestedAt ?? undefined,
    updatedAt: f.updatedAt,
    updatedBy: f.updatedByNickname || '지원자',
  }))

  const experiences: Experience[] = experiencesRes.docs.map((e) => ({
    id: e.appId,
    name: e.name,
    role: e.role ?? '',
    resultMetric: e.resultMetric ?? '',
    jobSimilarity: e.jobSimilarity ?? '상',
    tier: e.tier ?? '필살기',
    keywords: (e.keywords as string[] | null) ?? [],
    breakdown: (e.breakdown as Experience['breakdown'] | null) ?? {
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
    updatedAt: e.updatedAt,
    updatedBy: e.updatedByNickname || '지원자',
  }))

  const progress: Record<string, StudyProgress> = {}
  const practiceLogs: Record<string, number> = {}
  const checklists: Record<string, string[]> = {}
  const trash: TrashItem[] = []

  for (const rec of studyRecordsRes.docs) {
    if (rec.recordType === 'progress') {
      const k = rec.recordKey.replace(/^progress:/, '')
      progress[k] = rec.payload as unknown as StudyProgress
    } else if (rec.recordType === 'practice') {
      const k = rec.recordKey.replace(/^practice:/, '')
      const p = rec.payload as { seconds?: number }
      practiceLogs[k] = Number(p?.seconds || 0)
    } else if (rec.recordType === 'checklist') {
      const k = rec.recordKey.replace(/^checklist:/, '')
      const p = rec.payload as { checkedIds?: string[] }
      checklists[k] = p?.checkedIds ?? []
    } else if (rec.recordType === 'trash') {
      trash.push(rec.payload as unknown as TrashItem)
    }
  }

  return {
    version: 1,
    sets: sets.length > 0 ? sets : INITIAL_DATABASE.sets,
    categories: categories.length > 0 ? categories : INITIAL_DATABASE.categories,
    questions,
    followUps,
    progress,
    experiences: experiences.length > 0 ? experiences : INITIAL_DATABASE.experiences,
    researches,
    reviews,
    practiceLogs,
    checklists,
    trash,
    editPasscode: '1234',
  }
}

export const getCachedMindmapDatabase = unstable_cache(
  async () => {
    return fetchMindmapDatabaseUncached()
  },
  ['interview-mindmap-database-v1'],
  {
    tags: [MINDMAP_CACHE_TAG],
  }
)
