import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppUser, AuthSession } from '../types';

interface AuthContextType {
  currentUser: AppUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  is2FAPending: boolean;
  pendingUser: AppUser | null;
  currentOTP: string | null;
  otpExpiresAt: number | null;
  globalStatusMessage: string | null;
  login: (usernameOrEmail: string, password: string, enable2FAOverride?: boolean) => { success: boolean; error?: string; requires2FA?: boolean };
  verifyOTP: (otpCode: string) => { success: boolean; error?: string };
  resendOTP: () => { success: boolean; newOTP: string; message?: string; error?: string };
  register: (fullName: string, email: string, password: string, confirmPassword: string, enable2FA: boolean) => { success: boolean; error?: string };
  logout: () => void;
  resetPasswordRequest: (emailOrUsername: string) => { success: boolean; message?: string; error?: string };
  clearGlobalStatus: () => void;
  setGlobalStatusMessage: (msg: string | null) => void;
}

const USERS_STORAGE_KEY = 'passport_studio_users_v1';
const SESSION_STORAGE_KEY = 'passport_studio_session_v1';

// Default initial seeded users
const INITIAL_USERS: AppUser[] = [
  {
    id: 'user_admin_01',
    fullName: 'Studio Administrator',
    email: 'admin@passportstudio.com',
    username: 'admin',
    passwordHash: 'Admin@2026!',
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
    failedLoginAttempts: 0,
    isLocked: false,
  },
  {
    id: 'user_demo_02',
    fullName: 'Sarah Jenkins',
    email: 'sarah.j@example.com',
    username: 'sarah',
    passwordHash: 'Photo@2026#',
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
    failedLoginAttempts: 0,
    isLocked: false,
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading users from storage:', e);
    }
    return INITIAL_USERS;
  });

  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed: AuthSession = JSON.parse(saved);
        if (parsed && parsed.user && parsed.is2FAVerified) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading session from storage:', e);
    }
    return null;
  });

  const [is2FAPending, setIs2FAPending] = useState<boolean>(false);
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [currentOTP, setCurrentOTP] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [globalStatusMessage, setGlobalStatusMessage] = useState<string | null>(null);

  // Save users to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to storage:', e);
    }
  }, [users]);

  // Save session to localStorage
  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Error saving session to storage:', e);
    }
  }, [session]);

  const generate6DigitOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const login = (
    usernameOrEmail: string,
    password: string,
    enable2FAOverride?: boolean
  ): { success: boolean; error?: string; requires2FA?: boolean } => {
    const trimmedInput = usernameOrEmail.trim().toLowerCase();

    if (!trimmedInput || !password) {
      return { success: false, error: 'Invalid username or password.' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    const matchedUser = users.find(
      (u) =>
        u.email.toLowerCase() === trimmedInput ||
        u.username.toLowerCase() === trimmedInput
    );

    if (!matchedUser) {
      return { success: false, error: 'Account not found. Please register.' };
    }

    if (matchedUser.isLocked) {
      return { success: false, error: 'Your account is locked. Contact support.' };
    }

    if (matchedUser.failedLoginAttempts >= 5) {
      // Lock user account
      setUsers((prev) =>
        prev.map((u) => (u.id === matchedUser.id ? { ...u, isLocked: true } : u))
      );
      return { success: false, error: 'Too many failed attempts. Try again later.' };
    }

    // Verify password
    if (matchedUser.passwordHash !== password) {
      const newAttempts = matchedUser.failedLoginAttempts + 1;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === matchedUser.id
            ? { ...u, failedLoginAttempts: newAttempts, isLocked: newAttempts >= 5 }
            : u
        )
      );

      if (newAttempts >= 5) {
        return { success: false, error: 'Too many failed attempts. Try again later.' };
      }
      return { success: false, error: 'Invalid username or password.' };
    }

    // Reset failed attempts upon matching password
    setUsers((prev) =>
      prev.map((u) =>
        u.id === matchedUser.id
          ? {
              ...u,
              failedLoginAttempts: 0,
              lastLoginAt: new Date().toISOString(),
              twoFactorEnabled:
                enable2FAOverride !== undefined ? enable2FAOverride : u.twoFactorEnabled,
            }
          : u
      )
    );

    const requires2FA =
      enable2FAOverride !== undefined
        ? enable2FAOverride
        : matchedUser.twoFactorEnabled;

    if (requires2FA) {
      const otp = generate6DigitOTP();
      const expires = Date.now() + 60 * 1000; // 60 seconds expiry
      setPendingUser(matchedUser);
      setIs2FAPending(true);
      setCurrentOTP(otp);
      setOtpExpiresAt(expires);
      return { success: true, requires2FA: true };
    }

    // Direct Login Successful
    const newSession: AuthSession = {
      user: matchedUser,
      token: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginTime: new Date().toISOString(),
      is2FAVerified: true,
    };
    setSession(newSession);
    setGlobalStatusMessage('Login successful. Redirecting to dashboard…');
    return { success: true, requires2FA: false };
  };

  const verifyOTP = (otpCode: string): { success: boolean; error?: string } => {
    if (!is2FAPending || !pendingUser) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    if (otpExpiresAt && Date.now() > otpExpiresAt) {
      return { success: false, error: 'OTP expired. Request a new one.' };
    }

    if (otpCode.trim() !== currentOTP) {
      return { success: false, error: 'Invalid OTP. Please try again.' };
    }

    // 2FA Verified!
    const newSession: AuthSession = {
      user: pendingUser,
      token: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginTime: new Date().toISOString(),
      is2FAVerified: true,
    };
    setSession(newSession);
    setIs2FAPending(false);
    setPendingUser(null);
    setCurrentOTP(null);
    setOtpExpiresAt(null);
    setGlobalStatusMessage('Verification successful. Redirecting…');
    return { success: true };
  };

  const resendOTP = (): { success: boolean; newOTP: string; message?: string; error?: string } => {
    if (!pendingUser) {
      return { success: false, newOTP: '', error: 'Session expired. Please log in again.' };
    }

    const newOtp = generate6DigitOTP();
    const expires = Date.now() + 60 * 1000;
    setCurrentOTP(newOtp);
    setOtpExpiresAt(expires);
    return { success: true, newOTP: newOtp, message: 'A new OTP has been sent.' };
  };

  const register = (
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string,
    enable2FA: boolean
  ): { success: boolean; error?: string } => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Invalid email format.' };
    }

    // Check if email already registered
    const exists = users.some((u) => u.email.toLowerCase() === trimmedEmail);
    if (exists) {
      return { success: false, error: 'Email already registered.' };
    }

    // Check password length
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    // Check password complexity (letters, numbers, symbols)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

    if (!hasLetter || !hasNumber || !hasSymbol) {
      return {
        success: false,
        error: 'Password must include letters, numbers, and symbols.',
      };
    }

    // Check passwords match
    if (password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }

    const usernameGenerated =
      trimmedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || `user_${Date.now()}`;

    const newUser: AppUser = {
      id: `user_${Date.now()}`,
      fullName: trimmedName || 'Studio User',
      email: trimmedEmail,
      username: usernameGenerated,
      passwordHash: password,
      twoFactorEnabled: enable2FA,
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      isLocked: false,
    };

    setUsers((prev) => [...prev, newUser]);
    setGlobalStatusMessage('Registration complete. Please log in.');
    return { success: true };
  };

  const logout = () => {
    setSession(null);
    setIs2FAPending(false);
    setPendingUser(null);
    setCurrentOTP(null);
    setOtpExpiresAt(null);
    setGlobalStatusMessage('You have been logged out successfully.');
  };

  const resetPasswordRequest = (
    emailOrUsername: string
  ): { success: boolean; message?: string; error?: string } => {
    const trimmed = emailOrUsername.trim().toLowerCase();
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === trimmed || u.username.toLowerCase() === trimmed
    );
    if (!user) {
      return { success: false, error: 'Account not found. Please register.' };
    }
    // Unlock and generate temp recovery code
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isLocked: false, failedLoginAttempts: 0 } : u))
    );
    return {
      success: true,
      message: `Password reset link & temporary access token sent to ${user.email}. (Demo password is: ${user.passwordHash})`,
    };
  };

  const clearGlobalStatus = () => {
    setGlobalStatusMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser: session?.user || null,
        session,
        isAuthenticated: !!session && session.is2FAVerified,
        is2FAPending,
        pendingUser,
        currentOTP,
        otpExpiresAt,
        globalStatusMessage,
        login,
        verifyOTP,
        resendOTP,
        register,
        logout,
        resetPasswordRequest,
        clearGlobalStatus,
        setGlobalStatusMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
