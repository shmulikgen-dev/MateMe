import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      try {
        const snap = await getDoc(doc(db, 'posts', id));
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() });
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
      
      await addDoc(collection(db, 'responses'), {
        postId: post.id,
        responderId: auth.currentUser.uid,
        status: 'pending',
        bidAmount: bidNum,
        createdAt: serverTimestamp()
      });
      
      alert(isTender ? t('bidSubmitted') : t('connectionSent'));
      setPost({...post, responseCount: newCount, status: (post.type !== 'supply' && newCount >= 3 && !isTender) ? 'evaluating' : post.status});
    } catch (error) {
      console.error("Error connecting: ", error);
      alert(t('failedConnect', 'שגיאה ביצירת קשר'));
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

        {auth.currentUser?.uid !== post.creatorId && post.status !== 'resolved' && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            {post.status === 'active' || post.status === 'tender' ? (
              post.status === 'tender' ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    placeholder={t('enterYourBid', 'הכנס הצעת מחיר (₪)')}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  />
                  <button className="btn" onClick={() => handleConnect(true)} style={{ background: 'var(--accent-color)' }}>
                    {t('submitBid', 'שלח הצעה')}
                  </button>
                </div>
              ) : (
                <button className="btn" onClick={() => handleConnect(false)} style={{ width: '100%', background: 'var(--primary-color)' }}>
                  {post.type === 'supply' ? t('interestedToArrive', 'מעניין, מתכנן להגיע') : t('connect', 'צור קשר')}
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
