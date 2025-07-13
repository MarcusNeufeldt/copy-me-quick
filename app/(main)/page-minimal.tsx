'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export default function MinimalPage() {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Minimal Test Page</h1>
        <p className="text-muted-foreground">If you see this, the basic page structure works.</p>
      </div>
    </div>
  );
} 