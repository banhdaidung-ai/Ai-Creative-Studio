import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from '../lib/firebase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  getIdToken: async () => null,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        localStorage.setItem('google_account_pro', 'true');
        localStorage.setItem('google_account_email', firebaseUser.email || '');
        window.dispatchEvent(new Event('gemini_api_key_updated'));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  // Lấy Firebase ID Token để gửi lên backend nếu cần
  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken(/* forceRefresh */ true);
    } catch {
      return null;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
