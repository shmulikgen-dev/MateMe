import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { MapPin, Navigation, ArrowLeft, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../useAuth';

export default function CreateSupply() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const type = 'supply';
  const [category, setCategory] = useState('catOther');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState(5);
  const [ttlHours, setTtlHours] = useState(24);
  const [availability, setAvailability] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleCreate = async () => {
    if (!description || !auth.currentUser) return;
    setLoading(true);
    setStatus('Getting location...');

    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const hash = geohashForLocation([lat, lng]);
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ttlHours);

        const docRef = await addDoc(collection(db, 'posts'), {
          creatorId: auth.currentUser!.uid,
          creatorAlias: profile?.alias || 'Anonymous',
          creatorTrustScore: profile?.trustScore || 0,
          type,
          category,
          description,
          availability,
          budget: Number(budget) || 0,
          radius,
          location: { lat, lng, geohash: hash },
          createdAt: serverTimestamp(),
          expiresAt: expiresAt.toISOString(),
          status: 'active',
          responseCount: 0
        });

        // Fan-out notifications to subscribed users
        try {
          const usersQuery = query(
            collection(db, 'users'),
            where('subscribedCategories', 'array-contains', category)
          );
          const usersSnap = await getDocs(usersQuery);
          const notifPromises: Promise<any>[] = [];
          
          usersSnap.forEach(userDoc => {
            if (userDoc.id !== auth.currentUser!.uid) {
              notifPromises.push(addDoc(collection(db, 'notifications'), {
                userId: userDoc.id,
                postId: docRef.id,
                type: 'new_post',
                message: `${t('newPostIn')} ${t(category)}!`,
                read: false,
                createdAt: serverTimestamp()
              }));
            }
          });
          
          await Promise.all(notifPromises);
        } catch (notifErr) {
          console.error("Error sending notifications: ", notifErr);
        }

        setStatus(t('postSuccess'));
        setTimeout(() => navigate('/feed'), 2000);
      } catch (err) {
        console.error(err);
        setStatus('Error creating post.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setStatus(t('errorLocation'));
      setLoading(false);
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> {t('backToHome')}
      </button>

      <div className="glass" style={{ padding: '2rem', borderRadius: '16px' }}>
        <h2 style={{marginTop: 0}}>{t('createSupplyTitle')}</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            <Tags size={16} style={{verticalAlign: 'middle', marginRight: '5px'}}/> Category
          </label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="catRepairs">{t('catRepairs')}</option>
            <option value="catDeliveries">{t('catDeliveries')}</option>
            <option value="catTeaching">{t('catTeaching')}</option>
            <option value="catBabysitting">{t('catBabysitting')}</option>
            <option value="catLending">{t('catLending')}</option>
            <option value="catCommunity">{t('catCommunity')}</option>
            <option value="catTech">{t('catTech')}</option>
            <option value="catOther">{t('catOther')}</option>
          </select>
        </div>

        <textarea 
          placeholder={t('describeSupply')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', minHeight: '120px', marginBottom: '1.5rem', boxSizing: 'border-box' }}
        />

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span><MapPin size={16} style={{verticalAlign: 'middle', marginRight: '5px'}}/> {t('broadcastRadius')}</span>
            <span>{radius} km</span>
          </label>
          <input 
            type="range" 
            min="1" max="150" 
            value={radius} 
            onChange={(e) => setRadius(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{t('availability')} {t('optional')}</label>
          <input type="text" placeholder={t('availabilityDesc')} value={availability} onChange={e => setAvailability(e.target.value)} style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{t('startingPrice')} {t('optional')}</label>
          <input type="number" placeholder="e.g. 150" value={budget} onChange={e => setBudget(e.target.value)} style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('expiresIn')}</label>
          <select 
            value={ttlHours} 
            onChange={(e) => setTtlHours(Number(e.target.value))}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value={1}>{t('hour1')}</option>
            <option value={24}>{t('hours24')}</option>
            <option value={72}>{t('days3')}</option>
            <option value={168}>{t('week1')}</option>
          </select>
        </div>

        <button className="btn" onClick={handleCreate} disabled={loading || !description} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? t('processing') : <><Navigation size={20} /> {t('publish')}</>}
        </button>
      
      {status && <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{status}</p>}
      </div>
    </div>
  );
}
