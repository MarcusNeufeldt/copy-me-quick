import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/turso';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

interface ProjectTemplate {
  value: string;
  label: string;
  excludeFolders: string[];
  fileTypes: string[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const result = await db.execute({
      sql: "SELECT local_templates FROM users WHERE id = ?",
      args: [user.id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const templatesJson = result.rows[0].local_templates as string;
    let templates: ProjectTemplate[] = [];
    
    try {
      templates = JSON.parse(templatesJson);
    } catch (e) {
      console.error('Error parsing templates JSON:', e);
      templates = [];
    }

    return NextResponse.json({ templates });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { templates } = await request.json();

    if (!Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'Templates must be an array' },
        { status: 400 }
      );
    }

    // Validate template structure
    for (const template of templates) {
      if (!template.value || !template.label || !Array.isArray(template.excludeFolders) || !Array.isArray(template.fileTypes)) {
        return NextResponse.json(
          { error: 'Invalid template structure' },
          { status: 400 }
        );
      }
    }

    const templatesJson = JSON.stringify(templates);

    await db.execute({
      sql: "UPDATE users SET local_templates = ?, updated_at = strftime('%s', 'now') WHERE id = ?",
      args: [templatesJson, user.id]
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving templates:', error);
    return NextResponse.json(
      { error: 'Failed to save templates' },
      { status: 500 }
    );
  }
} 