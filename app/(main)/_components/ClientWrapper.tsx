'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ClientWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientWrapper({ children, fallback }: ClientWrapperProps) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return fallback || (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
} 