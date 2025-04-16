import { useState, useEffect } from 'react';
import { FileData } from '../components/types'; // Adjust path as needed

// Type for the get_encoding function from tiktoken
type GetEncodingFunc = (encoding: string) => ({ encode: (text: string) => number[] });

// Import LoadingStatus type (or define it if not accessible)
interface LoadingStatus {
  isLoading: boolean;
  message: string | null;
}

interface UseTokenCalculatorProps {
  selectedFiles: string[];
  getAllFilesFromDataSource: () => FileData[];
  onTokenCountChange: (count: number) => void;
  getEncodingFunc: GetEncodingFunc | null;
  // Add unified loading state props
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatus>>;
  loadingStatus: LoadingStatus; // To potentially avoid recalculating if already loading
}

interface UseTokenCalculatorReturn {
  // Remove isCalculatingTokens as it's now handled globally
  // isCalculatingTokens: boolean;
}

export function useTokenCalculator({
  selectedFiles,
  getAllFilesFromDataSource,
  onTokenCountChange,
  getEncodingFunc,
  setLoadingStatus,
  loadingStatus
}: UseTokenCalculatorProps): UseTokenCalculatorReturn {

  useEffect(() => {
    let isMounted = true;
    let calculationId = Date.now(); // Unique ID for this calculation run

    // Reduce chunk size
    const CHUNK_SIZE = 10; // Process fewer files at a time

    const estimateTokensInChunks = async () => {
      // Read the current loading status directly inside the function
      // instead of relying on it being stable from the outer scope via dependencies.
      if (loadingStatus.isLoading && !loadingStatus.message?.includes('Calculating tokens')) {
        console.warn("Token calculation skipped: another operation in progress.");
        return;
      }
      if (!selectedFiles.length) {
        onTokenCountChange(0);
        if (loadingStatus.isLoading && loadingStatus.message?.includes('Calculating tokens')) {
           setLoadingStatus({ isLoading: false, message: null });
        }
        return; // No files selected, reset count and clear loading if needed
      }

      setLoadingStatus({ isLoading: true, message: 'Calculating tokens... (Initializing)' });

      let currentTokenCount = 0;
      let usedFallback = false;
      const allFiles = getAllFilesFromDataSource();
      const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));
      let processedFiles = 0;
      const totalFilesToProcess = filesToProcess.length;

      let encoding: ReturnType<GetEncodingFunc> | null = null;
      if (typeof getEncodingFunc === 'function') {
        try {
          encoding = getEncodingFunc("cl100k_base");
        } catch (e) {
          console.warn("Error initializing tiktoken encoding:", e);
          encoding = null;
        }
      }

      const processChunk = async (startIndex: number, runId: number) => {
        if (!isMounted || runId !== calculationId) {
           console.log("Token calculation aborted (stale run or unmounted).");
           // Ensure loading is cleared if aborted mid-run
           setLoadingStatus(prev => prev.message?.includes('Calculating tokens') ? {isLoading: false, message: null} : prev);
           return; // Stop if component unmounted or a new calculation started
        }

        const endIndex = Math.min(startIndex + CHUNK_SIZE, totalFilesToProcess);
        const chunk = filesToProcess.slice(startIndex, endIndex);

        for (const file of chunk) {
          let content = file.content;

          if (content && encoding) {
            try {
                currentTokenCount += encoding.encode(content).length;
            } catch(encodeError: any) {
                if (encodeError?.message?.includes('special token that is not allowed')) {
                   const estimated = Math.ceil(content.length / 4);
                   currentTokenCount += estimated;
                   console.log(`⚠️ Used LENGTH fallback for ${file.path} due to disallowed special token.`);
                } else {
                   console.error(`Error encoding content for ${file.path}:`, encodeError);
                   const estimated = Math.ceil(content.length / 4);
                   currentTokenCount += estimated;
                   console.log(`⚠️ Used LENGTH fallback for ${file.path} due to other encode error (Length: ${content.length}, Estimated: ${estimated})`);
                }
                usedFallback = true;
            }
          } else {
            usedFallback = true;
            if (file.dataSourceType === 'github' || !content) {
               const estimated = Math.ceil((file.size || 0) / 4);
               currentTokenCount += estimated;
               const reason = getEncodingFunc ? (encoding ? 'Content unavailable' : 'Instance creation failed') : 'Tiktoken function not loaded';
               console.log(`⚠️ Used SIZE fallback for ${file.path} (Size: ${file.size}, Estimated: ${estimated}) - Reason: ${reason}`);
            } else if (content) {
               const estimated = Math.ceil(content.length / 4);
               currentTokenCount += estimated;
               const reason = getEncodingFunc ? 'Instance creation failed' : 'Tiktoken function not loaded';
               console.log(`⚠️ Used LENGTH fallback for ${file.path} (Length: ${content.length}, Estimated: ${estimated}) - Reason: ${reason}`);
            } else {
               console.log(`⚠️ No content or size for ${file.path}, adding 0 tokens.`);
            }
          }
          processedFiles++;
        }

        // Update count and status immediately after chunk processing
        if (isMounted && runId === calculationId) {
           onTokenCountChange(currentTokenCount);
           setLoadingStatus({ isLoading: true, message: `Calculating tokens... (${processedFiles}/${totalFilesToProcess})` });

           // Schedule next chunk or finish
           if (endIndex < totalFilesToProcess) {
             setTimeout(() => processChunk(endIndex, runId), 0); // Yield before next chunk
           } else {
             // Finished last chunk - Log results
             if (usedFallback) {
                 console.warn("Token count includes fallback estimations.");
             } else {
                 console.log("Token count calculation completed purely with tiktoken.");
             }
             // Decouple final state update using another timeout
             setTimeout(() => {
                if (isMounted && runId === calculationId) { // Check again before final update
                    setLoadingStatus({ isLoading: false, message: null });
                }
             }, 0);
           }
        }
      };

      // Start the first chunk
      setTimeout(() => processChunk(0, calculationId), 0);
    };

    // Debounce the initial start of the calculation
    const startTimeoutId = setTimeout(estimateTokensInChunks, 150);

    return () => {
      isMounted = false;
      clearTimeout(startTimeoutId);
      calculationId = -1; // Invalidate current run ID
      // Use functional update form to avoid needing loadingStatus dependency here
      setLoadingStatus(prev => {
          if (prev.isLoading && prev.message?.includes('Calculating tokens')) {
              return { isLoading: false, message: null }; // Clear if we were calculating
          }
          return prev; // Otherwise, leave it unchanged
      });
    };
  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc, setLoadingStatus]);

  return {};
} 