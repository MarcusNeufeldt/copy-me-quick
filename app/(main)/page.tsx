'use client';

import React from 'react';
import { Loader2, Github, Code2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from 'sonner';
import GitHubFilterManager from '@/components/GitHubFilterManager';
import LocalTemplateManager from '@/components/LocalTemplateManager';

import { AppProvider, useAppContext } from './_context/AppContext';
import { AppHeader } from './_components/AppHeader';
import { ProjectSidebar } from './_components/ProjectSidebar';
import { MainContentArea } from './_components/MainContentArea';
import { ConfirmationDialogs } from './_components/ConfirmationDialogs';
import { DataFastAnalytics } from '@/components/DataFastAnalytics';

// Dynamically import Analytics with error handling
const AnalyticsComponent = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics).catch(() => () => null),
  { ssr: false, loading: () => null }
);

import { SpeedInsights } from "@vercel/speed-insights/next";

// Main App Content Component
function AppContent() {
  const { 
    isMounted,
    userContext, 
    userContextError,
    ui,
    workspace,
    actions: { 
      handleSaveFilters, 
      handleSaveLocalFilters,
      setIsFilterSheetOpen,
      setIsLocalFilterSheetOpen
    }
  } = useAppContext();

  // Handle case where context is not yet mounted
  if (!isMounted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle GitHub login
  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github/login';
  };

  // Loading state for initial mount
  if (!userContext && !userContextError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthenticated state
  if (userContextError) {
    return (
      <div className="container px-4 py-8 max-w-2xl mx-auto">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Code2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-heading font-bold">Copy Me Quick</h1>
          </div>
          
          {/* Login Card */}
          <Card className="p-8">
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Github className="h-12 w-12 mx-auto text-muted-foreground" />
                <h2 className="text-2xl font-semibold">Welcome!</h2>
                <p className="text-muted-foreground">
                  Sign in with GitHub to access your projects and settings
                </p>
              </div>
              
              <Button 
                onClick={handleGitHubLogin} 
                className="w-full" 
                size="lg"
              >
                <Github className="mr-2 h-5 w-5" />
                Continue with GitHub
              </Button>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Your projects and settings will be saved securely</p>
                <p>• Access your repositories and manage file filters</p>
                <p>• Sync across all your devices</p>
              </div>
            </CardContent>
          </Card>
          
          {userContextError.message !== 'Failed to fetch' && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to load your data. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Toaster position="top-center" />
      
      {/* Loading indicator */}
      {ui.loadingStatus.isLoading && (
        <div className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-50">
          <div className="h-full bg-gradient-to-r from-primary to-purple-500 animate-pulse-fast" style={{ width: '100%' }} />
          {ui.loadingStatus.message && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-background border rounded-full shadow-lg text-xs font-medium flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {ui.loadingStatus.message}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <AppHeader />
      
      <div className="container px-4 py-4 sm:py-6 md:py-10 max-w-7xl mx-auto animate-fade-in">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <ProjectSidebar />
          
          {/* Main Content */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            <MainContentArea />
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialogs />

      {/* GitHub Filter Manager */}
      <GitHubFilterManager
        isOpen={ui.isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        currentExclusions={workspace.excludeFolders}
        onSave={handleSaveFilters}
      />

      {/* Local Template Manager */}
      <LocalTemplateManager
        isOpen={ui.isLocalFilterSheetOpen}
        onClose={() => setIsLocalFilterSheetOpen(false)}
        currentExclusions={workspace.excludeFolders}
        currentFileTypes={workspace.fileTypes}
        onSave={handleSaveLocalFilters}
      />

      <DataFastAnalytics />
      <AnalyticsComponent />
      <SpeedInsights />
      <Toaster />
    </div>
  );
}

// Root Component with Provider
export default function ClientPageRoot() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}