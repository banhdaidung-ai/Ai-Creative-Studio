import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import LandingPage from './components/LandingPage';
import LoginGate from './components/LoginGate';
import ErrorBoundary from './components/ErrorBoundary';
import { AppMode } from './types';
import { ProjectProvider } from './contexts/ProjectContext';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

// Lazy-load Layout and heavy Studio modules so LoginGate & LandingPage stay ultra-lightweight
const Layout = lazy(() => import('./components/Layout'));
const ImageEditor = lazy(() => import('./components/ImageEditor'));
const MultiAngleStudio = lazy(() => import('./components/MultiAngleStudio'));
const BatchFashionStudio = lazy(() => import('./components/BatchFashionStudio'));
const BackgroundRemover = lazy(() => import('./components/BackgroundRemover'));
const VideoGenerator = lazy(() => import('./components/VideoGenerator'));
const PromptGenerator = lazy(() => import('./components/PromptGenerator'));
const ManualEditor = lazy(() => import('./components/ManualEditor'));
const HistoryGallery = lazy(() => import('./components/HistoryGallery'));
const UserGuide = lazy(() => import('./components/UserGuide'));
const PromptLibrary = lazy(() => import('./components/PromptLibrary'));
const WorkflowStudio = lazy(() => import('./components/WorkflowStudio'));

const THEME_STORAGE_KEY = 'yody_theme_mode';
const ENTERED_STUDIO_KEY = 'yody_entered_studio';

// Only preserve up to 3 recently used stateful studio tabs in memory (LRU)
// Static/gallery tabs unmount immediately on switch to free RAM & DOM nodes
const MAX_CACHED_TABS = 3;
const KEEP_ALIVE_MODES = new Set<AppMode>([
  AppMode.IMAGE_EDITOR,
  AppMode.MULTI_ANGLE,
  AppMode.BATCH_FASHION,
  AppMode.BACKGROUND_REMOVER,
  AppMode.VIDEO_GENERATOR,
  AppMode.PROMPT_GENERATOR,
  AppMode.WORKFLOW,
]);

const HASH_TO_MODE: Record<string, AppMode> = {
  'image-editor': AppMode.IMAGE_EDITOR,
  'multi-angle': AppMode.MULTI_ANGLE,
  'batch-fashion': AppMode.BATCH_FASHION,
  'background-remover': AppMode.BACKGROUND_REMOVER,
  'video-generator': AppMode.VIDEO_GENERATOR,
  'prompt-generator': AppMode.PROMPT_GENERATOR,
  'manual-editor': AppMode.MANUAL_EDITOR,
  'history': AppMode.HISTORY,
  'guide': AppMode.GUIDE,
  'prompt-library': AppMode.PROMPT_LIBRARY,
  'workflow': AppMode.WORKFLOW,
};

const MODE_TO_HASH: Record<AppMode, string> = {
  [AppMode.IMAGE_EDITOR]: 'image-editor',
  [AppMode.MULTI_ANGLE]: 'multi-angle',
  [AppMode.BATCH_FASHION]: 'batch-fashion',
  [AppMode.BACKGROUND_REMOVER]: 'background-remover',
  [AppMode.VIDEO_GENERATOR]: 'video-generator',
  [AppMode.PROMPT_GENERATOR]: 'prompt-generator',
  [AppMode.MANUAL_EDITOR]: 'manual-editor',
  [AppMode.SEARCH_CHAT]: 'image-editor',
  [AppMode.HISTORY]: 'history',
  [AppMode.GUIDE]: 'guide',
  [AppMode.PROMPT_LIBRARY]: 'prompt-library',
  [AppMode.WORKFLOW]: 'workflow',
};

function getInitialModeFromHash(): AppMode | null {
  const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  return HASH_TO_MODE[hash] || null;
}

function updateKeepAliveQueue(prev: AppMode[], target: AppMode): AppMode[] {
  if (!KEEP_ALIVE_MODES.has(target)) return prev;
  const without = prev.filter((m) => m !== target);
  const next = [...without, target];
  return next.length > MAX_CACHED_TABS ? next.slice(next.length - MAX_CACHED_TABS) : next;
}

const StudioFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full w-full gap-3 text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    <span className="text-[11px] font-bold uppercase tracking-widest">Đang tải phân hệ Studio...</span>
  </div>
);

const App: React.FC = () => {
  const initialMode = getInitialModeFromHash() || AppMode.IMAGE_EDITOR;
  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [keepAliveModes, setKeepAliveModes] = useState<AppMode[]>(() =>
    KEEP_ALIVE_MODES.has(initialMode) ? [initialMode] : []
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved ? saved === 'dark' : true;
  });
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    if (getInitialModeFromHash()) return false;
    return sessionStorage.getItem(ENTERED_STUDIO_KEY) !== 'true';
  });

  const setMode = useCallback((nextMode: AppMode) => {
    setModeState(nextMode);
    setKeepAliveModes((prev) => updateKeepAliveQueue(prev, nextMode));
    const nextHash = MODE_TO_HASH[nextMode];
    if (nextHash && window.location.hash !== `#${nextHash}`) {
      window.history.replaceState(null, '', `#${nextHash}`);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const hashMode = getInitialModeFromHash();
      if (hashMode) {
        setShowLanding(false);
        setModeState(hashMode);
        setKeepAliveModes((prev) => updateKeepAliveQueue(prev, hashMode));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => setIsDarkMode((prev) => !prev), []);

  const handleEnterStudio = useCallback(() => {
    sessionStorage.setItem(ENTERED_STUDIO_KEY, 'true');
    setShowLanding(false);
    const hash = MODE_TO_HASH[mode];
    if (hash) window.history.replaceState(null, '', `#${hash}`);
  }, [mode]);

  const mountedModes = useMemo(() => {
    return keepAliveModes.includes(mode) ? keepAliveModes : [...keepAliveModes, mode];
  }, [keepAliveModes, mode]);

  if (showLanding) {
    return (
      <LoginGate>
        <LandingPage onStart={handleEnterStudio} />
      </LoginGate>
    );
  }

  const renderModeComponent = (m: AppMode) => {
    switch (m) {
      case AppMode.IMAGE_EDITOR:
        return <ImageEditor />;
      case AppMode.MULTI_ANGLE:
        return <MultiAngleStudio />;
      case AppMode.BATCH_FASHION:
        return <BatchFashionStudio />;
      case AppMode.BACKGROUND_REMOVER:
        return <BackgroundRemover />;
      case AppMode.VIDEO_GENERATOR:
        return <VideoGenerator />;
      case AppMode.PROMPT_GENERATOR:
        return <PromptGenerator />;
      case AppMode.MANUAL_EDITOR:
        return <ManualEditor />;
      case AppMode.HISTORY:
        return <HistoryGallery />;
      case AppMode.GUIDE:
        return <UserGuide />;
      case AppMode.PROMPT_LIBRARY:
        return <PromptLibrary onSwitchMode={setMode} />;
      case AppMode.WORKFLOW:
        return <WorkflowStudio />;
      default:
        return null;
    }
  };

  return (
    <LoginGate>
      <ProjectProvider>
        <div className="animate-in fade-in duration-500 flex h-screen">
          <Suspense fallback={<StudioFallback />}>
            <Layout currentMode={mode} onSwitchMode={setMode} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto relative">
                  <ErrorBoundary onResetMode={() => setMode(AppMode.IMAGE_EDITOR)}>
                    <Suspense fallback={<StudioFallback />}>
                      {mountedModes.map((mountedMode) => (
                        <div
                          key={mountedMode}
                          className={mode === mountedMode ? 'h-full w-full flex flex-col' : 'hidden'}
                        >
                          {renderModeComponent(mountedMode)}
                        </div>
                      ))}
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>
            </Layout>
          </Suspense>
          <Toaster position="top-right" richColors closeButton />
        </div>
      </ProjectProvider>
    </LoginGate>
  );
};

export default App;
