import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Inbox, CheckCircle, Trash2, Ghost, PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MyPosts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'posts' | 'offers'>('posts');
  
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [activeResponses, setActiveResponses] = useState<any[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    
    setMyOffers(offersData);
    setLoading(false);
  };

  const viewResponses = async (postId: string) => {
    setSelectedPostId(postId);
    const q = query(collection(db, 'responses'), where('postId', '==', postId));
    const snapshot = await getDocs(q);
    
    const responsesWithAliases = await Promise.all(snapshot.docs.map(async (responseDoc) => {
      const data = responseDoc.data();
      let alias = "Unknown";
      try {
        const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', data.responderId)));
        if (!userSnap.empty) {
          alias = userSnap.docs[0].data().alias;
        }
      } catch (e) {}
      return { id: responseDoc.id, ...data, alias };
    }));
    
    setActiveResponses(responsesWithAliases);
  };

  const handleAccept = async (responseId: string, responderId: string, postId: string) => {
    if (!auth.currentUser) return;
    
    // Create Chat
    const chatRef = await addDoc(collection(db, 'chats'), {
      postId,
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
    navigate(`/chat/${chatRef.id}`);
  };

  const initiateTenderMode = async (postId: string) => {
    await updateDoc(doc(db, 'posts', postId), { status: 'tender' });
    alert(t('tenderInitiated'));
    fetchMyPosts();
    setSelectedPostId(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'posts', postId));
      fetchMyPosts();
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
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)' }}>
                  {t(post.type)}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: post.status === 'active' ? 'rgba(83, 194, 139, 0.2)' : (post.status === 'evaluating' ? 'rgba(255, 165, 0, 0.2)' : (post.status === 'tender' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)')) }}>
                    {t(`status${post.status.charAt(0).toUpperCase() + post.status.slice(1)}`)}
                  </span>
                  <button onClick={() => handleDeletePost(post.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {post.category && (
                <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <strong>{t('category')}:</strong> {t(post.category)}
                </div>
              )}
              <p style={{ margin: '0 0 1rem 0' }}>{post.description}</p>
              
              {(post.targetDate || post.targetTime || post.availability || post.budget > 0) && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  {post.targetDate && <div><strong>{t('date')}:</strong> {post.targetDate}</div>}
                  {post.targetTime && <div><strong>{t('time')}:</strong> {post.targetTime}</div>}
                  {post.availability && <div><strong>{t('availability')}:</strong> {post.availability}</div>}
                  {post.budget > 0 && <div><strong>{post.type === 'supply' ? t('startingPrice') : t('budget')}:</strong> ₪{post.budget}</div>}
                </div>
              )}

              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    <strong>{t('responsesCount', { count: post.responseCount || 0 })}</strong>
                  </p>
                  {(post.responseCount || 0) > 0 && post.status !== 'resolved' && (
                    <button className="btn" onClick={() => viewResponses(post.id)} style={{ padding: '5px 15px', fontSize: '0.8rem' }}>
                      {t('viewResponses')}
                    </button>
                  )}
                </div>
                
                {post.status === 'evaluating' && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#f59e0b' }}>
                    {t('autoPaused')}
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
              <div className="animate-float" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                <Ghost size={32} />
              </div>
              <h3 style={{margin: '0.5rem 0 0 0'}}>{t('noOffersYet')}</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Go to the local feed to find requests you can help with!</p>
              <button className="btn" onClick={() => navigate('/feed')} style={{ marginTop: '1rem', background: 'var(--accent-color)' }}>{t('viewFeed')}</button>
            </div>
          )}
          {myOffers.map(offer => (
            <div key={offer.id} className="glass animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1rem', borderLeft: `4px solid var(--accent-color)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--accent-color)' }}>
                  {offer.bidAmount ? `${t('yourBid')} ₪${offer.bidAmount}` : t('myOffers')}
                </span>
                
                <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: offer.status === 'accepted' ? 'rgba(83, 194, 139, 0.2)' : (offer.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 165, 0, 0.2)'), color: offer.status === 'accepted' ? '#6ee7b7' : (offer.status === 'rejected' ? '#fca5a5' : '#fcd34d') }}>
                  {getTranslatedStatus(offer.status)}
                </span>
              </div>
              
              {offer.post ? (
                <>
                  <p style={{ margin: '0.5rem 0', opacity: 0.8, fontSize: '0.9rem', fontStyle: 'italic' }}>
                    "{offer.post.description}"
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px', display: 'flex', gap: '1rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                     {offer.post.targetDate && <div><strong>{t('date')}:</strong> {offer.post.targetDate}</div>}
                     {offer.post.budget > 0 && <div><strong>{t('budget')}:</strong> ₪{offer.post.budget}</div>}
                  </div>
                </>
              ) : (
                <p style={{ margin: '0.5rem 0', opacity: 0.5, fontStyle: 'italic' }}>Post deleted</p>
              )}
            </div>
          ))}
        </>
      )}

      {/* RESPONSES VIEW */}
      {selectedPostId && (
        <div className="glass animate-fade-in" style={{ padding: '2rem' }}>
          <button onClick={() => setSelectedPostId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> {t('backToPosts')}
          </button>
          <h3>{t('reviewConnections')}</h3>
          <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t('chooseOneUser')}</p>
          
          {activeResponses.map(res => (
            <div key={res.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{res.alias}</strong>
                {res.bidAmount && <div style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{t('yourBid')}: ₪{res.bidAmount}</div>}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t('statusLabel', { status: getTranslatedStatus(res.status) })}
                </div>
              </div>
              {res.status !== 'rejected' && res.status !== 'accepted' && (
                <button className="btn" onClick={() => handleAccept(res.id, res.responderId, res.postId)} style={{ padding: '8px 15px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <CheckCircle size={16} /> {t('acceptAndChat')}
                </button>
              )}
            </div>
          ))}

          {activeResponses.length >= 3 && !activeResponses.find(r => r.status === 'accepted') && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
              <p style={{fontSize: '0.9rem', marginBottom: '1rem'}}>{t('noneFitPerfectly')}</p>
              <button className="btn" onClick={() => initiateTenderMode(selectedPostId)} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', width: '100%' }}>
                {t('initiateTender')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
