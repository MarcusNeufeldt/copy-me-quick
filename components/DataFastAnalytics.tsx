'use client'

import { useEffect } from 'react'

export function DataFastAnalytics() {
  useEffect(() => {
    // Check if script already exists to prevent duplicates
    if (document.querySelector('script[data-website-id="dfid_HaJrAMnjWykYQwOEsYuVX"]')) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://datafa.st/js/script.js'
    script.defer = true
    script.setAttribute('data-website-id', 'dfid_HaJrAMnjWykYQwOEsYuVX')
    script.setAttribute('data-domain', 'copymequick.vercel.app')
    document.head.appendChild(script)

    return () => {
      const existingScript = document.querySelector('script[data-website-id="dfid_HaJrAMnjWykYQwOEsYuVX"]')
      if (existingScript && document.head.contains(existingScript)) {
        document.head.removeChild(existingScript)
      }
    }
  }, [])

  return null
}
