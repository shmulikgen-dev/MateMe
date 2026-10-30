import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { geohashForLocation } from 'geofire-common';
import { MapPin, Navigation, ArrowLeft, Tags, Hourglass, Paperclip, Search, ShoppingBag, Sparkles, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../useAuth';
import { compressImage } from '../utils/imageCompressor';
import RadiusMapPreview from './RadiusMapPreview';

type PostIntent = 'demand' | 'secondhand' | 'supply';

export default function CreatePost({ initialIntent = 'secondhand' }: { initialIntent?: PostIntent }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const locationState = useLocation();
  const queryParams = new URLSearchParams(locationState.search);
  const communityId = queryParams.get('communityId');

  const [intent, setIntent] = useState<PostIntent>(initialIntent);
  const [category, setCategory] = useState(initialIntent === 'secondhand' ? 'catSecondHand' : 'catCommunity');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState(5);
  const [ttlHours, setTtlHours] = useState(72);
  const [allowCalendar, setAllowCalendar] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [supplyType, setSupplyType] = useState<'item' | 'event'>('item');
  const [demandMode, setDemandMode] = useState<'ruleOf3' | 'tender'>('ruleOf3');
  const [availability, setAvailability] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isPopup, setIsPopup] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleIntentChange = (newIntent: PostIntent) => {
    setIntent(newIntent);
    if (newIntent === 'secondhand') {
      setCategory('catSecondHand');
      setSupplyType('item');
      setIsPopup(false);
    } else if (newIntent === 'demand' && category === 'catSecondHand') {
      setCategory('catCommunity');
    } else if (newIntent === 'supply' && category === 'catSecondHand') {
      setCategory('catRepairs');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];

      if (selected.size > 10 * 1024 * 1024) {
        alert(t('fileTooLarge', 'הקובץ חורג מ-10 מגה-בייט. אנא בחר קובץ קטן יותר.'));
        e.target.value = '';
        setFile(null);
        return;
      }

      if (selected.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(selected);
          setFile(compressed);
        } catch (error) {
          console.error('Error compressing image:', error);
          setFile(selected);
        }
      } else {
        setFile(selected);
      }
    }
  };

  const ensureDefaultEventDateTime = () => {
    if (!targetDate) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setTargetDate(`${yyyy}-${mm}-${dd}`);
    }
    if (!targetTime) {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setTargetTime(`${String(nextHour.getHours()).padStart(2, '0')}:00`);
    }
  };

  const handlePopupToggle = (val: boolean) => {
    setIsPopup(val);
    if (val) {
      setTtlHours(24);
      setAllowCalendar(true);
      ensureDefaultEventDateTime();
    }
  };

  const handleCreate = async () => {
    if (!description || !auth.currentUser) return;
    setLoading(true);
    setStatus('מאתר מיקום...');

    const publishWithCoords = async (lat: number, lng: number) => {
      try {
        const hash = geohashForLocation([lat, lng]);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ttlHours);

        let fileUrl = null;
        let fileName = null;
        let fileType = null;

        if (file) {
          setStatus('מעבד קובץ...');
          fileName = file.name;
          fileType = file.type;
          if (file.type.startsWith('image/')) {
            // Convert compressed image to Data URL directly so it saves instantaneously without Storage delays
            fileUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result as string);
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            });
          } else {
            const fileRef = ref(storage, `posts/${auth.currentUser!.uid}_${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            fileUrl = await getDownloadURL(fileRef);
          }
        }

        setStatus('שומר פרסום...');

        const postType = intent === 'demand' ? 'demand' : 'supply';

        const postData: any = {
          creatorId: auth.currentUser!.uid,
          creatorAlias: profile?.alias || 'Anonymous',
          creatorTrustScore: profile?.trustScore || 0,
          type: postType,
          supplyType: postType === 'supply' ? (intent === 'secondhand' ? 'item' : supplyType) : null,
          category,
          description,
          allowCalendar,
          targetDate: allowCalendar ? (targetDate || '') : '',
          targetTime: allowCalendar ? (targetTime || '') : '',
          availability: postType === 'supply' ? availability : '',
          budget: Number(budget) || 0,
          radius,
          location: { lat, lng, geohash: hash },
          createdAt: serverTimestamp(),
          expiresAt: expiresAt.toISOString(),
          status: (postType === 'demand' && !allowCalendar && demandMode === 'tender') ? 'tender' : 'active',
          responseCount: 0,
          isPopup: postType === 'supply' ? isPopup : false,
          fileUrl,
          fileName,
          fileType
        };

        if (communityId) {
          postData.communityId = communityId;
        }

        const docRef = await addDoc(collection(db, 'posts'), postData);

        // Fan-out notifications to subscribed users
        try {
          const usersQuery = query(
            collection(db, 'users'),
            where('subscribedCategories', 'array-contains', category)
          );
          const usersSnap = await getDocs(usersQuery);
          const notifPromises: Promise<any>[] = [];

          usersSnap.forEach((userDoc) => {
            if (userDoc.id !== auth.currentUser!.uid) {
              notifPromises.push(
                addDoc(collection(db, 'notifications'), {
                  userId: userDoc.id,
                  postId: docRef.id,
                  type: 'new_post',
                  message: `${t('newPostIn')} ${t(category)}!`,
                  read: false,
                  createdAt: serverTimestamp()
                })
              );
            }
          });

          if (postType === 'supply' && isPopup) {
            const allUsersSnap = await getDocs(collection(db, 'users'));
            allUsersSnap.forEach((userDoc) => {
              if (userDoc.id !== auth.currentUser!.uid) {
                notifPromises.push(
                  addDoc(collection(db, 'notifications'), {
                    userId: userDoc.id,
                    postId: docRef.id,
                    type: 'popup',
                    message: `🚨 ${t('popupAlert', 'אירוע פופ-אפ חדש באזור שלך')}!`,
                    read: false,
                    createdAt: serverTimestamp()
                  })
                );
              }
            });
          }

          await Promise.all(notifPromises);
        } catch (notifErr) {
          console.error('Error sending notifications: ', notifErr);
        }

        setStatus(t('postSuccess'));
        setTimeout(() => navigate(communityId ? `/community/${communityId}` : '/'), 1200);
      } catch (err) {
        console.error(err);
        setStatus('שגיאה ביצירת הפרסום.');
      }
      setLoading(false);
    };

    if (selectedCoords) {
      await publishWithCoords(selectedCoords.lat, selectedCoords.lng);
      return;
    }

    if (!navigator.geolocation) {
      setStatus('הדפדפן שלך אינו תומך בשירותי מיקום');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => publishWithCoords(position.coords.latitude, position.coords.longitude),
      (err) => {
        console.error(err);
        setStatus(t('errorLocation'));
        setLoading(false);
      }
    );
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button
        onClick={() => navigate(communityId ? `/community/${communityId}` : '/')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          marginBottom: '1rem',
          minHeight: '44px'
        }}
      >
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <div className="glass animate-fade-in" style={{ padding: '1.75rem', borderRadius: '18px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.25rem' }}>פרסום חדש בקהילה</h2>

        {/* Unified 3-pill selector */}
        <div className="intent-selector-grid" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => handleIntentChange('secondhand')}
            className={`intent-pill ${intent === 'secondhand' ? 'active secondhand' : ''}`}
          >
            <ShoppingBag size={20} />
            <span className="intent-pill-title">יד שנייה / מסירה</span>
            <span className="intent-pill-sub">מכירה או מסירת חפץ</span>
          </button>

          <button
            type="button"
            onClick={() => handleIntentChange('demand')}
            className={`intent-pill ${intent === 'demand' ? 'active demand' : ''}`}
          >
            <Search size={20} />
            <span className="intent-pill-title">מחפש / צריך עזרה</span>
            <span className="intent-pill-sub">בקשת פריט או שירות</span>
          </button>

          <button
            type="button"
            onClick={() => handleIntentChange('supply')}
            className={`intent-pill ${intent === 'supply' ? 'active supply' : ''}`}
          >
            <Sparkles size={20} />
            <span className="intent-pill-title">מציע שירות / אירוע</span>
            <span className="intent-pill-sub">עזרה, מקצוע או מפגש</span>
          </button>
        </div>

        {/* Category selector (hidden if secondhand is chosen, or shown with catSecondHand selected) */}
        {intent !== 'secondhand' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <Tags size={16} style={{ verticalAlign: 'middle', marginLeft: '5px' }} /> קטגוריה
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="catSecondHand">{t('catSecondHand')}</option>
              <option value="catCommunity">{t('catCommunity')}</option>
              <option value="catLending">{t('catLending')}</option>
              <option value="catRepairs">{t('catRepairs')}</option>
              <option value="catDeliveries">{t('catDeliveries')}</option>
              <option value="catTeaching">{t('catTeaching')}</option>
              <option value="catBabysitting">{t('catBabysitting')}</option>
              <option value="catTech">{t('catTech')}</option>
              <option value="catOther">{t('catOther')}</option>
            </select>
          </div>
        )}

        {intent === 'demand' && !allowCalendar && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              אופן קבלת פניות והצעות
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label
                style={{
                  flex: 1,
                  minWidth: '200px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.55rem',
                  background: demandMode === 'ruleOf3' ? 'var(--badge-demand-bg)' : 'var(--surface-subtle)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: demandMode === 'ruleOf3' ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="demandMode"
                  value="ruleOf3"
                  checked={demandMode === 'ruleOf3'}
                  onChange={() => setDemandMode('ruleOf3')}
                  style={{ accentColor: 'var(--primary-color)', marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    עד 3 פניות במקביל (חוק ה-3)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    מונע הצפה — עד 3 מועמדים פעילים במקביל לצ׳אט ובחירה
                  </div>
                </div>
              </label>

              <label
                style={{
                  flex: 1,
                  minWidth: '200px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.55rem',
                  background: demandMode === 'tender' ? 'var(--badge-demand-bg)' : 'var(--surface-subtle)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: demandMode === 'tender' ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="demandMode"
                  value="tender"
                  checked={demandMode === 'tender'}
                  onChange={() => setDemandMode('tender')}
                  style={{ accentColor: 'var(--accent-color)', marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    מכרז הצעות פתוח 🏆
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    קבלת הצעות מחיר ללא הגבלת פונים ודירוג לפי מוניטין ומחיר
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {intent === 'supply' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {t('supplyType', 'סוג ההצעה')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: supplyType === 'item' ? 'var(--primary-glow)' : 'var(--surface-subtle)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: supplyType === 'item' ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="supplyType"
                  value="item"
                  checked={supplyType === 'item'}
                  onChange={() => setSupplyType('item')}
                  style={{ accentColor: 'var(--primary-color)' }}
                />
                {t('typeServiceItem', 'שירות או מיומנות')}
              </label>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: supplyType === 'event' ? 'var(--primary-glow)' : 'var(--surface-subtle)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: supplyType === 'event' ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="supplyType"
                  value="event"
                  checked={supplyType === 'event'}
                  onChange={() => {
                    setSupplyType('event');
                    setAllowCalendar(true);
                    ensureDefaultEventDateTime();
                  }}
                  style={{ accentColor: 'var(--primary-color)' }}
                />
                {t('typeEvent', 'אירוע / מפגש')}
              </label>
            </div>
          </div>
        )}

        <textarea
          placeholder={
            intent === 'secondhand'
              ? 'מה אתה מוסר או מוכר? (מצב הפריט, פרטים, איסוף)...'
              : intent === 'demand'
              ? t('describeDemand')
              : t('describeSupply')
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', minHeight: '110px', marginBottom: '1.25rem', boxSizing: 'border-box' }}
        />

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              background: 'var(--surface-subtle)',
              padding: '0.9rem 1rem',
              borderRadius: '12px',
              border: '1px dashed var(--glass-border)'
            }}
          >
            <Paperclip size={20} color="var(--primary-color)" />
            <span style={{ fontSize: '0.9rem', color: file ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {file ? file.name : t('attachFile', 'צרף תמונה של הפריט או מסמך (מומלץ!)')}
            </span>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Price / Budget */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            {intent === 'secondhand'
              ? 'מחיר מבוקש ב-₪ (השאר ריק או 0 למסירה בחינם)'
              : intent === 'demand'
              ? `${t('budget')} (₪) ${t('optional')}`
              : `${t('startingPrice')} ${t('optional')}`}
          </label>
          <input
            type="number"
            placeholder={intent === 'secondhand' ? 'למשל: 0 למסירה, או 150 ₪' : 'למשל: 150'}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Opt-in Checkbox for Calendar Integration */}
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.95rem 1rem',
            borderRadius: '12px',
            background: allowCalendar ? 'var(--badge-demand-bg)' : 'var(--surface-subtle)',
            border: allowCalendar ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
            transition: 'all 0.2s ease'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowCalendar}
              onChange={(e) => {
                const checked = e.target.checked;
                setAllowCalendar(checked);
                if (checked) {
                  ensureDefaultEventDateTime();
                }
              }}
              style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--primary-color)', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Calendar size={16} color="var(--primary-color)" />
                <span>אפשר לאחרים להוסיף את האירוע / הפרסום ליומן האישי</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                סמן אפשרות זו רק אם לפרסום יש מועד או תלות בזמן ספציפי. בפרסומים אינפורמטיביים או כלליים השאר ללא סימון.
              </div>
            </div>
          </label>

          {allowCalendar && (
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  תאריך האירוע / המועד
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  שעת האירוע
                </label>
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          )}
        </div>

        {intent === 'supply' && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                {t('availability')} {t('optional')}
              </label>
              <input
                type="text"
                placeholder={t('availabilityDesc')}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }}
              />
            </div>

            <div
              style={{
                marginBottom: '1.25rem',
                background: isPopup ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.2)',
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                border: isPopup ? '1px solid #ef4444' : '1px solid var(--glass-border)'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPopup}
                  onChange={(e) => handlePopupToggle(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#ef4444' }}
                />
                <span
                  style={{
                    fontWeight: 'bold',
                    color: isPopup ? '#ef4444' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Hourglass size={18} /> {t('makePopup', 'הפוך לאירוע פופ-אפ (24 שעות)')}
                </span>
              </label>
            </div>
          </>
        )}

        {!communityId && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              <span>
                <MapPin size={16} style={{ verticalAlign: 'middle', marginLeft: '5px' }} /> {t('broadcastRadius')}
              </span>
              <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{radius} ק״מ</span>
            </label>
            <input
              type="range"
              min="1"
              max="150"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <RadiusMapPreview
              radiusKm={radius}
              center={selectedCoords}
              onCenterChange={(coords) => setSelectedCoords(coords)}
            />
          </div>
        )}

        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t('expiresIn')}</label>
          <select
            value={ttlHours}
            onChange={(e) => setTtlHours(Number(e.target.value))}
            disabled={isPopup}
            style={{
              width: '100%',
              padding: '0.9rem 1rem',
              borderRadius: '12px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              cursor: isPopup ? 'not-allowed' : 'pointer',
              opacity: isPopup ? 0.7 : 1
            }}
          >
            <option value={1}>{t('hour1')}</option>
            <option value={24}>{t('hours24')}</option>
            <option value={72}>{t('days3')}</option>
            <option value={168}>{t('week1')}</option>
          </select>
        </div>

        <button
          className="btn"
          onClick={handleCreate}
          disabled={loading || !description}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem',
            fontSize: '1.05rem',
            fontWeight: 600
          }}
        >
          {loading ? (
            t('processing')
          ) : (
            <>
              <Navigation size={20} /> {t('publish')}
            </>
          )}
        </button>

        {status && <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{status}</p>}
      </div>
    </div>
  );
}
