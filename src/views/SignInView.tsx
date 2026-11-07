import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, ChevronLeft } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase';
import { signInWithGoogleSafe } from '../utils/authHelper';
import { updateDocumentSEO } from '../utils/seo';

export default function SignInView(): React.JSX.Element {
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Sign In & Journalist Access — Current News Live',
      description: 'Access your Current News reader profile, dispatch submissions, and customized news alerts.',
      canonicalPath: '/signin',
      robots: 'noindex, follow'
    });
  }, []);

  // If already authenticated, redirect to /admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/admin', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Focus password input when transitioning to password step
  useEffect(() => {
    if (step === 'password') {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!agreedToTerms) {
      setErrorMessage('Please tick the box to agree to our Terms of service and Privacy policy before logging in.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // Step 1: If currently on email step, advance to password step
    if (step === 'email') {
      setStep('password');
      return;
    }

    // Step 2: On password step, validate password and authenticate
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
      navigate('/admin', { replace: true });
    } catch (err: any) {
      console.warn('Email authentication result:', err?.code || err?.message);
      let msg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = isSignUp
          ? 'Invalid credential. Please check your email and password format.'
          : 'Invalid email or password. If you do not have an account yet, click "Create one" below.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please switch to Sign in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/password sign-in is not enabled. Please sign in with Google.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please reset your password or try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection issue. Please check your connection and retry.';
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleSubmitting) return;

    if (!agreedToTerms) {
      setErrorMessage('Please tick the box to agree to our Terms of service and Privacy policy before logging in.');
      return;
    }

    setIsGoogleSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await signInWithGoogleSafe();
      if (res.success) {
        navigate('/admin', { replace: true });
      } else if (!res.cancelled && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err?.code || err?.message);
      setErrorMessage('Google Sign-In encountered an error. Please try again.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email above to reset your password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccessMessage(`Password reset link sent to ${trimmedEmail}. Please check your inbox.`);
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Password reset notice:', err?.code || err?.message);
      setErrorMessage('Could not send password reset email. Please verify the address.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 flex flex-col font-sans" id="signin-page-stage">
      <ProfilePageNavbar 
        title="Sign In" 
        fallbackUrl="/admin" 
        onBack={() => navigate('/admin', { replace: true })} 
      />

      <main className="flex-1 max-w-sm sm:max-w-md mx-auto w-full px-5 pt-8 pb-8 sm:py-14 flex flex-col items-center">
        {/* Website Logo perfectly fit in box div */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200/80 dark:border-slate-800 overflow-hidden flex items-center justify-center mb-4 transition-transform hover:scale-105 p-0">
          <img 
            src="/CurrentNews.png" 
            alt="Current News Logo" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Website Name in black colour */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-black dark:text-white tracking-tight text-center font-display mb-1.5">
          Current News
        </h1>

        {/* Sign in heading in grey colour */}
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-500 dark:text-slate-400 text-center mb-6">
          {isSignUp ? 'Create Account' : 'Sign in'}
        </h2>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="w-full mb-4 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs text-center leading-relaxed">
            <div>{errorMessage}</div>
            {!isSignUp && (errorMessage.includes('Create one') || errorMessage.includes('Invalid')) && (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage(null);
                }}
                className="mt-1.5 inline-block font-bold underline text-rose-700 dark:text-rose-300 hover:text-black dark:hover:text-white cursor-pointer"
              >
                New here? Click to create an account
              </button>
            )}
          </div>
        )}
        {successMessage && (
          <div className="w-full mb-4 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs text-center leading-relaxed">
            {successMessage}
          </div>
        )}

        {/* Dynamic Form: Initial state shows only email + Continue; when email is filled & submitted shows password + Sign in */}
        <form onSubmit={handleFormSubmit} className="w-full">
          {/* Email input field */}
          <div className="w-full mb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                EMAIL
              </label>
              {step === 'password' && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setPassword('');
                    setErrorMessage(null);
                  }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                >
                  Change email
                </button>
              )}
            </div>
            <div className="relative flex items-center bg-slate-200/60 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 rounded-xl px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-2.5 shrink-0" />
              <input 
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@example.com"
                required
                className="w-full bg-transparent border-0 p-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password input field: Only shown once email is filled and user clicks Continue */}
          {step === 'password' && (
            <div className="w-full mb-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                  PASSWORD
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative flex items-center bg-slate-200/60 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 rounded-xl px-3.5 py-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-2.5 shrink-0" />
                <input 
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent border-0 p-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Action button: Shows "Continue" on starting email step, and "Sign in" on password step */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-900 dark:text-white font-bold text-sm shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer mb-3 disabled:opacity-60"
            id="signin-email-continue-button"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-slate-600 dark:border-slate-300 border-t-transparent rounded-full animate-spin" />
            ) : step === 'email' ? (
              <span>Continue</span>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
              </>
            )}
          </button>
        </form>

        {/* Continue with Google button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-900 dark:text-white font-bold text-sm shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer mb-3 disabled:opacity-60"
          id="signin-google-continue-button"
        >
          {isGoogleSubmitting ? (
            <div className="w-4 h-4 border-2 border-slate-600 dark:border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Toggle between Sign in and Create one */}
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 text-center">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setStep('email');
              setPassword('');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="font-bold text-amber-600 dark:text-amber-500 hover:underline cursor-pointer"
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </p>

        {/* Terms and Privacy policy agreement */}
        <div 
          onClick={() => {
            setAgreedToTerms(!agreedToTerms);
            if (errorMessage && errorMessage.includes('tick the box')) {
              setErrorMessage(null);
            }
          }}
          className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-8 select-none text-center cursor-pointer max-w-sm group"
          role="checkbox"
          aria-checked={agreedToTerms}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setAgreedToTerms(!agreedToTerms);
            }
          }}
        >
          {agreedToTerms ? (
            <svg className="w-4 h-4 shrink-0 text-slate-900 dark:text-white transition-colors" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="currentColor" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" className="stroke-white dark:stroke-slate-950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 shrink-0 transition-colors ${errorMessage && errorMessage.includes('tick the box') ? 'text-rose-500 animate-pulse' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          )}
          <span className="leading-relaxed">
            You agree to our{' '}
            <Link to="/terms" onClick={(e) => e.stopPropagation()} className="underline font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400">
              Terms of service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="underline font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400">
              Privacy policy
            </Link>
          </span>
        </div>

        {/* Bottom copyright subtitle */}
        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80 pt-6 mt-auto">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-mono">
            © 2026 Current News Live • Independent Ledger
          </p>
        </div>
      </main>
    </div>
  );
}
