import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MyCommunities() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    const fetchCommunities = async () => {
      if (!profile.myCommunities || profile.myCommunities.length === 0) {
        setCommunities([]);
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'communities'),
          where('__name__', 'in', profile.myCommunities)
        );
        const snapshot = await getDocs(q);
        setCommunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching communities", e);
      }
      setLoading(false);
    };

    fetchCommunities();
  }, [user, profile]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loading', 'Loading...')}</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Users /> {t('myCommunitiesTitle', 'הקהילות שלי')}
      </h2>

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
    </div>
  );
}
