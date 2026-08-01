const fs = require('fs');
const path = 'C:/Users/shmul/Documents/עתיד החיבורים הקהילתיים/client/src/components/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { Shield, Trash2, ArrowLeft, MessageSquareWarning } from 'lucide-react';",
  "import { Shield, Trash2, ArrowLeft, MessageSquareWarning, XCircle } from 'lucide-react';"
);

const stateInsert = `  const [activeTab, setActiveTab] = useState<'general' | 'communities'>('general');
  const [rejectModal, setRejectModal] = useState<{isOpen: boolean, request: any}>({isOpen: false, request: null});
  const [rejectReason, setRejectReason] = useState('הקהילה כבר קיימת במערכת');
  const REJECT_REASONS = [
    'הקהילה כבר קיימת במערכת',
    'נושא הקהילה לא מתאים לאופי האפליקציה',
    'חסר מידע בתיאור הקהילה',
    'אחר'
  ];`;

content = content.replace(
  "  const [managerUserId, setManagerUserId] = useState('');",
  "  const [managerUserId, setManagerUserId] = useState('');\n" + stateInsert
);

const rejectHandler = `  const handleRejectCommunityRequest = async () => {
    if (!rejectModal.request) return;
    try {
      await updateDoc(doc(db, 'community_requests', rejectModal.request.id), {
        status: 'rejected',
        rejectReason: rejectReason
      });
      fetchData();
      setRejectModal({isOpen: false, request: null});
      alert('Community request rejected.');
    } catch (e) {
      console.error(e);
      alert('Error rejecting request');
    }
  };`;

content = content.replace(
  "  const handleApproveCommunityRequest",
  rejectHandler + "\n\n  const handleApproveCommunityRequest"
);

// We need to rewrite the return statement. We will use a regex to replace everything from `return (` to the end of the file.
const newReturn = `  return (
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
      </div>

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
}`;

content = content.replace(/  return \([\s\S]+$/, newReturn);
fs.writeFileSync(path, content, 'utf8');
