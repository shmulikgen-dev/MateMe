import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, doc, addDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { MapPin, ArrowLeft, SearchX, Share2, Flag, Hourglass, Paperclip, Trash2 } from 'lucide-react';
import { useFeed } from '../useFeed';

interface FeedProps {
  embedded?: boolean;
  communityId?: string;
  isManager?: boolean;
}

export default function Feed({ embedded = false, communityId, isManager = false }: FeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { posts, setPosts, loading, location } = useFeed(150, communityId);
  const [showAll, setShowAll] = useState(!embedded);
  const [bids, setBids] = useState<{[key: string]: string}>({});
  const [reportModal, setReportModal] = useState<{isOpen: boolean, postId: string}>({isOpen: false, postId: ''});
  const [reportReason, setReportReason] = useState('');

  const handleShare = async (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('appTitle'),
          text: t('checkOutThisPost'),
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert(t('linkCopied', 'הקישור הועתק ללוח'));
    }
  };

  const handleReport = async () => {
    if (!reportModal.postId || !reportReason.trim()) return;
    try {
      await addDoc(collection(db, 'reports'), {
        targetId: reportModal.postId,
        targetType: 'post',
        reason: reportReason,
        reporterId: auth.currentUser?.uid || 'anonymous',
        status: 'open',
        createdAt: serverTimestamp()
      });
      alert(t('reportSubmitted', 'הדיווח נשלח בהצלחה'));
      setReportModal({isOpen: false, postId: ''});
      setReportReason('');
    } catch (error) {
      console.error('Error reporting:', error);
      alert(t('errorOccurred', 'אירעה שגיאה'));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(t('confirmDelete', 'האם אתה בטוח שברצונך למחוק פוסט זה?'))) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts(posts.filter(p => p.id !== postId));
      alert(t('postDeleted', 'הפוסט נמחק בהצלחה'));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert(t('errorOccurred', 'אירעה שגיאה'));
    }
  };

  const handleConnect = async (postId: string, currentResponses: number, isTender: boolean, postType?: string) => {
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
      
      // Rule of 3: Auto-pause (skip for supply posts)
      if (postType !== 'supply' && newCount >= 3 && !isTender) {
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
          return { ...p, responseCount: newCount, status: (postType !== 'supply' && newCount >= 3 && !isTender) ? 'evaluating' : p.status };
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
        <div key={post.id} className="glass animate-fade-in" style={{ 
            padding: '1.5rem', 
            marginBottom: '1.2rem', 
            animationDelay: `${index * 0.1}s`, 
            borderRight: post.isPopup ? 'none' : `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}`,
            border: post.isPopup ? '2px solid #ef4444' : '1px solid var(--glass-border)',
            boxShadow: post.isPopup ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none'
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: post.type === 'demand' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: post.type === 'demand' ? '#a5b4fc' : '#6ee7b7' }}>
                {t(post.type)}
              </span>
              {post.isPopup && (
                <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <Hourglass size={12} className="animate-pulse-glow" /> POP-UP
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {post.distance.toFixed(1)} {t('kmAway')}
              </span>
              <button onClick={() => handleShare(post.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                <Share2 size={16} />
              </button>
              <button onClick={() => setReportModal({isOpen: true, postId: post.id})} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                <Flag size={16} />
              </button>
              {isManager && (
                <button onClick={() => handleDeletePost(post.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
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

          {post.fileUrl && (
            <div style={{ marginBottom: '1.5rem' }}>
              {post.fileType?.startsWith('image/') ? (
                <img src={post.fileUrl} alt={post.fileName || 'Attached image'} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)', maxHeight: '300px', objectFit: 'cover' }} />
              ) : (
                <a href={post.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', textDecoration: 'none', border: '1px solid var(--glass-border)' }}>
                  <Paperclip size={18} /> {post.fileName || 'Download Attached File'}
                </a>
              )}
            </div>
          )}

          {post.creatorId === auth.currentUser?.uid ? (
            <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.9rem' }}>{t('yourPost', 'זהו פוסט שאתה פרסמת')}</span>
            </div>
          ) : post.status === 'tender' ? (
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
              onClick={() => handleConnect(post.id, post.responseCount || 0, false, post.type)}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
            >
              {post.type === 'supply' 
                ? t('interestedToArrive', 'מעניין, מתכנן להגיע') 
                : t('connectCount', { count: post.responseCount || 0 })
              }
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

      {reportModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Flag color="var(--primary-color)" /> {t('reportPost', 'דיווח על פוסט')}</h3>
            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>{t('reportReasonDesc', 'מדוע אתה מדווח על פוסט זה?')}</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{ width: '100%', height: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}
              placeholder={t('reportPlaceholder', 'פרט כאן...')}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" onClick={() => setReportModal({isOpen: false, postId: ''})} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                {t('cancel')}
              </button>
              <button className="btn" onClick={handleReport} style={{ flex: 1, background: 'var(--primary-color)' }}>
                {t('submit', 'שלח')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
