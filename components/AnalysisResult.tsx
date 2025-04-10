import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FileSelector from './FileSelector';
import { AppState, FileData, DataSource } from './types';
import { Copy, File, Folder, FileText, CheckCircle2, BarChart3, FileSymlink, Layers, AlertCircle } from 'lucide-react';

interface AnalysisResultProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
  dataSource?: DataSource;
}

interface TreeNodeData {
  type: 'file' | 'directory';
  name: string;
  size?: number;
  children?: { [key: string]: TreeNodeData };
}

interface TreeItemProps {
  node: TreeNodeData;
  isLast: boolean;
  prefix?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const TreeItem: React.FC<TreeItemProps> = ({ node, isLast, prefix = '' }) => {
  const linePrefix = prefix + (isLast ? '└── ' : '├── ');
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  
  const entries = node.children 
    ? Object.entries(node.children).sort(([, a], [, b]) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground whitespace-pre font-mono">{linePrefix}</span>
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {node.type === 'file' ? (
            <File className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-accent" />
          )}
        </span>
        <span className="font-mono">{node.name}</span>
        {node.size && (
          <span className="text-muted-foreground text-xs ml-1">({formatFileSize(node.size)})</span>
        )}
      </div>
      {entries.map(([key, childNode], index) => (
        <TreeItem
          key={key}
          node={childNode}
          isLast={index === entries.length - 1}
          prefix={childPrefix}
        />
      ))}
    </div>
  );
};

const ProjectTree: React.FC<{ files: FileData[] }> = ({ files }) => {
  const tree: { [key: string]: TreeNodeData } = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = tree;

    parts.forEach((part, index) => {
      const isLastPart = index === parts.length - 1;
      if (!currentLevel[part]) {
        currentLevel[part] = {
          type: isLastPart ? 'file' : 'directory',
          name: part,
          size: isLastPart ? file.size : undefined,
          children: isLastPart ? undefined : {}
        };
      }
      currentLevel = currentLevel[part].children || {};
    });
  });

  const entries = Object.entries(tree).sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card className="glass-card p-4 overflow-auto max-h-96 custom-scrollbar">
      <div className="font-mono text-xs">
        {entries.map(([key, node], index) => (
          <TreeItem
            key={key}
            node={node}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>
    </Card>
  );
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  state,
  setState,
  updateCurrentProject,
  tokenCount,
  setTokenCount,
  maxTokens,
  dataSource
}) => {
  const [totalSelectedFiles, setTotalSelectedFiles] = useState(0);
  const [totalSelectedLines, setTotalSelectedLines] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // Create internal dataSource if not provided
  const effectiveDataSource = useMemo(() => {
    if (dataSource) {
      console.log("AnalysisResult: Using provided dataSource:", {
        type: dataSource.type,
        hasFiles: !!dataSource.files,
        hasTree: !!dataSource.tree,
        treeLength: dataSource.tree?.length || 0,
        hasRepoInfo: !!dataSource.repoInfo
      });
      return dataSource;
    }
    
    // Default to local dataSource using files from analysisResult
    console.log("AnalysisResult: Creating default local dataSource");
    return {
      type: 'local' as const,
      files: state.analysisResult?.files || []
    };
  }, [dataSource, state.analysisResult]);

  useEffect(() => {
    if (state.analysisResult) {
      const selectedFileData = state.analysisResult.files.filter(file => state.selectedFiles.includes(file.path));
      setTotalSelectedFiles(selectedFileData.length);
      setTotalSelectedLines(selectedFileData.reduce((sum, file) => sum + file.lines, 0));
    }
  }, [state]);

  const handleSetSelectedFiles = useCallback((filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    setState(prevState => {
      const newSelectedFiles = typeof filesOrUpdater === 'function' 
        ? filesOrUpdater(prevState.selectedFiles) 
        : filesOrUpdater;
      
      const newState = {
        ...prevState,
        selectedFiles: newSelectedFiles
      };
      
      updateCurrentProject(newState);
      return newState;
    });
  }, [setState, updateCurrentProject]);

  const copyToClipboard = () => {
    if (state.analysisResult) {
      navigator.clipboard.writeText(getSelectedFileTree(state.analysisResult.files, state.selectedFiles))
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        });
    }
  };

  const getSelectedFileTree = (files: FileData[], selectedPaths: string[]): string => {
    const selectedFiles = files.filter(file => selectedPaths.includes(file.path));
    return generateProjectTree(selectedFiles);
  };

  const generateProjectTree = (files: FileData[]): string => {
    // Convert to TreeNode structure
    const tree: { [key: string]: TreeNodeData } = {};

    files.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = tree;

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;
        if (!currentLevel[part]) {
          currentLevel[part] = {
            type: isLastPart ? 'file' : 'directory',
            name: part,
            size: isLastPart ? file.size : undefined,
            children: isLastPart ? undefined : {}
          };
        }
        currentLevel = currentLevel[part].children || {};
      });
    });

    const buildTreeString = (obj: { [key: string]: TreeNodeData }, prefix = ''): string => {
      let result = '';
      const entries = Object.entries(obj).sort(([, a], [, b]) => {
        // Directories first, then files
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      entries.forEach(([key, node], index) => {
        const isLast = index === entries.length - 1;
        const line = prefix + (isLast ? '└── ' : '├── ') + node.name;
        result += line + '\n';

        if (node.children) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          result += buildTreeString(node.children, newPrefix);
        }
      });

      return result;
    };

    return buildTreeString(tree);
  };

  const tokenPercentage = Math.min(100, (tokenCount / maxTokens) * 100);
  const isTokenWarning = tokenPercentage > 75;
  const isTokenExceeded = tokenPercentage >= 100;

  if (!state.analysisResult) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-6 animate-slide-up">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selected Files</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {totalSelectedFiles}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">of {(state.analysisResult.files || []).length}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 animate-slide-up animation-delay-200">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-secondary-100 dark:bg-secondary-900">
              <Layers className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Selected Lines</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {totalSelectedLines.toLocaleString()}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">
                  of {(state.analysisResult.totalLines || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 animate-slide-up animation-delay-400">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-accent-100 dark:bg-accent-900">
              <BarChart3 className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Token Count</p>
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold">
                  {tokenCount.toLocaleString()}
                </h3>
                <span className="ml-2 text-sm text-muted-foreground">
                  of {maxTokens.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Progress 
              value={tokenPercentage} 
              className={`h-2 ${
                isTokenExceeded ? 'bg-destructive/20' : 
                isTokenWarning ? 'bg-amber-200/20 dark:bg-amber-900/20' : 
                'bg-secondary/20'
              }`}
              indicatorClassName={
                isTokenExceeded ? 'bg-destructive' : 
                isTokenWarning ? 'bg-amber-500' : 
                'bg-gradient-to-r from-primary to-secondary'
              }
            />
            {isTokenExceeded && (
              <p className="mt-2 text-xs flex items-center text-destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Token limit exceeded
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* File Selector Tabs */}
      <Tabs defaultValue="selector" className="animate-fade-in animation-delay-200">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="selector" className="flex items-center gap-2">
            <FileSymlink className="h-4 w-4" />
            <span>File Selection</span>
          </TabsTrigger>
          <TabsTrigger value="tree" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <span>Project Tree</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="selector" className="mt-0 animate-slide-up">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-heading">File Selector</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <FileSelector
                dataSource={effectiveDataSource}
                selectedFiles={state.selectedFiles}
                setSelectedFiles={handleSetSelectedFiles}
                maxTokens={maxTokens}
                onTokenCountChange={setTokenCount}
                state={state}
                setState={setState}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tree" className="mt-0 animate-slide-up">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-heading">Selected Files Tree</CardTitle>
            </CardHeader>
            <CardContent>
              {state.selectedFiles.length > 0 ? (
                <ProjectTree files={(state.analysisResult.files || []).filter(file => 
                  state.selectedFiles.includes(file.path))} 
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-40" />
                  <p>No files selected</p>
                  <p className="text-sm mt-1">Select files using the File Selector tab.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalysisResult;