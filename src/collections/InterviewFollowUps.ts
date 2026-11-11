import type { CollectionConfig } from 'payload'
import {
  revalidateMindmapOnChange,
  revalidateMindmapOnDelete,
} from '../hooks/revalidateMindmap'

export const InterviewFollowUps: CollectionConfig = {
  slug: 'interview-followups',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['code', 'type', 'content', 'rootQuestionId', 'isSuggestion', 'updatedAt'],
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
      name: 'parentId',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'rootQuestionId',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'code',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'content',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['narrow', 'dig', 'twist', 'other_exp', 'reask', 'pressure'],
      defaultValue: 'dig',
      admin: { position: 'sidebar' },
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
      name: 'answer',
      type: 'textarea',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 1,
      admin: { position: 'sidebar' },
    },
    {
      name: 'isSuggestion',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'suggestedBy',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'suggestedAt',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'updatedByNickname',
      type: 'text',
      admin: { position: 'sidebar' },
    },
  ],
}
