'use client'

import { useEffect } from 'react'

export function DataFastAnalytics() {
  useEffect(() => {
    console.log('[DataFast] Component mounted, checking for existing script...')

    // Check if script already exists to prevent duplicates
    if (document.querySelector('script[data-website-id="dfid_HaJrAMnjWykYQwOEsYuVX"]')) {
      console.log('[DataFast] Script already exists, skipping')
      return
    }

    console.log('[DataFast] Creating and injecting script...')
    const script = document.createElement('script')
    script.src = 'https://datafa.st/js/script.js'
    script.defer = true
    script.setAttribute('data-website-id', 'dfid_HaJrAMnjWykYQwOEsYuVX')
    script.setAttribute('data-domain', 'copymequick.vercel.app')

    script.onload = () => console.log('[DataFast] Script loaded successfully')
    script.onerror = () => console.error('[DataFast] Failed to load script')

    document.head.appendChild(script)
    console.log('[DataFast] Script element appended to head')

    return () => {
      console.log('[DataFast] Cleaning up script...')
      const existingScript = document.querySelector('script[data-website-id="dfid_HaJrAMnjWykYQwOEsYuVX"]')
      if (existingScript && document.head.contains(existingScript)) {
        document.head.removeChild(existingScript)
      }
    }
  }, [])

  // Return an invisible element instead of null to prevent tree-shaking
  return <div style={{ display: 'none' }} data-component="datafast-analytics" />
}
