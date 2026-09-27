// ============================================================
// Firebase Client SDK Configuration — YODY Creative Studio
// Khởi tạo Firebase app phía client (browser)
// ============================================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey:            metaEnv.VITE_FIREBASE_API_KEY || 'AIzaSyDyyEkPtI1147gFlmv4GLPN431_ZXFLGGo',
  authDomain:        metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'ai-creative-studio-2026.firebaseapp.com',
  projectId:         metaEnv.VITE_FIREBASE_PROJECT_ID || 'ai-creative-studio-2026',
  storageBucket:     metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'ai-creative-studio-2026.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '540235016555',
  appId:             metaEnv.VITE_FIREBASE_APP_ID || '1:540235016555:web:d0c38b25c83311408c842e',
};

// Chỉ khởi tạo một lần (tránh lỗi duplicate khi hot reload)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google Provider
const googleProvider = new GoogleAuthProvider();
// Yêu cầu thêm thông tin profile để hiển thị ảnh avatar
googleProvider.addScope('profile');
googleProvider.addScope('email');

export { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
export type { User };
