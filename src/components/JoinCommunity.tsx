import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';

export default function JoinCommunity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCommunity = async () => {
      if (!id) return;
      try {
        const docSnap = await getDoc(doc(db, 'communities', id));
        if (docSnap.exists()) {
          setCommunity({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (e) {
        console.error("Error fetching community", e);
      }
      setLoading(false);
    };

    fetchCommunity();
  }, [id]);

  const handleJoin = async () => {
    if (!user || !profile || !community) {
      alert("עליך להתחבר ולהשלים פרופיל לפני ההצטרפות");
      navigate('/');
      return;
    }

    setJoining(true);
    try {
      // Create a request instead of joining directly
      await addDoc(collection(db, 'community_requests'), {
        communityId: community.id,
        requesterId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      setJoining(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (e: any) {
      console.error(e);
      alert(`שגיאה בשליחת בקשת הצטרפות: ${e.message || 'שגיאה לא ידועה'}`);
      setJoining(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>טוען פרטי קהילה...</div>;

  if (!community) return <div style={{ padding: '2rem', textAlign: 'center' }}>הקהילה לא נמצאה. ייתכן שהקישור שגוי.</div>;

  return (
    <div style={{ maxWidth: '500px', margin: '2rem auto', padding: '1rem' }}>
      <div className="glass" style={{ padding: '2rem', textAlign: 'center', borderRadius: '12px' }}>
        <h2 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>הזמנה להצטרף לקהילה</h2>
        <h1 style={{ fontSize: '2rem', margin: '0 0 1rem 0' }}>{community.name}</h1>
        <p style={{ opacity: 0.8, marginBottom: '2rem' }}>{community.description}</p>
        
        {profile?.myCommunities?.includes(community.id) ? (
          <div>
            <p style={{ color: 'var(--secondary-color)', fontWeight: 'bold' }}>אתה כבר חבר בקהילה זו!</p>
            <button className="btn" onClick={() => navigate(`/community/${community.id}`)} style={{ background: 'var(--primary-color)', width: '100%', marginTop: '1rem' }}>
              היכנס לקהילה
            </button>
          </div>
        ) : (
          <button 
            className={`btn ${success ? '' : 'animate-pulse-glow'}`} 
            onClick={handleJoin} 
            disabled={joining || success}
            style={{ 
              background: success ? 'var(--secondary-color)' : 'var(--accent-color)', 
              width: '100%', 
              fontSize: '1.2rem', 
              padding: '1rem',
              transition: 'all 0.3s ease'
            }}
          >
            {success ? 'בקשתך נשלחה למנהל הקהילה!' : joining ? 'שולח...' : 'שלח בקשת הצטרפות'}
          </button>
        )}
      </div>
    </div>
  );
}
