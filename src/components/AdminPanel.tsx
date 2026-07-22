import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Shield, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../useAuth';
import type { UserProfile } from '../useAuth';

export default function AdminPanel() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'admin') {
      alert("Unauthorized Access");
      navigate('/');
      return;
    }
    fetchData();
  }, [profile, authLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Users
    const usersSnap = await getDocs(collection(db, 'users'));
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    
    // Fetch Posts
    const postsSnap = await getDocs(collection(db, 'posts'));
    setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Delete this user?")) {
      await deleteDoc(doc(db, 'users', uid));
      fetchData();
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm("Delete this post?")) {
      await deleteDoc(doc(db, 'posts', postId));
      fetchData();
    }
  };

  if (loading || authLoading) return <div style={{padding: '2rem', textAlign: 'center'}}>Loading Admin Panel...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '2rem' }}>
        <ArrowLeft size={20} /> Back to App
      </button>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
        <Shield /> Administrator Control Panel
      </h1>

      {/* STATS OVERVIEW */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <div className="glass" style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--primary-color)' }}>{users.length}</h2>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Total Registered Users</p>
        </div>
        <div className="glass" style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--secondary-color)' }}>{posts.length}</h2>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Total Active Posts</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        
        {/* USERS TABLE */}
        <div className="glass" style={{ flex: 1, minWidth: '300px', padding: '1rem', borderRadius: '12px' }}>
          <h3>Users ({users.length})</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {users.map(u => (
              <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '8px' }}>
                <div>
                  <strong>{u.alias}</strong> <span style={{fontSize: '0.8rem', opacity: 0.7}}>({u.role})</span>
                  <div style={{ fontSize: '0.8rem' }}>{u.email} | Score: {u.trustScore}</div>
                </div>
                <button onClick={() => handleDeleteUser(u.uid!)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* POSTS TABLE */}
        <div className="glass" style={{ flex: 1, minWidth: '300px', padding: '1rem', borderRadius: '12px' }}>
          <h3>Active Posts ({posts.length})</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {posts.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '8px' }}>
                <div>
                  <strong style={{color: p.type === 'demand' ? 'var(--primary-color)' : 'var(--secondary-color)'}}>{p.type.toUpperCase()}</strong>
                  <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{p.description}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Status: {p.status}</div>
                </div>
                <button onClick={() => handleDeletePost(p.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
