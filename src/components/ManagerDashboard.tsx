import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { ArrowLeft, Check, X, Shield, Users, ShieldAlert, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ManagerDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  const [community, setCommunity] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;
      try {
        // Fetch community
        const docSnap = await getDoc(doc(db, 'communities', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCommunity({ id: docSnap.id, ...data });

          // Check permissions
          const isManager = data.managerIds?.includes(user.uid);
          const isAdmin = profile?.role === 'admin';
          if (!isManager && !isAdmin) {
            alert('Unauthorized');
            navigate(`/community/${id}`);
            return;
          }

          // Fetch Pending Requests
          const qReq = query(
            collection(db, 'community_requests'),
            where('communityId', '==', id),
            where('status', '==', 'pending')
          );
          const reqSnap = await getDocs(qReq);
          
          const reqsWithData = await Promise.all(reqSnap.docs.map(async (d) => {
            const reqData = d.data();
            let alias = 'Unknown';
            let trustScore = 0;
            try {
              const uDoc = await getDoc(doc(db, 'users', reqData.requesterId));
              if (uDoc.exists()) {
                alias = uDoc.data().alias;
                trustScore = uDoc.data().trustScore || 0;
              }
            } catch (e) {}
            return { id: d.id, ...reqData, alias, trustScore };
          }));
          setRequests(reqsWithData);

          // Fetch Members
          if (data.memberIds?.length > 0) {
            const allMembers: any[] = [];
            for (let i = 0; i < data.memberIds.length; i += 10) {
              const chunk = data.memberIds.slice(i, i + 10);
              const membersSnap = await getDocs(
                query(collection(db, 'users'), where('uid', 'in', chunk))
              );
              allMembers.push(...membersSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
            }
            setMembers(allMembers);
          }
        }
      } catch (e) {
        console.error("Error fetching manager data", e);
      }
      setLoading(false);
    };

    fetchData();
  }, [id, user, profile, navigate]);

  const handleApprove = async (request: any) => {
    try {
      // 1. Update Request Status
      await updateDoc(doc(db, 'community_requests', request.id), {
        status: 'approved'
      });
      // 2. Add to Community memberIds
      await updateDoc(doc(db, 'communities', id!), {
        memberIds: arrayUnion(request.requesterId)
      });
      // 3. Add to User myCommunities
      await updateDoc(doc(db, 'users', request.requesterId), {
        myCommunities: arrayUnion(id!)
      });

      setRequests(requests.filter(r => r.id !== request.id));
      alert('משתמש אושר וצורף לקהילה!');
    } catch (e) {
      console.error(e);
      alert('שגיאה באישור משתמש');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'community_requests', requestId), {
        status: 'rejected'
      });
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (e) {
      console.error(e);
      alert('שגיאה בדחיית משתמש');
    }
  };

  const handlePromoteManager = async (memberUid: string) => {
    if (!community) return;
    if (community.managerIds && community.managerIds.length >= 3) {
      alert('לא ניתן למנות יותר מ-3 מנהלים בקהילה.');
      return;
    }
    if (window.confirm('האם למנות משתמש זה למנהל קהילה?')) {
      try {
        await updateDoc(doc(db, 'communities', id!), {
          managerIds: arrayUnion(memberUid)
        });
        setCommunity({ ...community, managerIds: [...(community.managerIds || []), memberUid] });
        alert('המשתמש מונה למנהל קהילה!');
      } catch (e) {
        console.error(e);
        alert('שגיאה במינוי מנהל');
      }
    }
  };

  const handleDemoteManager = async (memberUid: string) => {
    if (!community) return;
    if (community.managerIds?.length <= 1) {
      alert('לא ניתן להסיר את המנהל היחיד בקהילה.');
      return;
    }
    if (window.confirm('האם להסיר משתמש זה מניהול הקהילה?')) {
      try {
        await updateDoc(doc(db, 'communities', id!), {
          managerIds: arrayRemove(memberUid)
        });
        setCommunity({ ...community, managerIds: community.managerIds.filter((m: string) => m !== memberUid) });
        alert('המשתמש הוסר מניהול הקהילה');
      } catch (e) {
        console.error(e);
        alert('שגיאה בהסרת מנהל');
      }
    }
  };

  const createCompressedDataUrl = (file: File, maxSize = 360, quality = 0.78): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context unavailable'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !id) return;
    const selected = e.target.files[0];

    if (!selected.type.startsWith('image/')) {
      alert('אנא בחר קובץ תמונה בלבד.');
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      alert('התמונה גדולה מ-10 מגה-בייט. אנא בחר תמונה קטנה יותר.');
      return;
    }

    setUploadingImage(true);
    setImageStatus('מעבד ושומר תמונה...');
    try {
      const dataUrl = await createCompressedDataUrl(selected, 360, 0.78);

      await updateDoc(doc(db, 'communities', id), {
        imageUrl: dataUrl
      });

      setCommunity({ ...community, imageUrl: dataUrl });
      setImageStatus('✅ תמונת הקהילה עודכנה בהצלחה!');
      setTimeout(() => setImageStatus(''), 3500);
    } catch (err) {
      console.error('Error uploading community image:', err);
      setImageStatus('❌ שגיאה בשמירת התמונה.');
    }
    setUploadingImage(false);
    e.target.value = '';
  };

  const handleRemoveImage = async () => {
    if (!id || !window.confirm('האם להסיר את תמונת הקהילה?')) return;
    setUploadingImage(true);
    try {
      await updateDoc(doc(db, 'communities', id), {
        imageUrl: null
      });
      setCommunity({ ...community, imageUrl: null });
      setImageStatus('תמונת הקהילה הוסרה.');
      setTimeout(() => setImageStatus(''), 3000);
    } catch (err) {
      console.error('Error removing image:', err);
      setImageStatus('❌ שגיאה בהסרת התמונה.');
    }
    setUploadingImage(false);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('loading', 'Loading...')}</div>;
  if (!community) return <div style={{ padding: '2rem', textAlign: 'center' }}>קהילה לא נמצאה</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate(`/community/${id}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
        <ArrowLeft size={20} /> חזרה לקהילה
      </button>

      <div className="glass" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--primary-color)' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield /> ניהול קהילה: {community.name}
        </h1>
        <p style={{ margin: 0, opacity: 0.8 }}>כאן תוכל לאשר חברים חדשים ולנהל את ההרשאות בקהילה.</p>
        
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>
            <strong>שימו לב:</strong> ניתן למנות עד 3 מנהלי קהילה בסך הכל. כרגע ישנם {community.managerIds?.length || 0} מנהלים.
          </div>
        </div>

        {/* Community Unique Image Upload Section */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            <ImageIcon size={20} color="var(--primary-color)" /> תמונה ייחודית לקהילה
          </h3>
          <p style={{ fontSize: '0.88rem', opacity: 0.8, marginBottom: '1rem' }}>
            בחר תמונה או לוגו שיופיעו בתיאור הקהילה ובכרטיס הקהילה עבור כלל החברים.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {community.imageUrl ? (
              <img
                src={community.imageUrl}
                alt={community.name}
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '16px',
                  objectFit: 'cover',
                  border: '2px solid var(--primary-color)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                }}
              />
            ) : (
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '16px',
                  background: 'var(--surface-subtle)',
                  border: '1px dashed var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <ImageIcon size={32} opacity={0.5} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  padding: '0.6rem 1.1rem',
                  fontSize: '0.9rem',
                  opacity: uploadingImage ? 0.6 : 1
                }}
              >
                <ImageIcon size={16} />
                <span>{uploadingImage ? 'מעלה...' : community.imageUrl ? 'החלף תמונת קהילה' : 'בחר תמונה לקהילה'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                />
              </label>

              {community.imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Trash2 size={14} /> הסר תמונה
                </button>
              )}
            </div>
          </div>

          {imageStatus && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: 'var(--primary-color)', fontWeight: 500 }}>
              {imageStatus}
            </p>
          )}
        </div>
      </div>

      <div className="glass" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Users /> בקשות המתנה ({requests.length})
        </h2>
        
        {requests.length === 0 ? (
          <p style={{ opacity: 0.7 }}>אין בקשות המתנה כרגע.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {requests.map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{req.alias}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Trust Score: {req.trustScore}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(req.createdAt?.toMillis?.() || Date.now()).toLocaleString('he-IL')}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleApprove(req)} style={{ background: '#10b981', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="אשר">
                    <Check size={20} />
                  </button>
                  <button onClick={() => handleReject(req.id)} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="דחה">
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass" style={{ padding: '2rem', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>חברי הקהילה ({members.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {members.map(m => {
            const isManager = community.managerIds?.includes(m.uid);
            return (
              <div key={m.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{m.alias || 'Anonymous'}</span>
                  {isManager && <span style={{ fontSize: '0.7rem', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '8px' }}>מנהל</span>}
                </div>
                
                {m.uid !== user?.uid && (
                  <div>
                    {!isManager ? (
                      <button 
                        onClick={() => handlePromoteManager(m.uid)} 
                        disabled={community.managerIds?.length >= 3}
                        style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', cursor: community.managerIds?.length >= 3 ? 'not-allowed' : 'pointer', opacity: community.managerIds?.length >= 3 ? 0.5 : 1 }}
                      >
                        מנה למנהל
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDemoteManager(m.uid)} 
                        style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        הסר ניהול
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
