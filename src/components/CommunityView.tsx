import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayRemove, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import Feed from './Feed';
import { Share2, Users, ArrowLeft, PlusCircle, UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CommunityView() {
  const { id } = useParams<{ id: string }>();
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

  const handleRemoveMember = async (memberUid: string) => {
    if (!window.confirm("האם להסיר משתמש זה מהקהילה?")) return;
    try {
      await updateDoc(doc(db, 'communities', id!), {
        memberIds: arrayRemove(memberUid)
      });
      await updateDoc(doc(db, 'users', memberUid), {
        myCommunities: arrayRemove(id!)
      });
      setMembers(members.filter(m => m.uid !== memberUid));
      alert("משתמש הוסר בהצלחה");
    } catch (e) {
      console.error(e);
      alert("שגיאה בהסרת משתמש");
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
          <button className="btn" onClick={handleShare} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Share2 size={18} /> הזמן חברים
          </button>
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

          {isManager && (
            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444' }}>כלי ניהול קהילה</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {members.map(m => (
                  <div key={m.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                    <span>{m.alias || m.email || m.uid}</span>
                    {m.uid !== user?.uid && (
                      <button onClick={() => handleRemoveMember(m.uid)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                        <UserMinus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showMembersModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
              <div className="glass animate-fade-in" style={{ padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                <button onClick={() => setShowMembersModal(false)} style={{ position: 'absolute', top: '10px', left: '10px', background: 'transparent', border: 'none', color: 'var(--text-color)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                <h3 style={{ margin: '0 0 1rem 0' }}>חברי הקהילה ({members.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {members.map(m => (
                    <div key={m.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>{m.alias || 'Anonymous'}</span>
                      <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>⭐ {m.trustScore || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <h2 style={{ marginBottom: '1rem' }}>לוח מודעות קהילתי</h2>
          {/* Note: In a real app, a community manager might need a special prop passed to Feed to enable "Delete Post" buttons.
              For simplicity, we pass manager mode to Feed if they are manager. */}
          <Feed communityId={id} isManager={isManager} />
        </>
      )}
    </div>
  );
}
