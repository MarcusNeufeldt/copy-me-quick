import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/turso';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const updates = await request.json();

    // Validate that the project belongs to the user
    const existingProject = await db.execute({
      sql: "SELECT id FROM projects WHERE id = ? AND user_id = ?",
      args: [projectId, user.id]
    });

    if (existingProject.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build dynamic update query based on provided fields
    const allowedFields = [
      'name',
      'is_pinned',
      'last_accessed',
      'local_exclude_folders',
      'local_file_types'
    ];
    
    const updateFields = [];
    const updateValues = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = strftime(\'%s\', \'now\')');
    updateValues.push(projectId, user.id);

    const sql = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
    
    await db.execute({
      sql,
      args: updateValues as any[]
    });

    // Return the updated project
    const updatedProject = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ? AND user_id = ?",
      args: [projectId, user.id]
    });

    return NextResponse.json({
      success: true,
      project: updatedProject.rows[0]
    });

  } catch (error) {
    console.error('Error updating project:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Validate that the project belongs to the user
    const existingProject = await db.execute({
      sql: "SELECT id FROM projects WHERE id = ? AND user_id = ?",
      args: [projectId, user.id]
    });

    if (existingProject.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete the project
    await db.execute({
      sql: "DELETE FROM projects WHERE id = ? AND user_id = ?",
      args: [projectId, user.id]
    });

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
} 