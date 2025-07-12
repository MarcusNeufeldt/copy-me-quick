import { useEffect, useRef } from 'react';
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
  const calculationRef = useRef(0);

  useEffect(() => {
    const runId = Date.now();
    calculationRef.current = runId;

    if (selectedFiles.length === 0) {
      onTokenCountChange(0);
      return;
    }

    const calculate = async () => {
      console.log(`Starting token calculation (run ID: ${runId})`);
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
        // If a new calculation has started, abort this one.
        if (calculationRef.current !== runId) {
          console.log(`Aborting stale calculation (run ID: ${runId})`);
          return;
        }
        
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
      
      // Final check to prevent race conditions
      if (calculationRef.current === runId) {
        console.log(`Finished token calculation (run ID: ${runId})`);
        onTokenCountChange(currentTokenCount);
        setLoadingStatus({ isLoading: false, message: null });
      }
    };
    
    // Defer the calculation to the next event loop cycle.
    const timeoutId = setTimeout(calculate, 0);

    return () => {
      clearTimeout(timeoutId);
    };

  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc, setLoadingStatus]);

  return {};
} 