import { useState, useEffect, useCallback } from 'react';
import { loadAllData } from '../lib/loaders';
import type { AppData } from '../types/contracts';

type LoadingState = 'idle' | 'loading' | 'done' | 'error';

interface UseDataResult {
  data: AppData | null;
  status: LoadingState;
  error: string | null;
  reload: () => void;
}

/**
 * Main application data hook. 
 * Orchestrates full data fetch, indexing, and validation on mount.
 */
export function useAppData(): UseDataResult {
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Reset state before loading
    setStatus('loading');
    setError(null);
    
    try {
      if (import.meta.env.DEV) {
        console.time('[Data Hook] Full load time');
      }

      const result = await loadAllData();
      
      // We are "done" even if some files failed by design 
      // (guards return defaults instead of throwing)
      setData(result);
      setStatus('done');
      
      if (import.meta.env.DEV) {
        console.timeEnd('[Data Hook] Full load time');
      }
    } catch (err) {
      console.error('[Data Hook] Fatal load error:', err);
      setError(err instanceof Error ? err.message : 'Unknown fatal error');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, status, error, reload: load };
}
