import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Smartphone, Globe, Mail, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AddToCalendarButtonProps {
  post: {
    id: string;
    description: string;
    category?: string;
    creatorAlias?: string;
    allowCalendar?: boolean;
    targetDate?: string;
    targetTime?: string;
    availability?: string;
    supplyType?: string;
    isPopup?: boolean;
    createdAt?: any;
    expiresAt?: string;
  };
}

export function isCalendarEnabledForPost(post: any): boolean {
  if (!post) return false;
  if (post.allowCalendar === true) return true;
  if (post.allowCalendar === false) return false;
  return Boolean(post.targetDate || post.targetTime || post.supplyType === 'event' || post.isPopup);
}

function formatUTCForCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function toLocalDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export default function AddToCalendarButton({ post }: AddToCalendarButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getInitialDateAndTime = () => {
    if (post.targetDate) {
      return {
        dateStr: post.targetDate,
        timeStr: post.targetTime && post.targetTime.includes(':') ? post.targetTime : '10:00'
      };
    }

    // If post has expiresAt (time-limited post), default to a sensible time before expiration or next rounded hour
    if (post.expiresAt) {
      const exp = new Date(post.expiresAt);
      const now = new Date();
      if (!isNaN(exp.getTime()) && exp > now) {
        const diffHours = (exp.getTime() - now.getTime()) / (1000 * 60 * 60);
        // If expires within 24h, set to next hour; otherwise use expiration date at 10:00
        if (diffHours <= 24) {
          const nextHour = new Date(now);
          nextHour.setMinutes(0, 0, 0);
          nextHour.setHours(nextHour.getHours() + 1);
          return {
            dateStr: toLocalDateInputValue(nextHour),
            timeStr: post.targetTime && post.targetTime.includes(':') ? post.targetTime : toLocalTimeInputValue(nextHour)
          };
        }
        return {
          dateStr: toLocalDateInputValue(exp),
          timeStr: post.targetTime && post.targetTime.includes(':') ? post.targetTime : '10:00'
        };
      }
    }

    const fallback = new Date();
    fallback.setMinutes(0, 0, 0);
    fallback.setHours(fallback.getHours() + 1);
    return {
      dateStr: toLocalDateInputValue(fallback),
      timeStr: post.targetTime && post.targetTime.includes(':') ? post.targetTime : toLocalTimeInputValue(fallback)
    };
  };

  const initial = getInitialDateAndTime();
  const [customDate, setCustomDate] = useState(initial.dateStr);
  const [customTime, setCustomTime] = useState(initial.timeStr);

  useEffect(() => {
    const next = getInitialDateAndTime();
    setCustomDate(next.dateStr);
    setCustomTime(next.timeStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.targetDate, post.targetTime, post.expiresAt]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!isCalendarEnabledForPost(post)) return null;

  const getEventDates = (): { start: Date; end: Date } => {
    const dateVal = customDate || initial.dateStr;
    const timeVal = customTime || initial.timeStr;
    const [year, month, day] = dateVal.split('-').map(Number);
    let hours = 10;
    let minutes = 0;
    if (timeVal && timeVal.includes(':')) {
      const [h, m] = timeVal.split(':').map(Number);
      if (!isNaN(h)) hours = h;
      if (!isNaN(m)) minutes = m;
    }
    const start = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, hours, minutes, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
    return { start, end };
  };

  const getEventMetadata = () => {
    const categoryName = post.category ? t(post.category) : 'אירוע קהילתי';
    const shortDesc = post.description.length > 48 ? `${post.description.slice(0, 48)}...` : post.description;
    const title = `MateMe: ${shortDesc}`;
    const postUrl = `${window.location.origin}/post/${post.id}`;
    const details = `${post.description}\n\nקטגוריה: ${categoryName}\nפורסם ע"י: ${post.creatorAlias || 'חבר קהילה'}\nקישור ב-MateMe: ${postUrl}`;
    return { title, details, postUrl };
  };

  const handleGoogleCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { start, end } = getEventDates();
    const { title, details } = getEventMetadata();
    const datesParam = `${formatUTCForCalendar(start)}/${formatUTCForCalendar(end)}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${datesParam}&details=${encodeURIComponent(details)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleOutlookWeb = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { start, end } = getEventDates();
    const { title, details } = getEventMetadata();
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
      title
    )}&startdt=${encodeURIComponent(start.toISOString())}&enddt=${encodeURIComponent(
      end.toISOString()
    )}&body=${encodeURIComponent(details)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleDownloadICS = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { start, end } = getEventDates();
    const { title, details, postUrl } = getEventMetadata();
    const nowUTC = formatUTCForCalendar(new Date());
    const startUTC = formatUTCForCalendar(start);
    const endUTC = formatUTCForCalendar(end);

    const escapedDetails = details.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,');
    const escapedTitle = title.replace(/,/g, '\\,');

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MateMe Community//Calendar//HE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:mateme-${post.id}@mateme.app`,
      `DTSTAMP:${nowUTC}`,
      `DTSTART:${startUTC}`,
      `DTEND:${endUTC}`,
      `SUMMARY:${escapedTitle}`,
      `DESCRIPTION:${escapedDetails}`,
      `URL:${postUrl}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    const icsContent = icsLines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `mateme-event-${post.id.slice(0, 6)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    setOpen(false);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          minHeight: '38px',
          borderRadius: '10px',
          background: 'var(--badge-demand-bg)',
          color: 'var(--badge-demand-text)',
          border: '1px solid var(--primary-color)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        title="הוסף אירוע ליומן האישי"
      >
        <Calendar size={15} />
        <span>הוסף ליומן</span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="glass animate-fade-in"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1200,
            minWidth: '255px',
            padding: '0.75rem',
            borderRadius: '14px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(18px)',
            border: '1px solid var(--primary-color)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            textAlign: 'start'
          }}
        >
          <div style={{ paddingBottom: '0.45rem', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={13} color="var(--primary-color)" />
              <span>מועד האירוע ביומן:</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{
                  flex: 1.2,
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                style={{
                  flex: 0.85,
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleCalendar}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'start'
            }}
          >
            <Globe size={16} color="#4f46e5" />
            <span>יומן Google (אנדרואיד / דפדפן)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadICS}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'start'
            }}
          >
            <Smartphone size={16} color="#10b981" />
            <span>יומן Apple / אייפון / תוכנת Outlook</span>
          </button>

          <button
            type="button"
            onClick={handleOutlookWeb}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'start'
            }}
          >
            <Mail size={16} color="#0284c7" />
            <span>יומן Outlook Web (דפדפן)</span>
          </button>
        </div>
      )}
    </div>
  );
}
