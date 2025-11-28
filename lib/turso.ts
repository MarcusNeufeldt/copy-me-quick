import { createClient, Client } from '@libsql/client';

// Singleton client instance
let tursoClient: Client | null = null;

/**
 * Get or create the Turso database client
 * Returns null if Turso is not configured
 */
export function getTursoClient(): Client | null {
  // Check if Turso is configured
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('[Turso] Not configured - TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing');
    return null;
  }

  // Return existing client if available
  if (tursoClient) {
    return tursoClient;
  }

  // Create new client
  try {
    tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('[Turso] Client created successfully');
    return tursoClient;
  } catch (error) {
    console.error('[Turso] Failed to create client:', error);
    return null;
  }
}

/**
 * Initialize the database schema
 */
export async function initializeDatabase(): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    // Create user_filters table for storing filter preferences
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_user_id TEXT NOT NULL UNIQUE,
        github_username TEXT NOT NULL,
        local_exclusions TEXT DEFAULT '',
        local_file_types TEXT DEFAULT '',
        github_exclusions TEXT DEFAULT '',
        github_file_types TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add github_file_types column if it doesn't exist (for existing databases)
    try {
      await client.execute(`ALTER TABLE user_filters ADD COLUMN github_file_types TEXT DEFAULT ''`);
    } catch {
      // Column already exists, ignore error
    }

    // Create index for faster lookups
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_filters_github_user_id
      ON user_filters(github_user_id)
    `);

    console.log('[Turso] Database schema initialized');
    return true;
  } catch (error) {
    console.error('[Turso] Failed to initialize database:', error);
    return false;
  }
}

/**
 * Get user filter preferences
 */
export async function getUserFilters(githubUserId: string): Promise<{
  localExclusions: string;
  localFileTypes: string;
  githubExclusions: string;
  githubFileTypes: string;
} | null> {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const result = await client.execute({
      sql: 'SELECT local_exclusions, local_file_types, github_exclusions, github_file_types FROM user_filters WHERE github_user_id = ?',
      args: [githubUserId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      localExclusions: (row.local_exclusions as string) ?? '',
      localFileTypes: (row.local_file_types as string) ?? '',
      githubExclusions: (row.github_exclusions as string) ?? '',
      githubFileTypes: (row.github_file_types as string) ?? '',
    };
  } catch (error) {
    console.error('[Turso] Failed to get user filters:', error);
    return null;
  }
}

/**
 * Save user filter preferences (upsert)
 */
export async function saveUserFilters(
  githubUserId: string,
  githubUsername: string,
  filters: {
    localExclusions?: string;
    localFileTypes?: string;
    githubExclusions?: string;
    githubFileTypes?: string;
  }
): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    // Use INSERT OR REPLACE for upsert behavior
    await client.execute({
      sql: `
        INSERT INTO user_filters (github_user_id, github_username, local_exclusions, local_file_types, github_exclusions, github_file_types, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(github_user_id) DO UPDATE SET
          github_username = excluded.github_username,
          local_exclusions = COALESCE(excluded.local_exclusions, local_exclusions),
          local_file_types = COALESCE(excluded.local_file_types, local_file_types),
          github_exclusions = COALESCE(excluded.github_exclusions, github_exclusions),
          github_file_types = COALESCE(excluded.github_file_types, github_file_types),
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        githubUserId,
        githubUsername,
        filters.localExclusions ?? null,
        filters.localFileTypes ?? null,
        filters.githubExclusions ?? null,
        filters.githubFileTypes ?? null,
      ],
    });

    console.log('[Turso] User filters saved for:', githubUsername);
    return true;
  } catch (error) {
    console.error('[Turso] Failed to save user filters:', error);
    return false;
  }
}

/**
 * Update specific filter fields
 */
export async function updateUserFilter(
  githubUserId: string,
  field: 'local_exclusions' | 'local_file_types' | 'github_exclusions' | 'github_file_types',
  value: string
): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.execute({
      sql: `UPDATE user_filters SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE github_user_id = ?`,
      args: [value, githubUserId],
    });
    return true;
  } catch (error) {
    console.error('[Turso] Failed to update user filter:', error);
    return false;
  }
}
