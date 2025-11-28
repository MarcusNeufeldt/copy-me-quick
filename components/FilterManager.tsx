import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderX, FileType, X, Filter, Github, Computer } from 'lucide-react';

type FilterMode = 'local' | 'github';

interface FilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: FilterMode;
  currentExclusions: string;
  currentFileTypes: string;
  onSave: (exclusions: string, fileTypes: string) => void;
}

// Shared exclusion options (files to exclude)
const fileExclusions = [
  // Lock files
  { id: 'package-lock.json', label: 'package-lock.json', category: 'lockfiles' },
  { id: 'yarn.lock', label: 'yarn.lock', category: 'lockfiles' },
  { id: 'pnpm-lock.yaml', label: 'pnpm-lock.yaml', category: 'lockfiles' },
  { id: 'bun.lockb', label: 'bun.lockb', category: 'lockfiles' },
  { id: 'Cargo.lock', label: 'Cargo.lock', category: 'lockfiles' },
  { id: 'Gemfile.lock', label: 'Gemfile.lock', category: 'lockfiles' },
  { id: 'poetry.lock', label: 'poetry.lock', category: 'lockfiles' },
  { id: 'composer.lock', label: 'composer.lock', category: 'lockfiles' },
  // Documentation
  { id: '*.md', label: 'Markdown (*.md)', category: 'docs' },
  { id: 'README*', label: 'README files', category: 'docs' },
  { id: 'LICENSE*', label: 'LICENSE files', category: 'docs' },
  { id: 'CHANGELOG*', label: 'CHANGELOG files', category: 'docs' },
  // Assets
  { id: '*.svg', label: 'SVG (*.svg)', category: 'assets' },
  { id: '*.png', label: 'PNG (*.png)', category: 'assets' },
  { id: '*.jpg', label: 'JPG (*.jpg)', category: 'assets' },
  { id: '*.jpeg', label: 'JPEG (*.jpeg)', category: 'assets' },
  { id: '*.gif', label: 'GIF (*.gif)', category: 'assets' },
  { id: '*.ico', label: 'ICO (*.ico)', category: 'assets' },
  { id: '*.webp', label: 'WebP (*.webp)', category: 'assets' },
  // Config files
  { id: '.gitignore', label: '.gitignore', category: 'config' },
  { id: '.gitattributes', label: '.gitattributes', category: 'config' },
  { id: '.editorconfig', label: '.editorconfig', category: 'config' },
  { id: '.prettierrc*', label: '.prettierrc*', category: 'config' },
  { id: '.eslintrc*', label: '.eslintrc*', category: 'config' },
  { id: 'tsconfig*.json', label: 'tsconfig*.json', category: 'config' },
];

// Folder exclusions (primarily for local mode, but useful for both)
const folderExclusions = [
  // Dependencies
  { id: 'node_modules', label: 'node_modules', category: 'dependencies' },
  { id: 'venv', label: 'venv', category: 'dependencies' },
  { id: '.venv', label: '.venv', category: 'dependencies' },
  { id: 'vendor', label: 'vendor', category: 'dependencies' },
  // Build output
  { id: 'dist', label: 'dist', category: 'build' },
  { id: 'build', label: 'build', category: 'build' },
  { id: 'out', label: 'out', category: 'build' },
  { id: '.next', label: '.next', category: 'build' },
  { id: '.nuxt', label: '.nuxt', category: 'build' },
  { id: 'target', label: 'target', category: 'build' },
  { id: '__pycache__', label: '__pycache__', category: 'build' },
  // Version control
  { id: '.git', label: '.git', category: 'vcs' },
  { id: '.svn', label: '.svn', category: 'vcs' },
  // IDE
  { id: '.vscode', label: '.vscode', category: 'ide' },
  { id: '.idea', label: '.idea', category: 'ide' },
  // System
  { id: '.DS_Store', label: '.DS_Store', category: 'system' },
  { id: 'Thumbs.db', label: 'Thumbs.db', category: 'system' },
  { id: '*.log', label: '*.log', category: 'system' },
  // Testing
  { id: 'coverage', label: 'coverage', category: 'testing' },
  { id: '.nyc_output', label: '.nyc_output', category: 'testing' },
];

