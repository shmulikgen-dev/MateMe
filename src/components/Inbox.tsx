import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { MessageCircle, Trash2 } from 'lucide-react';
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
          const usersList = data.users || data.participants || [];
          const partnerId = usersList.find((id: string) => id !== auth.currentUser?.uid);
          let partnerAlias = t('unknownUser', 'Unknown User');
          
          if (partnerId) {
            const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', partnerId)));
            if (!userSnap.empty) {
              partnerAlias = userSnap.docs[0].data().alias;
            }
          }
          
          let chatTopic = data.topic || '';
          if (!chatTopic && data.postId) {
            try {
              const postDoc = await getDoc(doc(db, 'posts', data.postId));
              if (postDoc.exists()) {
                const pData = postDoc.data();
                chatTopic = pData.description || pData.category || '';
              }
            } catch(e) {}
          }
          
          return { id: chatDoc.id, partnerAlias, chatTopic, ...data } as any;
        }));
        
        // Sort newest first
        chatsData.sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis() || a.createdAt?.toMillis() || 0;
          const timeB = b.lastMessageTime?.toMillis() || b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        });
        
        // Filter out chats the user deleted
        const filteredChats = chatsData.filter(c => !c.deletedFor?.includes(auth.currentUser?.uid));
        setActiveChats(filteredChats);
      } catch (error) {
        console.error("Error fetching chats", error);
      }
      setLoading(false);
    };

    fetchChats();
  }, []);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteChat', 'האם אתה בטוח שברצונך למחוק שיחה זו מהרשימה?'))) {
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          deletedFor: arrayUnion(auth.currentUser?.uid)
        });
        setActiveChats(prev => prev.filter(c => c.id !== chatId));
      } catch(err) {
        console.error("Error deleting chat", err);
      }
    }
  };

  if (loading) return null;

  if (activeChats.length === 0) return null; // Don't show anything if no chats

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
              {chat.chatTopic && (
                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '2px' }}>
                  <strong>{t('topic', 'נושא')}:</strong> {chat.chatTopic}
                </div>
              )}
              <div style={{ fontSize: '0.8rem', opacity: 0.7, display: 'flex', gap: '0.5rem' }}>
                <span>{chat.status === 'completed' ? t('transactionCompleted', 'Transaction Completed') : t('activeConversation', 'Active Conversation')}</span>
                <span>•</span>
                <span>{formatMessageTime(chat.lastMessageTime || chat.createdAt)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>{t('openChat', 'Open')}</button>
              <button onClick={(e) => handleDeleteChat(e, chat.id)} style={{ background: 'rgba(255,0,0,0.2)', border: 'none', color: '#ff4444', borderRadius: '8px', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
