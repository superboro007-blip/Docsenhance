import React from 'react';
import { StudioTab } from '../types';
import { Camera, CreditCard, FileText, Printer, Sparkles, LogOut, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const { currentUser, logout } = useAuth();

  return (
    <header className="glass border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl bg-slate-900/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => onSelectTab('passport')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md accent-glow">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">Passport & ID Studio</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hidden sm:inline-block">
                  Pro Print
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                36-Photo A4 Grid • Dual-Sided ID Cards • Document Print
              </p>
            </div>
          </div>

          {/* Navigation Tabs in Frosted Pill Container */}
          <nav className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/10 shrink-0">
            {/* Tab 1: Passport Studio */}
            <button
              onClick={() => onSelectTab('passport')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'passport'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Camera className={`w-3.5 h-3.5 ${activeTab === 'passport' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Passport Photo</span>
              <span className="hidden lg:inline-block text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-bold border border-blue-500/30">
                36 Grid
              </span>
            </button>

            {/* Tab 2: ID Card Studio */}
            <button
              onClick={() => onSelectTab('idcard')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'idcard'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'idcard' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>ID Card</span>
              <span className="hidden lg:inline-block text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-bold border border-emerald-500/30">
                Front/Back
              </span>
            </button>

            {/* Tab 3: Document Studio */}
            <button
              onClick={() => onSelectTab('document')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'document'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'document' ? 'text-purple-400' : 'text-slate-400'}`} />
              <span>Documents</span>
            </button>
          </nav>

          {/* User Account Info & Always-Visible Logout Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-black/30 border border-white/10 text-xs">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-[11px] font-bold">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-200 leading-tight max-w-[110px] truncate text-[11px]">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[9px] text-emerald-400 flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>{currentUser.twoFactorEnabled ? '2FA Verified' : 'Standard'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Logout option always visible for security */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 text-xs font-semibold transition-all shadow-sm cursor-pointer hover:border-red-400/50"
              title="Logout from session"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

