'use client';

// This file is now handled by the (main) route group
// The actual page component is in app/(main)/page.tsx
// This file exists to ensure proper routing

import NextDynamic from 'next/dynamic';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

// Dynamically import the main page component to prevent SSR issues
const MainPage = NextDynamic(() => import('./(main)/page-simple'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

export default MainPage;