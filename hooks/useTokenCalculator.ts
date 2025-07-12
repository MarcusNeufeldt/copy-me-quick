import { useEffect } from 'react';
import { FileData } from '../components/types';

type GetEncodingFunc = (encoding: string) => ({ encode: (text: string) => number[] });
interface LoadingStatus { 
  isLoading: boolean; 
  message: string | null; 
}
interface UseTokenCalculatorProps {
  selectedFiles: string[];
  getAllFilesFromDataSource: () => FileData[];
  onTokenCountChange: (count: number) => void;
  getEncodingFunc: GetEncodingFunc | null;
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
}

interface UseTokenCalculatorReturn {
  // No return values needed
}

export function useTokenCalculator({
  selectedFiles,
  getAllFilesFromDataSource,
  onTokenCountChange,
  getEncodingFunc,
  setLoadingStatus,
}: UseTokenCalculatorProps): UseTokenCalculatorReturn {

  useEffect(() => {
    if (selectedFiles.length === 0) {
      onTokenCountChange(0);
      return;
    }

    console.log('Starting token calculation...');
    setLoadingStatus({ isLoading: true, message: 'Calculating tokens...' });

    let encoding;
    if (getEncodingFunc) {
      try {
        encoding = getEncodingFunc("cl100k_base");
      } catch (e) {
        console.warn("Tiktoken init failed, using fallback.", e);
      }
    }

    const allFiles = getAllFilesFromDataSource();
    const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));
    let currentTokenCount = 0;

    for (const file of filesToProcess) {
      if (encoding && file.content) {
        try {
          currentTokenCount += encoding.encode(file.content).length;
        } catch {
          currentTokenCount += Math.ceil((file.content.length || 0) / 4);
        }
      } else {
        currentTokenCount += Math.ceil((file.size || 0) / 4);
      }
    }
    
    console.log('Finished token calculation');
    onTokenCountChange(currentTokenCount);
    setLoadingStatus({ isLoading: false, message: null });

  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc, setLoadingStatus]);

  return {};
} 