'use server'

import { getPayloadClient } from '@/lib/payload'
import { fetchMindmapDatabaseUncached } from '@/lib/mindmap-server'
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
} from '@/types'

export type GranularMutation =
  | {
      kind: 'upsert_set_bundle'
      set: InterviewSet
      categories: Category[]
      research?: CompanyResearch
      reviews: InterviewReview[]
    }
  | {
      kind: 'delete_set'
      setId: string
    }
  | {
      kind: 'upsert_question'
      question: Question
    }
  | {
      kind: 'delete_question'
      questionId: string
    }
  | {
      kind: 'upsert_followup'
      followUp: FollowUp
    }
  | {
      kind: 'delete_followups'
      followUpIds: string[]
    }
  | {
      kind: 'upsert_experience'
      experience: Experience
    }
  | {
      kind: 'delete_experience'
      experienceId: string
    }
  | {
      kind: 'upsert_study_record'
      recordKey: string
      recordType: 'progress' | 'practice' | 'checklist' | 'trash'
      profile?: string
      setId?: string
      payload: StudyProgress | { seconds: number } | { checkedIds: string[] } | TrashItem
      updatedByNickname: string
    }
  | {
      kind: 'delete_study_record'
      recordKey: string
    }

export async function fetchLatestMindmapAction(): Promise<{
  ok: boolean
  db?: AppDatabase
  error?: string
}> {
  try {
    const db = await fetchMindmapDatabaseUncached()
    return { ok: true, db }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to fetch latest database',
    }
  }
}

