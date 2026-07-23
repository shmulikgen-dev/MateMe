import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, query, where, arrayUnion } from 'firebase/firestore';
import { Shield, Trash2, ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { useAuth } from '../useAuth';
import type { UserProfile } from '../useAuth';

export default function AdminPanel() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [communityRequests, setCommunityRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [newCommunityType, setNewCommunityType] = useState<'geographic' | 'thematic'>('geographic');
  const [managerUserId, setManagerUserId] = useState('');

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
    try {
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
      
      // Fetch Communities
      const commSnap = await getDocs(collection(db, 'communities'));
      setCommunities(commSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch Community Requests
      const reqQ = query(collection(db, 'community_requests'), where('status', '==', 'pending'));
      const reqSnap = await getDocs(reqQ);
      setCommunityRequests(reqSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching admin data: ", error);
    } finally {
      setLoading(false);
    }
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

  const handleCreateCommunity = async () => {
    if (!newCommunityName) return;
    try {
      await addDoc(collection(db, 'communities'), {
        name: newCommunityName,
        description: newCommunityDesc,
        type: newCommunityType,
        managerIds: [],
        memberIds: [],
        createdAt: Date.now()
      });
      setNewCommunityName('');
      setNewCommunityDesc('');
      fetchData();
      alert('Community created!');
    } catch (e) {
      console.error(e);
      alert('Error creating community');
    }
  };

  const handleAssignManager = async (communityId: string) => {
    if (!managerUserId) return;
    try {
      const comm = communities.find(c => c.id === communityId);
      if (!comm) return;
      const updatedManagers = [...(comm.managerIds || []), managerUserId];
      await updateDoc(doc(db, 'communities', communityId), {
        managerIds: Array.from(new Set(updatedManagers))
      });
      setManagerUserId('');
      fetchData();
      alert('Manager assigned!');
    } catch (e) {
      console.error(e);
      alert('Error assigning manager');
    }
  };

  const handleApproveCommunityRequest = async (request: any) => {
    try {
      // 1. Create Community
      const docRef = await addDoc(collection(db, 'communities'), {
        name: request.name,
        description: request.description,
        type: request.type,
        managerIds: [request.requesterId], // User who requested becomes manager
        memberIds: [request.requesterId],
        createdAt: Date.now()
      });
      
      // 2. Update request status
      await updateDoc(doc(db, 'community_requests', request.id), {
        status: 'approved',
        communityId: docRef.id
      });
      
      // 3. Add community to user's profile
      await updateDoc(doc(db, 'users', request.requesterId), {
        myCommunities: arrayUnion(docRef.id)
      });

      fetchData();
      alert('Community approved and created successfully!');
    } catch (e) {
      console.error("Error approving request", e);
      alert("Error approving request");
    }
  };

  const handleOpenChatWithRequester = async (requesterId: string) => {
    if (!profile?.uid) return;
    try {
      // Check if chat exists
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', profile.uid));
      const querySnapshot = await getDocs(q);
      
      let existingChatId = null;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(requesterId)) {
          existingChatId = doc.id;
        }
      });
      
      if (existingChatId) {
        navigate(`/chat/${existingChatId}`);
      } else {
        const newChatRef = await addDoc(chatsRef, {
          participants: [profile.uid, requesterId],
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp()
        });
        navigate(`/chat/${newChatRef.id}`);
      }
    } catch (e) {
      console.error("Error opening chat", e);
      alert("Error opening chat");
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

        {/* COMMUNITIES MANAGEMENT */}
        <div className="glass" style={{ width: '100%', padding: '1rem', borderRadius: '12px', marginTop: '2rem' }}>
          <h3>Community Requests ({communityRequests.length})</h3>
          
          {communityRequests.length === 0 && <p style={{ opacity: 0.7 }}>No pending community requests.</p>}
          
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem' }}>
            {communityRequests.map(r => (
              <div key={r.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--secondary-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.name} ({r.type})</strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Requester: {r.requesterAlias}</span>
                </div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', fontStyle: 'italic' }}>"{r.description}"</p>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn" onClick={() => handleApproveCommunityRequest(r)} style={{ background: '#10b981', flex: 1, padding: '0.5rem' }}>
                    Approve & Create
                  </button>
                  <button className="btn" onClick={() => handleOpenChatWithRequester(r.requesterId)} style={{ background: 'var(--primary-color)', flex: 1, padding: '0.5rem' }}>
                    Open Chat
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3>Communities Management</h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <h4>Create New Community</h4>
              <input type="text" placeholder="Community Name" value={newCommunityName} onChange={e => setNewCommunityName(e.target.value)} style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Description" value={newCommunityDesc} onChange={e => setNewCommunityDesc(e.target.value)} style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', boxSizing: 'border-box' }} />
              <select value={newCommunityType} onChange={e => setNewCommunityType(e.target.value as any)} style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: 'white' }}>
                <option value="geographic">Geographic</option>
                <option value="thematic">Thematic</option>
              </select>
              <button className="btn" onClick={handleCreateCommunity} style={{ width: '100%', background: 'var(--primary-color)' }}>Create Community</button>
            </div>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {communities.map(c => (
              <div key={c.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{c.name} ({c.type})</strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Members: {c.memberIds?.length || 0}</span>
                </div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', opacity: 0.8 }}>{c.description}</p>
                <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Managers: {c.managerIds?.join(', ') || 'None'}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" placeholder="User ID to assign as manager" value={managerUserId} onChange={e => setManagerUserId(e.target.value)} style={{ padding: '0.5rem', flex: 1 }} />
                  <button className="btn" onClick={() => handleAssignManager(c.id)} style={{ padding: '0.5rem 1rem' }}>Assign</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
