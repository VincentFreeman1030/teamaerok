import type { CollectionConfig } from 'payload'
import {
  revalidateMindmapOnChange,
  revalidateMindmapOnDelete,
} from '../hooks/revalidateMindmap'

export const InterviewQuestions: CollectionConfig = {
  slug: 'interview-questions',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['questionNumber', 'priority', 'typeTag', 'content', 'categoryId', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    afterChange: [revalidateMindmapOnChange],
    afterDelete: [revalidateMindmapOnDelete],
  },
  fields: [
    {
      name: 'appId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'setId',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'categoryId',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'questionNumber',
      type: 'number',
      admin: { position: 'sidebar' },
    },
    {
      name: 'content',
      type: 'text',
      required: true,
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      options: ['S', 'A', 'B', 'C'],
      defaultValue: 'A',
      admin: { position: 'sidebar' },
    },
    {
      name: 'typeTag',
      type: 'select',
      required: true,
      options: ['K', 'M', 'L'],
      defaultValue: 'K',
      admin: { position: 'sidebar' },
    },
    {
      name: 'intent',
      type: 'textarea',
    },
    {
      name: 'keywords',
      type: 'json',
    },
    {
      name: 'firstSentence',
      type: 'textarea',
    },
    {
      name: 'framework',
      type: 'select',
      options: ['result_first', 'ostar', 'oreo', 'pressure', 'free'],
      defaultValue: 'result_first',
      admin: { position: 'sidebar' },
    },
    {
      name: 'frameworkSteps',
      type: 'json',
    },
    {
      name: 'answer',
      type: 'textarea',
    },
    {
      name: 'recommendedTime',
      type: 'select',
      options: ['short', 'normal'],
      defaultValue: 'normal',
      admin: { position: 'sidebar' },
    },
    {
      name: 'linkedExperienceIds',
      type: 'json',
    },
    {
      name: 'isActualAsked',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 1,
      admin: { position: 'sidebar' },
    },
    {
      name: 'updatedByNickname',
      type: 'text',
      admin: { position: 'sidebar' },
    },
  ],
}
