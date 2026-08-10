import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayRemove, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import Feed from './Feed';
import Chat from './Chat';
import UserBadge from './UserBadge';
import { Share2, Users, ArrowLeft, PlusCircle, LogOut, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CommunityView() {
  const { id, chatId } = useParams<{ id: string, chatId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!id) return;
      try {
        const docSnap = await getDoc(doc(db, 'communities', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCommunity({ id: docSnap.id, ...data });
          
          if (user && data.managerIds?.includes(user.uid)) {
            setIsManager(true);
          }
            
          // Fetch member details safely in chunks of 10
          if (data.memberIds?.length > 0) {
            const allMembers: any[] = [];
            for (let i = 0; i < data.memberIds.length; i += 10) {
              const chunk = data.memberIds.slice(i, i + 10);
              const membersSnap = await getDocs(
                query(collection(db, 'users'), where('uid', 'in', chunk))
              );
              allMembers.push(...membersSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
            }
            setMembers(allMembers);
          }
        }
      } catch (e) {
        console.error("Error fetching community", e);
      }
      setLoading(false);
    };

    fetchCommunity();
  }, [id, user]);

  const handleShare = () => {
    const url = `${window.location.origin}/join/${id}`;
    const text = `היי! הוזמנת להצטרף ל-${community.name} באפליקציית החיבורים הקהילתיים.\nלחץ על הקישור להצטרפות:\n${url}`;
    if (navigator.share) {
      navigator.share({
        title: `הצטרף לקהילה: ${community.name}`,
        text: text,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert('הודעת ההזמנה והקישור הועתקו ללוח!');
    }
  };



  const handleLeaveCommunity = async () => {
    if (!user || !id) return;
    if (!window.confirm('האם אתה בטוח שברצונך לעזוב את הקהילה?')) return;
    
    try {
      await updateDoc(doc(db, 'communities', id), {
        memberIds: arrayRemove(user.uid)
      });
      await updateDoc(doc(db, 'users', user.uid), {
        myCommunities: arrayRemove(id)
      });
      alert('עזבת את הקהילה בהצלחה');
      navigate('/');
      window.location.reload(); // Reload to refresh profile context
    } catch (e) {
      console.error("Error leaving community", e);
      alert('אירעה שגיאה. נסה שוב מאוחר יותר.');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loading', 'Loading...')}</div>;
  if (!community) return <div style={{ padding: '2rem', textAlign: 'center' }}>קהילה לא נמצאה</div>;

  const isMember = profile?.myCommunities?.includes(id!);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <div className="glass" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>{community.name}</h1>
            <p style={{ margin: 0, opacity: 0.8 }}>{community.description}</p>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7, display: 'flex', gap: '1rem' }}>
              <span onClick={() => setShowMembersModal(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}><Users size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/> {community.memberIds?.length || 0} חברים</span>
              <span>סוג: {community.type === 'geographic' ? 'גאוגרפי' : 'נושאי'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'flex-end' }}>
            <button className="btn" onClick={handleShare} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Share2 size={18} /> הזמן חברים
            </button>
            {isManager && (
              <button 
                onClick={() => navigate(`/community/${id}/manager`)} 
                style={{ background: '#10b981', border: '1px solid #059669', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'all 0.2s' }}
                title="ניהול קהילה"
              >
                <Shield size={14} /> לוח מנהלים
              </button>
            )}
            {isMember && (
              <button 
                onClick={handleLeaveCommunity} 
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'all 0.2s' }}
                title="עזוב קהילה"
              >
                <LogOut size={14} /> עזוב קהילה
              </button>
            )}
          </div>
        </div>
      </div>

      {!isMember ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>אינך חבר בקהילה זו.</p>
          <button className="btn" onClick={() => navigate(`/join/${id}`)} style={{ background: 'var(--accent-color)' }}>
            בקש להצטרף
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button className="btn" onClick={() => navigate(`/create-demand?communityId=${id}`)} style={{ flex: 1, padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <PlusCircle size={18} /> {t('createDemandBtn')} בקהילה
            </button>
            <button className="btn" onClick={() => navigate(`/create-supply?communityId=${id}`)} style={{ flex: 1, padding: '1rem', background: 'var(--secondary-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <PlusCircle size={18} /> {t('createSupplyBtn')} בקהילה
            </button>
          </div>

          {showMembersModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem', backdropFilter: 'blur(5px)' }}>
              <div className="animate-fade-in" style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                <button onClick={() => setShowMembersModal(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-color)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}>&times;</button>
                <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  <Users size={20} color="var(--primary-color)" /> חברי הקהילה ({members.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {members.map(m => (
                    <div key={m.uid} style={{ display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{m.alias || 'Anonymous'}</span>
                        <UserBadge trustScore={m.trustScore || 0} isManager={community.managerIds?.includes(m.uid)} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {m.createdAt && (Date.now() - m.createdAt < 7 * 24 * 60 * 60 * 1000) && (
                          <span style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '2px 6px', borderRadius: '8px', fontSize: '0.7rem' }}>🌱 חדש בשכונה</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {chatId ? (
            <div style={{ marginTop: '1rem' }}>
              <Chat />
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '1rem' }}>לוח מודעות קהילתי</h2>
              {/* Note: In a real app, a community manager might need a special prop passed to Feed to enable "Delete Post" buttons.
                  For simplicity, we pass manager mode to Feed if they are manager. */}
              <Feed communityId={id} isManager={isManager} embedded={true} />
            </>
          )}
        </>
      )}
    </div>
  );
}
