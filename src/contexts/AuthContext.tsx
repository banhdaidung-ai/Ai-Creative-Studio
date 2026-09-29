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
  signInAsGuest: () => void;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInAsGuest: () => {},
  logout: async () => {},
  getIdToken: async () => null,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const isGuest = localStorage.getItem('guest_mode') === 'true';
    if (isGuest) {
      return {
        uid: 'guest-demo-user',
        email: 'guest@yody.io',
        displayName: 'Khách trải nghiệm',
        photoURL: '',
        getIdToken: async () => 'demo-token',
      } as unknown as User;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.removeItem('guest_mode');
        localStorage.setItem('google_account_pro', 'true');
        localStorage.setItem('google_account_email', firebaseUser.email || '');
        window.dispatchEvent(new Event('gemini_api_key_updated'));
      } else {
        const isGuest = localStorage.getItem('guest_mode') === 'true';
        if (isGuest) {
          setUser({
            uid: 'guest-demo-user',
            email: 'guest@yody.io',
            displayName: 'Khách trải nghiệm',
            photoURL: '',
            getIdToken: async () => 'demo-token',
          } as unknown as User);
        } else {
          setUser(null);
        }
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

  const signInAsGuest = useCallback(() => {
    localStorage.setItem('guest_mode', 'true');
    setUser({
      uid: 'guest-demo-user',
      email: 'guest@yody.io',
      displayName: 'Khách trải nghiệm',
      photoURL: '',
      getIdToken: async () => 'demo-token',
    } as unknown as User);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('guest_mode');
    await signOut(auth).catch(() => {});
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
