import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';

interface AdminAnalyticsProps {
  users: any[];
  posts: any[];
  communities: any[];
}

export default function AdminAnalytics({ users, posts, communities }: AdminAnalyticsProps) {
  const { t } = useTranslation();

  // Process data for charts
  const postsByType = useMemo(() => {
    const supply = posts.filter(p => p.type === 'supply').length;
    const demand = posts.filter(p => p.type === 'demand').length;
    return [
      { name: t('supply', 'הצעות'), value: supply },
      { name: t('demand', 'בקשות'), value: demand }
    ];
  }, [posts, t]);

  const postsByStatus = useMemo(() => {
    const counts = posts.reduce((acc, post) => {
      const status = post.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    }));
  }, [posts]);

  // Aggregate user growth over time
  const userGrowth = useMemo(() => {
    const countsByDate = users.reduce((acc, user) => {
      if (!user.createdAt) return acc;
      const dateObj = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      if (isNaN(dateObj.getTime())) return acc;
      
      const dateStr = dateObj.toLocaleDateString();
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {});
    
    let cumulative = 0;
    const sortedDates = Object.keys(countsByDate).sort((a, b) => {
      const [d1, m1, y1] = a.split('.');
      const [d2, m2, y2] = b.split('.');
      return new Date(`${m1}/${d1}/${y1}`).getTime() - new Date(`${m2}/${d2}/${y2}`).getTime();
    });

    return sortedDates.map(date => {
      cumulative += countsByDate[date];
      return { date, users: cumulative };
    });
  }, [users]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>{t('totalUsers', 'סה"כ משתמשים')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '1rem 0 0', color: '#00C49F' }}>{users.length}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>{t('totalPosts', 'סה"כ פוסטים')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '1rem 0 0', color: '#0088FE' }}>{posts.length}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>{t('activeCommunities', 'קהילות פעילות')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '1rem 0 0', color: '#FFBB28' }}>{communities.length}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Posts By Type */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('postsByType', 'פוסטים לפי סוג')}</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={postsByType}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {postsByType.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Posts By Status */}
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('postsByStatus', 'סטטוס פוסטים')}</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={postsByStatus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
                <Bar dataKey="value" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* User Growth */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>{t('userGrowth', 'צמיחת משתמשים')}</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white' }} />
              <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
