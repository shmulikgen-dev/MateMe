import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Plus, Settings, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import CreatePost from './components/CreatePost';
import ProfileSettings from './components/ProfileSettings';
import UserProfileView from './components/UserProfileView';
import NotificationBell from './components/NotificationBell';
import Feed from './components/Feed';
import MyPosts from './components/MyPosts';
import Chat from './components/Chat';
import Inbox from './components/Inbox';
import AdminPanel from './components/AdminPanel';
import PostView from './components/PostView';
import MyCommunities from './components/MyCommunities';
import JoinCommunity from './components/JoinCommunity';
import CommunityView from './components/CommunityView';
import ManagerDashboard from './components/ManagerDashboard';
import OnboardingModal from './components/OnboardingModal';
import AuthScreen from './components/AuthScreen';
import './i18n';
import './App.css';

function Home() {
  const { t, i18n } = useTranslation();
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light');
  
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
    <div style={{ padding: '1rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ position: 'fixed', top: 'calc(15px + env(safe-area-inset-top))', right: 15, display: 'flex', gap: '0.5rem', zIndex: 1000 }}>
        <button onClick={toggleTheme} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px', minWidth: '44px', minHeight: '44px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button onClick={toggleLanguage} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px', minWidth: '44px', minHeight: '44px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {i18n.language === 'he' ? 'EN' : 'HE'}
        </button>
        {user && profile && (
          <button onClick={() => navigate('/settings')} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px', minWidth: '44px', minHeight: '44px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={20} />
          </button>
        )}
      </div>

      {/* Compact Top Header with Top Action Button */}
      <div className="glass" style={{ padding: '1.1rem 1.5rem', marginBottom: '1.25rem' }}>
        <div className="top-header-row">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', lineHeight: 1.1 }}>{t('appTitle')}</h1>
              {user && (
                <div style={{ opacity: 0.9, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.65rem', borderRadius: '999px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--secondary-color)', display: 'inline-block' }}></span>
                  {profile?.alias ? `${profile.alias} | ${t('trustScore')}: ${profile.trustScore}` : t('loggedInAs')}
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{t('appSubtitle')}</span>
          </div>

          {user && (
            <button
              className="top-create-btn"
              onClick={() => navigate('/create-post')}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>פרסום חדש</span>
            </button>
          )}
        </div>
        {user && <Inbox />}
      </div>

      {user ? (
        <div className="animate-fade-in">
          <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <MyCommunities />
          </div>

          <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <MyPosts embedded={true} />
          </div>

          <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <Feed embedded={true} />
          </div>

          <div className="glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            {profile?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} style={{ width: '100%', background: 'rgba(255,0,0,0.1)', border: '1px solid red', color: 'red', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '1rem' }}>
                Admin Panel
              </button>
            )}
            <button onClick={logout} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>{t('logout')}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const { user, profile, loading, registerProfile } = useAuth();
  
  useEffect(() => {
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light-mode');
    }
  }, []);
  
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
    return <AuthScreen />;
  }

  // Enforce Registration before accessing the app
  if (user && !profile) {
    const isFormValid = formData.alias && formData.city && formData.tosAgreed;
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="glass animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
          <h2 style={{textAlign: 'center'}}>Complete Registration</h2>
          <p style={{ opacity: 0.8, fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>Your personal details (Email, Phone) remain strictly private and will never be shared with other users.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem'}}>
            <input type="text" placeholder="Alias (Publicly Visible) *" value={formData.alias} onChange={e => setFormData({...formData, alias: e.target.value})} style={{width: '100%'}} />
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
            onClick={() => registerProfile({...formData, age: Number(formData.age)})}
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
    <>
      <OnboardingModal />
      {user && profile && <NotificationBell />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/create-post" element={<CreatePost />} />
        <Route path="/create-demand" element={<CreatePost initialIntent="demand" />} />
        <Route path="/create-supply" element={<CreatePost initialIntent="supply" />} />
        <Route path="/dashboard" element={<MyPosts />} />
        <Route path="/settings" element={<ProfileSettings />} />
        <Route path="/user/:userId" element={<UserProfileView />} />
        <Route path="/post/:id" element={<PostView />} />
        <Route path="/chat/:chatId" element={<Chat />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/join/:id" element={<JoinCommunity />} />
        <Route path="/community/:id" element={<CommunityView />} />
        <Route path="/community/:id/manager" element={<ManagerDashboard />} />
        <Route path="/community/:id/chat/:chatId" element={<CommunityView />} />
      </Routes>
    </>
  );
}

export default App;
