import { FileData, GitHubTreeItem } from './types';
import { InternalTreeNode } from './FileTreeNode';

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const buildLocalFileTree = (localFiles: FileData[]): { [key: string]: InternalTreeNode } => {
  const tree: { [key: string]: InternalTreeNode } = {};
  localFiles.forEach(file => {
    const parts = file.path.split('/');
    let current: { [key: string]: InternalTreeNode } | undefined = tree;
    let currentPath = '';
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!current) return; 
      if (i === parts.length - 1) {
        current[part] = { name: part, path: currentPath, type: 'file', lines: file.lines, content: file.content, size: file.size };
      } else {
        if (!current[part]) {
          current[part] = { name: part, path: currentPath, type: 'directory', children: {} };
        } else if (current[part].type === 'file') {
            console.warn(`Path conflict: Directory path ${currentPath} conflicts with existing file path.`);
            if (!current[part].children) current[part].children = {}; 
        } else if (!current[part].children) {
            current[part].children = {};
        }
        current = current[part].children;
      }
    });
  });
  return tree;
};

export const buildGitHubTree = (githubTreeItems: GitHubTreeItem[]): { [key: string]: InternalTreeNode } => {
  const tree: { [key: string]: InternalTreeNode } = {};
  githubTreeItems.sort((a, b) => a.path.localeCompare(b.path)); 
  githubTreeItems.forEach(item => {
    const parts = item.path.split('/');
    let current: { [key: string]: InternalTreeNode } | undefined = tree;
    let currentPath = '';
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!current) return; 
      if (i === parts.length - 1) {
        if (item.type === 'blob') {
          // Format the size for display
          const formattedSize = item.size ? formatFileSize(item.size) : '';
          
          // Type assertion to access potential extended properties
          const extendedItem = item as GitHubTreeItem & { lines?: number, content?: string };
          
          current[part] = { 
            name: part, 
            path: item.path, 
            type: 'file', 
            sha: item.sha, 
            size: item.size,
            formattedSize, // Add formatted size for display
            lines: extendedItem.lines, // Get lines directly from extended item 
            content: extendedItem.content // Get content directly from extended item
          };
        } else if (item.type === 'tree') {
          if (!current[part]) {
              current[part] = { name: part, path: item.path, type: 'directory', children: {}, sha: item.sha };
          } else {
                current[part].type = 'directory';
                if(!current[part].children) current[part].children = {};
                current[part].sha = item.sha; 
          }
        } 
      } else {
        if (!current[part]) {
          current[part] = { name: part, path: currentPath, type: 'directory', children: {} };
        } else if (!current[part].children) {
            current[part].type = 'directory';
            current[part].children = {};
        }
        current = current[part].children;
      }
    });
  });
  return tree;
};

export const getDescendantFiles = (node: InternalTreeNode): string[] => {
  if (node.type === 'file') return [node.path];
  
  const descendantFiles: string[] = [];
  if (node.type === 'directory' && node.children) {
    Object.values(node.children).forEach(child => {
      descendantFiles.push(...getDescendantFiles(child));
    });
  }
  
  return descendantFiles;
};

export const findNode = (tree: { [key: string]: InternalTreeNode }, targetPath: string): InternalTreeNode | null => {
  const parts = targetPath.split('/');
  let current: { [key: string]: InternalTreeNode } | undefined = tree;
  let currentNode: InternalTreeNode | null = null;

  for (const part of parts) {
    if (!current || !current[part]) return null;
    currentNode = current[part];
    current = currentNode.children;
  }

  return currentNode;
};

export const generateProjectTreeString = (tree: { [key: string]: InternalTreeNode }): string => {
  const buildString = (nodes: { [key: string]: InternalTreeNode }, prefix = ''): string => {
    const nodeStrings = Object.entries(nodes)
      .sort(([, a], [, b]) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(([key, node]) => {
        const nodeLine = prefix + (node.type === 'directory' ? `📁 ${node.name}/` : `📄 ${node.name}`);
        if (node.type === 'directory' && node.children) {
          return nodeLine + '\n' + buildString(node.children, prefix + '  ');
        }
        return nodeLine;
      });
    
    return nodeStrings.join('\n');
  };
  
  return buildString(tree);
};

export const minifyCode = (code: string): string => {
  if (!code) return '';
  
  // Very basic minification for various languages
  return code
    // Remove single-line comments (// for JS/TS/Java/C#, # for Python/Ruby)
    .replace(/\/\/.*|#.*/g, '')
    // Remove multi-line comments (/* ... */ for many languages)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove empty lines
    .replace(/^\s*[\r\n]/gm, '')
    // Collapse multiple spaces to single space
    .replace(/\s{2,}/g, ' ')
    // Collapse spaces around brackets and parentheses
    .replace(/\s*([{}()[\]])\s*/g, '$1')
    // Trim leading/trailing whitespace
    .trim();
};

export const isBinaryFile = (filePath: string): boolean => {
  const binaryExtensions = [
    '.ico', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', 
    '.webp', '.svg', '.pdf', '.zip', '.tar', '.gz', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db',
    '.woff', '.woff2', '.eot', '.ttf', '.otf'
  ];
  
  const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return binaryExtensions.includes(extension);
}; 