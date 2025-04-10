"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/ui/mode-toggle";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import BackupManagement from '@/components/BackupManagement';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project } from '@/components/types';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { GithubIcon, RotateCcw, Code2, GitBranchPlus, LayoutGrid } from 'lucide-react';

// Dynamically import Analytics with error handling
const AnalyticsComponent = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics).catch(() => () => null),
  { ssr: false, loading: () => null }
);

const MAX_TOKENS = 1048576;

const baseExclusions = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.vscode',
  '.idea',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.tmp',
  '*.temp',
  'coverage',
];

const defaultProjectTypes = [
  { value: "none", label: "None", excludeFolders: baseExclusions, fileTypes: ['*'] },
  { value: "nextjs", label: "Next.js", excludeFolders: [...baseExclusions, '.next', 'out'], fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "react", label: "React", excludeFolders: baseExclusions, fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "vue", label: "Vue.js", excludeFolders: [...baseExclusions, '.nuxt'], fileTypes: ['.vue', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "angular", label: "Angular", excludeFolders: baseExclusions, fileTypes: ['.ts', '.html', '.css', '.scss', '.json', '.md'] },
  { value: "svelte", label: "Svelte", excludeFolders: baseExclusions, fileTypes: ['.svelte', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "flask", label: "Flask", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "django", label: "Django", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "express", label: "Express.js", excludeFolders: baseExclusions, fileTypes: ['.js', '.ts', '.json', '.md'] },
  { value: "springboot", label: "Spring Boot", excludeFolders: [...baseExclusions, '.gradle', 'gradle'], fileTypes: ['.java', '.xml', '.properties', '.yml', '.md'] },
  { value: "dotnet", label: ".NET", excludeFolders: [...baseExclusions, 'packages', 'TestResults'], fileTypes: ['.cs', '.cshtml', '.csproj', '.sln', '.json', '.md'] },
];

// Default initial state, safe for server rendering
const initialAppState: AppState = {
  analysisResult: null,
  selectedFiles: [],
  excludeFolders: 'node_modules,.git,dist,.next',
  fileTypes: '.js,.jsx,.ts,.tsx,.py',
  backups: [],
};

export default function ClientPageRoot() {
  // Initialize state with server-safe defaults
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(initialAppState);
  const [projectTypes, setProjectTypes] = useState(() => defaultProjectTypes); // Keep default types initially
  const [isMounted, setIsMounted] = useState(false); // Track client-side mount

  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [projectTypeSelected, setProjectTypeSelected] = useState(false);

  // Load state from localStorage only on the client after mount
  useEffect(() => {
    setIsMounted(true); // Mark as mounted

    const savedProjectsStr = localStorage.getItem('codebaseReaderProjects');
    const loadedProjects = savedProjectsStr ? JSON.parse(savedProjectsStr) : [];
    setProjects(loadedProjects);

    const savedProjectId = localStorage.getItem('currentProjectId'); // Corrected typo
    setCurrentProjectId(savedProjectId);

    const savedTemplatesStr = localStorage.getItem('projectTemplates'); // Corrected typo
    if (savedTemplatesStr) {
      setProjectTypes(JSON.parse(savedTemplatesStr));
    }

    // Load the state for the current project
    if (savedProjectId) {
      const currentProject = loadedProjects.find((p: Project) => p.id === savedProjectId);
      if (currentProject) {
        // Ensure backups is always an array when loading state
        const loadedState = currentProject.state;
        if (!Array.isArray(loadedState.backups)) {
          console.warn("Loaded state backups is not an array, resetting to empty array.");
          loadedState.backups = [];
        }
        setState(loadedState);
      } else {
         setState(initialAppState); // Reset if project not found
      }
    } else {
      setState(initialAppState); // Reset if no project ID
    }

  }, []); // Empty dependency array ensures this runs only once on mount

  // Persist state changes to localStorage
  useEffect(() => {
    // Only run persistence logic after initial mount/load is complete
    if (!isMounted) return;

    localStorage.setItem('codebaseReaderProjects', JSON.stringify(projects));
    localStorage.setItem('currentProjectId', currentProjectId || '');
    localStorage.setItem('projectTemplates', JSON.stringify(projectTypes));

    // Also update the current project's state within the projects array for persistence
    if (currentProjectId) {
        const updatedProjects = projects.map(p =>
            p.id === currentProjectId ? { ...p, state: state } : p
        );
        // Avoid infinite loop by checking if the state actually changed
        if (JSON.stringify(updatedProjects) !== JSON.stringify(projects)) {
            setProjects(updatedProjects); // Update the projects state itself
        }
    }

  }, [state, projects, currentProjectId, projectTypes, isMounted]); // Re-run whenever relevant state changes *after* mount


  const updateCurrentProject = (newState: AppState) => {
    // This function now primarily updates the 'state' object.
    // The persistence useEffect will handle updating the 'projects' array in localStorage.
    setState(newState);
  };

  const handleUploadComplete = (newState: AppState) => {
    console.log('Upload complete.');
    setState(newState);
    // updateCurrentProject(newState); // No longer needed here, persistence useEffect handles it
  };

  const handleProjectTemplateUpdate = (updatedTemplates: typeof projectTypes) => {
    setProjectTypes(updatedTemplates);
  };

  // Handler function for the new Reset button
  const handleResetWorkspace = () => {
    if (confirm('Are you sure you want to clear the current workspace? This will reset the current view but not delete backups or saved project types.')) {
      setState(initialAppState);
      setCurrentProjectId(null); // Clear the current project ID
      setProjectTypeSelected(false); // Reset project type selection
      setTokenCount(0); // Reset token count
      setError(null); // Clear errors
      // The persistence useEffect will automatically handle saving the cleared currentProjectId
      // and the reset state for the (now non-current) project in the projects array.
      console.log('Workspace cleared.');
    }
  };

  // Prevent rendering potentially mismatched UI before mount
  if (!isMounted) {
    // Optionally return a loading spinner or null
    return null;
    // Or return the basic structure with default values if preferred,
    // but ensure it matches the server render exactly.
    // Returning null is often safer during the hydration phase.
  }

  return (
    <div className="relative">
      {/* Header with background blur */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-heading font-bold text-gradient">Copy Me Quick</h1>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://github.com/MarcusNeufeldt/copy-me-quick" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            <ModeToggle />
          </div>
        </div>
      </header>
      
      <div className="container px-4 py-6 md:py-10 max-w-7xl mx-auto animate-fade-in">
        <div className="grid gap-6 md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <aside className="flex flex-col gap-4">
            <Card className="glass-card animate-slide-up">
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranchPlus className="h-5 w-5 text-primary" />
                  <h2 className="font-heading font-semibold">Project Configuration</h2>
                </div>
                
                <ProjectSelector
                  setState={setState}
                  onProjectTypeSelected={setProjectTypeSelected}
                  projectTypes={projectTypes}
                  onProjectTemplatesUpdate={handleProjectTemplateUpdate}
                />
                
                <FileUploadSection
                  state={state}
                  setState={setState}
                  updateCurrentProject={updateCurrentProject}
                  setError={setError}
                  onUploadComplete={handleUploadComplete}
                  projectTypeSelected={projectTypeSelected}
                />
                
                <BackupManagement
                  state={state}
                  setState={setState}
                  updateCurrentProject={updateCurrentProject}
                />
                
                <Button
                  variant="outline"
                  onClick={handleResetWorkspace}
                  className="w-full transition-all hover:border-destructive hover:text-destructive"
                  disabled={!state.analysisResult && !currentProjectId}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Workspace
                </Button>
              </CardContent>
            </Card>
          </aside>
          
          {/* Main Content */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            {error && (
              <Alert variant="destructive" className="animate-scale">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Conditionally render AnalysisResult only when data is ready */}
            {state.analysisResult ? (
              <AnalysisResult
                state={state}
                setState={setState}
                updateCurrentProject={updateCurrentProject}
                tokenCount={tokenCount}
                setTokenCount={setTokenCount}
                maxTokens={MAX_TOKENS}
              />
            ) : (
              <Card className="glass-card flex flex-col items-center justify-center p-12 text-center h-[400px]">
                <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-heading font-semibold mb-2">No Project Loaded</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Select a project type and upload a folder to get started. Your file tree will appear here.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
      <AnalyticsComponent />
    </div>
  );
}