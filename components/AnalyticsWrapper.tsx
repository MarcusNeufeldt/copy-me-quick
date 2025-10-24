'use client'

import dynamic from 'next/dynamic'

// Dynamically import DataFast Analytics with no SSR
const DataFastAnalytics = dynamic(
  () => import('@/components/DataFastAnalytics'),
  { ssr: false, loading: () => null }
)

export function AnalyticsWrapper() {
  return <DataFastAnalytics />
}
