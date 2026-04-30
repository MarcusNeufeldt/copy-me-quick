declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

type DirectoryHandleWithValues = FileSystemDirectoryHandle & {
  values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
};

export async function getFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  path = '',
  includeRootName = true
): Promise<File[]> {
  const files: File[] = [];
  const rootPrefix = path === '' && includeRootName ? dirHandle.name : '';

  for await (const entry of (dirHandle as DirectoryHandleWithValues).values()) {
    const newPath = path === ''
      ? includeRootName ? `${rootPrefix}/${entry.name}` : entry.name
      : `${path}/${entry.name}`;

    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile();
      Object.defineProperty(file, 'webkitRelativePath', {
        value: newPath,
        writable: true,
        enumerable: true,
      });
      files.push(file);
    } else if (entry.kind === 'directory') {
      files.push(...(await getFilesFromHandle(entry as FileSystemDirectoryHandle, newPath, false)));
    }
  }

  return files;
}

export {};
