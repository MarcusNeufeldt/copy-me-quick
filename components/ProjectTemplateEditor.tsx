import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectTemplate {
  value: string;
  label: string;
  excludeFolders: string[];
  fileTypes: string[];
}

interface ProjectTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplate: ProjectTemplate | null;
  onSave: (template: ProjectTemplate) => void;
}

const ProjectTemplateEditor: React.FC<ProjectTemplateEditorProps> = ({
  isOpen,
  onClose,
  selectedTemplate,
  onSave,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<ProjectTemplate | null>(null);

  useEffect(() => {
    setEditedTemplate(selectedTemplate);
  }, [selectedTemplate]);

  const handleSave = () => {
    if (editedTemplate) {
      onSave(editedTemplate);
      onClose();
    }
  };

  if (!editedTemplate) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Project Template</SheetTitle>
          <SheetDescription>
            Customize the project type template. Changes will be saved locally.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={editedTemplate.label}
              onChange={(e) => setEditedTemplate({ ...editedTemplate, label: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="excludeFolders" className="text-right">
              Excluded Folders
            </Label>
            <Input
              id="excludeFolders"
              value={editedTemplate.excludeFolders.join(', ')}
              onChange={(e) => setEditedTemplate({ ...editedTemplate, excludeFolders: e.target.value.split(',').map(item => item.trim()) })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fileTypes" className="text-right">
              File Types
            </Label>
            <Input
              id="fileTypes"
              value={editedTemplate.fileTypes.join(', ')}
              onChange={(e) => setEditedTemplate({ ...editedTemplate, fileTypes: e.target.value.split(',').map(item => item.trim()) })}
              className="col-span-3"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit" onClick={handleSave}>Save changes</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ProjectTemplateEditor;