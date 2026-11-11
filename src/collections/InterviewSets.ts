import type { CollectionConfig } from 'payload'
import {
  revalidateMindmapOnChange,
  revalidateMindmapOnDelete,
} from '../hooks/revalidateMindmap'

export const InterviewSets: CollectionConfig = {
  slug: 'interview-sets',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'appId', 'interviewDate', 'updatedByNickname', 'updatedAt'],
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'interviewDate',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'categoriesJson',
      type: 'json',
    },
    {
      name: 'researchJson',
      type: 'json',
    },
    {
      name: 'reviewsJson',
      type: 'json',
    },
    {
      name: 'updatedByNickname',
      type: 'text',
      admin: { position: 'sidebar' },
    },
  ],
}
