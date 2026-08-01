import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MyCommunities() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [communities, setCommunities] = useState<any[]>([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestData, setRequestData] = useState({ name: '', description: '', type: 'geographic' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    const fetchCommunities = async () => {
      try {
        // Fetch My Communities
        if (profile.myCommunities && profile.myCommunities.length > 0) {
          const q = query(
            collection(db, 'communities'),
            where('__name__', 'in', profile.myCommunities)
          );
          const snapshot = await getDocs(q);
          setCommunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } else {
          setCommunities([]);
        }
        
        // Fetch Suggested Communities
        const allQ = query(collection(db, 'communities'));
        const allSnap = await getDocs(allQ);
        const allComms = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const suggested = allComms.filter(c => !profile.myCommunities?.includes(c.id));
        setSuggestedCommunities(suggested);
        
      } catch (e) {
        console.error("Error fetching communities", e);
      }
      setLoading(false);
    };

    fetchCommunities();
  }, [user, profile]);

  const handleRequestCommunity = async () => {
    if (!requestData.name || !requestData.description) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'community_requests'), {
        requesterId: user!.uid,
        requesterAlias: profile?.alias || 'Anonymous',
        name: requestData.name,
        description: requestData.description,
        type: requestData.type,
        status: 'pending',
        createdAt: Date.now()
      });
      alert('בקשתך לפתיחת קהילה נשלחה בהצלחה ותיבחן על ידי ההנהלה.');
      setShowRequestForm(false);
      setRequestData({ name: '', description: '', type: 'geographic' });
    } catch (e) {
      console.error("Error creating request", e);
      alert('אירעה שגיאה בשליחת הבקשה.');
    }
    setSubmitting(false);
  };
  const handleJoinCommunity = async (communityId: string) => {
    try {
      // Add to user
      await updateDoc(doc(db, 'users', user!.uid), {
        myCommunities: arrayUnion(communityId)
      });
      // Add to community
      await updateDoc(doc(db, 'communities', communityId), {
        memberIds: arrayUnion(user!.uid)
      });
      alert('הצטרפת לקהילה בהצלחה!');
      window.location.reload();
    } catch(e) {
      console.error(e);
      alert('שגיאה בהצטרפות לקהילה');
    }
  };


  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loading', 'Loading...')}</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Users /> {t('myCommunitiesTitle', 'הקהילות שלי')}
        </h2>
        <button className="btn" onClick={() => setShowRequestForm(!showRequestForm)} style={{ background: 'var(--secondary-color)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
          {showRequestForm ? 'ביטול' : 'בקש פתיחת קהילה חדשה'}
        </button>
      </div>

      {showRequestForm && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '12px', border: '1px solid var(--secondary-color)' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>בקשה להקמת קהילה</h3>
          <input type="text" placeholder="שם הקהילה המבוקשת" value={requestData.name} onChange={e => setRequestData({...requestData, name: e.target.value})} style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box' }} />
          <textarea placeholder="תאר את מטרת הקהילה" value={requestData.description} onChange={e => setRequestData({...requestData, description: e.target.value})} style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box', height: '80px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white' }} />
          <select value={requestData.type} onChange={e => setRequestData({...requestData, type: e.target.value})} style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: 'white' }}>
            <option value="geographic">קהילה גאוגרפית (יישוב, שכונה)</option>
            <option value="thematic">קהילה נושאית (תחביב, עניין משותף)</option>
          </select>
          <button className="btn" onClick={handleRequestCommunity} disabled={submitting || !requestData.name} style={{ width: '100%', background: 'var(--primary-color)' }}>
            {submitting ? 'שולח...' : 'שלח בקשה למנהל'}
          </button>
        </div>
      )}

      {communities.length === 0 ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ opacity: 0.8 }}>{t('noCommunitiesText', 'אינך חבר באף קהילה כרגע.')}</p>
          <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>{t('joinCommunityDesc', 'בקש ממנהל הקהילה שלך קישור הזמנה להצטרפות.')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {communities.map(c => (
            <div 
              key={c.id} 
              className="glass" 
              style={{ padding: '1.5rem', cursor: 'pointer', borderRadius: '12px' }}
              onClick={() => navigate(`/community/${c.id}`)}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>{c.name}</h3>
              <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>{c.description}</p>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
                <span>{c.type === 'geographic' ? 'קהילה גאוגרפית' : 'קהילה נושאית'}</span>
                <span>{c.memberIds?.length || 0} חברים</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestedCommunities.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>קהילות מומלצות עבורך</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {suggestedCommunities.map(c => (
              <div key={c.id} className="glass" style={{ padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--secondary-color)' }}>{c.name}</h4>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>{c.description}</p>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>
                    {c.type === 'geographic' ? 'קהילה גאוגרפית' : 'קהילה נושאית'} • {c.memberIds?.length || 0} חברים
                  </div>
                </div>
                <button className="btn" onClick={() => handleJoinCommunity(c.id)} style={{ background: 'var(--primary-color)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                  הצטרף
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
