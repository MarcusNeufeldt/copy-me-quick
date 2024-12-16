import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { path: localPath } = await request.json();

  try {
    const files = await processDirectory(localPath);
    const projectTree = await generateProjectTree(localPath);

    const summary = {
      total_files: files.length,
      total_lines: files.reduce((sum: number, file: { lines: number }) => sum + file.lines, 0),
    };

    return NextResponse.json({ summary, files, project_tree: projectTree });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze codebase' }, { status: 500 });
  }
}

interface FileInfo {
  path: string;
  lines: number;
  content: string;
}

async function processDirectory(directory: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await processDirectory(path.join(directory, entry.name)));
    } else {
      const filePath = path.join(directory, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      files.push({
        path: path.relative(directory, filePath),
        lines: content.split('\n').length,
        content,
      });
    }
  }

  return files;
}

async function generateProjectTree(directory: string): Promise<string> {
  // Implement project tree generation logic here
  // This is a placeholder implementation
  return `Project Tree for ${directory}`;
}