import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ProjectDB extends DBSchema {
  directoryHandles: {
    key: string;
    value: FileSystemDirectoryHandle;
  };
}

let dbPromise: Promise<IDBPDatabase<ProjectDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<ProjectDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<ProjectDB>('project-handles-db', 1, {
      upgrade(db) {
        db.createObjectStore('directoryHandles');
      },
    });
  }
  return dbPromise;
};

export async function saveDirectoryHandle(projectId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await getDb();
  await db.put('directoryHandles', handle, projectId);
  console.log(`Saved handle for project: ${projectId}`);
}

export async function getDirectoryHandle(projectId: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDb();
  console.log(`Attempting to retrieve handle for project: ${projectId}`);
  return db.get('directoryHandles', projectId);
}

export async function removeDirectoryHandle(projectId: string): Promise<void> {
  const db = await getDb();
  await db.delete('directoryHandles', projectId);
  console.log(`Removed handle for project: ${projectId}`);
}

export { getDb }; 