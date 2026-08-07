import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Award, MapPin, CheckCircle, MessageSquare } from 'lucide-react';

interface PublicProfile {
  alias: string;
  city: string;
  trustScore: number;
  interests?: string;
  bio?: string;
  createdAt?: number;
}

interface Transaction {
  id: string;
  points: number;
  review: string;
  createdAt: any;
}

export default function UserProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProfileData = async () => {
      setLoading(true);
      try {
        // Fetch User
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as PublicProfile);
        }

        // Fetch Transactions/Reviews
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', userId)
          // Removing orderBy to avoid requiring a composite index immediately.
          // Will sort client-side.
        );
        const transSnap = await getDocs(q);
        const transList: Transaction[] = [];
        transSnap.forEach(d => {
          transList.push({ id: d.id, ...d.data() } as Transaction);
        });

        // Sort client-side
        transList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setTransactions(transList);
      } catch (err) {
        console.error("Error fetching profile", err);
      }
      setLoading(false);
    };

    fetchProfileData();
  }, [userId]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> {t('back', 'Back')}
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : !profile ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>User not found</div>
      ) : (
        <>
          <div className="glass animate-fade-in" style={{ padding: '2rem', borderRadius: '16px', marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--glass-bg)', border: '2px solid var(--primary-color)', margin: '0 auto 1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
              <User size={40} />
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem' }}>{profile.alias}</h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', opacity: 0.8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /> {profile.city}</span>
            </div>

            <div className="animate-pulse-glow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem', background: 'var(--primary-color)', padding: '0.8rem 1.5rem', borderRadius: '24px', color: 'white', fontWeight: 'bold' }}>
              <Award size={24} /> {t('trustPoints')}: {profile.trustScore || 0}
            </div>

            {/* Gamification Badges */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
              {(profile.trustScore || 0) >= 20 && (
                <span style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#FFD700', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🌟 עוזר מתמיד
                </span>
              )}
              {profile.createdAt && (Date.now() - profile.createdAt < 7 * 24 * 60 * 60 * 1000) && (
                <span style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🌱 חדש בשכונה
                </span>
              )}
            </div>

            {profile.bio && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontStyle: 'italic', opacity: 0.9 }}>
                "{profile.bio}"
              </div>
            )}

            {profile.interests && (
              <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '12px' }}>
                <strong style={{ opacity: 0.7 }}>Interests:</strong>
                <p style={{ margin: '0.5rem 0 0 0' }}>{profile.interests}</p>
              </div>
            )}
          </div>

          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle size={20} color="var(--secondary-color)" /> {t('completedTransactions')} ({transactions.length})
          </h3>

          {transactions.length === 0 ? (
            <div className="glass" style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
              {t('noReviewsYet')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transactions.map(tData => (
                <div key={tData.id} className="glass" style={{ padding: '1.2rem', borderRadius: '12px', borderLeft: '4px solid var(--secondary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Award size={16} /> +{tData.points} Points
                    </span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                      {tData.createdAt?.toDate ? tData.createdAt.toDate().toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  {tData.review && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}>
                      <MessageSquare size={16} style={{ marginTop: '2px', opacity: 0.7 }} />
                      <p style={{ margin: 0, fontStyle: 'italic', opacity: 0.9 }}>"{tData.review}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
