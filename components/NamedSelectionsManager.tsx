import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NamedSelectionsManagerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  namedSelections: { [name: string]: string[] };
  onRenameSelection: (oldName: string, newName: string) => void;
  onDeleteSelection: (name: string) => void;
}

const NamedSelectionsManager: React.FC<NamedSelectionsManagerProps> = ({
  isOpen,
  onOpenChange,
  namedSelections,
  onRenameSelection,
  onDeleteSelection,
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newNameValue, setNewNameValue] = useState('');

  const handleStartRename = (name: string) => {
    setEditingName(name);
    setNewNameValue(name);
  };

  const handleCancelRename = () => {
    setEditingName(null);
    setNewNameValue('');
  };

  const handleConfirmRename = () => {
    if (!editingName || !newNameValue.trim() || newNameValue.trim() === editingName) {
      handleCancelRename();
      return;
    }
    const newName = newNameValue.trim();
    if (namedSelections[newName]) {
      toast.error(`A selection named "${newName}" already exists.`);
      return;
    }
    onRenameSelection(editingName, newName);
    toast.success(`Renamed selection "${editingName}" to "${newName}".`);
    handleCancelRename();
  };

  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete the selection named "${name}"?`)) {
      onDeleteSelection(name);
      toast.success(`Deleted selection "${name}".`);
      // If currently editing the deleted item, cancel edit mode
      if (editingName === name) {
        handleCancelRename();
      }
    }
  };

  const selectionEntries = Object.entries(namedSelections || {});

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Manage Saved Selections</DialogTitle>
          <DialogDescription>
            Rename or delete your saved file selections.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid gap-4 py-4">
            {selectionEntries.length > 0 ? (
              selectionEntries.map(([name, paths]) => (
                <div key={name} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted/50">
                  {editingName === name ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={newNameValue}
                        onChange={(e) => setNewNameValue(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={handleConfirmRename}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={handleCancelRename}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">{paths.length} file(s)</span>
                    </div>
                  )}
                  {editingName !== name && (
                    <div className="flex items-center gap-1">
                       <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartRename(name)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Rename Selection</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={() => handleDelete(name)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Selection</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No saved selections found.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NamedSelectionsManager; 