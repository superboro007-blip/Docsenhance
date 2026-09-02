import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Camera,
  Check,
  Copy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

type AuthViewMode = 'login' | 'register' | '2fa' | 'forgot_password';

export const AuthScreen: React.FC = () => {
  const {
    login,
    register,
    verifyOTP,
    resendOTP,
    resetPasswordRequest,
    is2FAPending,
    pendingUser,
    currentOTP,
    otpExpiresAt,
    globalStatusMessage,
    clearGlobalStatus,
  } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>('login');

  // Sync mode with is2FAPending
  useEffect(() => {
    if (is2FAPending) {
      setMode('2fa');
    }
  }, [is2FAPending]);

  // Form states - Login
  const [loginIdentifier, setLoginIdentifier] = useState('admin@passportstudio.com');
  const [loginPassword, setLoginPassword] = useState('Admin@2026!');
  const [loginEnable2FA, setLoginEnable2FA] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states - Register
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regEnable2FA, setRegEnable2FA] = useState(true);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Form states - 2FA OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpTimerSeconds, setOtpTimerSeconds] = useState(60);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Form states - Forgot Password
  const [forgotIdentifier, setForgotIdentifier] = useState('');

  // UI status & Error feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    if (mode === '2fa' && otpExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
        setOtpTimerSeconds(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mode, otpExpiresAt]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    clearGlobalStatus();
  };

  // Quick fill helper for demo accounts
  const handleFillDemo = (type: 'admin_2fa' | 'user_direct') => {
    clearMessages();
    setMode('login');
    if (type === 'admin_2fa') {
      setLoginIdentifier('admin@passportstudio.com');
      setLoginPassword('Admin@2026!');
      setLoginEnable2FA(true);
    } else {
      setLoginIdentifier('sarah.j@example.com');
      setLoginPassword('Photo@2026#');
      setLoginEnable2FA(false);
    }
  };

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    setTimeout(() => {
      const result = login(loginIdentifier, loginPassword, loginEnable2FA);
      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Invalid username or password.');
      } else if (result.requires2FA) {
        setSuccessMessage('Credentials accepted. Please complete Two-Factor Authentication.');
        setMode('2fa');
      } else {
        setSuccessMessage('Login successful. Redirecting to dashboard…');
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch {
          // ignore confetti
        }
      }
    }, 450);
  };

  // Registration handler
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    setTimeout(() => {
      const result = register(
        regFullName,
        regEmail,
        regPassword,
        regConfirmPassword,
        regEnable2FA
      );
      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Registration failed.');
      } else {
        setSuccessMessage('Registration complete. Please log in.');
        setLoginIdentifier(regEmail);
        setLoginPassword(regPassword);
        setLoginEnable2FA(regEnable2FA);
        setMode('login');
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }
    }, 450);
  };

  // 2FA OTP verification handler
  const handleVerifyOTP = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearMessages();
    setIsLoading(true);

    setTimeout(() => {
      const result = verifyOTP(otpCode);
      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Invalid OTP. Please try again.');
      } else {
        setSuccessMessage('Verification successful. Redirecting…');
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }
    }, 450);
  };

  // Resend OTP handler
  const handleResendOTP = () => {
    clearMessages();
    const result = resendOTP();
    if (result.success) {
      setSuccessMessage('New OTP sent. Please check your authenticator code below.');
      setOtpCode('');
    } else {
      setErrorMessage(result.error || 'OTP expired. Request a new one.');
    }
  };

  // Forgot password handler
  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    setTimeout(() => {
      const result = resetPasswordRequest(forgotIdentifier);
      setIsLoading(false);
      if (!result.success) {
        setErrorMessage(result.error || 'Account not found. Please register.');
      } else {
        setSuccessMessage(result.message || 'Password reset link sent.');
      }
    }, 450);
  };

  const handleCopyOtp = () => {
    if (currentOTP) {
      navigator.clipboard.writeText(currentOTP);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const handleAutoFillOtp = () => {
    if (currentOTP) {
      setOtpCode(currentOTP);
    }
  };

  // Calculate password strength
  const hasMinLength = regPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(regPassword);
  const passwordMatch = regPassword.length > 0 && regPassword === regConfirmPassword;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-500/30 selection:text-white"
      style={{
        backgroundColor: '#0a0f1d',
        backgroundImage:
          'radial-gradient(at 15% 15%, rgba(59, 130, 246, 0.18) 0px, transparent 55%), radial-gradient(at 85% 85%, rgba(99, 102, 241, 0.18) 0px, transparent 55%), radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.95) 0px, #070b14 100%)',
      }}
    >
      {/* Decorative Grid Lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-blue-500/20 mb-1 border border-white/20">
            <Camera className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Passport & ID Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Professional 36-Grid Passport Photos & Dual-Sided ID Printing Workspace
          </p>
        </div>

        {/* Global Security Prompt Card */}
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 backdrop-blur-xl text-xs text-slate-300 leading-relaxed shadow-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-200 block text-sm mb-1">
              🔐 Web App Prompt with Credentials
            </span>
            <p className="text-slate-300">
              "Please log in with your credentials to access the web app. Enter your username and
              password to continue. If you don’t have an account, register to create one. For added
              security, two-factor authentication is available."
            </p>
          </div>
        </div>

        {/* Main Auth Card Container */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-2xl shadow-2xl relative">
          {/* Notification Messages */}
          <AnimatePresence>
            {(errorMessage || globalStatusMessage?.includes('expired') || globalStatusMessage?.includes('logged out')) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 font-medium"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage || globalStatusMessage}</span>
              </motion.div>
            )}

            {(successMessage || (globalStatusMessage && !globalStatusMessage.includes('expired') && !globalStatusMessage.includes('logged out'))) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage || globalStatusMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIEW 1: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400" />
                    Account Login
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Enter your credentials to continue</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode('register');
                  }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4"
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Username / Email Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Username / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="admin@passportstudio.com or username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        clearMessages();
                        setMode('forgot_password');
                        setForgotIdentifier(loginIdentifier);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter at least 8 characters"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Enable Two-Factor Authentication Checkbox */}
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 flex items-center justify-between">
                  <label
                    htmlFor="enable-2fa-login"
                    className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer select-none"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>Enable Two-Factor Authentication</span>
                  </label>
                  <input
                    id="enable-2fa-login"
                    type="checkbox"
                    checked={loginEnable2FA}
                    onChange={(e) => setLoginEnable2FA(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-white/20 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Log In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Log In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Credentials Autofill Picker */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  ⚡ 1-Click Demo Accounts:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFillDemo('admin_2fa')}
                    className="p-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-300">Admin Account</span>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">
                        2FA ON
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      admin@passportstudio.com
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Password: Admin@2026!</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillDemo('user_direct')}
                    className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-white/10 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Staff Account</span>
                      <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                        Direct
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      sarah.j@example.com
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Password: Photo@2026#</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: REGISTRATION */}
          {mode === 'register' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    Create New Account
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Join Passport & ID Studio Pro</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode('login');
                  }}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                >
                  Already have an account? Log In
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="alex.morgan@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Create Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Create Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 8 chars, letters, numbers, symbols"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 text-[11px] grid grid-cols-2 gap-2 text-slate-400">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-semibold' : ''}`}>
                    {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block" />}
                    <span>At least 8 chars</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLetter && hasNumber ? 'text-emerald-400 font-semibold' : ''}`}>
                    {hasLetter && hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block" />}
                    <span>Letters & Numbers</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-400 font-semibold' : ''}`}>
                    {hasSymbol ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block" />}
                    <span>Symbols (!@#$%)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordMatch ? 'text-emerald-400 font-semibold' : ''}`}>
                    {passwordMatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block" />}
                    <span>Passwords Match</span>
                  </div>
                </div>

                {/* Enable 2FA for new account */}
                <div className="p-3 bg-black/30 rounded-xl border border-white/10 flex items-center justify-between">
                  <label
                    htmlFor="enable-2fa-reg"
                    className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer select-none"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Enable Two-Factor Authentication</span>
                  </label>
                  <input
                    id="enable-2fa-reg"
                    type="checkbox"
                    checked={regEnable2FA}
                    onChange={(e) => setRegEnable2FA(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-white/20 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Register Account Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Register Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW 3: TWO-FACTOR AUTHENTICATION (OTP) */}
          {mode === '2fa' && (
            <div className="space-y-5">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                    Two-Factor Authentication
                  </h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    2FA Security
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  A verification code was generated for{' '}
                  <strong className="text-blue-300 font-semibold">{pendingUser?.email || 'your account'}</strong>.
                </p>
              </div>

              {/* Interactive OTP Simulation Notification Card */}
              {currentOTP && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-400/40 shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                      Authenticator / SMS Simulation
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      ⏱ {otpTimerSeconds}s left
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/10">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Your 6-Digit One-Time Code:
                      </div>
                      <div className="text-2xl font-mono font-extrabold text-white tracking-[0.25em]">
                        {currentOTP}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyOtp}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition-all"
                        title="Copy OTP"
                      >
                        {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoFillOtp}
                        className="py-2 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
                      >
                        Auto-fill
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                {/* Enter OTP */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full py-3 px-4 bg-black/50 border border-blue-500/40 rounded-xl text-center text-2xl font-mono font-extrabold text-white tracking-[0.3em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend OTP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setMode('login');
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel / Back to Login
                  </button>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW 4: FORGOT PASSWORD */}
          {mode === 'forgot_password' && (
            <div className="space-y-5">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  Forgot Password?
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your username or email address to recover your account
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Username / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="admin@passportstudio.com"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                  >
                    Send Recovery Token
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setMode('login');
                    }}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Back to Log In
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Security Footer Details */}
        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>AES-256 Encrypted Session • Compliant 2-Factor Authentication</span>
        </div>
      </div>
    </div>
  );
};
