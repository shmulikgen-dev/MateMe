import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Send, Award, Trash2 } from 'lucide-react';

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerAlias, setPartnerAlias] = useState('Loading...');
  const [isCompleted, setIsCompleted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    // Load Chat Metadata & Partner Alias
    const loadChat = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        if (data.status === 'completed') setIsCompleted(true);

        const partnerId = data.users.find((id: string) => id !== auth.currentUser?.uid);
        if (partnerId) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', partnerId)));
          if (!userSnap.empty) {
            setPartnerAlias(userSnap.docs[0].data().alias);
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
    setNewMessage('');
  };

  const handleTransactionComplete = async () => {
    if (!chatId || !auth.currentUser) return;
    
    // Mark chat as completed
    await updateDoc(doc(db, 'chats', chatId), { status: 'completed' });
    
    // Reward Trust Points to both users
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    const users = chatDoc.data()?.users || [];
    
    for (const uid of users) {
      await updateDoc(doc(db, 'users', uid), {
        trustScore: increment(10)
      });
    }

    setIsCompleted(true);
    alert('Transaction Completed! Both users awarded +10 Trust Score.');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!chatId || !auth.currentUser) return;
    if (window.confirm("Delete this message?")) {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 16px 16px', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <ArrowLeft size={20} /> Back
        </button>
        <h3 style={{ margin: 0 }}>Chat with {partnerAlias}</h3>
        <div style={{width: 60}}></div> {/* spacer */}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          return (
            <div key={msg.id} style={{ alignSelf: isMe ? 'flex-start' : 'flex-end', maxWidth: '75%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isMe && (
                <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px' }}>
                  <Trash2 size={14} />
                </button>
              )}
              <div style={{ background: isMe ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', padding: '0.8rem 1rem', borderRadius: isMe ? '16px 16px 16px 4px' : '16px 16px 4px 16px', color: 'white' }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Action Bar */}
      {!isCompleted ? (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="btn" onClick={handleTransactionComplete} style={{ flex: 1, background: 'var(--secondary-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <Award size={18} /> Mark as Completed
            </button>
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '1rem', borderRadius: '24px' }}
            />
            <button type="submit" className="btn" style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={20} />
            </button>
          </form>
        </div>
      ) : (
        <div className="glass" style={{ padding: '1rem', textAlign: 'center', margin: '1rem', color: 'var(--secondary-color)' }}>
          <Award size={24} style={{ marginBottom: '0.5rem' }} />
          <p style={{ margin: 0 }}>Transaction Completed & Points Awarded!</p>
        </div>
      )}
    </div>
  );
}
