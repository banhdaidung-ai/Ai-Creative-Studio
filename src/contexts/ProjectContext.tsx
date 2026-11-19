import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { get, set, del, getMany, delMany } from 'idb-keyval';
import { createThumbnail } from '../utils/image';

// Define the structure of an image asset
export interface ImageAsset {
  id?: string;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  timestamp?: number;
  mode: string;
  type?: 'image' | 'video';
}

interface ProjectContextType {
  history: ImageAsset[];
  addToHistory: (asset: Omit<ImageAsset, 'id' | 'timestamp'>) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  workspaceAsset: ImageAsset | null;
  setWorkspaceAsset: (asset: ImageAsset | null) => void;
  addToWorkspace: (asset: ImageAsset) => void;
  updateWorkspaceAsset: (id: string, updates: Partial<ImageAsset>) => void;
  activePrompt: string | null;
  setActivePrompt: (prompt: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const LEGACY_STORAGE_KEY = 'yody_project_history_v1';
const HISTORY_INDEX_KEY = 'yody_project_history_index_v2';
const HISTORY_ITEM_PREFIX = 'yody_hist_item_';
const WORKSPACE_KEY = 'yody_workspace_asset_v1';
const MAX_HISTORY_ITEMS = 50;

const itemKey = (id: string) => `${HISTORY_ITEM_PREFIX}${id}`;

async function yieldToMain(): Promise<void> {
  const nav = typeof window !== 'undefined' ? (window as any) : null;
  if (nav?.scheduler && typeof nav.scheduler.yield === 'function') {
    await nav.scheduler.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<ImageAsset[]>([]);
  const [workspaceAsset, setWorkspaceAssetState] = useState<ImageAsset | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const historyIdsRef = useRef<string[]>([]);

  // Load initial data from IndexedDB (v2 per-item storage with automatic migration from legacy v1)
  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        const [indexIds, savedWorkspace] = await Promise.all([
          get<string[]>(HISTORY_INDEX_KEY),
          get<ImageAsset>(WORKSPACE_KEY),
        ]);

        if (cancelled) return;
        if (savedWorkspace) setWorkspaceAssetState(savedWorkspace);

        if (Array.isArray(indexIds) && indexIds.length > 0) {
          historyIdsRef.current = indexIds;
          // Load first 15 items immediately for fast initial render, then stream the rest
          const firstBatchIds = indexIds.slice(0, 15);
          const firstItems = (await getMany<ImageAsset>(firstBatchIds.map(itemKey))).filter(Boolean);
          if (cancelled) return;
          setHistory(firstItems);

          if (indexIds.length > 15) {
            await yieldToMain();
            if (cancelled) return;
            const remainingIds = indexIds.slice(15);
            const restItems = (await getMany<ImageAsset>(remainingIds.map(itemKey))).filter(Boolean);
            if (cancelled) return;
            setHistory((prev) => {
              const existingIds = new Set(prev.map((i) => i.id));
              const appended = restItems.filter((i) => i.id && !existingIds.has(i.id));
              return appended.length > 0 ? [...prev, ...appended] : prev;
            });
          }
          return;
        }

        // Legacy v1 migration path (preserves 100% of existing user history)
        const legacyHistory = await get<ImageAsset[]>(LEGACY_STORAGE_KEY);
        if (cancelled || !Array.isArray(legacyHistory) || legacyHistory.length === 0) return;

        const normalized = legacyHistory.slice(0, MAX_HISTORY_ITEMS).map((item, idx) => ({
          ...item,
          id: item.id || `${item.timestamp || Date.now()}_${idx}`,
        }));
        historyIdsRef.current = normalized.map((i) => i.id!);
        setHistory(normalized);

        // Migrate to per-item keys in background, yielding between writes to avoid blocking UI
        void (async () => {
          try {
            let deadline = performance.now() + 50;
            for (const item of normalized) {
              if (cancelled) return;
              const withThumb =
                !item.thumbnailUrl && item.type !== 'video' && item.mode !== 'VIDEO_GENERATOR'
                  ? { ...item, thumbnailUrl: await createThumbnail(item.url, 480, 0.78) }
                  : item;
              await set(itemKey(withThumb.id!), withThumb);
              if (performance.now() >= deadline) {
                await yieldToMain();
                deadline = performance.now() + 50;
              }
            }
            if (!cancelled) {
              await set(HISTORY_INDEX_KEY, historyIdsRef.current);
              await del(LEGACY_STORAGE_KEY);
            }
          } catch (e) {
            console.warn('Background history migration skipped:', e);
          }
        })();
      } catch (e) {
        console.error('Failed to load data from IndexedDB', e);
      }
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistWorkspace = useCallback((next: ImageAsset | null) => {
    void (async () => {
      try {
        if (next) {
          await set(WORKSPACE_KEY, next);
        } else {
          await del(WORKSPACE_KEY);
        }
      } catch (e) {
        console.error('Failed to save workspace asset to IndexedDB', e);
      }
    })();
  }, []);

  const setWorkspaceAsset = useCallback(
    (asset: ImageAsset | null) => {
      setWorkspaceAssetState(asset);
      persistWorkspace(asset);
    },
    [persistWorkspace]
  );

  const addToWorkspace = useCallback(
    (asset: ImageAsset) => {
      setWorkspaceAsset(asset);
    },
    [setWorkspaceAsset]
  );

  const updateWorkspaceAsset = useCallback(
    (id: string, updates: Partial<ImageAsset>) => {
      setWorkspaceAssetState((prev) => {
        if (!prev || prev.id !== id) return prev;
        const updated = { ...prev, ...updates };
        persistWorkspace(updated);
        return updated;
      });
    },
    [persistWorkspace]
  );

  const addToHistory = useCallback((asset: Omit<ImageAsset, 'id' | 'timestamp'>) => {
    const now = Date.now();
    const id = `${now}_${Math.random().toString(36).slice(2, 6)}`;
    const newAsset: ImageAsset = {
      ...asset,
      id,
      timestamp: now,
    };

    let evictedIds: string[] = [];
    setHistory((prev) => {
      const next = [newAsset, ...prev];
      if (next.length > MAX_HISTORY_ITEMS) {
        evictedIds = next
          .slice(MAX_HISTORY_ITEMS)
          .map((item) => item.id)
          .filter((x): x is string => Boolean(x));
      }
      const trimmed = next.slice(0, MAX_HISTORY_ITEMS);
      historyIdsRef.current = trimmed.map((item) => item.id!).filter(Boolean);
      return trimmed;
    });

    // Generate lightweight thumbnail off-path and persist only the new item
    void (async () => {
      try {
        let itemToStore = newAsset;
        if (!newAsset.thumbnailUrl && newAsset.type !== 'video' && newAsset.mode !== 'VIDEO_GENERATOR') {
          const thumb = await createThumbnail(newAsset.url, 480, 0.78);
          if (thumb && thumb !== newAsset.url) {
            itemToStore = { ...newAsset, thumbnailUrl: thumb };
            setHistory((prev) =>
              prev.map((item) => (item.id === id ? { ...item, thumbnailUrl: thumb } : item))
            );
          }
        }
        await set(itemKey(id), itemToStore);
        await set(HISTORY_INDEX_KEY, historyIdsRef.current);
        if (evictedIds.length > 0) {
          await delMany(evictedIds.map(itemKey));
        }
      } catch (e) {
        console.error('Failed to persist history item to IndexedDB', e);
      }
    })();
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      historyIdsRef.current = next.map((item) => item.id!).filter(Boolean);
      return next;
    });

    void (async () => {
      try {
        await del(itemKey(id));
        await set(HISTORY_INDEX_KEY, historyIdsRef.current);
      } catch (e) {
        console.error('Failed to remove history item from IndexedDB', e);
      }
    })();
  }, []);

  const clearHistory = useCallback(() => {
    const idsToDelete = [...historyIdsRef.current];
    historyIdsRef.current = [];
    setHistory([]);

    void (async () => {
      try {
        if (idsToDelete.length > 0) {
          await delMany(idsToDelete.map(itemKey));
        }
        await del(HISTORY_INDEX_KEY);
        await del(LEGACY_STORAGE_KEY);
      } catch (e) {
        console.error('Failed to clear history in IndexedDB', e);
      }
    })();
  }, []);

  const contextValue = useMemo<ProjectContextType>(
    () => ({
      history,
      addToHistory,
      removeFromHistory,
      clearHistory,
      workspaceAsset,
      setWorkspaceAsset,
      addToWorkspace,
      updateWorkspaceAsset,
      activePrompt,
      setActivePrompt,
    }),
    [
      history,
      addToHistory,
      removeFromHistory,
      clearHistory,
      workspaceAsset,
      setWorkspaceAsset,
      addToWorkspace,
      updateWorkspaceAsset,
      activePrompt,
    ]
  );

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
