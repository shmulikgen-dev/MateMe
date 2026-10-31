import React, { useState } from 'react';
import { useAuth } from '../useAuth';
import { Mail, Lock, ShieldCheck, ArrowRight, Users, ShoppingBag, Sparkles, Calendar, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AuthScreen() {
  const { t } = useTranslation();
  const { loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Honeypot for bot protection
  const [website, setWebsite] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleTheme = () => {
    const newTheme = isLightMode ? 'dark' : 'light';
    setIsLightMode(!isLightMode);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Bot protection: if honeypot is filled, silently reject
    if (website !== '') {
      return; 
    }
    
    if (!email) {
      setError(t('emailRequired', 'נא להזין אימייל'));
      return;
    }
    
    try {
      setLoading(true);
      if (mode === 'login') {
        if (!password) {
          setError(t('passwordRequired', 'נא להזין סיסמה'));
          return;
        }
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        if (!password || password.length < 6) {
          setError(t('passwordLength', 'סיסמה חייבת להכיל לפחות 6 תווים'));
          return;
        }
        await registerWithEmail(email, password);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setMessage(t('resetEmailSent', 'נשלח אימייל לאיפוס סיסמה (בדוק גם בספאם)'));
        setMode('login');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'email_exists' || err.code === 'auth/email-already-in-use') {
        setError(t('emailExistsError', 'האימייל הזה כבר רשום במערכת. העברנו אותך להתחברות.'));
        setMode('login');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(t('invalidCredentials', 'אימייל או סיסמה שגויים. אם עדיין לא נרשמת, עבור ללשונית "הצטרפות חינם".'));
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('שגיאה: התחברות באמצעות אימייל וסיסמה חסומה בפיירבייס!');
      } else {
        setError(t('authError', 'אירעה שגיאה. נא לנסות שוב.') + ' ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '1.25rem 1rem', position: 'relative' }}>
      {/* Theme Toggle on Landing Page */}
      <button
        type="button"
        onClick={toggleTheme}
        style={{
          position: 'fixed',
          top: 'calc(15px + env(safe-area-inset-top))',
          right: '15px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          padding: '10px',
          minWidth: '44px',
          minHeight: '44px',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}
        title="החלף ערכת נושא"
      >
        {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Inviting Hero Banner */}
        <div style={{ textAlign: 'center', padding: '0.5rem 0.25rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              background: 'var(--badge-demand-bg)',
              color: 'var(--badge-demand-text)',
              border: '1px solid var(--primary-color)',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '0.75rem'
            }}
          >
            <Sparkles size={14} />
            <span>קהילה מקומית חכמה, אנונימית ובטוחה</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
            <img
              src="/logo.svg"
              alt="MateMe Logo"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                boxShadow: '0 6px 18px rgba(30, 58, 138, 0.25)'
              }}
            />
            <h1 style={{ margin: 0, fontSize: '2.35rem', lineHeight: 1.15 }}>
              MateMe
            </h1>
          </div>
          <p style={{ margin: '0 auto', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '420px', lineHeight: 1.45 }}>
            המקום שבו שכנים, חברים וקהילות עוזרים זה לזה סביבך
          </p>
          <p style={{ margin: '0.4rem auto 0', fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '410px', lineHeight: 1.5 }}>
            מסירת חפצים ויד שנייה, בקשת עזרה הדדית, קהילות ייעודיות (שכונה, מילואים, תחביבים) ואירועים קרובים — בפרטיות מלאה וללא חשיפת הטלפון האישי שלך.
          </p>

          {/* Value Proposition Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginTop: '1.1rem' }}>
            <div className="glass" style={{ padding: '0.7rem 0.45rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <ShoppingBag size={20} color="#10b981" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>יד שנייה ומסירה</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>מסירה ומכירה קרוב לבית</span>
            </div>
            <div className="glass" style={{ padding: '0.7rem 0.45rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={20} color="var(--primary-color)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>קהילות ועזרה</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>קבוצות סגורות ודירוג אמון</span>
            </div>
            <div className="glass" style={{ padding: '0.7rem 0.45rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={20} color="var(--accent-color)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>אירועים ומפגשים</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>פופ-אפ וסנכרון ליומן</span>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="glass animate-fade-in" style={{ width: '100%', padding: '1.6rem', borderRadius: '18px', boxSizing: 'border-box', border: '1px solid var(--primary-color)' }}>
          {/* Mode Switcher Tabs */}
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', background: 'var(--surface-subtle)', padding: '0.3rem', borderRadius: '12px', marginBottom: '1.35rem', border: '1px solid var(--glass-border)' }}>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: mode === 'register' ? 'var(--primary-color)' : 'transparent',
                  color: mode === 'register' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                הצטרפות מהירה (חינם)
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: mode === 'login' ? 'var(--primary-color)' : 'transparent',
                  color: mode === 'login' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                כניסה לחשבון קיים
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '1.15rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)' }}>
              {mode === 'register'
                ? 'בואו נתחיל ב-30 שניות 🚀'
                : mode === 'login'
                ? 'שמחים לראות אותך שוב! 👋'
                : t('resetPassword', 'איפוס סיסמה')}
            </h2>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {mode === 'register'
                ? 'הפרטים האישיים שלך נשארים חסויים — בקהילה תופיע רק בכינוי שתבחר.'
                : mode === 'login'
                ? 'הזן את האימייל והסיסמה שלך כדי להיכנס לקהילה'
                : t('enterEmailToReset', 'הזן אימייל לקבלת קישור לאיפוס סיסמה')}
            </p>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'center', fontWeight: 500 }}>
              {error}
            </div>
          )}
          
          {message && (
            <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'center', fontWeight: 500 }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Honeypot field */}
            <input 
              type="text" 
              name="website" 
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div style={{ position: 'relative' }}>
              <Mail size={19} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.55 }} />
              <input 
                type="email" 
                placeholder={t('emailPlaceholder', 'כתובת אימייל')} 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 2.5rem 0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                autoComplete="email"
              />
            </div>

            {mode !== 'forgot' && (
              <div style={{ position: 'relative' }}>
                <Lock size={19} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.55 }} />
                <input 
                  type="password" 
                  placeholder={mode === 'register' ? 'בחר סיסמה (לפחות 6 תווים)' : t('passwordPlaceholder', 'סיסמה')} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 2.5rem 0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            <button 
              type="submit" 
              className="btn" 
              disabled={loading}
              style={{ width: '100%', padding: '0.9rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700 }}
            >
              {loading ? t('loading', 'טוען...') : (
                <>
                  {mode === 'login' ? 'התחבר לקהילה' : mode === 'register' ? 'הצטרף עכשיו לקהילה' : t('sendResetLink', 'שלח קישור לאיפוס')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.15rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {mode === 'login' && (
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('forgot')}>
                {t('forgotPasswordPrompt', 'שכחת סיסמה?')}
              </span>
            )}
            {mode === 'forgot' && (
              <span style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600 }} onClick={() => setMode('login')}>
                חזרה למסך ההתחברות
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.76rem', opacity: 0.8, marginTop: '0.25rem' }}>
              <ShieldCheck size={14} color="var(--secondary-color)" />
              <span>פרטיות מלאה • ללא פרסומות • מבוסס אמון קהילתי</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
