

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
      title={badgeTitle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        padding: '2px 6px',
        borderRadius: '12px',
        background: `${badgeColor}22`, // 22 hex is ~13% opacity
        color: badgeColor,
        border: `1px solid ${badgeColor}44`,
        marginLeft: '6px'
      }}
    >
      {badgeIcon} <span style={{ fontSize: '0.7rem' }}>{badgeTitle}</span>
    </span>
  );
}
