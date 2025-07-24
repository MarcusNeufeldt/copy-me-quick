import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/turso';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const projectData = await request.json();

    const {
      id,
      name,
      sourceType,
      githubRepoFullName,
      githubBranch,
      localExcludeFolders,
      localFileTypes,
      isPinned = false
    } = projectData;

    // Validate required fields
    if (!id || !name || !sourceType) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, sourceType' },
        { status: 400 }
      );
    }

    if (!['local', 'github'].includes(sourceType)) {
      return NextResponse.json(
        { error: 'sourceType must be either "local" or "github"' },
        { status: 400 }
      );
    }

    // Check if project already exists
    const existingProject = await db.execute({
      sql: "SELECT id FROM projects WHERE id = ? AND user_id = ?",
      args: [id, user.id]
    });

    if (existingProject.rows.length > 0) {
      return NextResponse.json(
        { error: 'Project with this ID already exists' },
        { status: 409 }
      );
    }

    // Create the project
    await db.execute({
      sql: `INSERT INTO projects (
        id, user_id, name, source_type, github_repo_full_name, 
        github_branch, local_exclude_folders, local_file_types, 
        is_pinned, last_accessed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
      args: [
        id,
        user.id,
        name,
        sourceType,
        githubRepoFullName || null,
        githubBranch || null,
        localExcludeFolders || null,
        localFileTypes || null,
        isPinned ? 1 : 0
      ]
    });

    // Return the created project
    const createdProject = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ? AND user_id = ?",
      args: [id, user.id]
    });

    return NextResponse.json({
      success: true,
      project: createdProject.rows[0]
    });

  } catch (error) {
    console.error('Error creating project:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 