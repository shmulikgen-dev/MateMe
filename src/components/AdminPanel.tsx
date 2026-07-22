import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Shield, Trash2, ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { useAuth } from '../useAuth';
import type { UserProfile } from '../useAuth';

export default function AdminPanel() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);

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
    
    // Fetch Open Reports
    const q = query(collection(db, 'reports'), where('status', '==', 'open'));
    const reportsSnap = await getDocs(q);
    setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    setLoading(false);
  };

  const handleResolveReport = async () => {
    if (!selectedReport || !replyText.trim()) return;
    
    try {
      // 1. Update report status
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'resolved',
        adminResponse: replyText,
        resolvedAt: serverTimestamp()
      });
      
      // 2. Create notification for the reporter
      if (selectedReport.reporterId && selectedReport.reporterId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedReport.reporterId,
          type: 'system',
          message: `Admin replied to your report: ${replyText}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
      setSelectedReport(null);
      setReplyText('');
      fetchData();
      alert('Report resolved and user notified.');
    } catch (e) {
      console.error(e);
      alert('Error resolving report');
    }
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
        <div className="glass" style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: reports.length > 0 ? '2px solid #ef4444' : 'none' }}>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#ef4444' }}>{reports.length}</h2>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Open Reports</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        
        {/* OPEN REPORTS TABLE */}
        <div className="glass" style={{ width: '100%', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquareWarning color="#ef4444" /> Open Reports ({reports.length})</h3>
          
          {reports.length === 0 && <p style={{ opacity: 0.7 }}>No open reports at this time. Great job!</p>}
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {reports.map(r => (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Reporter: {r.reporterId}</strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Target: {r.targetType} ({r.targetId})</span>
                </div>
                <p style={{ margin: '0.5rem 0', fontStyle: 'italic' }}>"{r.reason}"</p>
                
                {selectedReport?.id === r.id ? (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setReplyText('Thank you for reporting. We have reviewed the content and found no violation.')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px' }}>Canned: No Violation</button>
                      <button onClick={() => setReplyText('Thank you for reporting. The offending content/user has been removed.')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px' }}>Canned: Removed</button>
                    </div>
                    <textarea 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)} 
                      placeholder="Type your response to the user..." 
                      style={{ width: '100%', height: '80px', padding: '0.5rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={handleResolveReport} style={{ background: '#10b981', flex: 1 }}>Send & Resolve</button>
                      <button className="btn" onClick={() => setSelectedReport(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn" onClick={() => { setSelectedReport(r); setReplyText(''); }} style={{ alignSelf: 'flex-start', padding: '5px 15px', fontSize: '0.8rem' }}>
                    Respond & Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
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
