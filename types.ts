
export enum AppMode {
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  MULTI_ANGLE = 'MULTI_ANGLE',
  BATCH_FASHION = 'BATCH_FASHION',
  BACKGROUND_REMOVER = 'BACKGROUND_REMOVER',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  PROMPT_GENERATOR = 'PROMPT_GENERATOR',
  MANUAL_EDITOR = 'MANUAL_EDITOR',
  SEARCH_CHAT = 'SEARCH_CHAT',
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { uri: string; title: string }[];
}

// Window augmentation for Veo API key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  
  interface Window {
    aistudio?: AIStudio;
  }
}