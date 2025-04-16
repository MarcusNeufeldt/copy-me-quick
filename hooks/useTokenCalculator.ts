import { useState, useEffect } from 'react';
import { FileData } from '../components/types'; // Adjust path as needed

// Type for the get_encoding function from tiktoken
type GetEncodingFunc = (encoding: string) => ({ encode: (text: string) => number[] });

interface UseTokenCalculatorProps {
  selectedFiles: string[];
  getAllFilesFromDataSource: () => FileData[];
  onTokenCountChange: (count: number) => void;
  getEncodingFunc: GetEncodingFunc | null;
}

interface UseTokenCalculatorReturn {
  isCalculatingTokens: boolean;
  // Note: currentTokenCount is managed by the parent via onTokenCountChange
}

export function useTokenCalculator({
  selectedFiles,
  getAllFilesFromDataSource,
  onTokenCountChange,
  getEncodingFunc
}: UseTokenCalculatorProps): UseTokenCalculatorReturn {
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const estimateTokens = async () => {
      setIsCalculatingTokens(true);
      let currentTokenCount = 0;
      let usedFallback = false;
      const allFiles = getAllFilesFromDataSource();
      const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));

      let encoding: ReturnType<GetEncodingFunc> | null = null;
      if (typeof getEncodingFunc === 'function') {
        try {
          encoding = getEncodingFunc("cl100k_base");
        } catch (e) {
          console.warn("Error calling get_encoding('cl100k_base') from state function:", e);
          encoding = null;
        }
      } else {
        // console.log("getEncodingFunc from state was not a function.");
      }

      for (const file of filesToProcess) {
        let content = file.content;

        if (content && encoding) {
          try {
              currentTokenCount += encoding.encode(content).length;
          } catch(encodeError) {
              console.error(`Error encoding content for ${file.path}:`, encodeError);
              usedFallback = true;
              const estimated = Math.ceil(content.length / 4);
              currentTokenCount += estimated;
              console.log(`⚠️ Used LENGTH fallback for ${file.path} due to encode error (Length: ${content.length}, Estimated: ${estimated})`);
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
      }

      if (isMounted) {
        if (usedFallback) {
            console.warn("Token count includes fallback estimations.");
        } else {
            console.log("Token count calculation attempted purely with tiktoken.");
        }
        onTokenCountChange(currentTokenCount);
        setIsCalculatingTokens(false);
      }
    };

    const timeoutId = setTimeout(estimateTokens, 50);

    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc]);

  return { isCalculatingTokens };
} 