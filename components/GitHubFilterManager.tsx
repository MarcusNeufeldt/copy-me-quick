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

interface GitHubFilterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExclusions: string;
  onSave: (newExclusions: string) => void;
}

const commonExclusions = [
  { id: 'package-lock.json', label: 'package-lock.json' },
  { id: 'yarn.lock', label: 'yarn.lock' },
  { id: 'pnpm-lock.yaml', label: 'pnpm-lock.yaml' },
  { id: '.gitignore', label: '.gitignore files' },
  { id: '*.md', label: 'Markdown files (*.md)' },
  { id: '*.svg', label: 'SVG images (*.svg)' },
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
        const common = commonExclusions.find(c => c.id === item);
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
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter GitHub Files</SheetTitle>
          <SheetDescription>
            Choose files and patterns to exclude from the file tree. This helps remove noise like lockfiles and documentation.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-4">
          <div>
            <Label className="text-base font-semibold">Common Exclusions</Label>
            <div className="mt-2 space-y-2">
              {commonExclusions.map(exclusion => (
                <div key={exclusion.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`common-${exclusion.id}`}
                    checked={selectedCommon.has(exclusion.id)}
                    onCheckedChange={(checked) => handleCommonToggle(exclusion.id, !!checked)}
                  />
                  <label
                    htmlFor={`common-${exclusion.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {exclusion.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <Label htmlFor="custom-exclusions" className="text-base font-semibold">
              Custom Exclusions
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Add file/folder names or patterns, separated by commas.
            </p>
            <Input
              id="custom-exclusions"
              placeholder="e.g., dist, build, *.log, temp/"
              value={customExclusions}
              onChange={(e) => setCustomExclusions(e.target.value)}
            />
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

export default GitHubFilterManager;