export async function applyGranularMutationsAction(
  mutations: GranularMutation[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload = await getPayloadClient()

    for (const m of mutations) {
      if (m.kind === 'upsert_set_bundle') {
        const existing = await payload.find({
          collection: 'interview-sets',
          overrideAccess: false,
          where: { appId: { equals: m.set.id } },
          limit: 1,
        })
        const data = {
          appId: String(m.set.id),
          name: String(m.set.name),
          interviewDate: m.set.interviewDate ? String(m.set.interviewDate) : null,
          categoriesJson: m.categories as unknown as Record<string, unknown>[],
          researchJson: (m.research ?? null) as unknown as Record<string, unknown> | null,
          reviewsJson: m.reviews as unknown as Record<string, unknown>[],
          updatedByNickname: String(m.set.updatedBy || '지원자'),
        }
        if (existing.docs[0]) {
          await payload.update({
            collection: 'interview-sets',
            overrideAccess: false,
            id: existing.docs[0].id,
            data,
          })
        } else {
          await payload.create({
            collection: 'interview-sets',
            overrideAccess: false,
            data,
          })
        }
      } else if (m.kind === 'delete_set') {
        await payload.delete({
          collection: 'interview-sets',
          overrideAccess: false,
          where: { appId: { equals: String(m.setId) } },
        })
      } else if (m.kind === 'upsert_question') {
        const q = m.question
        const existing = await payload.find({
          collection: 'interview-questions',
          overrideAccess: false,
          where: { appId: { equals: String(q.id) } },
          limit: 1,
        })
        const data = {
          appId: String(q.id),
          setId: String(q.setId),
          categoryId: String(q.categoryId),
          questionNumber: q.questionNumber ?? null,
          content: String(q.content),
          priority: q.priority,
          typeTag: q.typeTag,
          intent: String(q.intent || ''),
          keywords: q.keywords ?? [],
          firstSentence: String(q.firstSentence || ''),
          framework: q.framework ?? 'result_first',
          frameworkSteps: q.frameworkSteps ?? {},
          answer: String(q.answer || ''),
          recommendedTime: q.recommendedTime ?? 'normal',
          linkedExperienceIds: q.linkedExperienceIds ?? [],
          isActualAsked: Boolean(q.isActualAsked),
          order: Number(q.order || 1),
          updatedByNickname: String(q.updatedBy || '지원자'),
        }
        if (existing.docs[0]) {
          await payload.update({
            collection: 'interview-questions',
            overrideAccess: false,
            id: existing.docs[0].id,
            data,
          })
        } else {
          await payload.create({
            collection: 'interview-questions',
            overrideAccess: false,
            data,
          })
        }
      } else if (m.kind === 'delete_question') {
        await payload.delete({
          collection: 'interview-questions',
          overrideAccess: false,
          where: { appId: { equals: String(m.questionId) } },
        })
        await payload.delete({
          collection: 'interview-followups',
          overrideAccess: false,
          where: { rootQuestionId: { equals: String(m.questionId) } },
        })
      } else if (m.kind === 'upsert_followup') {
        const f = m.followUp
        const existing = await payload.find({
          collection: 'interview-followups',
          overrideAccess: false,
          where: { appId: { equals: String(f.id) } },
          limit: 1,
        })
        const data = {
          appId: String(f.id),
          setId: String(f.setId),
          parentId: String(f.parentId),
          rootQuestionId: String(f.rootQuestionId),
          code: f.code ? String(f.code) : null,
          content: String(f.content),
          type: f.type,
          keywords: f.keywords ?? [],
          firstSentence: String(f.firstSentence || ''),
          answer: String(f.answer || ''),
          order: Number(f.order || 1),
          isSuggestion: Boolean(f.isSuggestion),
          suggestedBy: f.suggestedBy ? String(f.suggestedBy) : null,
          suggestedAt: f.suggestedAt ? String(f.suggestedAt) : null,
          updatedByNickname: String(f.updatedBy || '지원자'),
        }
        if (existing.docs[0]) {
          await payload.update({
            collection: 'interview-followups',
            overrideAccess: false,
            id: existing.docs[0].id,
            data,
          })
        } else {
          await payload.create({
            collection: 'interview-followups',
            overrideAccess: false,
            data,
          })
        }
      } else if (m.kind === 'delete_followups') {
        if (m.followUpIds.length > 0) {
          await payload.delete({
            collection: 'interview-followups',
            overrideAccess: false,
            where: { appId: { in: m.followUpIds.map(String) } },
          })
        }
      } else if (m.kind === 'upsert_experience') {
        const e = m.experience
        const existing = await payload.find({
          collection: 'experiences',
          overrideAccess: false,
          where: { appId: { equals: String(e.id) } },
          limit: 1,
        })
        const data = {
          appId: String(e.id),
          name: String(e.name),
          role: String(e.role || ''),
          resultMetric: String(e.resultMetric || ''),
          jobSimilarity: e.jobSimilarity ?? '상',
          tier: e.tier ?? '필살기',
          keywords: e.keywords ?? [],
          breakdown: e.breakdown as unknown as Record<string, unknown>,
          updatedByNickname: String(e.updatedBy || '지원자'),
        }
        if (existing.docs[0]) {
          await payload.update({
            collection: 'experiences',
            overrideAccess: false,
            id: existing.docs[0].id,
            data,
          })
        } else {
          await payload.create({
            collection: 'experiences',
            overrideAccess: false,
            data,
          })
        }
      } else if (m.kind === 'delete_experience') {
        await payload.delete({
          collection: 'experiences',
          overrideAccess: false,
          where: { appId: { equals: String(m.experienceId) } },
        })
      } else if (m.kind === 'upsert_study_record') {
        const existing = await payload.find({
          collection: 'study-records',
          overrideAccess: false,
          where: { recordKey: { equals: String(m.recordKey) } },
          limit: 1,
        })
        const data = {
          recordKey: String(m.recordKey),
          recordType: m.recordType,
          profile: m.profile ? String(m.profile) : null,
          setId: m.setId ? String(m.setId) : null,
          payload: m.payload as unknown as Record<string, unknown>,
          updatedByNickname: String(m.updatedByNickname || '지원자'),
        }
        if (existing.docs[0]) {
          await payload.update({
            collection: 'study-records',
            overrideAccess: false,
            id: existing.docs[0].id,
            data,
          })
        } else {
          await payload.create({
            collection: 'study-records',
            overrideAccess: false,
            data,
          })
        }
      } else if (m.kind === 'delete_study_record') {
        await payload.delete({
          collection: 'study-records',
          overrideAccess: false,
          where: { recordKey: { equals: String(m.recordKey) } },
        })
      }
    }

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to apply granular mutations',
    }
  }
}
