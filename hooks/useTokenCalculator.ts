import { useEffect } from 'react';
import { FileData } from '../components/types';

// Keep these types, they are correct.
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

// Replace the entire useTokenCalculator function with this new, robust version.
export function useTokenCalculator({
  selectedFiles,
  getAllFilesFromDataSource,
  onTokenCountChange,
  getEncodingFunc,
  setLoadingStatus,
}: UseTokenCalculatorProps) {

  useEffect(() => {
    // Use a unique ID for each calculation to prevent race conditions
    // if the selected files change quickly.
    const calculationId = Date.now();
    let isCancelled = false;

    const calculate = async () => {
      if (!selectedFiles.length) {
        onTokenCountChange(0);
        return;
      }
      
      // Only show loading status for potentially long calculations
      if (selectedFiles.length > 50) {
        setLoadingStatus({ isLoading: true, message: 'Calculating tokens...' });
      }

      let totalTokens = 0;
      const allFiles = getAllFilesFromDataSource();
      const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));
      
      let encoding: ReturnType<GetEncodingFunc> | null = null;
      if (typeof getEncodingFunc === 'function') {
        try {
          encoding = getEncodingFunc("cl100k_base");
        } catch (e) {
          console.warn("Failed to initialize tiktoken, using fallback estimation.", e);
          encoding = null;
        }
      }

      for (const file of filesToProcess) {
        if (isCancelled) break; // Abort if a new calculation has started

        try {
          if (encoding && file.content) {
            totalTokens += encoding.encode(file.content).length;
          } else {
            // Fallback estimation for binary files, missing content, or tiktoken failure
            totalTokens += Math.ceil((file.size || file.content?.length || 0) / 4);
          }
        } catch (error) {
          console.error(`Token calculation failed for ${file.path}, using fallback.`, error);
          totalTokens += Math.ceil((file.size || file.content?.length || 0) / 4);
        }
      }
      
      if (!isCancelled) {
        onTokenCountChange(totalTokens);
        if (selectedFiles.length > 50) {
          setLoadingStatus({ isLoading: false, message: null });
        }
      }
    };

    // Defer the expensive calculation using setTimeout(0)
    const timeoutId = setTimeout(calculate, 50); // A small delay to allow UI to be responsive

    // Cleanup function: This is crucial. It runs when the component unmounts
    // OR when the dependencies change (triggering a new effect run).
    // It prevents old, slow calculations from overwriting new ones.
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };

  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc, setLoadingStatus]); // Effect runs when selection changes

  // The hook itself doesn't need to return anything.
  return {};
} 