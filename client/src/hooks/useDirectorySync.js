import { useEffect } from 'react';
import { syncFullDirectory } from '../utils/offlineDb';
import API_BASE from '../api';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useDirectorySync() {
  useEffect(() => {
    const checkAndSync = async () => {
      // Only run in browser environments
      if (typeof window === 'undefined') return;

      const lastSyncStr = localStorage.getItem('last_directory_sync');
      const now = Date.now();

      // If no previous sync or if older than 24 hours
      if (!lastSyncStr || now - parseInt(lastSyncStr, 10) > SYNC_INTERVAL_MS) {
        // Wait a few seconds to let the app load first before heavy background fetch
        setTimeout(async () => {
          try {
            console.log('[DirectorySync] Starting background sync...');
            await syncFullDirectory(API_BASE);
          } catch (err) {
            console.error('[DirectorySync] Background sync failed', err);
          }
        }, 5000); 
      }
    };

    checkAndSync();
  }, []);
}
