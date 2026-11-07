import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Download, ArrowRight, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { appVersionManager, UpdateCheckResult } from '../utils/appVersionManager';
import { Capacitor } from '@capacitor/core';

export default function AppUpdatePrompt(): React.JSX.Element | null {
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // Check for updates shortly after app boot (non-blocking 2.5s delay)
    const timer = setTimeout(async () => {
      try {
        const result = await appVersionManager.checkForUpdates();
        if (!isMounted) return;

        if (result.updateAvailable) {
          // If update is forced, always show; if optional, check snooze
          if (result.forceUpdate || !appVersionManager.isUpdateSnoozed()) {
            setUpdateState(result);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.debug('[AppUpdatePrompt] Update check deferred:', err);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!isVisible || !updateState || !updateState.remoteInfo) {
    return null;
  }

  const { remoteInfo, forceUpdate, currentVersion } = updateState;

  const handleUpdateClick = () => {
    // If native Android, try opening Google Play Store app directly via market:// intent
    if (Capacitor.isNativePlatform()) {
      const playStoreAppUrl = 'market://details?id=blog.currentnews.app';
      const webFallbackUrl = remoteInfo.playStoreUrl || 'https://play.google.com/store/apps/details?id=blog.currentnews.app';
      
      try {
        window.location.href = playStoreAppUrl;
      } catch {
        window.open(webFallbackUrl, '_blank');
      }
    } else {
      // On web / PWA, open Play Store or direct APK
      window.open(remoteInfo.playStoreUrl || remoteInfo.directApkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = () => {
    if (forceUpdate) return; // Cannot dismiss mandatory updates
    appVersionManager.snoozeUpdate();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop only for mandatory force updates */}
          {forceUpdate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-9998"
            />
          )}

          {/* Bottom Pop-up Sheet / Card */}
          <div
            className={`fixed z-9999 ${
              forceUpdate
                ? 'inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto'
                : 'inset-x-3 bottom-3 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md'
            }`}
          >
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#fbf8f2] dark:bg-[#181614] border-2 border-[#1a1816] dark:border-amber-600/40 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-900 dark:text-slate-100 overflow-hidden relative"
            >
              {/* Header Ribbon */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${forceUpdate ? 'bg-amber-600 text-white' : 'bg-[#1a1816] dark:bg-amber-600 text-white'}`}>
                    {forceUpdate ? <ShieldAlert className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200">
                        v{remoteInfo.latestVersion} Available
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Installed: v{currentVersion}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight mt-1">
                      {remoteInfo.title || 'New Edition Available'}
                    </h3>
                  </div>
                </div>

                {/* Dismiss button (only if not forced) */}
                {!forceUpdate && (
                  <button
                    onClick={handleDismiss}
                    aria-label="Dismiss update"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Release Notes */}
              {Array.isArray(remoteInfo.releaseNotes) && remoteInfo.releaseNotes.length > 0 && (
                <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 mb-4 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    What's New in This Release:
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {remoteInfo.releaseNotes.slice(0, 3).map((note, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  onClick={handleUpdateClick}
                  className="w-full flex-1 flex items-center justify-center gap-2 bg-[#1a1816] hover:bg-black dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Update on Google Play</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </button>

                {!forceUpdate && (
                  <button
                    onClick={handleDismiss}
                    className="w-full sm:w-auto text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-2 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    Remind Later
                  </button>
                )}
              </div>

              {forceUpdate && (
                <p className="text-[11px] text-center text-amber-700 dark:text-amber-400 mt-2 font-medium">
                  This mandatory update is required to continue reading live dispatches.
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
