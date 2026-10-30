import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { ArrowLeft, Save, BellRing, User, Send, CheckCircle2, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'catSecondHand',
  'catRepairs',
  'catDeliveries',
  'catTeaching',
  'catBabysitting',
  'catLending',
  'catCommunity',
  'catTech',
  'catOther'
];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, user, requestNotificationPermission } = useAuth();
  
  const [alias, setAlias] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [subscribedCategories, setSubscribedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [testPushStatus, setTestPushStatus] = useState('');
  const [testingPush, setTestingPush] = useState(false);
  const browserPerm = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

  useEffect(() => {
    if (profile) {
      setAlias(profile.alias || '');
      setCity(profile.city || '');
      setBio(profile.bio || '');
      setInterests(profile.interests || '');
      setPushEnabled(profile.pushEnabled || false);
      setSubscribedCategories(profile.subscribedCategories || []);
    }
  }, [profile]);

  const toggleCategory = (cat: string) => {
    setSubscribedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handlePushToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      const success = await requestNotificationPermission();
      if (success) {
        setPushEnabled(true);
      } else {
        // Revert toggle
        e.target.checked = false;
        setPushEnabled(false);
      }
    } else {
      setPushEnabled(false);
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTestingPush(true);
    setTestPushStatus('');
    try {
      if (!('Notification' in window)) {
        setTestPushStatus('❌ הדפדפן הנוכחי אינו תומך בהתראות (באייפון חובה להוסיף למסך הבית PWA).');
        setTestingPush(false);
        return;
      }

      if (Notification.permission !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) {
          setTestPushStatus('❌ חסרה הרשאת התראות בדפדפן. אנא אשר קבלת התראות בסרגל הכתובת.');
          setTestingPush(false);
          return;
        }
      }

      const title = 'בדיקת התראה מ-MateMe 🔔';
      const body = `היי ${alias || 'חבר'}, התראות הפוש פועלות בהצלחה במכשיר זה!`;

      // 1. Trigger system push notification via Service Worker (or Notification API fallback)
      let shownViaSW = false;
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(title, {
            body,
            icon: '/vite.svg',
            badge: '/vite.svg'
          });
          shownViaSW = true;
        }
      }
      if (!shownViaSW) {
        new window.Notification(title, { body, icon: '/vite.svg' });
      }

      // 2. Also create a real test notification in Firestore so the top-left NotificationBell lights up
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        type: 'test_push',
        message: '🔔 התראת בדיקה נשלחה בהצלחה! המערכת מחוברת.',
        read: false,
        createdAt: serverTimestamp()
      });

      setTestPushStatus('✅ התראת בדיקה נשלחה! אמורה לקפוץ כעת הודעה על המסך + חיווי בפעמון למעלה.');
    } catch (err) {
      console.error('Error testing push:', err);
      setTestPushStatus('❌ שגיאה בשליחת התראת הבדיקה. בדוק שהדפדפן מאפשר התראות לאתר.');
    }
    setTestingPush(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setStatus('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        alias,
        city,
        bio,
        interests,
        pushEnabled,
        subscribedCategories
      });
      setStatus(t('settingsSaved'));
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setStatus('Error saving settings.');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <div className="glass animate-fade-in" style={{ padding: '2rem', borderRadius: '16px' }}>
        <h2 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <User size={24} /> {t('profileSettings')}
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('alias')}</label>
          <input 
            type="text" 
            value={alias} 
            onChange={(e) => setAlias(e.target.value)} 
            style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('city')}</label>
          <input 
            type="text" 
            value={city} 
            onChange={(e) => setCity(e.target.value)} 
            style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('bio', 'קצת עלי')}</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder={t('bioPlaceholder', 'כתוב כמה מילים על עצמך, במה אתה יכול לעזור...')}
            style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box', minHeight: '100px', borderRadius: '8px' }} 
          />
        </div>
        
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('interests', 'תחומי עניין (מופרדים בפסיק)')}</label>
          <input 
            type="text" 
            value={interests} 
            onChange={(e) => setInterests(e.target.value)} 
            placeholder={t('interestsPlaceholder', 'גינון, הייטק, בישול...')}
            style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box', borderRadius: '8px' }} 
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '2rem 0' }} />

        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BellRing size={20} color="var(--primary-color)" /> {t('notificationPreferences')}
        </h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem' }}>
          {t('notificationDesc')}
        </p>

        <div style={{ marginBottom: '1.5rem', background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BellRing size={18} /> {t('enablePushNotifications', 'אפשר התראות פוש (Push)')}
            </strong>
            <input 
              type="checkbox" 
              checked={pushEnabled} 
              onChange={handlePushToggle} 
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)' }}
            />
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {browserPerm === 'granted' ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
              הרשאת דפדפן: <strong>{browserPerm === 'granted' ? 'מאושר' : browserPerm === 'denied' ? 'חסום בדפדפן' : 'טרם אושר'}</strong>
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {(profile as any)?.fcmToken ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
              חיבור שרת (FCM): <strong>{(profile as any)?.fcmToken ? 'מחובר' : 'ממתין להפעלה'}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleTestPush}
            disabled={testingPush}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--primary-color)',
              background: 'var(--badge-demand-bg)',
              color: 'var(--badge-demand-text)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            <Send size={16} />
            {testingPush ? 'שולח התראת בדיקה...' : 'שלח התראת פוש לבדיקה במכשיר זה'}
          </button>

          {testPushStatus && (
            <div style={{ fontSize: '0.85rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              {testPushStatus}
            </div>
          )}
        </div>

        <h4 style={{ margin: '0 0 1rem 0' }}>{t('subscribeCategories', 'התראות עבור קטגוריות:')}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          {CATEGORIES.map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem', background: 'var(--surface-subtle)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <input 
                type="checkbox" 
                checked={subscribedCategories.includes(cat)} 
                onChange={() => toggleCategory(cat)} 
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)' }}
              />
              <span>{t(cat)}</span>
            </label>
          ))}
        </div>

        <button className="btn" onClick={handleSave} disabled={loading} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? t('processing') : <><Save size={20} /> {t('saveChanges')}</>}
        </button>

        {status && <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--primary-color)' }}>{status}</p>}
      </div>
    </div>
  );
}
