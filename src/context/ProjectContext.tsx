import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';

// Define the structure of an image asset
export interface ImageAsset {
  id?: string;
  url: string;
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

const STORAGE_KEY = 'yody_project_history_v1';
const WORKSPACE_KEY = 'yody_workspace_asset_v1';

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<ImageAsset[]>([]);
  const [workspaceAsset, setWorkspaceAsset] = useState<ImageAsset | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial data from IndexedDB
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [savedHistory, savedWorkspace] = await Promise.all([
          get(STORAGE_KEY),
          get(WORKSPACE_KEY)
        ]);
        
        if (savedHistory) setHistory(savedHistory);
        if (savedWorkspace) setWorkspaceAsset(savedWorkspace);
      } catch (e) {
        console.error('Failed to load data from IndexedDB', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadInitialData();
  }, []);

  // Save history to IndexedDB
  useEffect(() => {
    if (!isLoaded) return;
    const saveHistory = async () => {
      try {
        await set(STORAGE_KEY, history);
      } catch (e) {
        console.error('Failed to save history to IndexedDB', e);
      }
    };
    saveHistory();
  }, [history, isLoaded]);

  // Save workspace asset to IndexedDB
  useEffect(() => {
    if (!isLoaded) return;
    const saveWorkspace = async () => {
      try {
        if (workspaceAsset) {
          await set(WORKSPACE_KEY, workspaceAsset);
        } else {
          await del(WORKSPACE_KEY);
        }
      } catch (e) {
        console.error('Failed to save workspace asset to IndexedDB', e);
      }
    };
    saveWorkspace();
  }, [workspaceAsset, isLoaded]);

  const addToHistory = (asset: Omit<ImageAsset, 'id' | 'timestamp'>) => {
    const newAsset: ImageAsset = {
      ...asset,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    setHistory((prev) => [newAsset, ...prev].slice(0, 50)); // Keep last 50 items
  };

  const removeFromHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const addToWorkspace = (asset: ImageAsset) => {
    setWorkspaceAsset(asset);
  };

  const updateWorkspaceAsset = (id: string, updates: Partial<ImageAsset>) => {
    setWorkspaceAsset((prev) => prev && prev.id === id ? { ...prev, ...updates } : prev);
  };

  return (
    <ProjectContext.Provider value={{ 
      history, 
      addToHistory, 
      removeFromHistory, 
      clearHistory,
      workspaceAsset,
      setWorkspaceAsset,
      addToWorkspace,
      updateWorkspaceAsset,
      activePrompt,
      setActivePrompt
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
