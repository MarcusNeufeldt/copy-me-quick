import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookMarked, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PresetManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFiles: string[];
  onApplyPreset: (files: string[]) => void;
  currentProjectId?: string | null;
}

// Async localStorage helpers for presets
const getSelectionsForProject = async (projectId?: string | null): Promise<{ [name: string]: string[] }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        const key = projectId ? `presets_${projectId}` : 'codebaseReaderSelections';
        const stored = localStorage.getItem(key);
        resolve(stored ? JSON.parse(stored) : {});
      } catch (e) {
        console.error("Failed to read selections from storage", e);
        resolve({});
      }
    }, 0);
  });
};

const saveSelectionsForProject = async (projectId: string | null, selections: { [name: string]: string[] }) => {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      try {
        const key = projectId ? `presets_${projectId}` : 'codebaseReaderSelections';
        localStorage.setItem(key, JSON.stringify(selections));
        resolve();
      } catch (e) {
        console.error("Failed to save selections to storage", e);
        resolve(); // Still resolve so the app doesn't hang
      }
    }, 0);
  });
};

const PresetManager: React.FC<PresetManagerProps> = ({
  isOpen,
  onOpenChange,
  selectedFiles,
  onApplyPreset,
  currentProjectId
}) => {
  const [savedSelections, setSavedSelections] = useState<{ [name: string]: string[] }>({});
  const [newPresetName, setNewPresetName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load presets when dialog opens or project changes
  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen, currentProjectId]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const presets = await getSelectionsForProject(currentProjectId || null);
      setSavedSelections(presets);
    } catch (error) {
      console.error('Failed to load presets:', error);
      toast.error('Failed to load presets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrentSelection = async () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a name for the preset.");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("No files selected to save.");
      return;
    }

    const trimmedName = newPresetName.trim();
    
    // Check for existing preset and confirm overwrite
    if (savedSelections[trimmedName]) {
      if (!confirm(`A preset named "${trimmedName}" already exists. Overwrite it?`)) {
        return;
      }
    }

    setIsLoading(true);
    try {
      const newPreset = { [trimmedName]: selectedFiles };
      const updatedSelections = { ...savedSelections, ...newPreset };

      await saveSelectionsForProject(currentProjectId, updatedSelections);
      setSavedSelections(updatedSelections);
      setNewPresetName('');
      toast.success(`Preset "${trimmedName}" saved.`);
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error('Failed to save preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePreset = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the preset "${name}"?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const updatedSelections = { ...savedSelections };
      delete updatedSelections[name];

      await saveSelectionsForProject(currentProjectId, updatedSelections);
      setSavedSelections(updatedSelections);
      toast.success(`Preset "${name}" deleted.`);
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error('Failed to delete preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (files: string[]) => {
    onApplyPreset(files);
    onOpenChange(false);
    toast.success("Preset loaded.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveCurrentSelection();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Presets</DialogTitle>
          <DialogDescription>
            {currentProjectId 
              ? `Save and load file selection presets for this project`
              : 'Save and load file selection presets'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Save Current Selection */}
          <div className="space-y-2">
            <Label htmlFor="preset-name">Save Current Selection</Label>
            <div className="flex gap-2">
              <Input
                id="preset-name"
                placeholder="Enter preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <Button
                onClick={handleSaveCurrentSelection}
                disabled={selectedFiles.length === 0 || isLoading || !newPresetName.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            {selectedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Load Presets */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Loading presets...</span>
            </div>
          ) : Object.keys(savedSelections).length > 0 ? (
            <div className="space-y-2">
              <Label>Load Preset</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {Object.entries(savedSelections).map(([name, files]) => (
                  <div key={name} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-muted-foreground">{files.length} files</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyPreset(files)}
                        disabled={isLoading}
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePreset(name)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <BookMarked className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No saved presets</p>
              <p className="text-xs">Save your first preset above</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PresetManager;