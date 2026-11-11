import type { CollectionConfig } from 'payload'
import {
  revalidateMindmapOnChange,
  revalidateMindmapOnDelete,
} from '../hooks/revalidateMindmap'

export const StudyRecords: CollectionConfig = {
  slug: 'study-records',
  admin: {
    useAsTitle: 'recordKey',
    defaultColumns: ['recordKey', 'recordType', 'profile', 'setId', 'updatedAt'],
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
      name: 'recordKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'recordType',
      type: 'select',
      required: true,
      index: true,
      options: ['progress', 'practice', 'checklist', 'trash', 'meta'],
      admin: { position: 'sidebar' },
    },
    {
      name: 'profile',
      type: 'text',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'setId',
      type: 'text',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'payload',
      type: 'json',
      required: true,
    },
    {
      name: 'updatedByNickname',
      type: 'text',
      admin: { position: 'sidebar' },
    },
  ],
}
