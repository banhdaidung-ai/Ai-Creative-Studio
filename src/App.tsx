
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ImageEditor from './components/ImageEditor';
import MultiAngleStudio from './components/MultiAngleStudio';
import BatchFashionStudio from './components/BatchFashionStudio';
import BackgroundRemover from './components/BackgroundRemover';
import VideoGenerator from './components/VideoGenerator';
import PromptGenerator from './components/PromptGenerator';
import ManualEditor from './components/ManualEditor';
import LandingPage from './components/LandingPage';
import HistoryGallery from './components/HistoryGallery';
import UserGuide from './components/UserGuide';
import PromptLibrary from './components/PromptLibrary';
import WorkflowStudio from './components/WorkflowStudio';
import LoginGate from './components/LoginGate';
import { AppMode } from './types';
import { ProjectProvider } from './contexts/ProjectContext';
import { Toaster } from 'sonner';

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
    return (
      <LoginGate>
        <LandingPage onStart={() => setShowLanding(false)} />
      </LoginGate>
    );
  }

  return (
    <LoginGate>
      <ProjectProvider>
        <div className="animate-in fade-in duration-1000 flex h-screen">
          <Layout currentMode={mode} onSwitchMode={setMode} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-auto">
                {mode === AppMode.IMAGE_EDITOR && <ImageEditor />}
                {mode === AppMode.MULTI_ANGLE && <MultiAngleStudio />}
                {mode === AppMode.BATCH_FASHION && <BatchFashionStudio />}
                {mode === AppMode.BACKGROUND_REMOVER && <BackgroundRemover />}
                {mode === AppMode.VIDEO_GENERATOR && <VideoGenerator />}
                {mode === AppMode.PROMPT_GENERATOR && <PromptGenerator />}
                {mode === AppMode.MANUAL_EDITOR && <ManualEditor />}
                {mode === AppMode.HISTORY && <HistoryGallery />}
                {mode === AppMode.GUIDE && <UserGuide />}
                {mode === AppMode.PROMPT_LIBRARY && <PromptLibrary onSwitchMode={setMode} />}
                {mode === AppMode.WORKFLOW && <WorkflowStudio />}
              </div>
            </div>
          </Layout>
          <Toaster position="top-right" richColors closeButton />
        </div>
      </ProjectProvider>
    </LoginGate>
  );
};

export default App;
