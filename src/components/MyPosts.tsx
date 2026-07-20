import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Inbox, CheckCircle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MyPosts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [activeResponses, setActiveResponses] = useState<any[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyPosts();
  }, []);

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

  const viewResponses = async (postId: string) => {
    setSelectedPostId(postId);
    const q = query(collection(db, 'responses'), where('postId', '==', postId));
    const snapshot = await getDocs(q);
    
    // Fetch aliases for responders
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

    // Update Response
    await updateDoc(doc(db, 'responses', responseId), { status: 'accepted' });
    
    // Update Post
    await updateDoc(doc(db, 'posts', postId), { status: 'resolved' });

    alert('Match Accepted! Chat opened.');
    navigate(`/chat/${chatRef.id}`);
  };

  const initiateTenderMode = async (postId: string) => {
    await updateDoc(doc(db, 'posts', postId), { status: 'tender' });
    alert('Tender Mode Initiated! Responders will be asked to submit concrete bids.');
    fetchMyPosts();
    setSelectedPostId(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm("Are you sure you want to completely delete this post?")) {
      await deleteDoc(doc(db, 'posts', postId));
      fetchMyPosts();
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> Back to Home
      </button>

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Inbox /> {t('myDashboard')}
      </h2>
      
      {loading && <p>Loading your posts...</p>}
      
      {!loading && myPosts.length === 0 && (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>You haven't posted any requests or offers yet.</p>
        </div>
      )}

      {!selectedPostId ? (
        myPosts.map(post => (
          <div key={post.id} className="glass animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1rem', borderLeft: `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', color: post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)' }}>
                {post.type}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: post.status === 'active' ? 'rgba(83, 194, 139, 0.2)' : (post.status === 'evaluating' ? 'rgba(255, 165, 0, 0.2)' : (post.status === 'tender' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)')) }}>
                  {post.status.toUpperCase()}
                </span>
                <button onClick={() => handleDeletePost(post.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p style={{ margin: '0.5rem 0' }}>{post.description}</p>
            
            {(post.targetDate || post.targetTime || post.budget > 0) && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '8px', marginBottom: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                {post.targetDate && <div><strong>Date:</strong> {post.targetDate}</div>}
                {post.targetTime && <div><strong>Time:</strong> {post.targetTime}</div>}
                {post.budget > 0 && <div><strong>Budget:</strong> ₪{post.budget}</div>}
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  <strong>Responses: {post.responseCount || 0}</strong>
                </p>
                {(post.responseCount || 0) > 0 && post.status !== 'resolved' && (
                  <button className="btn" onClick={() => viewResponses(post.id)} style={{ padding: '5px 15px', fontSize: '0.8rem' }}>
                    View Responses
                  </button>
                )}
              </div>
              
              {post.status === 'evaluating' && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#f59e0b' }}>
                  Auto-paused! Max responses reached. Review connections below.
                </p>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="glass animate-fade-in" style={{ padding: '2rem' }}>
          <button onClick={() => setSelectedPostId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem' }}>
            ← Back to Posts
          </button>
          <h3>Review Connections</h3>
          <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1.5rem' }}>Choose one user to connect with, or initiate Tender Mode.</p>
          
          {activeResponses.map(res => (
            <div key={res.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{res.alias}</strong>
                {res.bidAmount && <div style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Bid: ₪{res.bidAmount}</div>}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status: {res.status}</div>
              </div>
              <button className="btn" onClick={() => handleAccept(res.id, res.responderId, res.postId)} style={{ padding: '8px 15px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                <CheckCircle size={16} /> Accept & Chat
              </button>
            </div>
          ))}

          {activeResponses.length >= 3 && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
              <p style={{fontSize: '0.9rem', marginBottom: '1rem'}}>None of these fit perfectly?</p>
              <button className="btn" onClick={() => initiateTenderMode(selectedPostId)} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', width: '100%' }}>
                Initiate Tender Mode (Bidding)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
