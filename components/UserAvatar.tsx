import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UserAvatarProps {
  variant?: 'compact' | 'sidebar';
}

export default function UserAvatar({ variant = 'compact' }: UserAvatarProps) {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Loading state
  if (loading) {
    return (
      <div className="h-8 w-24 rounded-full bg-white/5 animate-pulse" />
    );
  }

  // Not logged in -> Show Google Sign-In button
  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 active:scale-95 transition-all text-xs font-semibold text-white/90 backdrop-blur-md shadow-sm group ${
          variant === 'sidebar' ? 'w-full justify-center' : ''
        }`}
        title="Đăng nhập bằng tài khoản Google để sử dụng Google Flow"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 group-hover:scale-110 transition-transform">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className={variant === 'sidebar' ? 'block' : 'hidden sm:inline'}>Đăng nhập Google</span>
      </button>
    );
  }

  const displayName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
  const fullName = user.displayName || user.email?.split('@')[0] || 'User';
  const initials = (user.displayName || user.email || 'U')[0].toUpperCase();

  // Sidebar variant (Desktop sidebar bottom)
  if (variant === 'sidebar') {
    return (
      <div ref={ref} className="relative w-full">
        <button
          onClick={() => setOpen(!open)}
          className="w-full bg-black/25 hover:bg-black/40 backdrop-blur-md rounded-2xl p-2 border border-white/10 hover:border-white/20 flex items-center gap-2.5 transition-all group text-left"
          title={`${fullName} (${user.email})`}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={fullName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border border-indigo-500/50 object-cover shrink-0 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 group-hover:scale-105 transition-transform">
              {initials}
            </div>
          )}
          <div className="hidden lg:block min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-bold text-[11px] text-white truncate block">{fullName}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Google Flow sẵn sàng" />
            </div>
            <span className="text-[9px] text-slate-400 truncate block">{user.email}</span>
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 w-64 bg-[#11131a] border border-white/15 rounded-2xl p-3 backdrop-blur-2xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-white/10">
              {user.photoURL ? (
                <img src={user.photoURL} alt={fullName} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border border-indigo-500/50 object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">{initials}</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-white truncate">{user.displayName || 'Google Account'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2 flex items-center gap-2">
              <span className="text-xs">🍌</span>
              <span className="text-[10px] text-emerald-400 font-medium">Google Flow: Đã kết nối</span>
            </div>

            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-xs font-semibold"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 17l5-5-5-5M21 12H9M13 22H5a2 2 0 01-2-2V4a2 2 0 012-2h8"/>
              </svg>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    );
  }

  // Compact variant (Header / Topbar)
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        title={user.displayName || user.email || 'Tài khoản'}
        className={`flex items-center gap-2 p-1 pr-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-all text-white text-xs font-medium backdrop-blur-md ${
          open ? 'ring-2 ring-indigo-500/40 bg-white/10' : ''
        }`}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full border border-indigo-500/50 object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[11px]">
            {initials}
          </div>
        )}
        <span className="hidden sm:inline max-w-[90px] truncate">{displayName}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-60 bg-[#11131a] border border-white/15 rounded-2xl p-3 backdrop-blur-2xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="pb-2.5 mb-2 border-b border-white/10">
            <p className="font-bold text-xs text-white truncate">{user.displayName || 'Google Account'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>

          <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2 flex items-center gap-2">
            <span className="text-xs">🍌</span>
            <span className="text-[10px] text-emerald-400 font-medium">Google Flow: Đã kết nối</span>
          </div>

          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-xs font-semibold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17l5-5-5-5M21 12H9M13 22H5a2 2 0 01-2-2V4a2 2 0 012-2h8"/>
            </svg>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
