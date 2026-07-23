import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  postId?: string;
  read: boolean;
  createdAt: any;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });
      // Sort newest first client-side to avoid composite index requirement
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notif: Notification) => {
    setIsOpen(false);
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    if (notif.postId) {
      navigate(`/post/${notif.postId}`);
    } else {
      navigate('/feed');
    }
  };

  return (
    <div style={{ position: 'fixed', top: '15px', left: '15px', zIndex: 1000 }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '50%', 
          width: '45px', 
          height: '45px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <Bell size={22} className={unreadCount > 0 ? "animate-pulse-glow" : ""} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'var(--primary-color)',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass animate-fade-in" style={{
          position: 'absolute',
          top: '55px',
          left: '0',
          width: '280px',
          maxHeight: '400px',
          overflowY: 'auto',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{t('notifications')}</h3>
          
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.7, padding: '1rem 0' }}>
              {t('noNotifications')}
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  padding: '0.8rem',
                  borderRadius: '8px',
                  background: notif.read ? 'rgba(0,0,0,0.1)' : 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid',
                  borderColor: notif.read ? 'transparent' : 'rgba(99, 102, 241, 0.3)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  lineHeight: '1.4'
                }}
              >
                {!notif.read && <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--primary-color)', borderRadius: '50%', marginRight: '8px' }}></span>}
                {notif.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
