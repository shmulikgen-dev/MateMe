import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Hand } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import CreatePost from './components/CreatePost';
import Feed from './components/Feed';
import MyPosts from './components/MyPosts';
import Chat from './components/Chat';
import Inbox from './components/Inbox';
import AdminPanel from './components/AdminPanel';
import './i18n';
import './App.css';

function Home() {
  const { t, i18n } = useTranslation();
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(newLang);
    document.body.style.direction = newLang === 'he' ? 'rtl' : 'ltr';
  };
  
  // Ensure correct direction on mount
  useEffect(() => {
    document.body.style.direction = i18n.language === 'he' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <button onClick={toggleLanguage} style={{ position: 'absolute', top: 10, right: 10, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>
        {i18n.language === 'he' ? 'EN' : 'HE'}
      </button>

      <div className="glass" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>{t('appTitle')}</h1>
        <p style={{ margin: '0 0 2rem 0', fontSize: '1.1rem' }}>{t('appSubtitle')}</p>
        
        {user ? (
          <div className="animate-fade-in">
            <p style={{opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
              <span style={{width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary-color)', display: 'inline-block'}}></span>
              {profile?.alias ? `${profile.alias} | ${t('trustScore')}: ${profile.trustScore}` : t('loggedInAs')}
            </p>
            
            {profile?.trustScore === 0 && (
              <div className="animate-float" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.8rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.8rem', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px', borderRadius: '50%' }}><Hand size={18} /></div>
                <div style={{ textAlign: 'left' }}>
                  <strong>{t('welcomeTooltipTitle')} 👋</strong>
                  <div style={{opacity: 0.9}}>{t('welcomeTooltipDesc')}</div>
                </div>
                <div style={{ position: 'absolute', bottom: '-8px', left: '25%', width: '15px', height: '15px', background: 'var(--primary-color)', transform: 'rotate(45deg)', borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
              <button className="btn" onClick={() => navigate('/create')} style={{ flex: 1, padding: '1rem' }}>
                {t('newRequest')}
              </button>
              <button className="btn" onClick={() => navigate('/feed')} style={{ flex: 1, padding: '1rem', background: 'var(--secondary-color)', boxShadow: '0 4px 15px var(--secondary-glow)' }}>
                {t('viewFeed')}
              </button>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <button className="btn" onClick={() => navigate('/dashboard')} style={{ width: '100%', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxShadow: 'none' }}>
                {t('myDashboard')}
              </button>
            </div>
            
            <Inbox />

            {profile?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} style={{ marginTop: '1rem', width: '100%', background: 'rgba(255,0,0,0.1)', border: '1px solid red', color: 'red', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}>
                Admin Panel
              </button>
            )}

            <button onClick={logout} style={{ marginTop: '2rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>{t('logout')}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const { user, profile, loading, loginAnonymously, registerUser } = useAuth();
  
  // Registration Form State
  const [formData, setFormData] = useState({
    alias: '',
    email: '',
    phone: '',
    city: '',
    intent: 'both' as 'demand' | 'supply' | 'both',
    age: '',
    interests: '',
    language: 'he',
    tosAgreed: false
  });

  if (loading) return <div style={{textAlign: 'center', padding: '2rem'}}>Loading...</div>;

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="glass animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
          <h2 style={{ color: 'var(--primary-color)' }}>{t('appTitle')}</h2>
          <p style={{ margin: '1rem 0' }}>{t('appSubtitle')}</p>
          <button className="btn" onClick={loginAnonymously} style={{ marginTop: '1rem', width: '100%' }}>{t('enterAnonymously')}</button>
        </div>
      </div>
    );
  }

  // Enforce Registration before accessing the app
  if (user && !profile) {
    const isFormValid = formData.alias && formData.email && formData.city && formData.tosAgreed;
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="glass animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
          <h2 style={{textAlign: 'center'}}>Complete Registration</h2>
          <p style={{ opacity: 0.8, fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>Your personal details (Email, Phone) remain strictly private and will never be shared with other users.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem'}}>
            <input type="text" placeholder="Alias (Publicly Visible) *" value={formData.alias} onChange={e => setFormData({...formData, alias: e.target.value})} style={{width: '100%'}} />
            <input type="email" placeholder="Email Address *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{width: '100%'}} />
            <input type="tel" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{width: '100%'}} />
            <input type="text" placeholder="City of Residence *" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={{width: '100%'}} />
            
            <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
              <input type="number" placeholder="Age" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={{width: '80px'}} />
              <select value={formData.intent} onChange={e => setFormData({...formData, intent: e.target.value as any})} style={{flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'white'}}>
                <option value="both">I Need & Offer Help</option>
                <option value="demand">I Only Need Help</option>
                <option value="supply">I Only Offer Help</option>
              </select>
            </div>
            
            <input type="text" placeholder="Interests / Categories (e.g., Gardening, Tech)" value={formData.interests} onChange={e => setFormData({...formData, interests: e.target.value})} style={{width: '100%'}} />
            
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem'}}>
              <input type="checkbox" checked={formData.tosAgreed} onChange={e => setFormData({...formData, tosAgreed: e.target.checked})} />
              I agree to the Terms of Service. MateMe acts only as an intermediary.
            </label>
          </div>

          <button 
            className="btn" 
            onClick={() => registerUser({...formData, age: Number(formData.age)})}
            disabled={!isFormValid}
            style={{ width: '100%' }}
          >
            {t('save')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/feed" element={<Feed />} />
      <Route path="/create" element={<CreatePost />} />
      <Route path="/dashboard" element={<MyPosts />} />
      <Route path="/chat/:chatId" element={<Chat />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  );
}

export default App;
