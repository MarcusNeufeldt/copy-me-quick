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
import { Filter, X } from 'lucide-react';

interface GitHubFilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExclusions: string;
  onSave: (newExclusions: string) => void;
}

const commonGitHubExclusions = [
  { id: 'package-lock.json', label: 'package-lock.json', category: 'lockfiles' },
  { id: 'yarn.lock', label: 'yarn.lock', category: 'lockfiles' },
  { id: 'pnpm-lock.yaml', label: 'pnpm-lock.yaml', category: 'lockfiles' },
  { id: 'bun.lockb', label: 'bun.lockb', category: 'lockfiles' },
  { id: 'Cargo.lock', label: 'Cargo.lock', category: 'lockfiles' },
  { id: 'Gemfile.lock', label: 'Gemfile.lock', category: 'lockfiles' },
  { id: 'poetry.lock', label: 'poetry.lock', category: 'lockfiles' },
  { id: 'composer.lock', label: 'composer.lock', category: 'lockfiles' },
  { id: '*.md', label: 'Markdown files (*.md)', category: 'docs' },
  { id: 'README*', label: 'README files', category: 'docs' },
  { id: 'LICENSE*', label: 'LICENSE files', category: 'docs' },
  { id: 'CHANGELOG*', label: 'CHANGELOG files', category: 'docs' },
  { id: '*.svg', label: 'SVG images (*.svg)', category: 'assets' },
  { id: '*.png', label: 'PNG images (*.png)', category: 'assets' },
  { id: '*.jpg', label: 'JPG images (*.jpg)', category: 'assets' },
  { id: '*.ico', label: 'Icon files (*.ico)', category: 'assets' },
  { id: '.gitignore', label: '.gitignore', category: 'config' },
  { id: '.gitattributes', label: '.gitattributes', category: 'config' },
  { id: '.editorconfig', label: '.editorconfig', category: 'config' },
  { id: '.prettierrc*', label: '.prettierrc files', category: 'config' },
  { id: '.eslintrc*', label: '.eslintrc files', category: 'config' },
  { id: 'tsconfig*.json', label: 'TypeScript config files', category: 'config' },
];

const categories = [
  { id: 'lockfiles', label: 'Lock Files' },
  { id: 'docs', label: 'Documentation' },
  { id: 'assets', label: 'Assets & Images' },
  { id: 'config', label: 'Config Files' },
];

const GitHubFilterManager: React.FC<GitHubFilterManagerProps> = ({
  isOpen,
  onClose,
  currentExclusions,
  onSave,
}) => {
  const [customExclusions, setCustomExclusions] = useState('');
  const [selectedCommon, setSelectedCommon] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      const exclusionsArray = currentExclusions.split(',').map(item => item.trim()).filter(Boolean);
      const newSelectedCommon = new Set<string>();
      const customItems: string[] = [];

      exclusionsArray.forEach(item => {
        const common = commonGitHubExclusions.find(c => c.id === item);
        if (common) {
          newSelectedCommon.add(common.id);
        } else {
          customItems.push(item);
        }
      });

      setSelectedCommon(newSelectedCommon);
      setCustomExclusions(customItems.join(', '));
    }
  }, [isOpen, currentExclusions]);

  const handleSave = () => {
    const finalExclusions = [
      ...Array.from(selectedCommon),
      ...customExclusions.split(',').map(item => item.trim()).filter(Boolean)
    ];
    onSave(Array.from(new Set(finalExclusions)).join(','));
    onClose();
  };

  const handleCommonToggle = (id: string, checked: boolean) => {
    const newSet = new Set(selectedCommon);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedCommon(newSet);
  };

  const handleSelectAllInCategory = (categoryId: string, select: boolean) => {
    const newSet = new Set(selectedCommon);
    commonGitHubExclusions
      .filter(e => e.category === categoryId)
      .forEach(e => {
        if (select) {
          newSet.add(e.id);
        } else {
          newSet.delete(e.id);
        }
      });
    setSelectedCommon(newSet);
  };

  const isCategoryFullySelected = (categoryId: string) => {
    const categoryItems = commonGitHubExclusions.filter(e => e.category === categoryId);
    return categoryItems.every(item => selectedCommon.has(item.id));
  };

  const isCategoryPartiallySelected = (categoryId: string) => {
    const categoryItems = commonGitHubExclusions.filter(e => e.category === categoryId);
    const selectedCount = categoryItems.filter(item => selectedCommon.has(item.id)).length;
    return selectedCount > 0 && selectedCount < categoryItems.length;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter GitHub Files
          </SheetTitle>
          <SheetDescription>
            Choose files and patterns to exclude from the repository view. This helps reduce noise from lock files, documentation, and assets.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-220px)] mt-4 pr-4">
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{category.label}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSelectAllInCategory(
                      category.id,
                      !isCategoryFullySelected(category.id)
                    )}
                  >
                    {isCategoryFullySelected(category.id) ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {commonGitHubExclusions
                    .filter(e => e.category === category.id)
                    .map(exclusion => (
                      <div key={exclusion.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`github-${exclusion.id}`}
                          checked={selectedCommon.has(exclusion.id)}
                          onCheckedChange={(checked) => handleCommonToggle(exclusion.id, !!checked)}
                        />
                        <label
                          htmlFor={`github-${exclusion.id}`}
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
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
              <Label htmlFor="github-custom-exclusions" className="text-sm font-semibold">
                Custom Exclusions
              </Label>
              <p className="text-xs text-muted-foreground">
                Add file/folder names or glob patterns, separated by commas.
              </p>
              <Input
                id="github-custom-exclusions"
                placeholder="e.g., *.test.js, __tests__, fixtures/"
                value={customExclusions}
                onChange={(e) => setCustomExclusions(e.target.value)}
                className="text-sm"
              />
            </div>

            {selectedCommon.size > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground">
                  Active Filters ({selectedCommon.size})
                </Label>
                <div className="flex flex-wrap gap-1">
                  {Array.from(selectedCommon).map(id => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-full"
                    >
                      {id}
                      <button
                        onClick={() => handleCommonToggle(id, false)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default GitHubFilterManager;
