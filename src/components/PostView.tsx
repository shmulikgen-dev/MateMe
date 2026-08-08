import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Share2, Paperclip, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserBadge from './UserBadge';

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [post, setPost] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [bidText, setBidText] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      try {
        const snap = await getDoc(doc(db, 'posts', id));
        if (snap.exists()) {
          const postData = { id: snap.id, ...(snap.data() as any) };
          setPost(postData);
          
          if (auth.currentUser && postData.creatorId === auth.currentUser.uid) {
            const q = query(collection(db, 'responses'), where('postId', '==', snap.id));
            const resSnap = await getDocs(q);
            
            // For rich bids we need the responder info, so we fetch their user doc
            const fetchedResponses = await Promise.all(resSnap.docs.map(async (d) => {
              const respData = { id: d.id, ...d.data() } as any;
              if (respData.responderId) {
                try {
                  const userSnap = await getDoc(doc(db, 'users', respData.responderId));
                  if (userSnap.exists()) {
                    respData.responderInfo = userSnap.data();
                  }
                } catch (e) {}
              }
              return respData;
            }));
            
            setResponses(fetchedResponses);
          }
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchPost();
  }, [id]);

  const handleConnect = async (isTender: boolean) => {
    try {
      if (!auth.currentUser) {
        alert(t('pleaseLoginToConnect', 'נא להתחבר כדי להגיב'));
        navigate('/');
        return;
      }
      
      const bidNum = isTender ? Number(bidAmount) : null;
      if (isTender && (!bidNum || bidNum <= 0)) {
        alert(t('pleaseEnterValidBid', 'נא להזין הצעת מחיר תקינה'));
        return;
      }

      const newCount = (post.responseCount || 0) + 1;
      const postRef = doc(db, 'posts', post.id);
      
      const updates: any = { responseCount: newCount };
      if (post.type !== 'supply' && newCount >= 3 && !isTender) {
        updates.status = 'evaluating';
      }
      
      await updateDoc(postRef, updates);
      
      if (post.type === 'supply' && post.supplyType !== 'event') {
        // Create Chat immediately
        const chatRef = await addDoc(collection(db, 'chats'), {
          postId: post.id,
          communityId: post.communityId || null,
          users: [auth.currentUser.uid, post.creatorId],
          status: 'active',
          createdAt: serverTimestamp()
        });
        
        // Navigate to the chat
        if (post.communityId) {
          navigate(`/community/${post.communityId}/chat/${chatRef.id}`);
        } else {
          navigate(`/chat/${chatRef.id}`);
        }
        return;
      }
      
      await addDoc(collection(db, 'responses'), {
        postId: post.id,
        responderId: auth.currentUser.uid,
        status: 'pending',
        bidAmount: bidNum,
        bidText: bidText,
        createdAt: serverTimestamp()
      });
      
      alert(isTender ? t('bidSubmitted') : t('connectionSent'));
      setPost({...post, responseCount: newCount, status: (post.type !== 'supply' && newCount >= 3 && !isTender) ? 'evaluating' : post.status});
    } catch (error) {
      console.error("Error connecting: ", error);
      alert(t('failedConnect', 'שגיאה ביצירת קשר'));
    }
  };

  const handleAcceptBid = async (resp: any) => {
    if (!auth.currentUser || !post) return;
    try {
      // 1. Update response status to accepted
      await updateDoc(doc(db, 'responses', resp.id), {
        status: 'accepted'
      });
      
      // 2. Create a Chat between post creator and responder
      const chatRef = await addDoc(collection(db, 'chats'), {
        postId: post.id,
        communityId: post.communityId || null,
        users: [auth.currentUser.uid, resp.responderId],
        status: 'active',
        createdAt: serverTimestamp()
      });
      
      // 3. Update post status to resolved (or evaluating if they want to accept multiple, but usually resolved)
      await updateDoc(doc(db, 'posts', post.id), {
        status: 'evaluating'
      });
      
      // 4. Navigate to chat
      if (post.communityId) {
        navigate(`/community/${post.communityId}/chat/${chatRef.id}`);
      } else {
        navigate(`/chat/${chatRef.id}`);
      }
    } catch (error) {
      console.error("Error accepting bid:", error);
      alert('אירעה שגיאה. נסה שוב.');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: t('appTitle'), text: t('checkOutThisPost'), url: url });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(url);
      alert(t('linkCopied', 'הקישור הועתק ללוח'));
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('loading', 'טוען...')}</div>;
  if (!post) return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('postNotFound', 'הפוסט לא נמצא')}</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <div className="glass animate-fade-in" style={{ padding: '1.5rem', borderRight: `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: post.type === 'demand' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: post.type === 'demand' ? '#a5b4fc' : '#6ee7b7' }}>
            {t(post.type)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button onClick={handleShare} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
              <Share2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>
          <span style={{ opacity: 0.8 }}>{t('postedBy')} </span>
          <span onClick={() => navigate(`/user/${post.creatorId}`)} style={{ fontWeight: 'bold', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}>
            {post.creatorAlias || 'Anonymous'}
          </span>
          <UserBadge trustScore={post.creatorTrustScore || 0} />
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
              <img src={post.fileUrl} alt={post.fileName || 'Attached image'} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)', maxHeight: '400px', objectFit: 'contain' }} />
            ) : (
              <a href={post.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', textDecoration: 'none', border: '1px solid var(--glass-border)' }}>
                <Paperclip size={18} /> {post.fileName || 'Download Attached File'}
              </a>
            )}
          </div>
        )}

        {post.status !== 'resolved' && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginTop: '1.5rem' }}>
            {post.creatorId === auth.currentUser?.uid ? (
              <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('yourPost', 'זהו פוסט שאתה יצרת')}</span>
                
                {responses.length > 0 && (
                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>הצעות ופניות שהתקבלו ({responses.length}):</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {responses.map(resp => (
                        <div key={resp.id} style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span onClick={() => navigate(`/user/${resp.responderId}`)} style={{ fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                                {resp.responderInfo?.alias || 'Anonymous'}
                              </span>
                              <UserBadge trustScore={resp.responderInfo?.trustScore || 0} />
                            </div>
                            {resp.bidAmount && (
                              <span style={{ fontWeight: 'bold', color: 'var(--secondary-color)', fontSize: '1.1rem' }}>₪{resp.bidAmount}</span>
                            )}
                          </div>
                          {resp.bidText && (
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.9rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                              <MessageSquare size={14} style={{ display: 'inline', marginRight: '4px', opacity: 0.7 }} />
                              {resp.bidText}
                            </div>
                          )}
                          <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                            <button className="btn" onClick={() => handleAcceptBid(resp)} style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>בחר ושוחח</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : post.status === 'active' || post.status === 'tender' ? (
              post.status === 'tender' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <input 
                    type="number" 
                    placeholder={t('enterYourBid', 'הכנס הצעת מחיר (₪)')}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  />
                  <textarea
                    placeholder={t('bidDescription', 'הוסף הסבר קצר למה כדאי לבחור בך... (לא חובה)')}
                    value={bidText}
                    onChange={(e) => setBidText(e.target.value)}
                    style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', minHeight: '60px' }}
                  />
                  <button className="btn" onClick={() => handleConnect(true)} style={{ background: 'var(--accent-color)' }}>
                    {t('submitBid', 'הגש הצעה')}
                  </button>
                </div>
              ) : (
                <button className="btn" onClick={() => handleConnect(false)} style={{ width: '100%', background: 'var(--primary-color)' }}>
                  {post.type === 'supply' ? (post.supplyType === 'event' ? t('interestedToArrive', 'מעוניין, מתכנן להגיע') : t('interestedChat', 'מעוניין, פתח צ׳אט')) : t('connect', 'צור קשר')}
                </button>
              )
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.8, color: '#f59e0b' }}>
                {t('evaluatingConnections', 'בוחן פניות קיימות')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
