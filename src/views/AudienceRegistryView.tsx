import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { api } from '../utils/api';
import { safeFormatDate } from '../utils/dateHelper';
import { updateDocumentSEO } from '../utils/seo';
import { adminFetch } from '../utils/adminFetch';
import { 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  X,
  Bell, 
  Send, 
  RefreshCw,
  Users,
  Trash2
} from 'lucide-react';

export default function AudienceRegistryView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [pushDeviceCount, setPushDeviceCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ping All Devices console state
  const [pingMessage, setPingMessage] = useState('');
  const [isPingingDevices, setIsPingingDevices] = useState(false);
  const [pingFeedback, setPingFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // Resend API test email console state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const testEmailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (testEmailTimerRef.current) {
        clearTimeout(testEmailTimerRef.current);
      }
    };
  }, []);

  // All User Email List state
  const [userEmails, setUserEmails] = useState<{ id: string; email: string; createdAt?: any }[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Audience Registry — Current News Live',
      description: 'Push device listeners, cloud messaging alerts, and email test console.',
      canonicalPath: '/admin/audience',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const fetchPushCount = async () => {
    try {
      const res = await fetch('/api/push/subscribers-count');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === 'number') {
          setPushDeviceCount(data.count);
          return;
        }
      }
      const count = await api.getPushSubscriberCount();
      setPushDeviceCount(count);
    } catch (e) {
      console.debug('Failed to fetch push count:', e);
    }
  };

  const loadUserEmails = async () => {
    if (!user) return;
    setLoadingEmails(true);
    try {
      const rows = await api.getSubscribersAdmin();
      const list = rows.map(r => ({
        id: r.email,
        email: r.email,
        createdAt: r.created_at
      }));
      setUserEmails(list);
    } catch (err: any) {
      console.debug('User emails fetch notice:', err);
      if (err?.message) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchPushCount();
      loadUserEmails();
    }
  }, [user, isAdmin]);

  const handleDeleteUserEmail = async (emailToDelete: string) => {
    if (!window.confirm(`Are you sure you want to remove ${emailToDelete}?`)) return;
    try {
      await api.deleteSubscriberAdmin(emailToDelete);
      setUserEmails(prev => prev.filter(item => item.email !== emailToDelete));
    } catch (err: any) {
      console.error('Failed to delete email:', err);
      if (err?.message) {
        setErrorMsg(err.message);
      }
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = testEmailAddress.trim();
    if (!targetEmail) return;

    if (testEmailTimerRef.current) {
      clearTimeout(testEmailTimerRef.current);
      testEmailTimerRef.current = null;
    }

    setIsSendingTestEmail(true);
    setTestEmailFeedback({ status: 'idle', message: '' });

    try {
      const { ok, data, error: sendErr } = await adminFetch('/api/mail/send-alert', {
        method: 'POST',
        body: JSON.stringify({
          email: targetEmail,
          title: 'Test Circular: Newsroom Alert Dispatch',
          link: window.location.origin
        })
      });

      if (ok && data?.success) {
        setTestEmailFeedback({
          status: 'success',
          message: `successfully ${targetEmail} sent.`
        });
        setTestEmailAddress('');
        testEmailTimerRef.current = setTimeout(() => {
          setTestEmailFeedback({ status: 'idle', message: '' });
        }, 3000);
      } else {
        const errorText = sendErr || 'Failed to dispatch test circular.';
        setTestEmailFeedback({
          status: 'error',
          message: errorText
        });
        setErrorMsg(errorText);
      }
    } catch (err: any) {
      const errorText = err.message || 'Network error encountered during email transmission.';
      setTestEmailFeedback({
        status: 'error',
        message: errorText
      });
      setErrorMsg(errorText);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handlePingAllDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPingingDevices(true);
    setPingFeedback({ status: 'idle', message: '' });

    try {
      const { ok, data, error: pingErr } = await adminFetch('/api/push/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Current News Alert',
          body: pingMessage.trim() || 'A new editorial dispatch has just been published.',
          url: '/'
        })
      });

      if (ok && data?.success) {
        const sentCount = data.sent || 0;
        const msg = sentCount > 0
          ? `Dispatched successfully to ${sentCount} active device(s) via Firebase Cloud Messaging.`
          : (data.message || 'Ping broadcast processed. (No active device subscriptions found).');
        setPingFeedback({
          status: 'success',
          message: msg
        });
        setPingMessage('');
        fetchPushCount();
      } else {
        const errorText = pingErr || 'Failed to ping devices via cloud messaging.';
        setPingFeedback({
          status: 'error',
          message: errorText
        });
        setErrorMsg(errorText);
      }
    } catch (err: any) {
      const errorText = err.message || 'Network error encountered during cloud messaging dispatch.';
      setPingFeedback({
        status: 'error',
        message: errorText
      });
      setErrorMsg(errorText);
    } finally {
      setIsPingingDevices(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-950 font-sans" id="audience-registry-view">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <span className="text-xs sm:text-sm font-medium">{errorMsg}</span>
              </div>
              <button 
                onClick={() => setErrorMsg(null)} 
                className="text-red-600 hover:text-red-800 dark:text-red-400 p-1 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 1. Push Notifications Section (Redesigned with alert logo, number & refresh button next to heading) */}
          <div className="p-5 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  Push Notifications
                </h3>

                {/* Badge showing ONLY alert logo, number, and refresh button next to heading */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-xl shadow-xs">
                  <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                    {pushDeviceCount !== null ? pushDeviceCount : '0'}
                  </span>
                  <button
                    type="button"
                    onClick={fetchPushCount}
                    className="p-0.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    title="Refresh device count"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handlePingAllDevices} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={pingMessage}
                  onChange={(e) => setPingMessage(e.target.value)}
                  placeholder="Enter broadcast message (or leave empty for default alert)"
                  className="w-full px-4 py-2.5 pl-9 border border-amber-200 dark:border-amber-800/80 focus:ring-2 focus:ring-amber-500 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                <Bell className="absolute left-3 top-3 h-4 w-4 text-amber-500/70" />
              </div>
              <button
                type="submit"
                disabled={isPingingDevices}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:bg-amber-400 cursor-pointer shadow-xs whitespace-nowrap"
              >
                {isPingingDevices ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Pinging...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ping All Devices</span>
                  </>
                )}
              </button>
            </form>

            {pingFeedback.status !== 'idle' && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                pingFeedback.status === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              }`}>
                {pingFeedback.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span>{pingFeedback.message}</span>
              </div>
            )}
          </div>

          {/* 2. Email Test Section */}
          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Email Test
            </h3>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Enter email address for test circular"
                  className="w-full px-4 py-2.5 pl-9 border border-indigo-200 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  required
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              </div>
              <button
                type="submit"
                disabled={isSendingTestEmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 cursor-pointer shadow-xs whitespace-nowrap"
              >
                {isSendingTestEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Mail</span>
                  </>
                )}
              </button>
            </form>

            {testEmailFeedback.status !== 'idle' && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                testEmailFeedback.status === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              }`}>
                {testEmailFeedback.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span>{testEmailFeedback.message}</span>
              </div>
            )}
          </div>

          {/* 3. All User Email List Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  All User Email List ({userEmails.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={loadUserEmails}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingEmails ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                Loading user emails...
              </div>
            ) : userEmails.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No user emails registered yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {userEmails.map((item) => (
                  <div key={item.id || item.email} className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.email}
                      </p>
                      {item.createdAt && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Registered: {safeFormatDate(item.createdAt)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteUserEmail(item.email)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Email"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
