import { useState } from 'react';
import { useAuth } from '../useAuth';
import { useTranslation } from 'react-i18next';
import { Users, Search, ShieldCheck, HeartHandshake, ArrowRight, ArrowLeft } from 'lucide-react';

export default function OnboardingModal() {
  const { profile, completeOnboarding } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  // If we don't have a profile yet, or if they already completed onboarding, don't show
  if (!profile || profile.hasCompletedOnboarding) {
    return null;
  }

  const slides = [
    {
      title: t('onboardWelcomeTitle', 'ברוכים הבאים לקהילה! 👋'),
      desc: t('onboardWelcomeDesc', 'האפליקציה הזו נועדה לחבר בין אנשים: לעזור, להיעזר, וליצור קהילות חזקות ומגובשות באזור שלכם.'),
      icon: <HeartHandshake size={48} color="var(--primary-color)" />
    },
    {
      title: t('onboardCommunitiesTitle', 'הכוח נמצא בקהילות'),
      desc: t('onboardCommunitiesDesc', 'תוכלו להצטרף לקהילות קיימות באזורכם, או לפתוח קהילה חדשה עבור השכונה, הבניין או הקבוצה שלכם. קהילות מאפשרות סביבה בטוחה וסגורה לסיוע הדדי.'),
      icon: <Users size={48} color="#10b981" />
    },
    {
      title: t('onboardBiddingTitle', 'מכרזים והצעות שירות'),
      desc: t('onboardBiddingDesc', 'צריכים בעל מקצוע? פרסמו בקשה. המערכת מגבילה עד 3 בעלי מקצוע שיוכלו לפנות אליכם, כדי למנוע הצפה של פניות ולשמור על שקט.'),
      icon: <Search size={48} color="#8b5cf6" />
    },
    {
      title: t('onboardTrustTitle', 'אמינות לפני הכל'),
      desc: t('onboardTrustDesc', 'לאחר כל בקשת עזרה או מתן שירות, תוכלו לדרג אחד את השני. משתמשים עם ציון אמינות גבוה מקבלים עדיפות וזוכים לאמון הקהילה.'),
      icon: <ShieldCheck size={48} color="#f59e0b" />
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const currentSlide = slides[step];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div className="glass animate-fade-in" style={{
        width: '100%', maxWidth: '450px', padding: '2rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', position: 'relative'
      }}>
        
        <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '50%' }}>
          {currentSlide.icon}
        </div>
        
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
          {currentSlide.title}
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem', minHeight: '80px' }}>
          {currentSlide.desc}
        </p>
        
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {slides.map((_, idx) => (
            <div key={idx} style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: idx === step ? 'var(--primary-color)' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s ease'
            }} />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', width: '100%', gap: '1rem', justifyContent: 'space-between' }}>
          <button 
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
              background: 'transparent', color: 'white', cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <ArrowRight size={20} />
          </button>
          
          <button 
            className="btn"
            onClick={handleNext}
            style={{
              flex: 1, background: 'var(--primary-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}
          >
            {step === slides.length - 1 ? t('onboardFinish', 'קדימה, בואו נתחיל!') : t('onboardNext', 'הבא')}
            {step < slides.length - 1 && <ArrowLeft size={18} />}
          </button>
        </div>
        
        <button 
          onClick={completeOnboarding}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            marginTop: '1.5rem', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline'
          }}
        >
          {t('skipOnboarding', 'דלג על ההדרכה')}
        </button>

      </div>
    </div>
  );
}
