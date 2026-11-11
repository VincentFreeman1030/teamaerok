import type { CollectionConfig } from 'payload'
import {
  revalidateMindmapOnChange,
  revalidateMindmapOnDelete,
} from '../hooks/revalidateMindmap'

export const Experiences: CollectionConfig = {
  slug: 'experiences',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'tier', 'jobSimilarity', 'role', 'updatedAt'],
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
      name: 'role',
      type: 'text',
    },
    {
      name: 'resultMetric',
      type: 'textarea',
    },
    {
      name: 'jobSimilarity',
      type: 'select',
      options: ['상', '중', '하'],
      defaultValue: '상',
      admin: { position: 'sidebar' },
    },
    {
      name: 'tier',
      type: 'select',
      options: ['필살기', '비살기', '밉살기'],
      defaultValue: '필살기',
      admin: { position: 'sidebar' },
    },
    {
      name: 'keywords',
      type: 'json',
    },
    {
      name: 'breakdown',
      type: 'json',
    },
    {
      name: 'updatedByNickname',
      type: 'text',
      admin: { position: 'sidebar' },
    },
  ],
}
