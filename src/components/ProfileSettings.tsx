import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { ArrowLeft, Save, BellRing, User } from 'lucide-react';

const CATEGORIES = [
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
  const { profile, user } = useAuth();
  
  const [alias, setAlias] = useState('');
  const [city, setCity] = useState('');
  const [subscribedCategories, setSubscribedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profile) {
      setAlias(profile.alias || '');
      setCity(profile.city || '');
      setSubscribedCategories(profile.subscribedCategories || []);
    }
  }, [profile]);

  const toggleCategory = (cat: string) => {
    setSubscribedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
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

        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '2rem 0' }} />

        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BellRing size={20} color="var(--primary-color)" /> {t('notificationPreferences')}
        </h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem' }}>
          {t('notificationDesc')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          {CATEGORIES.map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
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
