'use client'

import { useEffect } from 'react'

function DataFastAnalyticsComponent() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://datafa.st/js/script.js'
    script.defer = true
    script.setAttribute('data-website-id', 'dfid_HaJrAMnjWykYQwOEsYuVX')
    script.setAttribute('data-domain', 'copymequick.vercel.app')
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  return null
}

export default DataFastAnalyticsComponent
