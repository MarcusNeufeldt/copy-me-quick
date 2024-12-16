"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ProjectSelector from '@/components/ProjectSelector';
import FileUploadSection from '@/components/FileUploadSection';
import BackupManagement from '@/components/BackupManagement';
import AnalysisResult from '@/components/AnalysisResult';
import { AppState, Project } from '@/components/types';
import { Analytics } from "@vercel/analytics/react"

const MAX_TOKENS = 4096;

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

export default function CodebaseReader() {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== 'undefined') {
      const savedProjects = localStorage.getItem('codebaseReaderProjects');
      return savedProjects ? JSON.parse(savedProjects) : [];
    }
    return [];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentProjectId');
    }
    return null;
  });

  const [state, setState] = useState<AppState>(() => {
    if (currentProjectId) {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject) {
        return currentProject.state;
      }
    }
    return {
      analysisResult: null,
      selectedFiles: [],
      excludeFolders: 'node_modules,.git,dist,.next',
      fileTypes: '.js,.jsx,.ts,.tsx,.py',
      backups: [],
    };
  });

  const [projectTypes, setProjectTypes] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTemplates = localStorage.getItem('projectTemplates');
      return savedTemplates ? JSON.parse(savedTemplates) : defaultProjectTypes;
    }
    return defaultProjectTypes;
  });

  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [projectTypeSelected, setProjectTypeSelected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('codebaseReaderProjects', JSON.stringify(projects));
      localStorage.setItem('currentProjectId', currentProjectId || '');
      localStorage.setItem('projectTemplates', JSON.stringify(projectTypes));
    }
  }, [projects, currentProjectId, projectTypes]);

  const updateCurrentProject = (newState: AppState) => {
    setProjects(prevProjects =>
      prevProjects.map(project =>
        project.id === currentProjectId
          ? { ...project, state: newState }
          : project
      )
    );
  };

  const handleUploadComplete = (newState: AppState) => {
    console.log('Upload complete.');
    setState(newState);
    updateCurrentProject(newState);
  };

  const handleProjectTemplateUpdate = (updatedTemplates: typeof projectTypes) => {
    setProjectTypes(updatedTemplates);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Copy Me Quick</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {state.analysisResult && (
        <AnalysisResult
          state={state}
          setState={setState}
          updateCurrentProject={updateCurrentProject}
          tokenCount={tokenCount}
          setTokenCount={setTokenCount}
          maxTokens={MAX_TOKENS}
        />
      )}
    <Analytics />
    </div>
  );
}