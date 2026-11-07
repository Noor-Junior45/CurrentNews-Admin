import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sun, MoonStar } from 'lucide-react';

interface GlassThemeToggleProps {
  className?: string;
  onThemeChange?: (isDark: boolean) => void;
}

export default function GlassThemeToggle({ className = '', onThemeChange }: GlassThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) {
        return saved === 'dark';
      }
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Apply theme to document and persist in storage
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { isDark } }));
    if (onThemeChange) {
      onThemeChange(isDark);
    }
  }, [isDark, onThemeChange]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle light and dark theme"
        onClick={toggleTheme}
        className={`group relative flex items-center h-7 w-14 p-[3px] rounded-full cursor-pointer select-none transition-all duration-300 outline-hidden shrink-0 active:scale-95 ${
          isDark
            ? 'bg-slate-900/70 border border-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),inset_0_-1px_2px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.3)]'
            : 'bg-slate-300/70 border border-white/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.06)]'
        } backdrop-blur-md`}
        id="settings-theme-toggle"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {/* Static Ambient Track Background Glyphs */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none opacity-30 dark:opacity-25">
          <Sun className="h-3 w-3 text-slate-800 dark:text-white" />
          <MoonStar className="h-3 w-3 text-slate-800 dark:text-white" />
        </div>

        {/* Sliding Frosted Glass Disc Knob */}
        <motion.div
          animate={{ x: isDark ? 28 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`relative z-10 flex items-center justify-center w-[22px] h-[22px] rounded-full pointer-events-none transition-colors duration-300 ${
            isDark
              ? 'bg-gradient-to-b from-slate-700/90 via-slate-800/95 to-slate-900/95 border border-white/25 text-white shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.3)]'
              : 'bg-gradient-to-b from-white via-white/95 to-slate-100/90 border border-white/90 text-slate-750 shadow-[0_2px_5px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,1)]'
          }`}
        >
          {isDark ? (
            <MoonStar className="h-3.5 w-3.5 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-600 drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]" />
          )}
        </motion.div>
      </button>
    </div>
  );
}
