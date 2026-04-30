import { useEffect } from 'react';
import { FileData } from '../components/types';

export const DEFAULT_TOKEN_ENCODING = 'o200k_base';
const FALLBACK_TOKEN_ENCODING = 'cl100k_base';
const ESTIMATED_CHARS_PER_TOKEN = 3.6;
const ESTIMATED_TOKENS_PER_CHANGED_LINE = 8;

export type TokenEncoding = {
  encode: (text: string) => ArrayLike<number>;
  free?: () => void;
};

export type GetEncodingFunc = (encoding: string) => TokenEncoding;

export interface TokenCountDetails {
  totalTokens: number;
  exactTokens: number;
  estimatedTokens: number;
  exactFileCount: number;
  estimatedFileCount: number;
  encodingName: string;
  estimatedCharsPerToken: number;
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

function estimateTokensFromText(text?: string | null) {
  if (!text) return 0;
  return Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN);
}

function estimateTokensFromFile(file: FileData) {
  if (typeof file.size === 'number' && file.size > 0) {
    return Math.ceil(file.size / ESTIMATED_CHARS_PER_TOKEN);
  }

  const patchEstimate = estimateTokensFromText(file.patch);
  if (patchEstimate > 0) {
    return patchEstimate;
  }

  const changedLines = (file.additions || 0) + (file.deletions || 0);
  if (changedLines > 0) {
    return Math.max(1, changedLines * ESTIMATED_TOKENS_PER_CHANGED_LINE);
  }

  return 0;
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

    let encoding: TokenEncoding | null = null;
    let encodingName = getEncodingFunc ? DEFAULT_TOKEN_ENCODING : 'heuristic';
    if (getEncodingFunc) {
      try {
        encoding = getEncodingFunc(DEFAULT_TOKEN_ENCODING);
      } catch (e) {
        console.warn(`Tiktoken init failed for ${DEFAULT_TOKEN_ENCODING}, trying ${FALLBACK_TOKEN_ENCODING}.`, e);
        try {
          encoding = getEncodingFunc(FALLBACK_TOKEN_ENCODING);
          encodingName = FALLBACK_TOKEN_ENCODING;
        } catch (fallbackError) {
          console.warn("Tiktoken init failed, using heuristic token estimates.", fallbackError);
          encoding = null;
          encodingName = 'heuristic';
        }
      }
    }

    const allFiles = getAllFilesFromDataSource();
    const filesToProcess = allFiles.filter(f => selectedFiles.includes(f.path));
    
    let exactTokens = 0;
    let estimatedTokens = 0;
    let exactFileCount = 0;
    let estimatedFileCount = 0;

    try {
      for (const file of filesToProcess) {
        const hasContent = typeof file.content === 'string' && file.content.length > 0;

        if (encoding && hasContent) {
          try {
            exactTokens += encoding.encode(file.content).length;
            exactFileCount++;
          } catch {
            estimatedTokens += estimateTokensFromText(file.content);
            estimatedFileCount++;
          }
        } else if (hasContent) {
          estimatedTokens += estimateTokensFromText(file.content);
          estimatedFileCount++;
        } else {
          estimatedTokens += estimateTokensFromFile(file);
          estimatedFileCount++;
        }
      }
    } finally {
      if (typeof encoding?.free === 'function') {
        try {
          encoding.free();
        } catch {
          // Ignore tokenizer cleanup errors.
        }
      }
    }

    const totalTokens = exactTokens + estimatedTokens;
    const details: TokenCountDetails = {
      totalTokens,
      exactTokens,
      estimatedTokens,
      exactFileCount,
      estimatedFileCount,
      encodingName,
      estimatedCharsPerToken: ESTIMATED_CHARS_PER_TOKEN
    };

    console.log('Finished token calculation', details);
    onTokenCountChange(totalTokens, details);

  }, [selectedFiles, getAllFilesFromDataSource, onTokenCountChange, getEncodingFunc]);

  return {};
}
