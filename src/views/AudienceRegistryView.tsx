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
  Trash2,
  Smartphone,
  Laptop,
  Globe,
  Copy,
  Check
} from 'lucide-react';

export default function AudienceRegistryView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [pushDeviceCount, setPushDeviceCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Push devices list state
  const [pushDevices, setPushDevices] = useState<Array<{
    id: string;
    endpoint: string;
    userAgent: string;
    createdAt?: string;
  }>>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (testEmailTimerRef.current) {
        clearTimeout(testEmailTimerRef.current);
      }
      if (pingTimerRef.current) {
        clearTimeout(pingTimerRef.current);
      }
    };
  }, []);

  // All User Email List state
  const [userEmails, setUserEmails] = useState<{
    id: string;
    email: string;
    role?: string;
    displayName?: string;
    createdAt?: any;
    lastLoginAt?: any;
  }[]>([]);
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

  const fetchPushDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await adminFetch<{
        success?: boolean;
        count: number;
        devices: Array<{ id: string; endpoint: string; userAgent: string; createdAt: string }>;
      }>('/api/admin/push/devices');

      if (res.ok && res.data?.devices) {
        setPushDevices(res.data.devices);
        setPushDeviceCount(res.data.count ?? res.data.devices.length);
      } else {
        fetchPushCount();
      }
    } catch (e) {
      console.debug('Failed to fetch devices:', e);
      fetchPushCount();
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchPushCount = async () => {
    try {
      const res = await adminFetch<{ success?: boolean; count: number }>('/api/admin/push/subscribers-count');
      if (res.ok && res.data && typeof res.data.count === 'number') {
        setPushDeviceCount(res.data.count);
        return;
      }
      const count = await api.getPushSubscriberCount();
      setPushDeviceCount(count);
    } catch (e) {
      console.debug('Failed to fetch push count:', e);
    }
  };

  const handleDeleteDevice = async (idOrEndpoint: string) => {
    if (!window.confirm('Are you sure you want to remove this push notification device from Neon?')) return;
    try {
      const res = await adminFetch(`/api/admin/push/devices/${encodeURIComponent(idOrEndpoint)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPushDevices(prev => prev.filter(d => d.id !== idOrEndpoint && d.endpoint !== idOrEndpoint));
        setPushDeviceCount(prev => Math.max(0, (prev || 1) - 1));
      } else {
        setErrorMsg(res.error || 'Failed to remove device');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error removing device');
    }
  };

  const handleCopyEndpoint = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadUserEmails = async () => {
    if (!user) return;
    setLoadingEmails(true);
    try {
      // 1. Ensure current authenticated Firebase user is synced to backend
      try {
        await adminFetch('/api/users/sync', {
          method: 'POST',
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || null
          })
        });
      } catch (_) {}

      // 2. Fetch users from backend (Firebase Auth + database)
      const res = await adminFetch<{
        success?: boolean;
        count: number;
        users: Array<{
          id: string;
          email: string;
          role?: string;
          displayName?: string;
          createdAt?: any;
          lastLoginAt?: any;
        }>;
      }>('/api/admin/users');

      if (res.ok && res.data?.users && res.data.users.length > 0) {
        setUserEmails(res.data.users);
      } else {
        const rows = await api.getSubscribersAdmin();
        const list = rows.map(r => ({
          id: r.email,
          email: r.email,
          role: 'subscriber',
          displayName: '',
          createdAt: r.created_at
        }));
        if (user.email && !list.some(item => item.email.toLowerCase() === user.email!.toLowerCase())) {
          list.unshift({
            id: user.uid,
            email: user.email,
            role: isAdmin ? 'admin' : 'Firebase User',
            displayName: user.displayName || '',
            lastLoginAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
        }
        setUserEmails(list);
      }
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
      fetchPushDevices();
      loadUserEmails();
    }
  }, [user, isAdmin]);

  const handleDeleteUserEmail = async (emailToDelete: string) => {
    if (!window.confirm(`Are you sure you want to remove ${emailToDelete}?`)) return;
    try {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(emailToDelete)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUserEmails(prev => prev.filter(item => item.email.toLowerCase() !== emailToDelete.toLowerCase()));
      } else {
        await api.deleteSubscriberAdmin(emailToDelete);
        setUserEmails(prev => prev.filter(item => item.email.toLowerCase() !== emailToDelete.toLowerCase()));
      }
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
          link: 'https://currentnews.blog'
        })
      });

      if (ok && data?.success) {
        setTestEmailFeedback({
          status: 'success',
          message: `Successfully dispatched test email to ${targetEmail} via Resend.`
        });
        setTestEmailAddress('');
        testEmailTimerRef.current = setTimeout(() => {
          setTestEmailFeedback({ status: 'idle', message: '' });
        }, 5000);
      } else {
        const errorText = data?.error || data?.detail || data?.message || sendErr || 'Failed to dispatch test circular.';
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
    if (pingTimerRef.current) {
      clearTimeout(pingTimerRef.current);
      pingTimerRef.current = null;
    }

    setIsPingingDevices(true);
    setPingFeedback({ status: 'idle', message: '' });

    try {
      const { ok, data, error: pingErr } = await adminFetch('/api/admin/push/broadcast', {
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
          ? `Dispatched successfully to ${sentCount} active device(s) via Cloud Messaging.`
          : (data.message || 'Ping broadcast processed. (No active device subscriptions found).');
        setPingFeedback({
          status: 'success',
          message: msg
        });
        setPingMessage('');
        fetchPushCount();
        pingTimerRef.current = setTimeout(() => {
          setPingFeedback({ status: 'idle', message: '' });
        }, 5000);
      } else {
        const errorText = data?.error || pingErr || data?.message || 'Failed to ping devices via cloud messaging.';
        setPingFeedback({
          status: 'error',
          message: errorText
        });
        setErrorMsg(errorText);
        pingTimerRef.current = setTimeout(() => {
          setPingFeedback({ status: 'idle', message: '' });
        }, 5000);
      }
    } catch (err: any) {
      const errorText = err?.message || 'Network error encountered during cloud messaging dispatch.';
      setPingFeedback({
        status: 'error',
        message: errorText
      });
      setErrorMsg(errorText);
      pingTimerRef.current = setTimeout(() => {
        setPingFeedback({ status: 'idle', message: '' });
      }, 5000);
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

          {/* 1. Push Notifications Section */}
          <div className="p-5 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  Push Notifications
                </h3>

                {/* Badge showing alert logo, device count, and refresh button */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-xl shadow-xs">
                  <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                    {pushDeviceCount !== null ? pushDeviceCount : '0'}
                  </span>
                  <button
                    type="button"
                    onClick={fetchPushDevices}
                    className="p-0.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    title="Refresh devices and count"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingDevices ? 'animate-spin' : ''}`} />
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

            {/* Registered Push Devices List from Neon database */}
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-950 dark:text-amber-200">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Registered Devices ({pushDevices.length})
                </span>
                <button
                  type="button"
                  onClick={fetchPushDevices}
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${loadingDevices ? 'animate-spin' : ''}`} />
                  <span>Reload devices</span>
                </button>
              </div>

              {loadingDevices ? (
                <div className="py-4 text-center text-xs text-amber-800/70 dark:text-amber-300/70 font-mono">
                  Loading registered devices from database...
                </div>
              ) : pushDevices.length === 0 ? (
                <div className="py-3 px-3.5 bg-white/70 dark:bg-slate-900/60 rounded-xl text-center text-xs text-amber-900/70 dark:text-amber-200/70 border border-amber-200/50 dark:border-amber-900/30">
                  No devices registered in database yet. Device tokens appear here when readers or app users subscribe to notifications.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {pushDevices.map((device) => {
                    const isAndroid = /android/i.test(device.userAgent);
                    const isApple = /iphone|ipad|macintosh/i.test(device.userAgent);
                    const isWindows = /windows/i.test(device.userAgent);

                    return (
                      <div
                        key={device.id || device.endpoint}
                        className="p-3 bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                            {isAndroid ? (
                              <Smartphone className="w-4 h-4" />
                            ) : isApple ? (
                              <Smartphone className="w-4 h-4" />
                            ) : isWindows ? (
                              <Laptop className="w-4 h-4" />
                            ) : (
                              <Globe className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {device.userAgent.length > 50 ? device.userAgent.slice(0, 50) + '...' : device.userAgent}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-mono truncate max-w-[200px]" title={device.endpoint}>
                                {device.endpoint.length > 35 ? `${device.endpoint.slice(0, 20)}...${device.endpoint.slice(-10)}` : device.endpoint}
                              </span>
                              {device.createdAt && (
                                <span>• {safeFormatDate(device.createdAt)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyEndpoint(device.id, device.endpoint)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 rounded-md transition-colors cursor-pointer"
                            title="Copy device token"
                          >
                            {copiedId === device.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(device.id || device.endpoint)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                            title="Remove device from database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                <RefreshCw className={`w-3 h-3 ${loadingEmails ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingEmails ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                Loading user emails from database...
              </div>
            ) : userEmails.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No user emails registered yet. Users will appear here automatically when they log in to the site.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {userEmails.map((item) => (
                  <div key={item.id || item.email} className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.email}
                        </p>
                        {item.displayName && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            ({item.displayName})
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider ${
                          item.role === 'admin' 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900' 
                            : item.role === 'writer'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        }`}>
                          {item.role || 'Firebase User'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                        {item.lastLoginAt && (
                          <span>Last Login: {safeFormatDate(item.lastLoginAt)}</span>
                        )}
                        {item.createdAt && (
                          <span>• Registered: {safeFormatDate(item.createdAt)}</span>
                        )}
                      </div>
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
