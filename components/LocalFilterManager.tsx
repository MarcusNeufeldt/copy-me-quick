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
import { FolderX, FileType, X } from 'lucide-react';

interface LocalFilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExclusions: string;
  currentFileTypes: string;
  onSave: (newExclusions: string, newFileTypes: string) => void;
}

const commonFolderExclusions = [
  { id: 'node_modules', label: 'node_modules', category: 'dependencies' },
  { id: '.git', label: '.git', category: 'vcs' },
  { id: '.svn', label: '.svn', category: 'vcs' },
  { id: 'dist', label: 'dist', category: 'build' },
  { id: 'build', label: 'build', category: 'build' },
  { id: 'out', label: 'out', category: 'build' },
  { id: '.next', label: '.next', category: 'build' },
  { id: '.nuxt', label: '.nuxt', category: 'build' },
  { id: 'target', label: 'target', category: 'build' },
  { id: 'bin', label: 'bin', category: 'build' },
  { id: 'obj', label: 'obj', category: 'build' },
  { id: '__pycache__', label: '__pycache__', category: 'build' },
  { id: '.vscode', label: '.vscode', category: 'ide' },
  { id: '.idea', label: '.idea', category: 'ide' },
  { id: '.DS_Store', label: '.DS_Store', category: 'system' },
  { id: 'Thumbs.db', label: 'Thumbs.db', category: 'system' },
  { id: '*.log', label: '*.log', category: 'system' },
  { id: '*.tmp', label: '*.tmp', category: 'system' },
  { id: '*.temp', label: '*.temp', category: 'system' },
  { id: 'coverage', label: 'coverage', category: 'testing' },
  { id: '.nyc_output', label: '.nyc_output', category: 'testing' },
  { id: 'venv', label: 'venv', category: 'dependencies' },
  { id: '.venv', label: '.venv', category: 'dependencies' },
  { id: 'vendor', label: 'vendor', category: 'dependencies' },
];

const folderCategories = [
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'build', label: 'Build Output' },
  { id: 'vcs', label: 'Version Control' },
  { id: 'ide', label: 'IDE Files' },
  { id: 'system', label: 'System Files' },
  { id: 'testing', label: 'Test Coverage' },
];

const commonFileTypes = [
  { id: '.js', label: 'JavaScript (.js)', category: 'javascript' },
  { id: '.jsx', label: 'React JSX (.jsx)', category: 'javascript' },
  { id: '.ts', label: 'TypeScript (.ts)', category: 'javascript' },
  { id: '.tsx', label: 'React TSX (.tsx)', category: 'javascript' },
  { id: '.mjs', label: 'ES Module (.mjs)', category: 'javascript' },
  { id: '.cjs', label: 'CommonJS (.cjs)', category: 'javascript' },
  { id: '.vue', label: 'Vue (.vue)', category: 'javascript' },
  { id: '.svelte', label: 'Svelte (.svelte)', category: 'javascript' },
  { id: '.py', label: 'Python (.py)', category: 'backend' },
  { id: '.java', label: 'Java (.java)', category: 'backend' },
  { id: '.cs', label: 'C# (.cs)', category: 'backend' },
  { id: '.go', label: 'Go (.go)', category: 'backend' },
  { id: '.rs', label: 'Rust (.rs)', category: 'backend' },
  { id: '.rb', label: 'Ruby (.rb)', category: 'backend' },
  { id: '.php', label: 'PHP (.php)', category: 'backend' },
  { id: '.cpp', label: 'C++ (.cpp)', category: 'backend' },
  { id: '.c', label: 'C (.c)', category: 'backend' },
  { id: '.html', label: 'HTML (.html)', category: 'web' },
  { id: '.css', label: 'CSS (.css)', category: 'web' },
  { id: '.scss', label: 'SCSS (.scss)', category: 'web' },
  { id: '.sass', label: 'Sass (.sass)', category: 'web' },
  { id: '.less', label: 'Less (.less)', category: 'web' },
  { id: '.json', label: 'JSON (.json)', category: 'data' },
  { id: '.yaml', label: 'YAML (.yaml)', category: 'data' },
  { id: '.yml', label: 'YML (.yml)', category: 'data' },
  { id: '.xml', label: 'XML (.xml)', category: 'data' },
  { id: '.toml', label: 'TOML (.toml)', category: 'data' },
  { id: '.md', label: 'Markdown (.md)', category: 'docs' },
  { id: '.txt', label: 'Text (.txt)', category: 'docs' },
  { id: '.sql', label: 'SQL (.sql)', category: 'data' },
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
  { id: 'docs', label: 'Documentation' },
  { id: 'scripts', label: 'Scripts' },
];

