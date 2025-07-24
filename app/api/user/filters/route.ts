import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/turso';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { excludeFolders } = await request.json();

    if (typeof excludeFolders !== 'string') {
      return NextResponse.json(
        { error: 'excludeFolders must be a string' }, 
        { status: 400 }
      );
    }

    // Update the user's global GitHub filters
    await db.execute({
      sql: `UPDATE users 
            SET global_github_exclude_folders = ?, 
                updated_at = strftime('%s', 'now')
            WHERE id = ?`,
      args: [excludeFolders, user.id]
    });

    return NextResponse.json({ 
      success: true, 
      excludeFolders 
    });

  } catch (error) {
    console.error('Error updating filters:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update filters' }, 
      { status: 500 }
    );
  }
} 