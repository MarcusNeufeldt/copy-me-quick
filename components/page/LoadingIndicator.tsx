"use client";

import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  isLoading: boolean;
  message: string | null;
}

export function LoadingIndicator({ isLoading, message }: LoadingIndicatorProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-50">
      <div
        className="h-full bg-gradient-to-r from-primary to-purple-500 animate-pulse-fast"
        style={{ width: '100%' }}
      />
      {message && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-background border rounded-full shadow-lg text-xs font-medium flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {message}
        </div>
      )}
    </div>
  );
}
