import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signInWithGoogle, signInAsGuest } = useAuth();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)',
      }}>
        <div className="login-spinner" />
      </div>
    );
  }

  // ── Logged in — show app ───────────────────────────────────────────────────
  if (user) {
    return <>{children}</>;
  }

  // ── Login Gate ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient background orbs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '500px', height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%',
        width: '600px', height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '15%',
        width: '300px', height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(24px)',
        borderRadius: '24px',
        padding: '56px 48px',
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'loginFadeUp 0.6s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Logo */}
        <div style={{
          width: '80px', height: '80px',
          borderRadius: '22px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '38px',
          margin: '0 auto 28px',
          boxShadow: '0 8px 32px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.2)',
        }}>✦</div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 10px',
          fontSize: '28px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.5px',
        }}>
          YODY Creative Studio
        </h1>
        <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.55)', fontSize: '15px' }}>
          Tạo hình ảnh &amp; video bằng AI của Google
        </p>
        <p style={{ margin: '0 0 36px', color: 'rgba(255,255,255,0.35)', fontSize: '13px', lineHeight: 1.6 }}>
          Đăng nhập bằng Google Account để bắt đầu tạo nội dung<br />
          với <strong style={{ color: '#6366f1' }}>Gemini</strong>,{' '}
          <strong style={{ color: '#f59e0b' }}>Nano Banana Pro</strong> và{' '}
          <strong style={{ color: '#ec4899' }}>Google Flow</strong>
        </p>

        {/* Sign In Button */}
        <button
          id="google-signin-main-btn"
          onClick={signInWithGoogle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 28px',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.07)',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all 0.25s ease',
            width: '100%',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget;
            btn.style.background = 'rgba(255,255,255,0.13)';
            btn.style.borderColor = 'rgba(255,255,255,0.28)';
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget;
            btn.style.background = 'rgba(255,255,255,0.07)';
            btn.style.borderColor = 'rgba(255,255,255,0.18)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
          }}
        >
          {/* Google Logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Đăng nhập với Google
        </button>

        {/* Guest / Demo Tryout Button */}
        <button
          id="guest-signin-btn"
          onClick={signInAsGuest}
          style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '50px',
            border: '1px dashed rgba(255,255,255,0.2)',
            background: 'transparent',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span>🚀</span>
          <span>Dùng thử nhanh (Chế độ Khách / Demo)</span>
        </button>

        {/* Feature list */}
        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
          {[
            { icon: '✅', text: 'Không cần API key — dùng Google Account cá nhân' },
            { icon: '🍌', text: 'Tạo ảnh chi tiết sắc nét với Nano Banana Pro (Google Flow)' },
            { icon: '🎬', text: 'Tạo video AI điện ảnh với Veo (Text & Image-to-Video)' },
            { icon: '✨', text: 'Tối ưu prompt tự động bằng Gemini AI' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          marginTop: '24px', marginBottom: 0,
          fontSize: '11px', color: 'rgba(255,255,255,0.25)',
          lineHeight: 1.5,
        }}>
          Bằng cách đăng nhập, bạn đồng ý sử dụng dịch vụ với mục đích cá nhân.
        </p>
      </div>

      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-spinner {
          width: 44px; height: 44px;
          border: 3px solid rgba(99,102,241,0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
