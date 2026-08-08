import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, query, where, arrayUnion, increment } from 'firebase/firestore';
import { Shield, Trash2, ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { useAuth } from '../useAuth';
import type { UserProfile } from '../useAuth';
import AdminAnalytics from './AdminAnalytics';

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
  const [activeTab, setActiveTab] = useState<'general' | 'communities' | 'analytics'>('general');
  const [rejectModal, setRejectModal] = useState<{isOpen: boolean, request: any}>({isOpen: false, request: null});
  const [rejectReason, setRejectReason] = useState('הקהילה כבר קיימת במערכת');
  
  // User Filtering States
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userCommunityFilter, setUserCommunityFilter] = useState('all');
  const [userScoreFilter, setUserScoreFilter] = useState(0);
  const [userInterestFilter, setUserInterestFilter] = useState('');
  const REJECT_REASONS = [
    'הקהילה כבר קיימת במערכת',
    'נושא הקהילה לא מתאים לאופי האפליקציה',
    'חסר מידע בתיאור הקהילה',
    'אחר'
  ];

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

  const sendAdminMessage = async (userId: string, communityName: string, text: string) => {
    if (!profile?.uid) return;
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', profile.uid));
      const querySnapshot = await getDocs(q);
      
      let existingChatId: string | null = null;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(userId)) {
          existingChatId = doc.id;
        }
      });
      
      let chatIdToUse: string;
      if (!existingChatId) {
        const newChatRef = await addDoc(chatsRef, {
          participants: [profile.uid, userId],
          users: [profile.uid, userId],
          topic: `בקשת קהילה: ${communityName}`,
          createdAt: serverTimestamp(),
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${userId}`]: 1
        });
        chatIdToUse = newChatRef.id;
      } else {
        chatIdToUse = existingChatId;
        await updateDoc(doc(db, 'chats', chatIdToUse), {
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${userId}`]: increment(1)
        });
      }

      await addDoc(collection(db, 'chats', chatIdToUse, 'messages'), {
        text: text,
        senderId: profile.uid,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error sending admin message", e);
    }
  };

  const handleRejectCommunityRequest = async () => {
    if (!rejectModal.request || !rejectReason) {
      alert("אנא בחר סיבת דחייה");
      return;
    }
    try {
      await updateDoc(doc(db, 'community_requests', rejectModal.request.id), {
        status: 'rejected',
        rejectReason: rejectReason
      });
      
      const rejectMsg = `בקשתך לפתיחת הקהילה "${rejectModal.request.name}" נדחתה.
סיבת הדחייה: ${rejectReason}`;
      await sendAdminMessage(rejectModal.request.requesterId, rejectModal.request.name, rejectMsg);

      fetchData();
      setRejectModal({isOpen: false, request: null});
      setRejectReason('');
      alert('Community request rejected and user notified.');
    } catch (e) {
      console.error(e);
      alert('Error rejecting request');
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

      // 4. Send admin message with link
      const link = `${window.location.origin}/join/${docRef.id}`;
      const approvalMsg = `בקשתך לפתיחת הקהילה "${request.name}" אושרה בהצלחה! 
מצורף קישור ההצטרפות לקהילה: ${link}
אנו ממליצים לך לשלוח את הקישור לחברי הקהילה כדי שיוכלו להצטרף.`;
      await sendAdminMessage(request.requesterId, request.name, approvalMsg);

      fetchData();
      alert('Community approved, created, and user notified successfully!');
    } catch (e) {
      console.error("Error approving request", e);
      alert("Error approving request");
    }
  };

  const handleOpenChatWithRequester = async (requesterId: string, communityName: string) => {
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
          users: [profile.uid, requesterId],
          topic: `בקשת קהילה: ${communityName}`,
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

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
        <button className="btn" onClick={() => setActiveTab('general')} style={{ flex: 1, background: activeTab === 'general' ? 'var(--primary-color)' : 'rgba(0,0,0,0.2)' }}>General Overview</button>
        <button className="btn" onClick={() => setActiveTab('communities')} style={{ flex: 1, background: activeTab === 'communities' ? 'var(--primary-color)' : 'rgba(0,0,0,0.2)' }}>Communities Management</button>
        <button className="btn" onClick={() => setActiveTab('analytics')} style={{ flex: 1, background: activeTab === 'analytics' ? 'var(--primary-color)' : 'rgba(0,0,0,0.2)' }}>Analytics</button>
      </div>

      {activeTab === 'analytics' && (
        <AdminAnalytics users={users} posts={posts} communities={communities} />
      )}

      {activeTab === 'general' && (
        <>
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
            <div className="glass" style={{ flex: 1, minWidth: '300px', padding: '1rem', borderRadius: '12px' }}>
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
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '3rem 0' }} />

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {/* USERS TABLE */}
            <div className="glass" style={{ flex: 1, minWidth: '350px', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0 }}>Users ({users.length})</h3>
              </div>

              {/* FILTER CONTROLS */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  value={userSearchTerm}
                  onChange={e => setUserSearchTerm(e.target.value)}
                  style={{ flex: '1 1 200px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}
                />
                <select 
                  value={userRoleFilter} 
                  onChange={e => setUserRoleFilter(e.target.value)}
                  style={{ flex: '1 1 120px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Roles</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <select 
                  value={userCommunityFilter} 
                  onChange={e => setUserCommunityFilter(e.target.value)}
                  style={{ flex: '1 1 150px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Communities</option>
                  {communities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="Filter by interests..." 
                  value={userInterestFilter}
                  onChange={e => setUserInterestFilter(e.target.value)}
                  style={{ flex: '1 1 150px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}
                />
                <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
                  <label style={{ whiteSpace: 'nowrap' }}>Min Trust Score: {userScoreFilter}</label>
                  <input 
                    type="range" 
                    min="-10" max="100" 
                    value={userScoreFilter} 
                    onChange={e => setUserScoreFilter(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {users.filter(u => {
                  const matchesSearch = (u.alias?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()));
                  const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter || (!u.role && userRoleFilter === 'user');
                  const matchesCommunity = userCommunityFilter === 'all' || u.myCommunities?.includes(userCommunityFilter);
                  const matchesInterest = !userInterestFilter || (u.interests && u.interests.toLowerCase().includes(userInterestFilter.toLowerCase()));
                  const matchesScore = (u.trustScore || 0) >= userScoreFilter;
                  return matchesSearch && matchesRole && matchesCommunity && matchesScore && matchesInterest;
                }).map(u => (
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
        </>
      )}

      {activeTab === 'communities' && (
        <>
          {/* COMMUNITIES DASHBOARD */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <div className="glass" style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--primary-color)' }}>{communities.length}</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Active Communities</p>
            </div>
            <div className="glass" style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: communityRequests.length > 0 ? '2px solid #3b82f6' : 'none' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#3b82f6' }}>{communityRequests.length}</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Pending Requests</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            {/* COMMUNITY REQUESTS */}
            <div className="glass" style={{ flex: 1, minWidth: '300px', padding: '1rem', borderRadius: '12px' }}>
              <h3>Community Requests ({communityRequests.length})</h3>
              
              {communityRequests.length === 0 && <p style={{ opacity: 0.7 }}>No pending community requests.</p>}
              
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '2rem' }}>
                {communityRequests.map(r => (
                  <div key={r.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{r.name} ({r.type})</strong>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Requester: {r.requesterAlias}</span>
                    </div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', fontStyle: 'italic' }}>"{r.description}"</p>
                    
                    {rejectModal.isOpen && rejectModal.request?.id === r.id ? (
                      <div className="animate-fade-in" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>Select rejection reason:</p>
                        <select 
                          value={rejectReason} 
                          onChange={e => setRejectReason(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
                        >
                          {REJECT_REASONS.map(reason => <option key={reason} value={reason} style={{color: 'black'}}>{reason}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn" onClick={handleRejectCommunityRequest} style={{ background: '#ef4444', flex: 1, padding: '0.5rem' }}>Confirm Reject</button>
                          <button className="btn" onClick={() => setRejectModal({isOpen: false, request: null})} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', flex: 1, padding: '0.5rem' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button className="btn" onClick={() => handleApproveCommunityRequest(r)} style={{ background: '#10b981', flex: 1, padding: '0.5rem' }}>
                          Approve
                        </button>
                        <button className="btn" onClick={() => setRejectModal({isOpen: true, request: r})} style={{ background: 'rgba(239, 68, 68, 0.8)', flex: 1, padding: '0.5rem' }}>
                          Reject
                        </button>
                        <button className="btn" onClick={() => handleOpenChatWithRequester(r.requesterId, r.name)} style={{ background: 'var(--primary-color)', flex: 1, padding: '0.5rem' }}>
                          Open Chat
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '3rem 0' }} />

          {/* COMMUNITIES MANAGEMENT */}
          <div className="glass" style={{ width: '100%', padding: '1rem', borderRadius: '12px' }}>
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
        </>
      )}
    </div>
  );
}