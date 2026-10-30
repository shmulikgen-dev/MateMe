import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Inbox, CheckCircle, Trash2, Ghost, PackageOpen, Share2, Link, Flag, RefreshCw, MessageCircle, XCircle, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AddToCalendarButton, { isCalendarEnabledForPost } from './AddToCalendarButton';
import UserBadge from './UserBadge';

interface MyPostsProps {
  embedded?: boolean;
}

export default function MyPosts({ embedded = false }: MyPostsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'posts' | 'offers'>('posts');
  
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [activeResponses, setActiveResponses] = useState<any[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState<{isOpen: boolean, postId: string}>({isOpen: false, postId: ''});
  const [reportReason, setReportReason] = useState('');
  const [deletingOffers, setDeletingOffers] = useState<string[]>([]);

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
        createdAt: new Date()
      });
      alert(t('reportSubmitted', 'הדיווח נשלח בהצלחה'));
      setReportModal({isOpen: false, postId: ''});
      setReportReason('');
    } catch (error) {
      console.error('Error reporting:', error);
      alert(t('errorOccurred', 'אירעה שגיאה'));
    }
  };

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchMyPosts();
    } else {
      fetchMyOffers();
    }
  }, [activeTab]);

  const fetchMyPosts = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const q = query(
      collection(db, 'posts'),
      where('creatorId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    postsData.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const dateB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return dateB - dateA;
    });
    setMyPosts(postsData);
    setLoading(false);
  };

  const fetchMyOffers = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    // Fetch responses created by current user
    const q = query(collection(db, 'responses'), where('responderId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    
    // For each response, fetch the associated post details
    const offersData = await Promise.all(snapshot.docs.map(async (responseDoc) => {
      const respData = responseDoc.data();
      let postData = null;
      try {
        const postRef = await getDoc(doc(db, 'posts', respData.postId));
        if (postRef.exists()) {
          postData = { id: postRef.id, ...postRef.data() };
        }
      } catch(e) {}
      
      return { id: responseDoc.id, ...respData, post: postData };
    }));
    
    // Sort offers: pending and accepted first, rejected last
    const statusOrder: Record<string, number> = { 'accepted': 1, 'pending': 2, 'rejected': 3 };
    offersData.sort((a: any, b: any) => {
      const statusDiff = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
      if (statusDiff !== 0) return statusDiff;
      const dateA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const dateB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return dateB - dateA;
    });

    setMyOffers(offersData);
    setLoading(false);
  };

  const handleDeleteOffer = async (offerId: string, postId?: string) => {
    try {
      setDeletingOffers(prev => [...prev, offerId]);
      
      await deleteDoc(doc(db, 'responses', offerId));
      if (postId) {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const currentCount = postSnap.data().responseCount || 0;
          const newCount = Math.max(0, currentCount - 1);
          const updates: any = { responseCount: newCount };
          if (newCount < 3 && postSnap.data().status === 'evaluating') {
            updates.status = 'active';
          }
          await updateDoc(postRef, updates);
        }
      }
      
      setTimeout(() => {
        setMyOffers(prev => prev.filter(o => o.id !== offerId));
        setDeletingOffers(prev => prev.filter(id => id !== offerId));
      }, 1500);
    } catch (e) {
      console.error("Error deleting offer: ", e);
      setDeletingOffers(prev => prev.filter(id => id !== offerId));
    }
  };

  const viewResponses = async (postId: string) => {
    setSelectedPostId(postId);
    const q = query(collection(db, 'responses'), where('postId', '==', postId));
    const snapshot = await getDocs(q);
    
    const responsesWithAliases = await Promise.all(snapshot.docs.map(async (responseDoc) => {
      const data = responseDoc.data();
      let alias = t('unknownUser', 'חבר קהילה');
      let trustScore = 0;
      try {
        const directUserDoc = await getDoc(doc(db, 'users', data.responderId));
        if (directUserDoc.exists()) {
          alias = directUserDoc.data().alias || alias;
          trustScore = directUserDoc.data().trustScore || 0;
        } else {
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', data.responderId)));
          if (!userSnap.empty) {
            alias = userSnap.docs[0].data().alias || alias;
            trustScore = userSnap.docs[0].data().trustScore || 0;
          }
        }
      } catch (e) {}
      return { id: responseDoc.id, ...data, alias, trustScore } as any;
    }));

    // Sort: non-rejected first, then by combined community score (higher trustScore + lower bidAmount)
    responsesWithAliases.sort((a, b) => {
      if (a.status === 'rejected' && b.status !== 'rejected') return 1;
      if (a.status !== 'rejected' && b.status === 'rejected') return -1;
      const trustDiff = (b.trustScore || 0) - (a.trustScore || 0);
      if (a.bidAmount && b.bidAmount && a.bidAmount !== b.bidAmount) {
        return a.bidAmount - b.bidAmount;
      }
      return trustDiff;
    });
    
    setActiveResponses(responsesWithAliases);
  };

  const handleOpenChatOnly = async (responderId: string, postId: string) => {
    if (!auth.currentUser) return;
    const post = myPosts.find((p: any) => p.id === postId);
    const resolvedCommunityId = (post?.communityId && post.communityId !== 'global') ? post.communityId : null;

    const chatRef = await addDoc(collection(db, 'chats'), {
      postId,
      communityId: resolvedCommunityId,
      users: [auth.currentUser.uid, responderId],
      status: 'active',
      createdAt: serverTimestamp()
    });

    if (resolvedCommunityId) {
      navigate(`/community/${resolvedCommunityId}/chat/${chatRef.id}`);
    } else {
      navigate(`/chat/${chatRef.id}`);
    }
  };

  const handleRejectSingle = async (responseId: string, postId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'responses', responseId), { status: 'rejected' });
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const currentCount = postSnap.data().responseCount || 0;
        const newCount = Math.max(0, currentCount - 1);
        const updates: any = { responseCount: newCount };
        if (newCount < 3 && postSnap.data().status === 'evaluating') {
          updates.status = 'active';
        }
        await updateDoc(postRef, updates);
      }
      setActiveResponses(prev => prev.map(r => r.id === responseId ? { ...r, status: 'rejected' } : r));
      fetchMyPosts();
    } catch (e) {
      console.error('Error rejecting response:', e);
    }
  };

  const handleAccept = async (responseId: string, responderId: string, postId: string) => {
    if (!auth.currentUser) return;
    const post = myPosts.find((p: any) => p.id === postId);
    
    // Create Chat
    const resolvedCommunityId = (post?.communityId && post.communityId !== 'global') ? post.communityId : null;
    const chatRef = await addDoc(collection(db, 'chats'), {
      postId,
      communityId: resolvedCommunityId,
      users: [auth.currentUser.uid, responderId],
      status: 'active',
      createdAt: new Date()
    });

    // Update accepted Response
    await updateDoc(doc(db, 'responses', responseId), { status: 'accepted' });
    
    // Auto-Reject other responses
    const otherResponses = activeResponses.filter(r => r.id !== responseId);
    for (const r of otherResponses) {
      await updateDoc(doc(db, 'responses', r.id), { status: 'rejected' });
    }
    
    // Update Post
    await updateDoc(doc(db, 'posts', postId), { status: 'resolved' });

    alert(t('matchAccepted'));
    if (resolvedCommunityId) {
      navigate(`/community/${resolvedCommunityId}/chat/${chatRef.id}`);
    } else {
      navigate(`/chat/${chatRef.id}`);
    }
  };

  const initiateTenderMode = async (postId: string) => {
    await updateDoc(doc(db, 'posts', postId), { status: 'tender' });
    alert(t('tenderInitiated'));
    fetchMyPosts();
    setSelectedPostId(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(t('confirmDelete', 'Are you sure you want to delete this post?'))) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      fetchMyPosts();
    } catch (err) {
      console.error(err);
      alert(t('errorOccurred'));
    }
  };

  const handleRenewPost = async (postId: string) => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Renew for 7 days
      await updateDoc(doc(db, 'posts', postId), {
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString()
      });
      alert(t('postRenewed', 'המודעה חודשה בהצלחה!'));
      fetchMyPosts();
    } catch (e) {
      console.error(e);
      alert(t('errorOccurred'));
    }
  };

  // Helper to translate statuses dynamically
  const getTranslatedStatus = (status: string) => {
    switch (status) {
      case 'active': return t('statusActive');
      case 'evaluating': return t('statusEvaluating');
      case 'tender': return t('statusTender');
      case 'resolved': return t('statusResolved');
      case 'pending': return t('statusPending');
      case 'accepted': return t('statusAccepted');
      case 'rejected': return t('statusRejected');
      default: return status.toUpperCase();
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: embedded ? '0' : '1rem' }}>
      {!embedded && (
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <ArrowLeft size={20} /> {t('backToHome')}
        </button>
      )}

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: embedded ? '1rem' : '0' }}>
        <Inbox /> {t('myDashboard')}
      </h2>
      
      {/* TABS */}
      {!selectedPostId && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('posts')}
            style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', color: activeTab === 'posts' ? 'var(--accent-color)' : 'var(--text-color)', borderBottom: activeTab === 'posts' ? '2px solid var(--accent-color)' : 'none', fontWeight: activeTab === 'posts' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            {t('myRequests')}
          </button>
          <button 
            onClick={() => setActiveTab('offers')}
            style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', color: activeTab === 'offers' ? 'var(--accent-color)' : 'var(--text-color)', borderBottom: activeTab === 'offers' ? '2px solid var(--accent-color)' : 'none', fontWeight: activeTab === 'offers' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            {t('myOffers')}
          </button>
        </div>
      )}

      {loading && <p>{t('loadingYourPosts')}</p>}
      
      {/* MY POSTS TAB */}
      {!loading && activeTab === 'posts' && !selectedPostId && (
        <>
          {myPosts.length === 0 && (
            <div className="glass animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
              <div className="animate-float" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                <PackageOpen size={32} />
              </div>
              <h3 style={{margin: '0.5rem 0 0 0'}}>{t('noPostsYet')}</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>When you create a new request or offer, it will appear here.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn" onClick={() => navigate('/create-demand')} style={{ flex: 1 }}>{t('createDemandBtn')}</button>
                <button className="btn" onClick={() => navigate('/create-supply')} style={{ flex: 1, background: 'var(--secondary-color)' }}>{t('createSupplyBtn')}</button>
              </div>
            </div>
          )}
          {myPosts.map(post => (
            <div key={post.id} className="glass animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1rem', borderLeft: `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)' }}>
                    {t(post.type)}
                  </span>
                  {post.createdAt && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {new Date(post.createdAt?.toMillis?.() || post.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: post.status === 'active' ? 'rgba(83, 194, 139, 0.2)' : (post.status === 'evaluating' ? 'rgba(255, 165, 0, 0.2)' : (post.status === 'tender' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)')) }}>
                    {t(`status${post.status.charAt(0).toUpperCase() + post.status.slice(1)}`)}
                  </span>
                  
                  {post.type === 'supply' && (
                    <button onClick={() => handleShare(post.id)} title="Direct Booking Link" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                      <Link size={16} />
                    </button>
                  )}
                  <button onClick={() => handleShare(post.id)} title="Share" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                    <Share2 size={16} />
                  </button>

                  <button onClick={() => handleRenewPost(post.id)} title={t('renewPost', 'חדש מודעה')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                    <RefreshCw size={16} />
                  </button>

                  <button onClick={() => handleDeletePost(post.id)} title="Delete" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {post.category && (
                <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <strong>{t('category')}:</strong> {t(post.category)}
                </div>
              )}
              {post.communityId && post.communityId !== 'global' && (
                <div style={{ marginBottom: '0.5rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  🔒 פורסם בקהילה סגורה
                </div>
              )}
              <p style={{ margin: '0 0 1rem 0' }}>{post.description}</p>
              
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

              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    <strong>
                      {post.supplyType === 'event' || isCalendarEnabledForPost(post)
                        ? `נרשמים לאירוע: ${post.responseCount || 0}`
                        : t('responsesCount', { count: post.responseCount || 0 })}
                    </strong>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {post.type === 'demand' && !isCalendarEnabledForPost(post) && post.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => initiateTenderMode(post.id)}
                        style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        🏆 העבר למכרז פתוח
                      </button>
                    )}
                    {(post.responseCount || 0) > 0 && post.status !== 'resolved' && (
                      <button className="btn" onClick={() => viewResponses(post.id)} style={{ padding: '5px 15px', fontSize: '0.8rem' }}>
                        {post.supplyType === 'event' || isCalendarEnabledForPost(post) ? 'צפה בנרשמים' : t('viewResponses')}
                      </button>
                    )}
                  </div>
                </div>
                
                {post.status === 'evaluating' && post.type === 'demand' && !isCalendarEnabledForPost(post) && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#f59e0b' }}>
                    התקבלו 3 פניות פעילות — ניתן לפתוח צ׳אט בירור, לבחור מועמד או לשחרר מקום כדי להחזיר את המודעה לפיד.
                  </p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* MY OFFERS TAB */}
      {!loading && activeTab === 'offers' && !selectedPostId && (
        <>
          {myOffers.length === 0 && (
            <div className="glass animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
              <div className="animate-float" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                <Ghost size={32} />
              </div>
              <h3 style={{margin: '0.5rem 0 0 0'}}>{t('noOffersYet')}</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Go to the local feed to find requests you can help with!</p>
              <button className="btn" onClick={() => navigate('/feed')} style={{ marginTop: '1rem', background: 'var(--primary-color)' }}>{t('viewFeed')}</button>
            </div>
          )}
          {myOffers.map(offer => {
            const isDeleting = deletingOffers.includes(offer.id);
            
            return (
            <div key={offer.id} className={`glass ${isDeleting ? '' : 'animate-fade-in'}`} style={{ 
                padding: isDeleting ? '0' : '1.5rem', 
                marginBottom: isDeleting ? '0' : '1rem', 
                maxHeight: isDeleting ? '0' : '300px',
                opacity: isDeleting ? 0 : 1,
                transform: isDeleting ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: isDeleting ? 'hidden' : 'visible',
                borderLeft: isDeleting ? 'none' : `4px solid ${offer.status === 'rejected' ? 'var(--accent-color)' : 'var(--primary-color)'}` 
              }}>
              {isDeleting && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10, color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
                  transition: 'opacity 0.3s ease'
                }}>
                  הפנייה נמחקה
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: offer.status === 'rejected' ? 'var(--accent-color)' : 'var(--primary-color)' }}>
                    {offer.bidAmount ? `${t('yourBid')} ₪${offer.bidAmount}` : t('myOffers')}
                  </span>
                  {offer.bidText && <div style={{ fontSize: '0.85rem', marginTop: '4px', fontStyle: 'italic', opacity: 0.9 }}>"{offer.bidText}"</div>}
                  {offer.createdAt && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      {new Date(offer.createdAt?.toMillis?.() || offer.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: offer.status === 'accepted' ? 'rgba(83, 194, 139, 0.2)' : (offer.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)'), color: offer.status === 'accepted' ? '#6ee7b7' : (offer.status === 'rejected' ? '#fca5a5' : '#a5b4fc') }}>
                    {getTranslatedStatus(offer.status)}
                  </span>
                  {offer.post && (
                    <>
                      <button onClick={() => handleShare(offer.post.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                        <Share2 size={16} />
                      </button>
                      <button onClick={() => setReportModal({isOpen: true, postId: offer.post.id})} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                        <Flag size={16} />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDeleteOffer(offer.id, offer.postId)} title="Delete / Cancel" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {offer.post ? (
                <>
                  <p style={{ margin: '0.5rem 0', opacity: 0.8, fontSize: '0.9rem', fontStyle: 'italic' }}>
                    "{offer.post.description}"
                  </p>
                  {(isCalendarEnabledForPost(offer.post) || offer.post.targetDate || offer.post.targetTime || offer.post.budget > 0) && (
                    <div style={{ background: 'var(--surface-subtle)', padding: '0.7rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', fontSize: '0.82rem', marginTop: '0.5rem', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {offer.post.targetDate && <div><strong>{t('date')}:</strong> {offer.post.targetDate}</div>}
                        {offer.post.targetTime && <div><strong>{t('time')}:</strong> {offer.post.targetTime}</div>}
                        {offer.post.budget > 0 && <div><strong>{t('budget')}:</strong> ₪{offer.post.budget}</div>}
                        {isCalendarEnabledForPost(offer.post) && !offer.post.targetDate && offer.post.expiresAt && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            <strong>בתוקף עד:</strong> {new Date(offer.post.expiresAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                      <AddToCalendarButton post={offer.post} />
                    </div>
                  )}
                </>
              ) : (
                <p style={{ margin: '0.5rem 0', opacity: 0.5, fontStyle: 'italic' }}>Post deleted</p>
              )}
            </div>
          )})}
        </>
      )}

      {/* RESPONSES VIEW */}
      {selectedPostId && (() => {
        const selectedPost = myPosts.find(p => p.id === selectedPostId);
        const isEventOrSupply = Boolean(
          selectedPost?.type === 'supply' ||
          selectedPost?.supplyType === 'event' ||
          isCalendarEnabledForPost(selectedPost)
        );
        const validBids = activeResponses.filter(r => r.status !== 'rejected' && r.bidAmount > 0);
        const minBidAmount = validBids.length > 0 ? Math.min(...validBids.map(r => r.bidAmount)) : null;
        const maxTrustScore = activeResponses.length > 0 ? Math.max(...activeResponses.filter(r => r.status !== 'rejected').map(r => r.trustScore || 0)) : 0;

        return (
          <div className="glass animate-fade-in" style={{ padding: '1.5rem' }}>
            <button onClick={() => setSelectedPostId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> {t('backToPosts')}
            </button>
            <h3 style={{ marginTop: 0 }}>
              {isEventOrSupply ? 'נרשמים ומתעניינים באירוע / בשירות' : t('reviewConnections')}
            </h3>
            <p style={{ opacity: 0.85, fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              {isEventOrSupply
                ? 'ניתן לפתוח צ׳אט עם כל אחד מהנרשמים מבלי לסגור את האירוע לשאר המשתתפים.'
                : 'ניתן לפתוח צ׳אט בירור חופשי עם המועמדים, לשחרר מקום של פונה לא מתאים (להחזרת המודעה לפיד), או לבחור סופית.'}
            </p>
            
            {activeResponses.map(res => {
              const isBestPrice = !isEventOrSupply && minBidAmount !== null && res.bidAmount === minBidAmount && res.status !== 'rejected';
              const isTopTrust = !isEventOrSupply && maxTrustScore >= 20 && res.trustScore === maxTrustScore && res.status !== 'rejected';

              return (
                <div
                  key={res.id}
                  style={{
                    background: 'var(--surface-subtle)',
                    border: isTopTrust ? '1px solid var(--secondary-color)' : '1px solid var(--glass-border)',
                    padding: '1rem',
                    borderRadius: '12px',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.85rem',
                    opacity: res.status === 'rejected' ? 0.55 : 1
                  }}
                >
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <strong
                        onClick={() => navigate(`/user/${res.responderId}`)}
                        style={{ cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline', fontSize: '0.98rem' }}
                      >
                        {res.alias}
                      </strong>
                      <UserBadge trustScore={res.trustScore || 0} />
                      {isTopTrust && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.16)', color: 'var(--secondary-color)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Award size={12} /> מומלץ קהילה
                        </span>
                      )}
                      {isBestPrice && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(236, 72, 153, 0.15)', color: 'var(--accent-color)' }}>
                          💰 ההצעה המשתלמת
                        </span>
                      )}
                    </div>
                    {res.bidAmount > 0 && (
                      <div style={{ color: 'var(--accent-color)', fontWeight: 700, marginTop: '0.3rem', fontSize: '0.92rem' }}>
                        {t('yourBid')}: ₪{res.bidAmount}
                      </div>
                    )}
                    {res.bidText && (
                      <div style={{ fontSize: '0.86rem', fontStyle: 'italic', opacity: 0.92, marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                        "{res.bidText}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {t('statusLabel', { status: getTranslatedStatus(res.status) })}
                    </div>
                  </div>

                  {res.status !== 'rejected' && res.status !== 'accepted' && (
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenChatOnly(res.responderId, res.postId)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '9px',
                          border: '1px solid var(--primary-color)',
                          background: 'var(--badge-demand-bg)',
                          color: 'var(--badge-demand-text)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MessageCircle size={15} /> {isEventOrSupply ? 'פתח צ׳אט' : 'צ׳אט בירור'}
                      </button>

                      {!isEventOrSupply && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleAccept(res.id, res.responderId, res.postId)}
                            style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'inline-flex', gap: '4px', alignItems: 'center', background: 'var(--secondary-color)' }}
                          >
                            <CheckCircle size={15} /> בחר סופית
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectSingle(res.id, res.postId)}
                            title="דחה מועמד זה ושחרר מקום לפונה חדש"
                            style={{
                              padding: '7px 10px',
                              borderRadius: '9px',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <XCircle size={14} /> שחרר מקום
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!isEventOrSupply && selectedPost?.status !== 'tender' && !activeResponses.find(r => r.status === 'accepted') && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.88rem', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>
                  רוצה לפתוח את הבקשה להצעות מחיר מכל הקהילה ללא הגבלת 3 פונים?
                </p>
                <button className="btn" onClick={() => initiateTenderMode(selectedPostId)} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', width: '100%' }}>
                  🏆 {t('initiateTender')}
                </button>
              </div>
            )}
          </div>
        );
      })()}

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
