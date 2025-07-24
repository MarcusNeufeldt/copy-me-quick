import { NextRequest, NextResponse } from 'next/server';
import { db, initializeDatabase } from '@/lib/turso';
import { getGithubUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Ensure database schema is initialized
    await initializeDatabase();
    
    const user = await getGithubUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use a transaction to get everything at once
    const tx = await db.transaction('read');
    try {
      // Get or create user record
      let userResult = await tx.execute({
        sql: "SELECT * FROM users WHERE id = ?",
        args: [user.id]
      });

      let dbUser = userResult.rows[0];
      
      // If user doesn't exist, create them
      if (!dbUser) {
        await tx.rollback(); // End read transaction
        
        // Create user in a write transaction
        await db.execute({
          sql: `INSERT INTO users (id, login, avatar_url, name) 
                VALUES (?, ?, ?, ?)`,
          args: [user.id, user.login, user.avatar_url || null, user.name || null]
        });
        
        // Start new read transaction to get the created user
        const newTx = await db.transaction('read');
        userResult = await newTx.execute({
          sql: "SELECT * FROM users WHERE id = ?",
          args: [user.id]
        });
        dbUser = userResult.rows[0];
        
        // Get projects (will be empty for new user)
        const projectsResult = await newTx.execute({
          sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY last_accessed DESC",
          args: [user.id]
        });
        
        await newTx.commit();
        
        return NextResponse.json({
          user: dbUser,
          projects: projectsResult.rows,
        });
      }
      
      // Get projects for existing user
      const projectsResult = await tx.execute({
        sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY last_accessed DESC",
        args: [user.id]
      });
      
      await tx.commit();

      return NextResponse.json({
        user: dbUser,
        projects: projectsResult.rows,
      });
      
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error fetching user context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user context' }, 
      { status: 500 }
    );
  }
} 