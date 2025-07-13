'use client';

import React from 'react';
import { Loader2, Github, Code2 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from 'sonner';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

// Simplified App Content Component
function AppContent() {
  const [isClientMounted, setIsClientMounted] = React.useState(false);
  
  React.useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Handle case where client is not yet mounted
  if (!isClientMounted) {
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

  return (
    <div className="relative">
      <Toaster position="top-center" />
      
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
          
          <Alert variant="default">
            <AlertDescription>
              This is a simplified version to test the build process.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}

// Root Component
export default function SimplePage() {
  return <AppContent />;
} 