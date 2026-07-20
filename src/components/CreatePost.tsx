import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { MapPin, Navigation, ArrowLeft } from 'lucide-react';

export default function CreatePost() {
  const navigate = useNavigate();
  const [type, setType] = useState<'demand' | 'supply'>('demand');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState(5);
  const [ttlHours, setTtlHours] = useState(24);
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
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

        await addDoc(collection(db, 'posts'), {
          creatorId: auth.currentUser!.uid,
          type,
          description,
          targetDate,
          targetTime,
          budget: Number(budget) || 0,
          radius,
          location: { lat, lng, geohash: hash },
          createdAt: serverTimestamp(),
          expiresAt: expiresAt.toISOString(),
          status: 'active',
          responseCount: 0
        });

        setStatus('Successfully posted to your community!');
        setTimeout(() => navigate('/feed'), 2000);
      } catch (err) {
        console.error(err);
        setStatus('Error creating post.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setStatus('Location access denied. Cannot create post.');
      setLoading(false);
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> Back to Home
      </button>

      <div className="glass" style={{ padding: '2rem', borderRadius: '16px' }}>
        <h2 style={{marginTop: 0}}>Create a Request or Offer</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setType('demand')}
            style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: type === 'demand' ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)', background: type === 'demand' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            I Need (Demand)
          </button>
          <button 
            onClick={() => setType('supply')}
            style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: type === 'supply' ? '2px solid var(--secondary-color)' : '1px solid var(--glass-border)', background: type === 'supply' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            I Offer (Supply)
          </button>
        </div>

        <textarea 
          placeholder="Describe what you need or offer..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', minHeight: '120px', marginBottom: '1.5rem', boxSizing: 'border-box' }}
        />

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span><MapPin size={16} style={{verticalAlign: 'middle', marginRight: '5px'}}/> Broadcast Radius</span>
            <span>{radius} km</span>
          </label>
          <input 
            type="range" 
            min="1" max="50" 
            value={radius} 
            onChange={(e) => setRadius(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Date (Optional)</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Time (Optional)</label>
            <input type="time" value={targetTime} onChange={e => setTargetTime(e.target.value)} style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Budget / Price (₪) (Optional)</label>
          <input type="number" placeholder="e.g. 150" value={budget} onChange={e => setBudget(e.target.value)} style={{ width: '100%', padding: '0.8rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Expires In</label>
          <select 
            value={ttlHours} 
            onChange={(e) => setTtlHours(Number(e.target.value))}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value={1}>1 Hour</option>
            <option value={24}>24 Hours</option>
            <option value={72}>3 Days</option>
            <option value={168}>1 Week</option>
          </select>
        </div>

        <button className="btn" onClick={handleCreate} disabled={loading || !description} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? 'Processing...' : <><Navigation size={20} /> Publish to Community</>}
        </button>
      
      {status && <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{status}</p>}
      </div>
    </div>
  );
}
