import React from 'react'
import { getCachedMindmapDatabase } from '@/lib/mindmap-server'
import { InterviewMindmapClient } from '@/components/InterviewMindmapClient'

export default async function HomePage() {
  const initialDb = await getCachedMindmapDatabase()
  return <InterviewMindmapClient initialDb={initialDb} />
}
