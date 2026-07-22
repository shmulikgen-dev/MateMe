import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { MapPin, ArrowLeft, SearchX } from 'lucide-react';
import { useFeed } from '../useFeed';

interface FeedProps {
  embedded?: boolean;
}

export default function Feed({ embedded = false }: FeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { posts, setPosts, loading, location } = useFeed();
  const [showAll, setShowAll] = useState(!embedded);
  const [bids, setBids] = useState<{[key: string]: string}>({});

  const handleConnect = async (postId: string, currentResponses: number, isTender: boolean) => {
    try {
      if (!auth.currentUser) return;
      
      const bidAmount = isTender ? Number(bids[postId]) : null;
      if (isTender && (!bidAmount || bidAmount <= 0)) {
        alert(t('pleaseEnterValidBid'));
        return;
      }

      const newCount = (currentResponses || 0) + 1;
      const postRef = doc(db, 'posts', postId);
      
      const updates: any = { responseCount: newCount };
      
      // Rule of 3: Auto-pause
      if (newCount >= 3 && !isTender) {
        updates.status = 'evaluating';
      }
      
      await updateDoc(postRef, updates);
      
      // Create response document
      await addDoc(collection(db, 'responses'), {
        postId,
        responderId: auth.currentUser.uid,
        status: 'pending',
        bidAmount,
        createdAt: serverTimestamp()
      });
      
      // Update local UI
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return { ...p, responseCount: newCount, status: (newCount >= 3 && !isTender) ? 'evaluating' : p.status };
        }
        return p;
      }).filter(p => p.status === 'active' || p.status === 'tender'));
      
      alert(isTender ? t('bidSubmitted') : t('connectionSent'));
    } catch (error) {
      console.error("Error connecting: ", error);
      alert(t('failedConnect'));
    }
  };

  if (!location) return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('lookingForLocation')}</div>;

  const displayedPosts = showAll ? posts : posts.slice(0, 3);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: embedded ? '0' : '1rem' }}>
      {!embedded && (
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <ArrowLeft size={20} /> {t('backToHome')}
        </button>
      )}

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: embedded ? '1.5rem' : '0' }}>
        <MapPin /> {t('localFeed')}
      </h2>
      
      {loading && <p>{t('loadingPosts')}</p>}
      
      {displayedPosts.length === 0 && !loading && location && (
        <div className="glass animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
          <div className="animate-float" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--glass-bg)', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <SearchX size={40} />
          </div>
          <div>
            <h3 style={{margin: '0 0 0.5rem 0', fontSize: '1.5rem'}}>{t('quietHere')}</h3>
            <p style={{ margin: 0, opacity: 0.8 }}>{t('noRequestsInArea')}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', width: '100%', maxWidth: '300px' }}>
            <button className="btn animate-pulse-glow" onClick={() => navigate('/create-demand')} style={{ flex: 1 }}>
              {t('createDemandBtn')}
            </button>
            <button className="btn" onClick={() => navigate('/create-supply')} style={{ flex: 1, background: 'var(--secondary-color)' }}>
              {t('createSupplyBtn')}
            </button>
          </div>
        </div>
      )}

      {displayedPosts.map((post, index) => (
        <div key={post.id} className="glass animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.2rem', animationDelay: `${index * 0.1}s`, borderRight: `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: post.type === 'demand' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: post.type === 'demand' ? '#a5b4fc' : '#6ee7b7' }}>
              {t(post.type)}
            </span>
            <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {post.distance.toFixed(1)} {t('kmAway')}
            </span>
          </div>

          <div style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>
            <span style={{ opacity: 0.8 }}>{t('postedBy')} </span>
            <span 
              onClick={() => navigate(`/user/${post.creatorId}`)} 
              style={{ fontWeight: 'bold', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {post.creatorAlias || 'Anonymous'}
            </span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', opacity: 0.9 }}>
              (⭐ {post.creatorTrustScore || 0})
            </span>
          </div>

          {post.category && (
            <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <strong>{t('category')}:</strong> {t(post.category)}
            </div>
          )}
          <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', lineHeight: '1.6' }}>{post.description}</p>
          
          {(post.targetDate || post.targetTime || post.availability || post.budget > 0) && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              {post.targetDate && <div><strong>{t('date')}:</strong> {post.targetDate}</div>}
              {post.targetTime && <div><strong>{t('time')}:</strong> {post.targetTime}</div>}
              {post.availability && <div><strong>{t('availability')}:</strong> {post.availability}</div>}
              {post.budget > 0 && <div><strong>{post.type === 'supply' ? t('startingPrice') : t('budget')}:</strong> ₪{post.budget}</div>}
            </div>
          )}

          {post.status === 'tender' ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="number" 
                placeholder={t('yourBid')} 
                value={bids[post.id] || ''}
                onChange={e => setBids({...bids, [post.id]: e.target.value})}
                style={{ flex: 1, padding: '0.8rem', boxSizing: 'border-box' }}
              />
              <button 
                className="btn" 
                onClick={() => handleConnect(post.id, post.responseCount || 0, true)}
                style={{ flex: 1, background: 'var(--accent-color)' }}
              >
                {t('submitBid')}
              </button>
            </div>
          ) : (
            <button 
              className="btn" 
              onClick={() => handleConnect(post.id, post.responseCount || 0, false)}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
            >
              {t('connectCount', { count: post.responseCount || 0 })}
            </button>
          )}
        </div>
      ))}
      
      {!showAll && posts.length > 3 && (
        <button 
          className="btn" 
          onClick={() => setShowAll(true)}
          style={{ width: '100%', marginTop: '1rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
        >
          {t('showMorePosts', 'הצג את כל הפוסטים הרלוונטים')}
        </button>
      )}
    </div>
  );
}
