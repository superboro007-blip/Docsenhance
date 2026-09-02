import React, { useState } from 'react';
import { StudioTab } from './types';
import { Navbar } from './components/Navbar';
import { PassportStudio } from './components/PassportStudio';
import { IDCardStudio } from './components/IDCardStudio';
import { DocumentStudio } from './components/DocumentStudio';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

function StudioDashboard() {
  const [activeTab, setActiveTab] = useState<StudioTab>('passport');
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div
      className="min-h-screen text-slate-200 flex flex-col font-sans antialiased selection:bg-blue-500/30 selection:text-white"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: 'var(--mesh-gradient)',
      }}
    >
      {/* Top Frosted Navbar with Tab Switching & Always-Visible Logout */}
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'passport' && (
            <motion.div
              key="passport"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <PassportStudio />
            </motion.div>
          )}

          {activeTab === 'idcard' && (
            <motion.div
              key="idcard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <IDCardStudio />
            </motion.div>
          )}

          {activeTab === 'document' && (
            <motion.div
              key="document"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <DocumentStudio />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Frosted Modern Footer */}
      <footer className="border-t border-white/10 glass py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Passport & ID Photo Studio • Ready for 300 DPI High-Resolution Physical Print & PDF</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('passport')}
              className={`transition-colors hover:text-blue-400 ${activeTab === 'passport' ? 'text-blue-400 font-semibold' : ''}`}
            >
              Passport (36 A4 Grid)
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('idcard')}
              className={`transition-colors hover:text-emerald-400 ${activeTab === 'idcard' ? 'text-emerald-400 font-semibold' : ''}`}
            >
              ID Cards (Front & Back)
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('document')}
              className={`transition-colors hover:text-purple-400 ${activeTab === 'document' ? 'text-purple-400 font-semibold' : ''}`}
            >
              Documents
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StudioDashboard />
    </AuthProvider>
  );
}

