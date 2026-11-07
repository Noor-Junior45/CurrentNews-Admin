import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface ProfilePageNavbarProps {
  title: string;
  onBack?: () => void;
  fallbackUrl?: string;
  rightAction?: React.ReactNode;
  align?: 'center' | 'left';
}

export default function ProfilePageNavbar({ 
  title, 
  onBack, 
  fallbackUrl = '/admin',
  rightAction,
  align = 'left'
}: ProfilePageNavbarProps): React.JSX.Element {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (fallbackUrl && fallbackUrl !== '/profile') {
      navigate(fallbackUrl);
    } else if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/admin');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Left container: Tailless arrow Back button + Heading directly next to it on the left */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBack}
            className="h-10 w-10 -ml-1 sm:-ml-2 inline-flex items-center justify-center bg-transparent hover:bg-transparent border-0 shadow-none text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer active:scale-90 shrink-0 select-none group focus-visible:outline-none"
            id="page-liquid-glass-back-btn"
            aria-label="Go back"
            title="Go back"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.2] shrink-0 transition-transform group-hover:-translate-x-0.5" />
          </button>

          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight sm:tracking-wider font-display truncate">
            {title}
          </h1>
        </div>

        {/* Right side spacer or custom action */}
        <div className="min-w-[40px] sm:min-w-[48px] flex items-center justify-end shrink-0">
          {rightAction || null}
        </div>
      </div>
    </header>
  );
}
