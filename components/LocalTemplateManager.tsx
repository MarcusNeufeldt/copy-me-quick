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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectTemplate {
  value: string;
  label: string;
  excludeFolders: string[];
  fileTypes: string[];
}

interface LocalTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentExclusions: string;
  currentFileTypes: string;
  onSave: (newExclusions: string, newFileTypes: string) => void;
}

const baseExclusions = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.vscode',
  '.idea',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.tmp',
  '*.temp',
  'coverage',
];

const defaultTemplates: ProjectTemplate[] = [
  { value: "none", label: "None", excludeFolders: baseExclusions, fileTypes: ['*'] },
  { value: "nextjs", label: "Next.js", excludeFolders: [...baseExclusions, '.next', 'out'], fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "react", label: "React", excludeFolders: baseExclusions, fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md'] },
  { value: "vue", label: "Vue.js", excludeFolders: [...baseExclusions, '.nuxt'], fileTypes: ['.vue', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "angular", label: "Angular", excludeFolders: baseExclusions, fileTypes: ['.ts', '.html', '.css', '.scss', '.json', '.md'] },
  { value: "svelte", label: "Svelte", excludeFolders: baseExclusions, fileTypes: ['.svelte', '.js', '.ts', '.css', '.scss', '.json', '.md'] },
  { value: "flask", label: "Flask", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "django", label: "Django", excludeFolders: [...baseExclusions, 'venv', '__pycache__', '*.pyc', 'migrations'], fileTypes: ['.py', '.html', '.css', '.js', '.json', '.md'] },
  { value: "express", label: "Express.js", excludeFolders: baseExclusions, fileTypes: ['.js', '.ts', '.json', '.md'] },
  { value: "springboot", label: "Spring Boot", excludeFolders: [...baseExclusions, '.gradle', 'gradle'], fileTypes: ['.java', '.xml', '.properties', '.yml', '.md'] },
  { value: "dotnet", label: ".NET", excludeFolders: [...baseExclusions, 'packages', 'TestResults'], fileTypes: ['.cs', '.cshtml', '.csproj', '.sln', '.json', '.md'] },
];

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
  { id: '.next', label: '.next' },
  { id: '.nuxt', label: '.nuxt' },
  { id: 'venv', label: 'venv' },
  { id: '__pycache__', label: '__pycache__' },
  { id: '*.pyc', label: 'Python cache (*.pyc)' },
  { id: 'migrations', label: 'migrations' },
  { id: '.gradle', label: '.gradle' },
  { id: 'gradle', label: 'gradle' },
  { id: 'packages', label: 'packages' },
  { id: 'TestResults', label: 'TestResults' },
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

const LocalTemplateManager: React.FC<LocalTemplateManagerProps> = ({
  isOpen,
  onClose,
  currentExclusions,
  currentFileTypes,
  onSave,
}) => {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Custom filter state (for manual editing)
  const [customExclusions, setCustomExclusions] = useState('');
  const [selectedCommonExclusions, setSelectedCommonExclusions] = useState<Set<string>>(new Set());
  const [customFileTypes, setCustomFileTypes] = useState('');
  const [selectedCommonFileTypes, setSelectedCommonFileTypes] = useState<Set<string>>(new Set());

  // Load templates from database when opened
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  // Update filter state when template changes
  useEffect(() => {
    if (selectedTemplate && !isEditing) {
      const template = templates.find(t => t.value === selectedTemplate);
      if (template) {
        updateFiltersFromTemplate(template);
      }
    }
  }, [selectedTemplate, templates, isEditing]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/templates');
      if (response.ok) {
        const data = await response.json();
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
        } else {
          // If no templates in DB, save defaults
          await saveTemplates(defaultTemplates);
          setTemplates(defaultTemplates);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplates = async (templatesToSave: ProjectTemplate[]) => {
    try {
      const response = await fetch('/api/user/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: templatesToSave }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save templates');
      }
      
      return true;
    } catch (error) {
      console.error('Error saving templates:', error);
      toast.error('Failed to save templates');
      return false;
    }
  };

  const updateFiltersFromTemplate = (template: ProjectTemplate) => {
    // Update exclusions
    const newSelectedCommonExclusions = new Set<string>();
    const customExclusionItems: string[] = [];

    template.excludeFolders.forEach(item => {
      const common = commonExclusions.find(c => c.id === item);
      if (common) {
        newSelectedCommonExclusions.add(common.id);
      } else {
        customExclusionItems.push(item);
      }
    });

    setSelectedCommonExclusions(newSelectedCommonExclusions);
    setCustomExclusions(customExclusionItems.join(', '));

    // Update file types
    const newSelectedCommonFileTypes = new Set<string>();
    const customFileTypeItems: string[] = [];

    template.fileTypes.forEach(item => {
      if (item === '*') {
        // Handle wildcard - select all file types
        commonFileTypes.forEach(ft => newSelectedCommonFileTypes.add(ft.id));
      } else {
        const common = commonFileTypes.find(c => c.id === item);
        if (common) {
          newSelectedCommonFileTypes.add(common.id);
        } else {
          customFileTypeItems.push(item);
        }
      }
    });

    setSelectedCommonFileTypes(newSelectedCommonFileTypes);
    setCustomFileTypes(customFileTypeItems.join(', '));
  };

  const handleTemplateChange = (templateValue: string) => {
    setSelectedTemplate(templateValue);
    setIsEditing(false);
    setIsCreatingNew(false);
  };

  const handleEditTemplate = () => {
    const template = templates.find(t => t.value === selectedTemplate);
    if (template) {
      setEditingTemplate({ ...template });
      setIsEditing(true);
    }
  };

  const handleCreateNew = () => {
    const newTemplate: ProjectTemplate = {
      value: `custom_${Date.now()}`,
      label: 'New Template',
      excludeFolders: [...baseExclusions],
      fileTypes: ['.js', '.jsx', '.ts', '.tsx', '.py'],
    };
    setEditingTemplate(newTemplate);
    setIsCreatingNew(true);
    setIsEditing(true);
    updateFiltersFromTemplate(newTemplate);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    // Build template from current filter state
    const excludeFolders = [
      ...Array.from(selectedCommonExclusions),
      ...customExclusions.split(',').map(item => item.trim()).filter(Boolean)
    ];

    const fileTypes = [
      ...Array.from(selectedCommonFileTypes),
      ...customFileTypes.split(',').map(item => item.trim()).filter(Boolean)
    ];

    const updatedTemplate: ProjectTemplate = {
      ...editingTemplate,
      excludeFolders,
      fileTypes,
    };

    let updatedTemplates: ProjectTemplate[];
    if (isCreatingNew) {
      updatedTemplates = [...templates, updatedTemplate];
    } else {
      updatedTemplates = templates.map(t => 
        t.value === updatedTemplate.value ? updatedTemplate : t
      );
    }

    const success = await saveTemplates(updatedTemplates);
    if (success) {
      setTemplates(updatedTemplates);
      setSelectedTemplate(updatedTemplate.value);
      setIsEditing(false);
      setIsCreatingNew(false);
      setEditingTemplate(null);
      toast.success(`Template "${updatedTemplate.label}" saved!`);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!editingTemplate || isCreatingNew) return;

    const updatedTemplates = templates.filter(t => t.value !== editingTemplate.value);
    const success = await saveTemplates(updatedTemplates);
    
    if (success) {
      setTemplates(updatedTemplates);
      setSelectedTemplate('none');
      setIsEditing(false);
      setEditingTemplate(null);
      toast.success('Template deleted!');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreatingNew(false);
    setEditingTemplate(null);
    
    // Restore filters from selected template
    const template = templates.find(t => t.value === selectedTemplate);
    if (template) {
      updateFiltersFromTemplate(template);
    }
  };

  const handleApplyFilters = () => {
    const excludeFolders = [
      ...Array.from(selectedCommonExclusions),
      ...customExclusions.split(',').map(item => item.trim()).filter(Boolean)
    ].join(',');

    const fileTypes = [
      ...Array.from(selectedCommonFileTypes),
      ...customFileTypes.split(',').map(item => item.trim()).filter(Boolean)
    ].join(',');

    onSave(excludeFolders, fileTypes);
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
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Local Project Templates & Filters</SheetTitle>
          <SheetDescription>
            {isEditing 
              ? `${isCreatingNew ? 'Create' : 'Edit'} template to save your filter preferences`
              : 'Choose a template or customize filters for local projects'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Template Selection */}
          {!isEditing && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Project Template</Label>
              <div className="flex gap-2">
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.value} value={template.value}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleEditTemplate} disabled={!selectedTemplate}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleCreateNew}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Template Editing */}
          {isEditing && editingTemplate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  {isCreatingNew ? 'Create New Template' : 'Edit Template'}
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveTemplate}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  {!isCreatingNew && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteTemplate}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={editingTemplate.label}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    label: e.target.value
                  })}
                  placeholder="Enter template name..."
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Exclude Folders Section */}
          <div>
            <Label className="text-base font-semibold">Exclude Folders & Files</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select folders and file patterns to exclude from analysis.
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {commonExclusions.map(exclusion => (
                <div key={exclusion.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`exclusion-${exclusion.id}`}
                    checked={selectedCommonExclusions.has(exclusion.id)}
                    onCheckedChange={(checked) => handleCommonExclusionToggle(exclusion.id, !!checked)}
                  />
                  <label
                    htmlFor={`exclusion-${exclusion.id}`}
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
              <Label htmlFor="custom-filetypes" className="text-sm font-medium">
                Custom File Types
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add custom file extensions, separated by commas.
              </p>
              <Input
                id="custom-filetypes"
                placeholder="e.g., .config, .env, .lock"
                value={customFileTypes}
                onChange={(e) => setCustomFileTypes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!isEditing && (
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default LocalTemplateManager; 