
import React, { useState, useEffect } from 'react';
import { AppMode } from './types';

// Lazy load studio components
const Layout = React.lazy(() => import('./components/Layout'));
const ImageEditor = React.lazy(() => import('./components/ImageEditor'));
const MultiAngleStudio = React.lazy(() => import('./components/MultiAngleStudio'));
const BatchFashionStudio = React.lazy(() => import('./components/BatchFashionStudio'));
const BackgroundRemover = React.lazy(() => import('./components/BackgroundRemover'));
const VideoGenerator = React.lazy(() => import('./components/VideoGenerator'));
const PromptGenerator = React.lazy(() => import('./components/PromptGenerator'));
const ManualEditor = React.lazy(() => import('./components/ManualEditor'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.IMAGE_EDITOR);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode for better aesthetics
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  return (
    <div className="animate-in fade-in duration-1000">
      <React.Suspense fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      }>
        <Layout currentMode={mode} onSwitchMode={setMode} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
          {mode === AppMode.IMAGE_EDITOR && <ImageEditor />}
          {mode === AppMode.MULTI_ANGLE && <MultiAngleStudio />}
          {mode === AppMode.BATCH_FASHION && <BatchFashionStudio />}
          {mode === AppMode.BACKGROUND_REMOVER && <BackgroundRemover />}
          {mode === AppMode.VIDEO_GENERATOR && <VideoGenerator />}
          {mode === AppMode.PROMPT_GENERATOR && <PromptGenerator />}
          {mode === AppMode.MANUAL_EDITOR && <ManualEditor />}
        </Layout>
      </React.Suspense>
    </div>
  );
};

export default App;
