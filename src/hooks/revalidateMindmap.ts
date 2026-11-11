import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

export const MINDMAP_CACHE_TAG = 'interview-mindmap-data'

export const revalidateMindmapOnChange: CollectionAfterChangeHook = async ({
  context,
}) => {
  if (context?.skipRevalidate) return
  try {
    revalidateTag(MINDMAP_CACHE_TAG, 'max')
    revalidatePath('/')
  } catch {
    // Ignored when running inside standalone CLI outside Next.js request store
  }
}

export const revalidateMindmapOnDelete: CollectionAfterDeleteHook = async ({
  context,
}) => {
  if (context?.skipRevalidate) return
  try {
    revalidateTag(MINDMAP_CACHE_TAG, 'max')
    revalidatePath('/')
  } catch {
    // Ignored when running inside standalone CLI outside Next.js request store
  }
}
