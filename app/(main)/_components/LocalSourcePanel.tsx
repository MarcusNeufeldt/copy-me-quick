'use client';

import { Computer, Filter, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FileUploadSection from '@/components/FileUploadSection';
import RecentProjectsDisplay from '@/components/RecentProjectsDisplay';
import { useAppContext } from '../_context/AppContext';

export function LocalSourcePanel() {
  const { 
    workspace,
    ui,
    projects,
    actions: { 
      handleUploadComplete, 
      handleLoadProject,
      setIsLocalFilterSheetOpen
    }
  } = useAppContext();

  return (
    <>
      {/* Template & Filter Button */}
      <Button variant="outline" className="w-full" onClick={() => setIsLocalFilterSheetOpen(true)}>
        <Filter className="mr-2 h-4 w-4" />
        Templates & Filters
      </Button>

      <FileUploadSection
        onUploadComplete={handleUploadComplete}
        setLoadingStatus={() => {}} // Already handled by the context
        loadingStatus={ui.loadingStatus}
        excludeFolders={workspace.excludeFolders.split(',').map(f => f.trim()).filter(Boolean)}
        allowedFileTypes={workspace.fileTypes.split(',').map(t => t.trim()).filter(Boolean)}
      />

      <Alert variant="default" className="mt-2 bg-primary/5 border-primary/20">
        <ShieldCheck className="h-4 w-4 text-primary/80" />
        <AlertDescription className="text-primary/90 text-xs">
          <strong>Privacy Assured:</strong> Your local files are processed only in your browser.
        </AlertDescription>
      </Alert>
      
      <RecentProjectsDisplay 
        projects={projects.items.filter(p => p.sourceType === 'local')} 
        onLoadProject={handleLoadProject}
        onPinProject={projects.handlePinProject}
        onRemoveProject={projects.handleRemoveProject}
        onRenameProject={projects.handleRenameProject}
      />
    </>
  );
}