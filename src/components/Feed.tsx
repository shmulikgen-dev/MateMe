import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, serverTimestamp, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { MapPin, ArrowLeft, SearchX, Search, Share2, Flag, Hourglass, Paperclip, Trash2, XCircle, Calendar } from 'lucide-react';
import { useFeed } from '../useFeed';
import UserBadge from './UserBadge';
import AddToCalendarButton, { isCalendarEnabledForPost } from './AddToCalendarButton';

interface FeedProps {
  embedded?: boolean;
  communityId?: string;
  isManager?: boolean;
}

export default function Feed({ embedded = false, communityId, isManager = false }: FeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { posts, setPosts, loading, location, locationError, fallbackMode, setFallbackMode, loadMore, hasMore } = useFeed(30, communityId);
  const [bids, setBids] = useState<{[key: string]: {amount: string, text: string}}>({});
  const [expandedRespondPostId, setExpandedRespondPostId] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{isOpen: boolean, postId: string}>({isOpen: false, postId: ''});
  const [reportReason, setReportReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedFilter, setFeedFilter] = useState<'all' | 'events'>('all');
  const [toastMsg, setToastMsg] = useState('');
  const [ignoringPosts, setIgnoringPosts] = useState<string[]>([]);
  const [respondedPostIds, setRespondedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchUserResponses = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(collection(db, 'responses'), where('responderId', '==', auth.currentUser.uid));
        const snap = await getDocs(q);
        setRespondedPostIds(snap.docs.map(d => d.data().postId).filter(Boolean));
      } catch (err) {
        console.error('Error fetching user responses:', err);
      }
    };
    fetchUserResponses();
  }, []);

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
      setToastMsg(t('linkCopied', 'הקישור הועתק ללוח'));
      setTimeout(() => setToastMsg(''), 3000);
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
      setToastMsg(t('reportSubmitted', 'הדיווח נשלח בהצלחה'));
      setTimeout(() => setToastMsg(''), 3000);
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
      setToastMsg(t('postDeleted', 'הפוסט נמחק בהצלחה'));
      setTimeout(() => setToastMsg(''), 3000);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert(t('errorOccurred', 'אירעה שגיאה'));
    }
  };

  const isRuleOf3Post = (post: any) =>
    post.type === 'demand' &&
    !isCalendarEnabledForPost(post) &&
    post.supplyType !== 'event' &&
    !post.isPopup &&
    post.status !== 'tender';

  const handleConnect = async (post: any, isTender: boolean) => {
    try {
      const postId = post.id;
      const currentResponses = post.responseCount || 0;
      const postType = post.type;
      if (!auth.currentUser) return;

      const responseId = `${postId}_${auth.currentUser.uid}`;

      // Check local state and Firestore to strictly block duplicate responses from the same user
      if (respondedPostIds.includes(postId)) {
        const msg = t('alreadyResponded', 'כבר הגבת לפנייה זו ולא ניתן להגיב שוב.');
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3500);
        alert(msg);
        return;
      }

      const existingResponseSnap = await getDoc(doc(db, 'responses', responseId));
      if (existingResponseSnap.exists()) {
        setRespondedPostIds(prev => (prev.includes(postId) ? prev : [...prev, postId]));
        const msg = t('alreadyResponded', 'כבר הגבת לפנייה זו ולא ניתן להגיב שוב.');
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3500);
        alert(msg);
        return;
      }
      
      const rawAmount = bids[postId]?.amount ? Number(bids[postId]?.amount) : null;
      const bidAmount = rawAmount && rawAmount > 0 ? rawAmount : null;
      const bidText = bids[postId]?.text?.trim() || '';
      if (isTender && (!bidAmount || bidAmount <= 0)) {
        alert(t('pleaseEnterValidBid'));
        return;
      }

      // Record user's response first so a user can only respond once per post
      await setDoc(doc(db, 'responses', responseId), {
        postId,
        responderId: auth.currentUser.uid,
        status: 'pending',
        bidAmount,
        bidText,
        createdAt: serverTimestamp()
      });
      setRespondedPostIds(prev => (prev.includes(postId) ? prev : [...prev, postId]));

      const newCount = (currentResponses || 0) + 1;
      const postRef = doc(db, 'posts', postId);
      
      const updates: any = { responseCount: newCount };
      
      // Rule of 3: Only apply to non-calendar, non-event Demand posts in normal active mode
      const shouldPauseAfter3 = isRuleOf3Post(post) && newCount >= 3 && !isTender;
      if (shouldPauseAfter3) {
        updates.status = 'evaluating';
      }

      if (bidAmount && (!post.lowestBid || bidAmount < post.lowestBid)) {
        updates.lowestBid = bidAmount;
      }
      
      await updateDoc(postRef, updates);
      
      // Direct chat for supply services/items (not events)
      if (postType === 'supply' && post.supplyType !== 'event') {
        const resolvedCommunityId = (post.communityId && post.communityId !== 'global') ? post.communityId : (communityId || null);
        const chatRef = await addDoc(collection(db, 'chats'), {
          postId,
          communityId: resolvedCommunityId,
          users: [auth.currentUser.uid, post.creatorId],
          status: 'active',
          createdAt: serverTimestamp()
        });
        
        if (resolvedCommunityId) {
          navigate(`/community/${resolvedCommunityId}/chat/${chatRef.id}`);
        } else {
          navigate(`/chat/${chatRef.id}`);
        }
        return;
      }
      
      setExpandedRespondPostId(null);

      // Update local UI
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            responseCount: newCount,
            lowestBid: updates.lowestBid ?? p.lowestBid,
            status: shouldPauseAfter3 ? 'evaluating' : p.status
          };
        }
        return p;
      }).filter(p => p.status === 'active' || p.status === 'tender'));
      
      if (isTender) {
        setToastMsg(t('bidSubmitted', 'הצעתך במכרז נשלחה בהצלחה!'));
        setTimeout(() => setToastMsg(''), 3000);
      } else if (post.supplyType === 'event' || isCalendarEnabledForPost(post)) {
        setToastMsg('נרשמת להגעה לאירוע בהצלחה! 🎉');
        setTimeout(() => setToastMsg(''), 3000);
      } else {
        setToastMsg(t('connectionSent', 'פנייתך נשלחה למפרסם בהצלחה'));
        setTimeout(() => setToastMsg(''), 3000);
      }
    } catch (error) {
      console.error("Error connecting: ", error);
      alert(t('failedConnect'));
    }
  };

  const handleIgnorePost = async (postId: string) => {
    if (!auth.currentUser) return;
    try {
      // Mark as ignoring to trigger the visual transition
      setIgnoringPosts(prev => [...prev, postId]);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        ignoredPosts: arrayUnion(postId)
      });
      
      // Wait for the transition to finish before removing from the list
      setTimeout(() => {
        setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
        setIgnoringPosts(prev => prev.filter(id => id !== postId));
      }, 1500);
      
    } catch (err) {
      console.error("Error ignoring post: ", err);
      setIgnoringPosts(prev => prev.filter(id => id !== postId));
      alert('אירעה שגיאה בהסרת ההודעה');
    }
  };

  if (locationError && !fallbackMode && !location && !communityId) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return (
      <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <h3 style={{ color: '#ef4444', margin: 0 }}>שגיאת מיקום</h3>
        <p style={{ margin: 0 }}>{locationError}</p>
        
        {isIOS && (
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', textAlign: 'right', fontSize: '0.9rem', width: '100%', border: '1px solid var(--glass-border)' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#f59e0b' }}>משתמשי אייפון (iOS):</strong>
            כדי לאפשר גישה למיקום, אנא פעלו לפי השלבים:
            <ol style={{ paddingInlineStart: '1.2rem', marginTop: '0.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>לחצו על סמל ה-<b>aA</b> (למעלה או למטה בשורת הכתובת של Safari).</li>
              <li>בחרו ב-<b>הגדרות אתר אינטרנט</b> (Website Settings).</li>
              <li>תחת מיקום (Location), שנו ל-<b>אפשר</b> (Allow).</li>
              <li>רעננו את הדף.</li>
            </ol>
          </div>
        )}
        
        <div style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '12px', width: '100%', border: '1px solid var(--glass-border)' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>אם אינך רוצה או יכול לאפשר מיקום, באפשרותך לראות את כלל הפוסטים הפעילים (ללא מיון לפי קירבה גיאוגרפית).</p>
          <button 
            className="btn" 
            style={{ width: '100%', background: 'var(--primary-color)' }}
            onClick={() => setFallbackMode(true)}
          >
            הצג הכל (ללא מיקום)
          </button>
        </div>
      </div>
    );
  }

  if (!location && !fallbackMode && !communityId) return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('lookingForLocation')}</div>;

  const filteredPosts = posts.filter(post => {
    if (feedFilter === 'events') {
      if (!isCalendarEnabledForPost(post)) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (post.title?.toLowerCase().includes(q)) || 
           (post.description?.toLowerCase().includes(q)) ||
           (post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(q)));
  });

  const displayedPosts = filteredPosts;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: embedded ? '0' : '1rem' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--primary-color)', color: '#fff', padding: '10px 20px',
          borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toastMsg}
        </div>
      )}

      {!embedded && (
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <ArrowLeft size={20} /> {t('backToHome')}
        </button>
      )}

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: embedded ? '1.5rem' : '0' }}>
        <MapPin /> {t('localFeed')}
      </h2>
      
      <div style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.35rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Search size={20} color="var(--text-secondary)" style={{ marginLeft: '0.5rem', flexShrink: 0 }} />
        <input 
          type="text" 
          className="search-bare-input"
          placeholder={t('searchPostsPlaceholder', 'חפש בלוח המודעות...')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', padding: '0.5rem 0', boxShadow: 'none' }}
        />
      </div>

      {/* Quick Filter Pills for Events & All Posts */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFeedFilter('all')}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: '999px',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: feedFilter === 'all' ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
            background: feedFilter === 'all' ? 'var(--badge-demand-bg)' : 'var(--surface-subtle)',
            color: feedFilter === 'all' ? 'var(--badge-demand-text)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          הכל ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setFeedFilter('events')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.95rem',
            borderRadius: '999px',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: feedFilter === 'events' ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
            background: feedFilter === 'events' ? 'var(--badge-demand-bg)' : 'var(--surface-subtle)',
            color: feedFilter === 'events' ? 'var(--badge-demand-text)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          <Calendar size={14} />
          <span>אירועים ומועדים קבועים</span>
        </button>
      </div>
      
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
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem', width: '100%' }}>
            <button
              className="btn animate-pulse-glow"
              onClick={() => navigate(communityId ? `/create-post?communityId=${communityId}` : '/create-post')}
              style={{ padding: '0.85rem 1.75rem', fontWeight: 600 }}
            >
              + הוסף פרסום ראשון
            </button>
          </div>
        </div>
      )}

      {displayedPosts.map((post, index) => {
        const isIgnoring = ignoringPosts.includes(post.id);
        
        return (
        <div key={post.id} className={`glass ${isIgnoring ? '' : 'animate-fade-in'}`} style={{ 
            padding: isIgnoring ? '0' : '1.5rem', 
            marginBottom: isIgnoring ? '0' : '1.2rem', 
            maxHeight: isIgnoring ? '0' : '800px',
            animationDelay: isIgnoring ? '0s' : `${index * 0.1}s`, 
            borderRight: isIgnoring ? 'none' : (post.isPopup ? 'none' : `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}`),
            border: isIgnoring ? 'none' : (post.isPopup ? '2px solid #ef4444' : '1px solid var(--glass-border)'),
            boxShadow: post.isPopup && !isIgnoring ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none',
            opacity: isIgnoring ? 0 : 1,
            transform: isIgnoring ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: isIgnoring ? 'hidden' : 'visible'
          }}>
          {isIgnoring && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
              transition: 'opacity 0.3s ease'
            }}>
              ההודעה הוסרה מהפיד
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.78rem', padding: '4px 12px', borderRadius: '20px', background: post.type === 'demand' ? 'var(--badge-demand-bg)' : 'var(--badge-supply-bg)', color: post.type === 'demand' ? 'var(--badge-demand-text)' : 'var(--badge-supply-text)' }}>
                {t(post.type)}
              </span>
              {isCalendarEnabledForPost(post) && (
                <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'var(--badge-demand-bg)', color: 'var(--badge-demand-text)', border: '1px solid var(--glass-border)' }}>
                  <Calendar size={12} /> {post.supplyType === 'event' ? 'אירוע' : 'מועד קבוע'}
                </span>
              )}
              {post.isPopup && (
                <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <Hourglass size={12} className="animate-pulse-glow" /> POP-UP
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              {post.distance !== undefined && !fallbackMode && (
                <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> {post.distance.toFixed(1)} {t('kmAway')}
                </span>
              )}
              {fallbackMode && (
                <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> מיקום לא ידוע
                </span>
              )}
              <button onClick={() => handleShare(post.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Share2 size={16} />
              </button>
              <button onClick={() => setReportModal({isOpen: true, postId: post.id})} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flag size={16} />
              </button>
              {(isManager || post.creatorId === auth.currentUser?.uid) && (
                <button onClick={() => handleDeletePost(post.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '10px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <UserBadge trustScore={post.creatorTrustScore || 0} />
            {post.createdAt && (
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                פורסם ב: {new Date(post.createdAt?.toMillis?.() || post.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>

          {post.category && (
            <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <strong>{t('category')}:</strong> {t(post.category)}
            </div>
          )}
          <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', lineHeight: '1.6' }}>{post.description}</p>
          
          {(isCalendarEnabledForPost(post) || post.targetDate || post.targetTime || post.availability || post.budget > 0) && (
            <div style={{ background: 'var(--surface-subtle)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', fontSize: '0.85rem', flexWrap: 'wrap', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {post.targetDate && <div><strong>{t('date')}:</strong> {post.targetDate}</div>}
                {post.targetTime && <div><strong>{t('time')}:</strong> {post.targetTime}</div>}
                {post.availability && <div><strong>{t('availability')}:</strong> {post.availability}</div>}
                {post.budget > 0 && <div><strong>{post.type === 'supply' ? t('startingPrice') : t('budget')}:</strong> ₪{post.budget}</div>}
                {isCalendarEnabledForPost(post) && !post.targetDate && post.expiresAt && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <strong>בתוקף עד:</strong> {new Date(post.expiresAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
              <AddToCalendarButton post={post} />
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
            <div style={{ textAlign: 'center', padding: '0.8rem', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px dashed var(--glass-border)', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('yourPost', 'זהו פוסט שאתה פרסמת')}</span>
            </div>
          ) : post.status === 'tender' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'var(--surface-subtle)', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-color)', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span>🏆 מכרז קהילתי פתוח ({post.responseCount || 0} הצעות הוגשו)</span>
                {post.lowestBid > 0 && (
                  <span style={{ background: 'rgba(236, 72, 153, 0.14)', padding: '2px 8px', borderRadius: '999px' }}>
                    הצעה מובילה: ₪{post.lowestBid}
                  </span>
                )}
              </div>
              {!respondedPostIds.includes(post.id) && (
                <>
                  <input 
                    type="number" 
                    placeholder={t('yourBid')} 
                    value={bids[post.id]?.amount || ''}
                    onChange={e => setBids({...bids, [post.id]: {...(bids[post.id] || {}), amount: e.target.value}})}
                    style={{ padding: '0.8rem', boxSizing: 'border-box' }}
                  />
                  <textarea
                    placeholder={t('bidDescription', 'הסבר קצר למה כדאי לבחור בך... (אופציונלי)')}
                    value={bids[post.id]?.text || ''}
                    onChange={e => setBids({...bids, [post.id]: {...(bids[post.id] || {}), text: e.target.value}})}
                    style={{ padding: '0.8rem', boxSizing: 'border-box', minHeight: '60px', borderRadius: '8px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
                  />
                </>
              )}
              <button 
                className="btn" 
                onClick={() => handleConnect(post, true)}
                style={{
                  background: respondedPostIds.includes(post.id) ? 'var(--surface-subtle)' : 'var(--accent-color)',
                  color: respondedPostIds.includes(post.id) ? 'var(--text-secondary)' : '#ffffff',
                  border: respondedPostIds.includes(post.id) ? '1px solid var(--glass-border)' : 'none'
                }}
              >
                {respondedPostIds.includes(post.id) ? '✓ כבר הגבת לפנייה זו' : t('submitBid')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {expandedRespondPostId === post.id && isRuleOf3Post(post) && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem', borderRadius: '12px', background: 'var(--surface-subtle)', border: '1px solid var(--primary-color)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    הוסף פרטים לפנייה (אופציונלי — עוזר למפרסם לבחור בך מהר יותר):
                  </div>
                  <textarea
                    placeholder="איך תוכל לעזור ומתי אתה זמין? (אופציונלי)"
                    value={bids[post.id]?.text || ''}
                    onChange={e => setBids({...bids, [post.id]: {...(bids[post.id] || {}), text: e.target.value}})}
                    style={{ padding: '0.65rem 0.8rem', boxSizing: 'border-box', minHeight: '56px', borderRadius: '8px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
                  />
                  <input
                    type="number"
                    placeholder="הצעת מחיר ב-₪ (אופציונלי - השאר ריק לעזרה בחינם או לפי תקציב המפרסם)"
                    value={bids[post.id]?.amount || ''}
                    onChange={e => setBids({...bids, [post.id]: {...(bids[post.id] || {}), amount: e.target.value}})}
                    style={{ padding: '0.65rem 0.8rem', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedRespondPostId(null)}
                      style={{ flex: 0.4, padding: '0.65rem', borderRadius: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleConnect(post, false)}
                      style={{ flex: 1, background: 'var(--primary-color)', color: '#fff', fontWeight: 600 }}
                    >
                      שלח פנייה למפרסם (נותרו {Math.max(0, 3 - (post.responseCount || 0))} מתוך 3 מקומות)
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    if (respondedPostIds.includes(post.id)) {
                      const msg = t('alreadyResponded', 'כבר הגבת לפנייה זו ולא ניתן להגיב שוב.');
                      setToastMsg(msg);
                      setTimeout(() => setToastMsg(''), 3500);
                      alert(msg);
                      return;
                    }
                    if (isRuleOf3Post(post) && expandedRespondPostId !== post.id) {
                      setExpandedRespondPostId(post.id);
                    } else {
                      handleConnect(post, false);
                    }
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: respondedPostIds.includes(post.id)
                      ? 'var(--surface-subtle)'
                      : (post.type === 'supply' ? 'var(--secondary-color)' : 'var(--primary-color)'),
                    color: respondedPostIds.includes(post.id) ? 'var(--text-secondary)' : '#ffffff',
                    border: respondedPostIds.includes(post.id) ? '1px solid var(--glass-border)' : 'none',
                    fontWeight: 600
                  }}
                >
                  {respondedPostIds.includes(post.id)
                    ? '✓ כבר הגבת לפנייה זו'
                    : post.type === 'supply' 
                      ? (post.supplyType === 'event'
                          ? `מעוניין, מתכנן להגיע (${post.responseCount || 0} נרשמו)`
                          : t('interestedChat', 'מעוניין, פתח צ׳אט'))
                      : isCalendarEnabledForPost(post)
                        ? `מעוניין להשתתף (${post.responseCount || 0} נרשמו)`
                        : `הצע עזרה / צור קשר (${post.responseCount || 0} מתוך 3 פניות)`
                  }
                </button>
                <button 
                  onClick={() => handleIgnorePost(post.id)}
                  style={{ flex: 0.25, minWidth: '44px', minHeight: '44px', background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  title="לא מעוניין"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )})}
      
      {hasMore && (
        <button 
          onClick={loadMore}
          disabled={loading}
          style={{ width: '100%', marginTop: '1rem', padding: '0.85rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
        >
          {loading ? t('loading', 'טוען...') : t('loadMorePosts', 'טען עוד פוסטים')}
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
