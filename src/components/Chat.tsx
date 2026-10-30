import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, increment, deleteDoc, arrayUnion } from 'firebase/firestore';
import { ArrowLeft, Send, Award, Trash2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Chat() {
  const { chatId, id: communityId } = useParams<{ chatId: string, id?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerAlias, setPartnerAlias] = useState('Loading...');
  const [chatTopic, setChatTopic] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    // Load Chat Metadata & Partner Alias
    const loadChat = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        if (data.status === 'completed') setIsCompleted(true);
        
        if (data.topic) {
          setChatTopic(data.topic);
        } else if (data.postId) {
          const postDoc = await getDoc(doc(db, 'posts', data.postId));
          if (postDoc.exists()) {
            const pData = postDoc.data();
            setChatTopic(pData.description || pData.category || '');
          }
        }

        const usersList = data.users || data.participants || [];
        const partnerId = usersList.find((id: string) => id !== auth.currentUser?.uid);
        if (partnerId) {
          try {
            const directUserDoc = await getDoc(doc(db, 'users', partnerId));
            if (directUserDoc.exists() && directUserDoc.data().alias) {
              setPartnerAlias(directUserDoc.data().alias);
            } else {
              const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', partnerId)));
              if (!userSnap.empty) {
                setPartnerAlias(userSnap.docs[0].data().alias);
              } else {
                setPartnerAlias(t('unknownUser', 'Unknown User'));
              }
            }
          } catch (e) {
            setPartnerAlias(t('unknownUser', 'Unknown User'));
          }
        }
      }
    };
    loadChat();

    // Listen to messages
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Clear unread count for current user
    const clearUnread = async () => {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${auth.currentUser?.uid}`]: 0
      });
    };
    clearUnread();

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !auth.currentUser) return;

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: newMessage,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    
    // Update the parent chat document
    const updateData: any = {
      lastMessage: newMessage,
      lastMessageTime: serverTimestamp()
    };
    
    const chatDocRef = doc(db, 'chats', chatId);
    const chatDocSnapshot = await getDoc(chatDocRef);
    if (chatDocSnapshot.exists()) {
      const users = chatDocSnapshot.data()?.users || chatDocSnapshot.data()?.participants || [];
      const partnerId = users.find((id: string) => id !== auth.currentUser?.uid);
      if (partnerId) {
        updateData[`unreadCount.${partnerId}`] = increment(1);
      }
    }
    
    await updateDoc(chatDocRef, updateData);
    
    setNewMessage('');
  };

  const handleTransactionComplete = async () => {
    if (!chatId || !auth.currentUser || submittingReview || isCompleted) return;
    setSubmittingReview(true);

    try {
      const currentUid = auth.currentUser.uid;
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      const users: string[] = chatDoc.data()?.users || chatDoc.data()?.participants || [];
      const partnerId = users.find((id: string) => id !== currentUid);

      // Mark chat as completed and remove from current user's active inbox
      await updateDoc(doc(db, 'chats', chatId), {
        status: 'completed',
        deletedFor: arrayUnion(currentUid)
      });

      // Reward Trust Points to both users
      for (const uid of users) {
        try {
          await updateDoc(doc(db, 'users', uid), {
            trustScore: increment(10)
          });
        } catch (err) {
          console.warn('Could not increment trustScore for user', uid, err);
        }
      }

      if (partnerId) {
        try {
          await addDoc(collection(db, 'transactions'), {
            parties: [currentUid, partnerId],
            userId: partnerId,
            reviewerId: currentUid,
            points: 10,
            review: reviewText.trim(),
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.warn('Could not save transaction review', err);
        }
      }

      setReviewSuccess(true);
      setIsCompleted(true);
      setShowReviewInput(false);

      // Automatically close chat after showing visual feedback
      setTimeout(() => {
        if (communityId) {
          navigate(`/community/${communityId}`);
        } else {
          navigate('/');
        }
      }, 1500);
    } catch (err) {
      console.error('Error completing transaction:', err);
      setSubmittingReview(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!chatId || !auth.currentUser) return;
    if (window.confirm("Delete this message?")) {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? timeStr : `${date.toLocaleDateString()} ${timeStr}`;
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: '0 0 16px 16px', zIndex: 10, paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => {
            if (communityId) navigate(`/community/${communityId}`);
            else navigate(-1);
          }} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '10px' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <h3 style={{ margin: 0 }}>Chat with {partnerAlias}</h3>
          <div style={{width: 60}}></div> {/* spacer */}
        </div>
        {chatTopic && (
          <div style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.8, background: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: '8px', alignSelf: 'center' }}>
            <strong>נושא:</strong> {chatTopic}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          return (
            <div key={msg.id} style={{ alignSelf: isMe ? 'flex-start' : 'flex-end', maxWidth: '75%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isMe && (
                <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} />
                </button>
              )}
              <div style={{ background: isMe ? 'var(--primary-color)' : 'var(--glass-bg)', border: isMe ? 'none' : '1px solid var(--glass-border)', padding: '0.8rem 1rem', borderRadius: isMe ? '16px 16px 16px 4px' : '16px 16px 4px 16px', color: isMe ? 'white' : 'var(--text-primary)' }}>
                <div>{msg.text}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: isMe ? 'right' : 'left', marginTop: '4px' }}>
                  {formatMessageTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Action Bar */}
      {!isCompleted ? (
        <div style={{ padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {showReviewInput ? (
            <div className="glass animate-fade-in" style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '12px' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('leaveReview')} {partnerAlias}:</p>
              <input 
                type="text" 
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder={t('reviewPlaceholder')}
                style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box', marginBottom: '0.8rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => setShowReviewInput(false)}
                  style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', fontWeight: 600, cursor: submittingReview ? 'not-allowed' : 'pointer' }}
                >
                  {t('cancel', 'ביטול')}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={submittingReview}
                  onClick={handleTransactionComplete}
                  style={{ flex: 1, background: 'var(--secondary-color)', opacity: submittingReview ? 0.7 : 1, cursor: submittingReview ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  {submittingReview ? 'שולח וסוגר צ׳אט...' : t('markCompletedWithReview')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button className="btn" onClick={() => setShowReviewInput(true)} style={{ flex: 1, background: 'var(--secondary-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <Award size={18} /> {t('markCompleted', 'סמן כהושלם')}
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '1rem', borderRadius: '24px' }}
            />
            <button type="submit" className="btn" style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '50px' }}>
              <Send size={20} />
            </button>
          </form>
        </div>
      ) : (
        <div className="glass animate-fade-in" style={{ padding: '1.25rem', textAlign: 'center', margin: '1rem', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--secondary-color)', borderRadius: '14px' }}>
          <CheckCircle2 size={28} style={{ marginBottom: '0.4rem' }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>
            {reviewSuccess ? 'הביקורת נשלחה בהצלחה! (+10 נקודות אמון)' : 'העסקה הושלמה ונקודות האמון הוענקו!'}
          </p>
          {reviewSuccess && (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              סוגר את הצ׳אט ומחזיר למסך הראשי...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