const exclusionCategories = [
  { id: 'lockfiles', label: 'Lock Files', type: 'file' },
  { id: 'docs', label: 'Documentation', type: 'file' },
  { id: 'assets', label: 'Assets & Images', type: 'file' },
  { id: 'config', label: 'Config Files', type: 'file' },
  { id: 'dependencies', label: 'Dependencies', type: 'folder' },
  { id: 'build', label: 'Build Output', type: 'folder' },
  { id: 'vcs', label: 'Version Control', type: 'folder' },
  { id: 'ide', label: 'IDE Files', type: 'folder' },
  { id: 'system', label: 'System Files', type: 'folder' },
  { id: 'testing', label: 'Test Coverage', type: 'folder' },
];

// File types to include
const fileTypes = [
  // JavaScript/TypeScript
  { id: '.js', label: 'JavaScript (.js)', category: 'javascript' },
  { id: '.jsx', label: 'React JSX (.jsx)', category: 'javascript' },
  { id: '.ts', label: 'TypeScript (.ts)', category: 'javascript' },
  { id: '.tsx', label: 'React TSX (.tsx)', category: 'javascript' },
  { id: '.mjs', label: 'ES Module (.mjs)', category: 'javascript' },
  { id: '.vue', label: 'Vue (.vue)', category: 'javascript' },
  { id: '.svelte', label: 'Svelte (.svelte)', category: 'javascript' },
  // Backend
  { id: '.py', label: 'Python (.py)', category: 'backend' },
  { id: '.java', label: 'Java (.java)', category: 'backend' },
  { id: '.cs', label: 'C# (.cs)', category: 'backend' },
  { id: '.go', label: 'Go (.go)', category: 'backend' },
  { id: '.rs', label: 'Rust (.rs)', category: 'backend' },
  { id: '.rb', label: 'Ruby (.rb)', category: 'backend' },
  { id: '.php', label: 'PHP (.php)', category: 'backend' },
  { id: '.cpp', label: 'C++ (.cpp)', category: 'backend' },
  { id: '.c', label: 'C (.c)', category: 'backend' },
  // Web
  { id: '.html', label: 'HTML (.html)', category: 'web' },
  { id: '.css', label: 'CSS (.css)', category: 'web' },
  { id: '.scss', label: 'SCSS (.scss)', category: 'web' },
  { id: '.sass', label: 'Sass (.sass)', category: 'web' },
  { id: '.less', label: 'Less (.less)', category: 'web' },
  // Data
  { id: '.json', label: 'JSON (.json)', category: 'data' },
  { id: '.yaml', label: 'YAML (.yaml)', category: 'data' },
  { id: '.yml', label: 'YML (.yml)', category: 'data' },
  { id: '.xml', label: 'XML (.xml)', category: 'data' },
  { id: '.toml', label: 'TOML (.toml)', category: 'data' },
  { id: '.sql', label: 'SQL (.sql)', category: 'data' },
  // Docs
  { id: '.md', label: 'Markdown (.md)', category: 'docfiles' },
  { id: '.txt', label: 'Text (.txt)', category: 'docfiles' },
  // Scripts
  { id: '.sh', label: 'Shell (.sh)', category: 'scripts' },
  { id: '.bash', label: 'Bash (.bash)', category: 'scripts' },
  { id: '.ps1', label: 'PowerShell (.ps1)', category: 'scripts' },
  { id: '.bat', label: 'Batch (.bat)', category: 'scripts' },
];

const fileTypeCategories = [
  { id: 'javascript', label: 'JavaScript/TypeScript' },
  { id: 'backend', label: 'Backend Languages' },
  { id: 'web', label: 'Web (HTML/CSS)' },
  { id: 'data', label: 'Data Files' },
  { id: 'docfiles', label: 'Documentation' },
  { id: 'scripts', label: 'Scripts' },
];

// All exclusions combined
const allExclusions = [...fileExclusions, ...folderExclusions];

