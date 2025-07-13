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

interface LocalFilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExclusions: string;
  currentFileTypes: string;
  onSave: (newExclusions: string, newFileTypes: string) => void;
}

const commonExclusions = [
  { id: 'node_modules', label: 'node_modules' },
  { id: '.git', label: '.git' },
  { id: 'dist', label: 'dist' },
  { id: 'build', label: 'build' },
  { id: 'out', label: 'out' },
  { id: 'target', label: 'target' },
  { id: 'bin', label: 'bin' },
  { id: 'obj', label: 'obj' },
  { id: '.vscode', label: '.vscode' },
  { id: '.idea', label: '.idea' },
  { id: '.DS_Store', label: '.DS_Store' },
  { id: 'Thumbs.db', label: 'Thumbs.db' },
  { id: '*.log', label: 'Log files (*.log)' },
  { id: '*.tmp', label: 'Temporary files (*.tmp)' },
  { id: '*.temp', label: 'Temp files (*.temp)' },
  { id: 'coverage', label: 'coverage' },
];

const commonFileTypes = [
  { id: '.js', label: 'JavaScript (.js)' },
  { id: '.jsx', label: 'React JSX (.jsx)' },
  { id: '.ts', label: 'TypeScript (.ts)' },
  { id: '.tsx', label: 'React TSX (.tsx)' },
  { id: '.py', label: 'Python (.py)' },
  { id: '.java', label: 'Java (.java)' },
  { id: '.cs', label: 'C# (.cs)' },
  { id: '.cpp', label: 'C++ (.cpp)' },
  { id: '.c', label: 'C (.c)' },
  { id: '.php', label: 'PHP (.php)' },
  { id: '.rb', label: 'Ruby (.rb)' },
  { id: '.go', label: 'Go (.go)' },
  { id: '.rs', label: 'Rust (.rs)' },
  { id: '.swift', label: 'Swift (.swift)' },
  { id: '.kt', label: 'Kotlin (.kt)' },
  { id: '.vue', label: 'Vue (.vue)' },
  { id: '.svelte', label: 'Svelte (.svelte)' },
  { id: '.html', label: 'HTML (.html)' },
  { id: '.css', label: 'CSS (.css)' },
  { id: '.scss', label: 'SCSS (.scss)' },
  { id: '.sass', label: 'Sass (.sass)' },
  { id: '.less', label: 'Less (.less)' },
  { id: '.json', label: 'JSON (.json)' },
  { id: '.xml', label: 'XML (.xml)' },
  { id: '.yaml', label: 'YAML (.yaml)' },
  { id: '.yml', label: 'YML (.yml)' },
  { id: '.md', label: 'Markdown (.md)' },
  { id: '.txt', label: 'Text (.txt)' },
  { id: '.sql', label: 'SQL (.sql)' },
  { id: '.sh', label: 'Shell scripts (.sh)' },
  { id: '.bat', label: 'Batch files (.bat)' },
  { id: '.ps1', label: 'PowerShell (.ps1)' },
];

const LocalFilterManager: React.FC<LocalFilterManagerProps> = ({
  isOpen,
  onClose,
  currentExclusions,
  currentFileTypes,
  onSave,
}) => {
  const [customExclusions, setCustomExclusions] = useState('');
  const [selectedCommonExclusions, setSelectedCommonExclusions] = useState<Set<string>>(new Set());
  const [customFileTypes, setCustomFileTypes] = useState('');
  const [selectedCommonFileTypes, setSelectedCommonFileTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      // Parse exclusions
      const exclusionsArray = currentExclusions.split(',').map(item => item.trim()).filter(Boolean);
      const newSelectedCommonExclusions = new Set<string>();
      const customExclusionItems: string[] = [];

      exclusionsArray.forEach(item => {
        const common = commonExclusions.find(c => c.id === item);
        if (common) {
          newSelectedCommonExclusions.add(common.id);
        } else {
          customExclusionItems.push(item);
        }
      });
      
      setSelectedCommonExclusions(newSelectedCommonExclusions);
      setCustomExclusions(customExclusionItems.join(', '));

      // Parse file types
      const fileTypesArray = currentFileTypes.split(',').map(item => item.trim()).filter(Boolean);
      const newSelectedCommonFileTypes = new Set<string>();
      const customFileTypeItems: string[] = [];

      fileTypesArray.forEach(item => {
        const common = commonFileTypes.find(c => c.id === item);
        if (common) {
          newSelectedCommonFileTypes.add(common.id);
        } else {
          customFileTypeItems.push(item);
        }
      });
      
      setSelectedCommonFileTypes(newSelectedCommonFileTypes);
      setCustomFileTypes(customFileTypeItems.join(', '));
    }
  }, [isOpen, currentExclusions, currentFileTypes]);

  const handleSave = () => {
    const finalExclusions = [
      ...Array.from(selectedCommonExclusions),
      ...customExclusions.split(',').map(item => item.trim()).filter(Boolean)
    ];

    const finalFileTypes = [
      ...Array.from(selectedCommonFileTypes),
      ...customFileTypes.split(',').map(item => item.trim()).filter(Boolean)
    ];

    onSave(
      Array.from(new Set(finalExclusions)).join(','),
      Array.from(new Set(finalFileTypes)).join(',')
    );
    onClose();
  };
  
  const handleCommonExclusionToggle = (id: string, checked: boolean) => {
    const newSet = new Set(selectedCommonExclusions);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedCommonExclusions(newSet);
  };

  const handleCommonFileTypeToggle = (id: string, checked: boolean) => {
    const newSet = new Set(selectedCommonFileTypes);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedCommonFileTypes(newSet);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter Local Files</SheetTitle>
          <SheetDescription>
            Configure which files and folders to exclude, and which file types to include when working with local projects.
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-6 py-4">
          {/* Exclude Folders Section */}
          <div>
            <Label className="text-base font-semibold">Exclude Folders & Files</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select common items to exclude from your local projects.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {commonExclusions.map(exclusion => (
                <div key={exclusion.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`exclusion-${exclusion.id}`}
                    checked={selectedCommonExclusions.has(exclusion.id)}
                    onCheckedChange={(checked) => handleCommonExclusionToggle(exclusion.id, !!checked)}
                  />
                  <label
                    htmlFor={`exclusion-${exclusion.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {exclusion.label}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="mt-3">
              <Label htmlFor="custom-exclusions" className="text-sm font-medium">
                Custom Exclusions
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add custom file/folder names or patterns, separated by commas.
              </p>
              <Input
                id="custom-exclusions"
                placeholder="e.g., my-custom-folder, *.backup, temp-*"
                value={customExclusions}
                onChange={(e) => setCustomExclusions(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Include File Types Section */}
          <div>
            <Label className="text-base font-semibold">Include File Types</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select which file types to include in your analysis.
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-md p-3">
              {commonFileTypes.map(fileType => (
                <div key={fileType.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filetype-${fileType.id}`}
                    checked={selectedCommonFileTypes.has(fileType.id)}
                    onCheckedChange={(checked) => handleCommonFileTypeToggle(fileType.id, !!checked)}
                  />
                  <label
                    htmlFor={`filetype-${fileType.id}`}
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {fileType.label}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="mt-3">
              <Label htmlFor="custom-file-types" className="text-sm font-medium">
                Custom File Types
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add custom file extensions, separated by commas.
              </p>
              <Input
                id="custom-file-types"
                placeholder="e.g., .config, .env, .custom"
                value={customFileTypes}
                onChange={(e) => setCustomFileTypes(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" onClick={handleSave}>Save and Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default LocalFilterManager; 