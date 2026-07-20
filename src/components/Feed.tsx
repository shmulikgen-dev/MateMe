import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { MapPin, ArrowLeft } from 'lucide-react';

export default function Feed() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!location) return;

    const fetchNearbyPosts = async () => {
      setLoading(true);
      const radiusInM = 10 * 1000; // Search within 10km for the feed
      const center = [location.lat, location.lng] as [number, number];
      const bounds = geohashQueryBounds(center, radiusInM);
      const promises = [];

      for (const b of bounds) {
        const q = query(
          collection(db, 'posts'),
          where('location.geohash', '>=', b[0]),
          where('location.geohash', '<=', b[1]),
          where('status', 'in', ['active', 'tender'])
        );
        promises.push(getDocs(q));
      }

      const snapshots = await Promise.all(promises);
      const matchingDocs: any[] = [];
      const now = new Date().toISOString();

      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          const data = doc.data();
          
          // TTL Check: Ignore if expired
          if (data.expiresAt && data.expiresAt < now) continue;

          const lat = data.location.lat;
          const lng = data.location.lng;
          const distanceInKm = distanceBetween([lat, lng], center);
          
          if (distanceInKm <= data.radius) {
            matchingDocs.push({ id: doc.id, ...data, distance: distanceInKm });
          }
        }
      }

      // Sort by closest
      matchingDocs.sort((a, b) => a.distance - b.distance);
      setPosts(matchingDocs);
      setLoading(false);
    };

    fetchNearbyPosts();
  }, [location]);

  const [bids, setBids] = useState<{[key: string]: string}>({});

  const handleConnect = async (postId: string, currentResponses: number, isTender: boolean) => {
    try {
      if (!auth.currentUser) return;
      
      const bidAmount = isTender ? Number(bids[postId]) : null;
      if (isTender && (!bidAmount || bidAmount <= 0)) {
        alert("Please enter a valid bid amount.");
        return;
      }

      const newCount = (currentResponses || 0) + 1;
      const postRef = doc(db, 'posts', postId);
      
      const updates: any = { responseCount: newCount };
      
      // Rule of 3: Auto-pause
      if (newCount >= 3 && !isTender) {
        updates.status = 'evaluating';
      }
      
      await updateDoc(postRef, updates);
      
      // Create response document
      await addDoc(collection(db, 'responses'), {
        postId,
        responderId: auth.currentUser.uid,
        status: 'pending',
        bidAmount,
        createdAt: serverTimestamp()
      });
      
      // Update local UI
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return { ...p, responseCount: newCount, status: (newCount >= 3 && !isTender) ? 'evaluating' : p.status };
        }
        return p;
      }).filter(p => p.status === 'active' || p.status === 'tender'));
      
      alert(isTender ? 'Bid submitted successfully!' : 'Connection sent successfully!');
    } catch (error) {
      console.error("Error connecting: ", error);
      alert('Failed to connect');
    }
  };

  if (!location) return <div style={{ textAlign: 'center', padding: '2rem' }}>Looking for your location...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <ArrowLeft size={20} /> Back to Home
      </button>

      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MapPin /> Local Community Feed
      </h2>
      
      {loading && <p>Loading local posts...</p>}
      
      {!loading && posts.length === 0 && (
        <div className="glass animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={30} color="var(--text-secondary)" />
          </div>
          <h3 style={{margin: 0}}>It's quiet around here...</h3>
          <p style={{ margin: 0 }}>No requests or offers in your area yet.</p>
        </div>
      )}

      {posts.map((post, index) => (
        <div key={post.id} className="glass animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.2rem', animationDelay: `${index * 0.1}s`, borderRight: `4px solid ${post.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: post.type === 'demand' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: post.type === 'demand' ? '#a5b4fc' : '#6ee7b7' }}>
              {post.type}
            </span>
            <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {post.distance.toFixed(1)} km
            </span>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', lineHeight: '1.6' }}>{post.description}</p>
          
          {(post.targetDate || post.targetTime || post.budget > 0) && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              {post.targetDate && <div><strong>Date:</strong> {post.targetDate}</div>}
              {post.targetTime && <div><strong>Time:</strong> {post.targetTime}</div>}
              {post.budget > 0 && <div><strong>Budget:</strong> ₪{post.budget}</div>}
            </div>
          )}

          {post.status === 'tender' ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="number" 
                placeholder="Your Bid (₪)" 
                value={bids[post.id] || ''}
                onChange={e => setBids({...bids, [post.id]: e.target.value})}
                style={{ flex: 1, padding: '0.8rem', boxSizing: 'border-box' }}
              />
              <button 
                className="btn" 
                onClick={() => handleConnect(post.id, post.responseCount || 0, true)}
                style={{ flex: 1, background: 'var(--accent-color)' }}
              >
                Submit Bid
              </button>
            </div>
          ) : (
            <button 
              className="btn" 
              onClick={() => handleConnect(post.id, post.responseCount || 0, false)}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
            >
              Connect ({post.responseCount || 0}/3)
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
