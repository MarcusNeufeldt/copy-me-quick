import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderOpen, Ban, FileType, Loader, AlertCircle, Info } from 'lucide-react';
import { AppState, FileData } from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Add this type declaration at the top of your file
declare module 'react' {
  interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

interface FileUploadSectionProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onUploadComplete: (newState: AppState) => void;
  projectTypeSelected: boolean;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  state,
  setState,
  updateCurrentProject,
  setError,
  onUploadComplete,
  projectTypeSelected
}) => {
  const [progress, setProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState<{ total: number; valid: number }>({ total: 0, valid: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [rememberPreference, setRememberPreference] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedPreference = localStorage.getItem('showUploadInfoBox');
    if (savedPreference !== null) {
      const shouldShow = JSON.parse(savedPreference);
      setShowInfoBox(shouldShow);
    }
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    setError(null);
    setProgress(0);
    setUploadStats({ total: 0, valid: 0 });
    setIsProcessing(true);
    setProcessingStatus("Initializing...");

    const excludedFolders = state.excludeFolders.split(',').map(f => f.trim());
    const allowedFileTypes = state.fileTypes.split(',').map(t => t.trim());

    let fileContents: FileData[] = [];
    let totalFiles = 0;
    let totalLines = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;

      setUploadStats(prev => ({ ...prev, total: prev.total + 1 }));

      if (excludedFolders.some(folder => relativePath.includes(folder))) {
        setProcessingStatus(`Skipping excluded: ${relativePath}`);
        continue;
      }

      if (!allowedFileTypes.some(type => relativePath.endsWith(type))) {
        setProcessingStatus(`Skipping type: ${relativePath}`);
        continue;
      }

      setProcessingStatus(`Reading: ${relativePath}`);
      const content = await file.text();
      const lines = content.split('\n').length;

      fileContents.push({
        path: relativePath,
        lines,
        content
      });

      totalFiles++;
      totalLines += lines;
      setUploadStats(prev => ({ ...prev, valid: prev.valid + 1 }));

      setProgress(Math.round((i + 1) / files.length * 100));
    }

    if (fileContents.length === 0) {
      setError(`No valid files found. Processed ${uploadStats.total} files, but none matched the allowed types.`);
      setIsProcessing(false);
      setProcessingStatus(null);
      return;
    }

    setProcessingStatus("Generating project tree...");
    await new Promise(resolve => setTimeout(resolve, 10));
    const projectTree = generateProjectTree(fileContents);

    setProcessingStatus("Finalizing...");
    await new Promise(resolve => setTimeout(resolve, 10));

    const newState: AppState = {
      ...state,
      analysisResult: {
        summary: {
          total_files: totalFiles,
          total_lines: totalLines
        },
        files: fileContents,
        project_tree: projectTree
      },
      selectedFiles: []
    };

    setState(newState);
    updateCurrentProject(newState);
    onUploadComplete(newState);
    setIsProcessing(false);
    setProcessingStatus(null);
  }, [state, setState, updateCurrentProject, onUploadComplete, setError, setUploadStats]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setIsDialogOpen(false);
      processFiles(event.target.files);
    }
  };

  const generateProjectTree = (files: FileData[]): string => {
    const tree: { [key: string]: any } = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = null;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });

    const stringify = (node: any, prefix = ''): string => {
      let result = '';
      const entries = Object.entries(node);
      entries.forEach(([key, value], index) => {
        const isLast = index === entries.length - 1;
        result += `${prefix}${isLast ? '└── ' : '├── '}${key}\n`;
        if (value !== null) {
          result += stringify(value, `${prefix}${isLast ? '    ' : '│   '}`);
        }
      });
      return result;
    };

    return stringify(tree);
  };

  const handleChooseFolder = () => {
    const savedPreference = localStorage.getItem('showUploadInfoBox');
    const shouldShowDialog = savedPreference === null || JSON.parse(savedPreference);
    
    if (shouldShowDialog) {
      setIsDialogOpen(true);
    } else {
      document.getElementById('fileInput')?.click();
    }
  };

  const handleProceed = () => {
    if (rememberPreference) {
      localStorage.setItem('showUploadInfoBox', JSON.stringify(false));
      setShowInfoBox(false);
    }
    setIsDialogOpen(false);
    document.getElementById('fileInput')?.click();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="excludedFolders" className="flex items-center space-x-2">
              <Ban className="w-4 h-4" />
              <span>Excluded folders</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  id="excludedFolders"
                  type="text"
                  placeholder="e.g., node_modules,.git,dist,.next"
                  value={state.excludeFolders}
                  onChange={(e) => setState(prev => ({ ...prev, excludeFolders: e.target.value }))}
                  className="w-full"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Comma-separated list of folders to ignore during analysis</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-sm text-gray-500">Comma-separated list of folders to ignore</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileTypes" className="flex items-center space-x-2">
              <FileType className="w-4 h-4" />
              <span>File types</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  id="fileTypes"
                  type="text"
                  placeholder="e.g., .js,.jsx,.ts,.tsx,.py"
                  value={state.fileTypes}
                  onChange={(e) => setState(prev => ({ ...prev, fileTypes: e.target.value }))}
                  className="w-full"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Comma-separated list of file extensions to include in the analysis</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-sm text-gray-500">Comma-separated list of file extensions to include</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full"
              disabled={isProcessing || !projectTypeSelected}
              onClick={handleChooseFolder}
            >
              <FolderOpen className="mr-2 h-4 w-4" /> Choose Project Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Project Folder</DialogTitle>
              <DialogDescription>
                You&apos;re about to select your project folder for analysis. Here&apos;s what will happen:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  1. Your browser will prompt you to select a folder.
                </AlertDescription>
              </Alert>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  2. Only files matching the specified types will be processed.
                </AlertDescription>
              </Alert>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  3. Excluded folders will be skipped during analysis.
                </AlertDescription>
              </Alert>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  All uploaded files are stored locally in your browser and are NOT uploaded to any server.
                </AlertDescription>
              </Alert>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="rememberPreference" 
                  checked={rememberPreference} 
                  onCheckedChange={(checked) => setRememberPreference(checked as boolean)}
                />
                <label htmlFor="rememberPreference" className="text-sm text-gray-700">
                  Don&apos;t show this information again
                </label>
              </div>
              <Button 
                onClick={handleProceed}
                className="w-full"
              >
                Proceed with Folder Selection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <input
          id="fileInput"
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        {progress > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
              Processed {uploadStats.total} files, {uploadStats.valid} valid files found
            </p>
          </div>
        )}
        {isProcessing && (
          <Alert>
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            <AlertDescription>
              {processingStatus || "Processing files..."}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </TooltipProvider>
  );
};

export default FileUploadSection;