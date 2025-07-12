import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';
import { AppState } from './types';
import ProjectTemplateEditor from './ProjectTemplateEditor';

interface ProjectTemplate {
  value: string;
  label: string;
  excludeFolders: string[];
  fileTypes: string[];
}

interface ProjectSelectorProps {
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onProjectTypeSelected: (selected: boolean) => void;
  projectTypes: ProjectTemplate[];
  onProjectTemplatesUpdate: (updatedTemplates: ProjectTemplate[]) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  setState,
  onProjectTypeSelected,
  projectTypes,
  onProjectTemplatesUpdate
}) => {
  const [selectedType, setSelectedType] = useState<string>('none');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);

  const updateProjectType = (type: string) => {
    setSelectedType(type);
    const template = projectTypes.find(t => t.value === type);
    if (template) {
      setState(prevState => ({
        ...prevState,
        excludeFolders: template.excludeFolders.join(','),
        fileTypes: template.fileTypes.join(','),
        isNextJsApp: type === 'nextjs',
        projectType: type,
      }));
    }
    // "none" is a valid selection that should enable uploads (it means "all files")
    onProjectTypeSelected(true);
  };

  const handleEditClick = () => {
    const template = projectTypes.find(t => t.value === selectedType);
    if (template) {
      setEditingTemplate(template);
      setIsEditorOpen(true);
    }
  };

  const handleSaveTemplate = (updatedTemplate: ProjectTemplate) => {
    const updatedTemplates = projectTypes.map(t =>
      t.value === updatedTemplate.value ? updatedTemplate : t
    );
    onProjectTemplatesUpdate(updatedTemplates);
    updateProjectType(updatedTemplate.value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Select value={selectedType} onValueChange={updateProjectType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select project type" />
          </SelectTrigger>
          <SelectContent>
            {projectTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleEditClick} disabled={selectedType === 'none'}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <ProjectTemplateEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        selectedTemplate={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};

export default ProjectSelector;