import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FileSelector from './FileSelector';
import { AppState, FileData } from './types';
import { Copy, File, Folder } from 'lucide-react';

interface AnalysisResultProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateCurrentProject: (newState: AppState) => void;
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number;
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
        <span className="text-gray-500 whitespace-pre font-mono">{linePrefix}</span>
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {node.type === 'file' ? (
            <File className="w-3.5 h-3.5 text-blue-500" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-yellow-500" />
          )}
        </span>
        <span className="font-mono">{node.name}</span>
        {node.size && (
          <span className="text-gray-500 text-xs ml-1">({formatFileSize(node.size)})</span>
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
    <div className="font-mono">
      {entries.map(([key, node], index) => (
        <TreeItem
          key={key}
          node={node}
          isLast={index === entries.length - 1}
        />
      ))}
    </div>
  );
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  state,
  setState,
  updateCurrentProject,
  tokenCount,
  setTokenCount,
  maxTokens
}) => {
  const [totalSelectedFiles, setTotalSelectedFiles] = useState(0);
  const [totalSelectedLines, setTotalSelectedLines] = useState(0);

  useEffect(() => {
    console.log("AnalysisResult: state changed", state);
    console.log("Files:", state.analysisResult?.files);
    console.log("Selected Files:", state.selectedFiles);

    if (state.analysisResult) {
      const selectedFileData = state.analysisResult.files.filter(file => state.selectedFiles.includes(file.path));
      console.log("Selected file data:", selectedFileData);
      setTotalSelectedFiles(selectedFileData.length);
      setTotalSelectedLines(selectedFileData.reduce((sum, file) => sum + file.lines, 0));
    }
  }, [state]);

  const handleSetSelectedFiles = useCallback((filesOrUpdater: string[] | ((prev: string[]) => string[])) => {
    setState(prevState => {
      const newSelectedFiles = typeof filesOrUpdater === 'function' 
        ? filesOrUpdater(prevState.selectedFiles) 
        : filesOrUpdater;
      
      console.log("Updating selected files:", newSelectedFiles);
      
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
      navigator.clipboard.writeText(getSelectedFileTree(state.analysisResult.files, state.selectedFiles));
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
        const linePrefix = prefix + (isLast ? '└── ' : '├── ');
        const icon = node.type === 'file' ? <File className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
        const sizeInfo = node.size ? ` (${formatFileSize(node.size)})` : '';
        
        result += `${linePrefix}${icon} ${node.name}${sizeInfo}\n`;

        if (node.children) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          result += buildTreeString(node.children, newPrefix);
        }
      });

      return result;
    };

    return buildTreeString(tree);
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Selected Files:</span>
                <span className="font-medium">{totalSelectedFiles}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Lines:</span>
                <span className="font-medium">{totalSelectedLines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Token Usage:</span>
                <span className="font-medium">{tokenCount} / {maxTokens}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 mt-1">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min((tokenCount / maxTokens) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Project Tree</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-[400px]">
              {state.analysisResult ? (
                state.selectedFiles.length > 0 ? (
                  <ProjectTree
                    files={state.analysisResult.files.filter(file => 
                      state.selectedFiles.includes(file.path)
                    )}
                  />
                ) : (
                  <span className="text-gray-500">No files selected</span>
                )
              ) : (
                <span className="text-gray-500">No project loaded</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3">
        {state.analysisResult && (
          <FileSelector
            files={state.analysisResult.files}
            selectedFiles={state.selectedFiles}
            setSelectedFiles={handleSetSelectedFiles}
            maxTokens={maxTokens}
            onTokenCountChange={setTokenCount}
          />
        )}
      </div>
    </div>
  );
};

export default AnalysisResult;