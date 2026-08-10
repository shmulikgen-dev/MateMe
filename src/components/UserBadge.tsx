

interface UserBadgeProps {
  trustScore?: number;
  isManager?: boolean;
  role?: string;
  className?: string;
}

export default function UserBadge({ trustScore = 0, isManager = false, role, className = '' }: UserBadgeProps) {
  let badgeIcon = '';
  let badgeTitle = '';
  let badgeColor = '';

  if (role === 'admin') {
    badgeIcon = '🛡️';
    badgeTitle = 'מנהל מערכת';
    badgeColor = '#ef4444';
  } else if (isManager) {
    badgeIcon = '👑';
    badgeTitle = 'מייסד קהילה';
    badgeColor = '#f59e0b';
  } else if (trustScore >= 20) {
    badgeIcon = '🌟';
    badgeTitle = 'עוזר מתמיד';
    badgeColor = '#10b981';
  } else if (trustScore < 5) {
    badgeIcon = '🌱';
    badgeTitle = 'חדש בשכונה';
    badgeColor = '#6366f1';
  }

  if (!badgeIcon) return null;

  return (
    <span 
      className={`user-badge ${className}`}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        backgroundColor: `${badgeColor}15`,
        color: 'var(--text-primary)', // Much better contrast against any background
        border: `1px solid ${badgeColor}`
      }}
      title={badgeTitle}
    >
      {badgeIcon} <span>{badgeTitle}</span>
    </span>
  );
}
