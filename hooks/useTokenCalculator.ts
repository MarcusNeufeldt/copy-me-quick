import { useEffect } from 'react';
import { FileData } from '../components/types';

type GetEncodingFunc = (encoding: string) => ({ encode: (text: string) => number[] });
interface LoadingStatus { 
  isLoading: boolean; 
  message: string | null; 
}
export interface TokenCountDetails {
  totalTokens: number;
  exactTokens: number;
  estimatedTokens: number;
  exactFileCount: number;
  estimatedFileCount: number;
}

interface UseTokenCalculatorReturn {
  // No return values needed
}

interface UseTokenCalculatorProps {
  selectedFiles: string[];
  getAllFilesFromDataSource: () => FileData[];
  onTokenCountChange: (count: number, details?: TokenCountDetails) => void;
  getEncodingFunc: GetEncodingFunc | null;
}

export function useTokenCalculator({
  selectedFiles,
  getAllFilesFromDataSource,
  onTokenCountChange,
  getEncodingFunc,
}: UseTokenCalculatorProps): UseTokenCalculatorReturn {

  useEffect(() => {
    if (selectedFiles.length === 0) {
      onTokenCountChange(0);
      return;
    }

    console.log('Starting token calculation...');

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
    
    let exactTokens = 0;
    let estimatedTokens = 0;
    let exactFileCount = 0;
    let estimatedFileCount = 0;

    for (const file of filesToProcess) {
      if (encoding && file.content) {
        try {
          exactTokens += encoding.encode(file.content).length;
          exactFileCount++;
        } catch {
          const fallbackTokens = Math.ceil((file.content.length || 0) / 4);
          exactTokens += fallbackTokens;
          exactFileCount++;
        }
      } else {
        const estimatedFileTokens = Math.ceil((file.size || 0) / 4);
        estimatedTokens += estimatedFileTokens;
        estimatedFileCount++;
      }
    }
    
    const totalTokens = exactTokens + estimatedTokens;
    const details: TokenCountDetails = {
      totalTokens,
      exactTokens,
      estimatedTokens,
      exactFileCount,
      estimatedFileCount
    };
    
    console.log('Finished token calculation', details);
    onTokenCountChange(totalTokens, details);

  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc]);

  return {};
} 