const FilterManager: React.FC<FilterManagerProps> = ({
  isOpen,
  onClose,
  mode,
  currentExclusions,
  currentFileTypes,
  onSave,
}) => {
  const [customExclusions, setCustomExclusions] = useState('');
  const [selectedExclusions, setSelectedExclusions] = useState<Set<string>>(new Set());
  const [customFileTypes, setCustomFileTypes] = useState('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      // Parse exclusions
      const exclusionsArray = currentExclusions.split(',').map(item => item.trim()).filter(Boolean);
      const newSelectedExclusions = new Set<string>();
      const customExclusionItems: string[] = [];

      exclusionsArray.forEach(item => {
        const found = allExclusions.find(e => e.id === item);
        if (found) {
          newSelectedExclusions.add(found.id);
        } else {
          customExclusionItems.push(item);
        }
      });

      setSelectedExclusions(newSelectedExclusions);
      setCustomExclusions(customExclusionItems.join(', '));

      // Parse file types
      const fileTypesArray = currentFileTypes.split(',').map(item => item.trim()).filter(Boolean);
      const newSelectedFileTypes = new Set<string>();
      const customFileTypeItems: string[] = [];

      fileTypesArray.forEach(item => {
        const found = fileTypes.find(ft => ft.id === item);
        if (found) {
          newSelectedFileTypes.add(found.id);
        } else {
          customFileTypeItems.push(item);
        }
      });

      setSelectedFileTypes(newSelectedFileTypes);
      setCustomFileTypes(customFileTypeItems.join(', '));
    }
  }, [isOpen, currentExclusions, currentFileTypes]);

  const handleSave = () => {
    const finalExclusions = [
      ...Array.from(selectedExclusions),
      ...customExclusions.split(',').map(item => item.trim()).filter(Boolean)
    ];

    const finalFileTypes = [
      ...Array.from(selectedFileTypes),
      ...customFileTypes.split(',').map(item => item.trim()).filter(Boolean)
    ];

    onSave(
      Array.from(new Set(finalExclusions)).join(','),
      Array.from(new Set(finalFileTypes)).join(',')
    );
    onClose();
  };

  const handleExclusionToggle = (id: string, checked: boolean) => {
    const newSet = new Set(selectedExclusions);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedExclusions(newSet);
  };

  const handleFileTypeToggle = (id: string, checked: boolean) => {
    const newSet = new Set(selectedFileTypes);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedFileTypes(newSet);
  };

  const handleSelectAllInCategory = (
    categoryId: string,
    items: typeof allExclusions | typeof fileTypes,
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    select: boolean
  ) => {
    const newSet = new Set(selected);
    items
      .filter(e => e.category === categoryId)
      .forEach(e => {
        if (select) {
          newSet.add(e.id);
        } else {
          newSet.delete(e.id);
        }
      });
    setSelected(newSet);
  };

  const isCategoryFullySelected = (
    categoryId: string,
    items: typeof allExclusions | typeof fileTypes,
    selected: Set<string>
  ) => {
    const categoryItems = items.filter(e => e.category === categoryId);
    return categoryItems.length > 0 && categoryItems.every(item => selected.has(item.id));
  };

  // Get relevant exclusion categories based on mode
  const getExclusionCategories = () => {
    if (mode === 'github') {
      // GitHub: prioritize file exclusions, but also show folder exclusions
      return exclusionCategories;
    }
    // Local: show folder exclusions first, then file exclusions
    return [
      ...exclusionCategories.filter(c => c.type === 'folder'),
      ...exclusionCategories.filter(c => c.type === 'file'),
    ];
  };

  const ModeIcon = mode === 'github' ? Github : Computer;
  const modeLabel = mode === 'github' ? 'GitHub' : 'Local';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:w-[560px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ModeIcon className="h-5 w-5" />
            {modeLabel} Filter Settings
          </SheetTitle>
          <SheetDescription>
            Configure which files to exclude and which file types to include.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="exclusions" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="exclusions" className="text-xs">
              <FolderX className="h-3.5 w-3.5 mr-1.5" />
              Exclusions
            </TabsTrigger>
            <TabsTrigger value="filetypes" className="text-xs">
              <FileType className="h-3.5 w-3.5 mr-1.5" />
              File Types
            </TabsTrigger>
          </TabsList>

          {/* Exclusions Tab */}
          <TabsContent value="exclusions" className="mt-4">
            <ScrollArea className="h-[calc(100vh-300px)] pr-4">
              <div className="space-y-4">
                {getExclusionCategories().map(category => {
                  const categoryItems = allExclusions.filter(e => e.category === category.id);
                  if (categoryItems.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          {category.type === 'folder' ? (
                            <FolderX className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Filter className="h-3 w-3 text-muted-foreground" />
                          )}
                          {category.label}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => handleSelectAllInCategory(
                            category.id,
                            allExclusions,
                            selectedExclusions,
                            setSelectedExclusions,
                            !isCategoryFullySelected(category.id, allExclusions, selectedExclusions)
                          )}
                        >
                          {isCategoryFullySelected(category.id, allExclusions, selectedExclusions) ? 'Clear' : 'All'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {categoryItems.map(item => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`exclusion-${item.id}`}
                              checked={selectedExclusions.has(item.id)}
                              onCheckedChange={(checked) => handleExclusionToggle(item.id, !!checked)}
                            />
                            <label
                              htmlFor={`exclusion-${item.id}`}
                              className="text-xs font-medium leading-none cursor-pointer truncate"
                              title={item.label}
                            >
                              {item.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom-exclusions" className="text-xs font-semibold">
                    Custom Exclusions
                  </Label>
                  <Input
                    id="custom-exclusions"
                    placeholder="e.g., temp/, *.bak, __tests__"
                    value={customExclusions}
                    onChange={(e) => setCustomExclusions(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {selectedExclusions.size > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Active Exclusions ({selectedExclusions.size})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedExclusions).slice(0, 8).map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-destructive/10 text-destructive rounded"
                        >
                          {id}
                          <button onClick={() => handleExclusionToggle(id, false)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {selectedExclusions.size > 8 && (
                        <span className="text-xs text-muted-foreground">
                          +{selectedExclusions.size - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* File Types Tab */}
          <TabsContent value="filetypes" className="mt-4">
            <ScrollArea className="h-[calc(100vh-300px)] pr-4">
              <div className="space-y-4">
                {fileTypeCategories.map(category => {
                  const categoryItems = fileTypes.filter(ft => ft.category === category.id);
                  if (categoryItems.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">{category.label}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => handleSelectAllInCategory(
                            category.id,
                            fileTypes,
                            selectedFileTypes,
                            setSelectedFileTypes,
                            !isCategoryFullySelected(category.id, fileTypes, selectedFileTypes)
                          )}
                        >
                          {isCategoryFullySelected(category.id, fileTypes, selectedFileTypes) ? 'Clear' : 'All'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {categoryItems.map(fileType => (
                          <div key={fileType.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`filetype-${fileType.id}`}
                              checked={selectedFileTypes.has(fileType.id)}
                              onCheckedChange={(checked) => handleFileTypeToggle(fileType.id, !!checked)}
                            />
                            <label
                              htmlFor={`filetype-${fileType.id}`}
                              className="text-xs font-medium leading-none cursor-pointer truncate"
                              title={fileType.label}
                            >
                              {fileType.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom-filetypes" className="text-xs font-semibold">
                    Custom File Types
                  </Label>
                  <Input
                    id="custom-filetypes"
                    placeholder="e.g., .env, .prisma, .graphql"
                    value={customFileTypes}
                    onChange={(e) => setCustomFileTypes(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {selectedFileTypes.size > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Included Types ({selectedFileTypes.size})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedFileTypes).slice(0, 10).map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded"
                        >
                          {id}
                          <button onClick={() => handleFileTypeToggle(id, false)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {selectedFileTypes.size > 10 && (
                        <span className="text-xs text-muted-foreground">
                          +{selectedFileTypes.size - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default FilterManager;