const LocalFilterManager: React.FC<LocalFilterManagerProps> = ({
  isOpen,
  onClose,
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
        const common = commonFolderExclusions.find(c => c.id === item);
        if (common) {
          newSelectedExclusions.add(common.id);
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
        const common = commonFileTypes.find(c => c.id === item);
        if (common) {
          newSelectedFileTypes.add(common.id);
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

  const handleSelectAllExclusionsInCategory = (categoryId: string, select: boolean) => {
    const newSet = new Set(selectedExclusions);
    commonFolderExclusions
      .filter(e => e.category === categoryId)
      .forEach(e => {
        if (select) {
          newSet.add(e.id);
        } else {
          newSet.delete(e.id);
        }
      });
    setSelectedExclusions(newSet);
  };

  const handleSelectAllFileTypesInCategory = (categoryId: string, select: boolean) => {
    const newSet = new Set(selectedFileTypes);
    commonFileTypes
      .filter(e => e.category === categoryId)
      .forEach(e => {
        if (select) {
          newSet.add(e.id);
        } else {
          newSet.delete(e.id);
        }
      });
    setSelectedFileTypes(newSet);
  };

  const isCategoryFullySelected = (
    categoryId: string,
    items: typeof commonFolderExclusions | typeof commonFileTypes,
    selected: Set<string>
  ) => {
    const categoryItems = items.filter(e => e.category === categoryId);
    return categoryItems.every(item => selected.has(item.id));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderX className="h-5 w-5" />
            Local File Filters
          </SheetTitle>
          <SheetDescription>
            Configure which folders to exclude and which file types to include when processing local files.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="exclusions" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="exclusions" className="text-xs">
              <FolderX className="h-3 w-3 mr-1" />
              Excluded Folders
            </TabsTrigger>
            <TabsTrigger value="filetypes" className="text-xs">
              <FileType className="h-3 w-3 mr-1" />
              File Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exclusions" className="mt-4">
            <ScrollArea className="h-[calc(100vh-320px)] pr-4">
              <div className="space-y-4">
                {folderCategories.map(category => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">{category.label}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleSelectAllExclusionsInCategory(
                          category.id,
                          !isCategoryFullySelected(category.id, commonFolderExclusions, selectedExclusions)
                        )}
                      >
                        {isCategoryFullySelected(category.id, commonFolderExclusions, selectedExclusions) ? 'Clear' : 'All'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {commonFolderExclusions
                        .filter(e => e.category === category.id)
                        .map(exclusion => (
                          <div key={exclusion.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`exclusion-${exclusion.id}`}
                              checked={selectedExclusions.has(exclusion.id)}
                              onCheckedChange={(checked) => handleExclusionToggle(exclusion.id, !!checked)}
                            />
                            <label
                              htmlFor={`exclusion-${exclusion.id}`}
                              className="text-xs font-medium leading-none cursor-pointer truncate"
                              title={exclusion.label}
                            >
                              {exclusion.label}
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom-exclusions" className="text-xs font-semibold">
                    Custom Exclusions
                  </Label>
                  <Input
                    id="custom-exclusions"
                    placeholder="e.g., temp/, *.bak, backup"
                    value={customExclusions}
                    onChange={(e) => setCustomExclusions(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {selectedExclusions.size > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Excluded ({selectedExclusions.size})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedExclusions).slice(0, 10).map(id => (
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
                      {selectedExclusions.size > 10 && (
                        <span className="text-xs text-muted-foreground">
                          +{selectedExclusions.size - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="filetypes" className="mt-4">
            <ScrollArea className="h-[calc(100vh-320px)] pr-4">
              <div className="space-y-4">
                {fileTypeCategories.map(category => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">{category.label}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleSelectAllFileTypesInCategory(
                          category.id,
                          !isCategoryFullySelected(category.id, commonFileTypes, selectedFileTypes)
                        )}
                      >
                        {isCategoryFullySelected(category.id, commonFileTypes, selectedFileTypes) ? 'Clear' : 'All'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {commonFileTypes
                        .filter(e => e.category === category.id)
                        .map(fileType => (
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
                ))}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom-filetypes" className="text-xs font-semibold">
                    Custom File Types
                  </Label>
                  <Input
                    id="custom-filetypes"
                    placeholder="e.g., .env, .config, .prisma"
                    value={customFileTypes}
                    onChange={(e) => setCustomFileTypes(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {selectedFileTypes.size > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Included ({selectedFileTypes.size})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedFileTypes).slice(0, 12).map(id => (
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
                      {selectedFileTypes.size > 12 && (
                        <span className="text-xs text-muted-foreground">
                          +{selectedFileTypes.size - 12} more
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

export default LocalFilterManager;
