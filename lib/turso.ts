import { createClient } from '@libsql/client';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        avatar_url TEXT,
        name TEXT,
        global_github_exclude_folders TEXT DEFAULT 'node_modules,.git,dist,.next,package-lock.json,yarn.lock,pnpm-lock.yaml',
        local_exclude_folders TEXT DEFAULT 'node_modules,.git,dist,build,out,target,bin,obj,.vscode,.idea,.DS_Store,Thumbs.db,*.log,*.tmp,*.temp,coverage',
        local_file_types TEXT DEFAULT '.js,.jsx,.ts,.tsx,.py',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create projects table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('local', 'github')),
        github_repo_full_name TEXT,
        github_branch TEXT,
        local_exclude_folders TEXT,
        local_file_types TEXT,
        is_pinned INTEGER DEFAULT 0,
        last_accessed INTEGER DEFAULT (strftime('%s', 'now')),
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects (user_id, last_accessed DESC)
    `);

    // Add new columns to existing users table (if they don't exist)
    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN local_exclude_folders TEXT DEFAULT 'node_modules,.git,dist,build,out,target,bin,obj,.vscode,.idea,.DS_Store,Thumbs.db,*.log,*.tmp,*.temp,coverage'
      `);
    } catch (e) {
      // Column might already exist, ignore error
    }

    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN local_file_types TEXT DEFAULT '.js,.jsx,.ts,.tsx,.py'
      `);
    } catch (e) {
      // Column might already exist, ignore error
    }

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
} 