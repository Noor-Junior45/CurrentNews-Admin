import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { syncUserAuthState } from '../hooks/useAuthState';
import { signInWithGoogleSafe } from '../utils/authHelper';
import { updateDocumentSEO } from '../utils/seo';

export default function SignInView(): React.JSX.Element {
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
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
      title: 'Current News — Admin Sign In',
      description: 'Secure editorial authentication portal for Current News writers and administrators.',
      canonicalPath: '/',
      robots: 'noindex, follow'
    });
  }, []);

  // Redirect to /admin on initial load only if already authenticated session exists
  useEffect(() => {
    let isMounted = true;
    const checkInitialSession = async () => {
      try {
        await auth.authStateReady();
        if (isMounted && auth.currentUser) {
          await syncUserAuthState(auth.currentUser);
          navigate('/admin', { replace: true });
        }
      } catch (err) {
        console.debug('[SignInView] Initial session check notice:', err);
      }
    };
    checkInitialSession();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!agreedToTerms) {
      setErrorMessage('Please agree to our Terms of service and Privacy policy before logging in.');
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

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (isSignUp && password.length < 6) {
      setErrorMessage('Password should be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      let cred;
      if (isSignUp) {
        cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      if (cred?.user) {
        // Fast, zero-network sync of cached claims before navigation
        await syncUserAuthState(cred.user);
      }

      navigate('/admin', { replace: true });
    } catch (err: any) {
      console.warn('Email authentication result:', err?.code || err?.message);
      let msg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = isSignUp
          ? 'Invalid credential. Please check your email and password format.'
          : 'Invalid email or password. If you do not have an account yet, switch to create one below.';
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
      setErrorMessage('Please agree to our Terms of service and Privacy policy before logging in.');
      return;
    }

    setIsGoogleSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await signInWithGoogleSafe();
      if (res.success && res.user) {
        // Fast, zero-network sync of cached claims before navigation
        await syncUserAuthState(res.user);
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
    <div className="min-h-screen bg-[#FFF0F5] dark:bg-[#161214] text-black dark:text-white flex flex-col justify-center items-center font-sans px-4 py-8 sm:py-12 selection:bg-[#B22222] selection:text-white" id="signin-page-stage">
      <main className="editorial-wrapper w-full max-w-[480px] px-6 sm:px-8 py-8 relative">
        {/* Header */}
        <header className="mb-8 sm:mb-10">
          <div className="flex items-center justify-start gap-4 sm:gap-6">
            {/* Left side logo aligned with email & password */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 border border-black/20 dark:border-white/20 p-2.5 sm:p-3 flex items-center justify-center shrink-0">
              <img 
                src="/CurrentNews.png" 
                alt="Current News Logo" 
                className="w-full h-full object-contain" 
              />
            </div>

            {/* Right side heading Current News and Admin below in second line */}
            <div className="text-left flex flex-col justify-center min-w-0">
              <h1 className="font-lora text-2xl xs:text-[1.75rem] sm:text-3xl md:text-4xl font-normal leading-tight tracking-normal text-black dark:text-white whitespace-nowrap">
                Current News
              </h1>
              <div className="font-lora text-xl xs:text-2xl sm:text-3xl font-normal leading-tight tracking-normal text-black dark:text-white mt-1 sm:mt-1.5">
                Admin
              </div>
            </div>
          </div>
        </header>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className={`w-full mb-6 px-4 py-3 text-xs leading-relaxed font-sans ${
            errorMessage.includes('not allowed from') || errorMessage.includes('authorized domain') || errorMessage.includes('Authorized domains')
              ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-600 text-black dark:text-amber-200 font-semibold'
              : 'bg-rose-50 dark:bg-rose-950/40 border-l-4 border-[#B22222] text-[#B22222] dark:text-rose-300 font-semibold'
          }`}>
            <div className="font-bold">{errorMessage}</div>
            {errorMessage.includes('Authorized domains') && (
              <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-900/40 text-[11px] text-black dark:text-amber-300 font-mono">
                💡 <strong>Immediate Access:</strong> You can sign in right now using the <strong>Email & Password</strong> fields below without needing domain authorization.
              </div>
            )}
            {!isSignUp && (errorMessage.includes('create one') || errorMessage.includes('Invalid')) && (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage(null);
                }}
                className="mt-1.5 inline-block font-bold underline text-[#B22222] dark:text-rose-300 hover:text-black dark:hover:text-white cursor-pointer font-space-mono text-[11px]"
              >
                New here? Click to create an account
              </button>
            )}
          </div>
        )}
        {successMessage && (
          <div className="w-full mb-6 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 text-black dark:text-emerald-300 text-xs leading-relaxed font-sans font-semibold">
            {successMessage}
          </div>
        )}

        {/* Form with clean editorial bottom-border inputs */}
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="font-space-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-black dark:text-white">
              Email
            </label>
            <div className="relative border-b-2 border-black dark:border-white py-2 flex items-center focus-within:border-[#B22222] dark:focus-within:border-[#E04D4D] transition-colors">
              <Mail className="w-4 h-4 text-black dark:text-white mr-3 shrink-0" />
              <input 
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@example.com"
                required
                className="w-full bg-transparent border-none outline-none text-base text-black dark:text-white placeholder:text-stone-500 dark:placeholder:text-stone-400 placeholder:italic font-sans font-medium"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="font-space-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-black dark:text-white">
              Password
            </label>
            <div className="relative border-b-2 border-black dark:border-white py-2 flex items-center focus-within:border-[#B22222] dark:focus-within:border-[#E04D4D] transition-colors">
              <Lock className="w-4 h-4 text-black dark:text-white mr-3 shrink-0" />
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
                className="w-full bg-transparent border-none outline-none text-base text-black dark:text-white placeholder:text-stone-500 dark:placeholder:text-stone-400 placeholder:italic font-sans font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 cursor-pointer text-black dark:text-white hover:text-[#B22222] dark:hover:text-[#E04D4D] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Forgot button moved below the horizontal line of password */}
            {!isSignUp && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-space-mono text-xs font-bold text-black dark:text-white underline hover:text-[#B22222] dark:hover:text-[#E04D4D] cursor-pointer transition-colors"
                >
                  Forgot?
                </button>
              </div>
            )}
          </div>

          {/* Terms and Privacy agreement checkbox */}
          <div 
            onClick={() => {
              setAgreedToTerms(!agreedToTerms);
              if (errorMessage && errorMessage.includes('agree to our Terms')) {
                setErrorMessage(null);
              }
            }}
            className="flex gap-3 text-xs text-black dark:text-white leading-relaxed cursor-pointer select-none group mt-1 font-medium"
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
            <div className={`w-4 h-4 border-2 border-black dark:border-white flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${agreedToTerms ? 'bg-black dark:bg-white' : 'bg-transparent'}`}>
              {agreedToTerms && (
                <svg className="w-3 h-3 text-white dark:text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>
              I agree to the{' '}
              <Link to="/terms" onClick={(e) => e.stopPropagation()} className="text-black dark:text-white underline font-bold hover:text-[#B22222] dark:hover:text-[#E04D4D]">
                Terms of service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="text-black dark:text-white underline font-bold hover:text-[#B22222] dark:hover:text-[#E04D4D]">
                Privacy policy
              </Link>
            </span>
          </div>

          {/* Button stack */}
          <div className="flex flex-col gap-3 mt-2">
            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black hover:bg-stone-900 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-black border-none p-3.5 font-sans font-bold text-xs sm:text-sm uppercase tracking-[0.1em] cursor-pointer flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60"
              id="signin-submit-btn"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m10 17 5-5-5-5"></path>
                    <path d="M15 12H3"></path>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  </svg>
                  <span className="font-lora font-medium tracking-normal normal-case text-sm sm:text-base">{isSignUp ? 'Create account' : 'Sign in'}</span>
                </>
              )}
            </button>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting}
              className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/10 border-2 border-black dark:border-white text-black dark:text-white p-3 font-sans font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60"
              id="signin-google-btn"
            >
              {isGoogleSubmitting ? (
                <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <footer className="mt-10 sm:mt-12 text-center">
          <p className="text-xs text-black dark:text-stone-200 mb-6 font-sans font-semibold">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setPassword('');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="font-bold text-[#B22222] dark:text-[#E04D4D] underline cursor-pointer ml-1"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>

          <p className="font-space-mono text-[0.65rem] text-black dark:text-stone-300 font-bold uppercase tracking-[0.1em]">
            © 2026 Current News Live • Autonomous Press Alliance
          </p>
        </footer>
      </main>
    </div>
  );
}
