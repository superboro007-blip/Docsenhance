import React from 'react';
import { StudioTab } from '../types';
import { Camera, CreditCard, FileText, Printer, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <header className="glass border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl bg-slate-900/60 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('passport')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md accent-glow">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">Passport & ID Studio</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Pro Print
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                36-Photo A4 Grid • AI ID Side Detector • CR-80 & Document Prints
              </p>
            </div>
          </div>

          {/* Navigation Tabs in Frosted Pill Container */}
          <nav className="flex items-center gap-1 bg-black/30 p-1 rounded-full border border-white/10">
            {/* Tab 1: Passport Studio */}
            <button
              onClick={() => onSelectTab('passport')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'passport'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Camera className={`w-3.5 h-3.5 ${activeTab === 'passport' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>Passport Photo</span>
              <span className="hidden md:inline-block text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-bold border border-blue-500/30">
                36 Grid
              </span>
            </button>

            {/* Tab 2: ID Card Studio */}
            <button
              onClick={() => onSelectTab('idcard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'idcard'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'idcard' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>ID Card</span>
              <span className="hidden md:inline-block text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-bold border border-emerald-500/30">
                Front/Back
              </span>
            </button>

            {/* Tab 3: Document Studio */}
            <button
              onClick={() => onSelectTab('document')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'document'
                  ? 'bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'document' ? 'text-purple-400' : 'text-slate-400'}`} />
              <span>Documents</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
