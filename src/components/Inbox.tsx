import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Inbox() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(collection(db, 'chats'), where('users', 'array-contains', auth.currentUser.uid));
        const snapshot = await getDocs(q);
        
        const chatsData = await Promise.all(snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const partnerId = data.users.find((id: string) => id !== auth.currentUser?.uid);
          let partnerAlias = t('unknownUser', 'Unknown User');
          
          if (partnerId) {
            const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', partnerId)));
            if (!userSnap.empty) {
              partnerAlias = userSnap.docs[0].data().alias;
            }
          }
          return { id: chatDoc.id, partnerAlias, ...data };
        }));
        
        setActiveChats(chatsData);
      } catch (error) {
        console.error("Error fetching chats", error);
      }
      setLoading(false);
    };

    fetchChats();
  }, []);

  if (loading) return null;

  if (activeChats.length === 0) return null; // Don't show anything if no chats

  return (
    <div style={{ marginTop: '2rem', textAlign: 'left' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <MessageCircle size={20} /> {t('myActiveChats', 'My Active Chats')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {activeChats.map(chat => (
          <div 
            key={chat.id} 
            className="glass" 
            onClick={() => navigate(`/chat/${chat.id}`)}
            style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: chat.status === 'completed' ? '4px solid gray' : '4px solid var(--primary-color)' }}
          >
            <div>
              <div style={{ fontWeight: 'bold' }}>{chat.partnerAlias}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {chat.status === 'completed' ? t('transactionCompleted', 'Transaction Completed') : t('activeConversation', 'Active Conversation')}
              </div>
            </div>
            <button className="btn" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>{t('openChat', 'Open')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
