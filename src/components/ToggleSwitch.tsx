import React from 'react';
import { motion } from 'motion/react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  checked, 
  onChange, 
  disabled = false, 
  ariaLabel = "Toggle setting",
  id 
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      id={id}
      className={`group relative flex items-center h-7 w-14 p-[3px] rounded-full cursor-pointer select-none transition-all duration-300 outline-hidden shrink-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? 'bg-indigo-600/85 dark:bg-indigo-500/85 border border-white/60 dark:border-white/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),0_2px_8px_rgba(99,102,241,0.35)]'
          : 'bg-slate-300/70 dark:bg-slate-800/70 border border-white/80 dark:border-white/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.06)]'
      } backdrop-blur-md`}
    >
      {/* Ambient track ON / OFF labels */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none text-[8.5px] font-bold font-mono tracking-wider">
        <span className={`transition-opacity duration-200 ${checked ? 'opacity-90 text-white' : 'opacity-0'}`}>
          ON
        </span>
        <span className={`transition-opacity duration-200 ${!checked ? 'opacity-50 text-slate-700 dark:text-slate-300' : 'opacity-0'}`}>
          OFF
        </span>
      </div>

      {/* Sliding Frosted Glass Disc Knob */}
      <motion.div
        animate={{ x: checked ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`relative z-10 flex items-center justify-center w-[22px] h-[22px] rounded-full pointer-events-none transition-colors duration-300 ${
          checked
            ? 'bg-gradient-to-b from-white via-white/95 to-indigo-50/95 border border-white/90 shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,1)]'
            : 'bg-gradient-to-b from-white via-white/95 to-slate-100/90 border border-white/90 shadow-[0_2px_5px_rgba(0,0,0,0.18),inset_0_1px_2px_rgba(255,255,255,1)]'
        }`}
      />
    </button>
  );
};

export default ToggleSwitch;
