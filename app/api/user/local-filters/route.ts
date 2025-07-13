import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/turso';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { excludeFolders, fileTypes } = await request.json();

    if (typeof excludeFolders !== 'string' || typeof fileTypes !== 'string') {
      return NextResponse.json(
        { error: 'excludeFolders and fileTypes must be strings' }, 
        { status: 400 }
      );
    }

    // Update the user's default local filters
    await db.execute({
      sql: `UPDATE users 
            SET local_exclude_folders = ?, 
                local_file_types = ?,
                updated_at = strftime('%s', 'now')
            WHERE id = ?`,
      args: [excludeFolders, fileTypes, user.id]
    });

    return NextResponse.json({ 
      success: true, 
      excludeFolders,
      fileTypes
    });

  } catch (error) {
    console.error('Error updating local filters:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update local filters' }, 
      { status: 500 }
    );
  }
} 