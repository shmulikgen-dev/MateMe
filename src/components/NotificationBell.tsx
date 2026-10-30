import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Bell, X } from 'lucide-react';

interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  postId?: string;
  communityId?: string;
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

  // Listen for Foreground FCM Push Notifications so they also pop up when the tab is open
  useEffect(() => {
    let unsubMessaging: (() => void) | undefined;
    import('firebase/messaging').then(async ({ onMessage }) => {
      const { messaging } = await import('../firebase');
      if (messaging) {
        unsubMessaging = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'התראה חדשה מ-MateMe';
          const body = payload.notification?.body || '';
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker?.ready
              .then((reg) => reg.showNotification(title, { body, icon: '/vite.svg' }))
              .catch(() => new window.Notification(title, { body }));
          }
        });
      }
    }).catch(() => {});
    return () => {
      if (unsubMessaging) unsubMessaging();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notif: Notification) => {
    setIsOpen(false);
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    if (notif.postId) {
      navigate(`/post/${notif.postId}`);
    } else if (notif.communityId && notif.communityId !== 'global') {
      if (notif.type === 'community_invite') {
        navigate(`/join/${notif.communityId}`);
      } else {
        navigate(`/community/${notif.communityId}`);
      }
    } else {
      navigate('/feed');
    }
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 2999
          }}
        />
      )}
      <div style={{ position: 'fixed', top: 'calc(15px + env(safe-area-inset-top))', left: '15px', zIndex: 3000 }}>
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
          <div className="animate-fade-in" style={{
            position: 'absolute',
            top: '55px',
            left: '0',
            width: 'min(320px, calc(100vw - 30px))',
            maxHeight: '420px',
            overflowY: 'auto',
            borderRadius: '16px',
            padding: '1rem',
            background: 'var(--bg-color)',
            border: '1px solid var(--primary-color)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{t('notifications')}</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
            
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.7, padding: '1.25rem 0', color: 'var(--text-secondary)' }}>
                {t('noNotifications')}
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '10px',
                    background: notif.read ? 'var(--surface-subtle)' : 'var(--badge-demand-bg)',
                    color: notif.read ? 'var(--text-primary)' : 'var(--badge-demand-text)',
                    border: '1px solid',
                    borderColor: notif.read ? 'var(--glass-border)' : 'var(--primary-color)',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    lineHeight: '1.45',
                    textAlign: 'start'
                  }}
                >
                  {!notif.read && <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--primary-color)', borderRadius: '50%', marginInlineEnd: '8px' }}></span>}
                  {notif.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
