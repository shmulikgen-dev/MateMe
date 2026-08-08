import React, { useState } from 'react';
import { useAuth } from '../useAuth';
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AuthScreen() {
  const { t } = useTranslation();
  const { loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Honeypot for bot protection
  const [website, setWebsite] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
        setError(t('emailExistsError', 'האימייל הזה כבר רשום במערכת. אנא התחבר.'));
        setMode('login');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(t('invalidCredentials', 'אימייל או סיסמה שגויים. נסה שוב.'));
      } else {
        setError(t('authError', 'אירעה שגיאה. נא לנסות שוב.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem', background: 'var(--bg-color)' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <ShieldCheck size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-color)' }}>
            {mode === 'login' ? t('welcomeBack', 'ברוך שובך') : 
             mode === 'register' ? t('createAccount', 'יצירת חשבון') : 
             t('resetPassword', 'איפוס סיסמה')}
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>
            {mode === 'login' ? t('loginToContinue', 'התחבר כדי להמשיך') : 
             mode === 'register' ? t('joinCommunity', 'הצטרף לקהילה שלנו') : 
             t('enterEmailToReset', 'הזן אימייל לקבלת קישור')}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        
        {message && (
          <div style={{ background: '#dcfce7', color: '#10b981', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Honeypot field (hidden from users) */}
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
            <Mail size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input 
              type="email" 
              placeholder={t('emailPlaceholder', 'אימייל')} 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
              autoComplete="email"
            />
          </div>

          {mode !== 'forgot' && (
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="password" 
                placeholder={t('passwordPlaceholder', 'סיסמה')} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn" 
            disabled={loading}
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? t('loading', 'טוען...') : (
              <>
                {mode === 'login' ? t('login', 'התחבר') : mode === 'register' ? t('register', 'הרשם') : t('sendResetLink', 'שלח קישור')}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', opacity: 0.8, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {mode === 'login' ? (
            <>
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('forgot')}>
                {t('forgotPasswordPrompt', 'שכחת סיסמה?')}
              </span>
              <span>
                {t('noAccountPrompt', 'אין לך חשבון?')} {' '}
                <span style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setMode('register')}>
                  {t('registerNow', 'הירשם עכשיו')}
                </span>
              </span>
            </>
          ) : (
            <span>
              {t('haveAccountPrompt', 'יש לך כבר חשבון?')} {' '}
              <span style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setMode('login')}>
                {t('loginNow', 'התחבר עכשיו')}
              </span>
            </span>
          )}
        </div>
        
      </div>
    </div>
  );
}
