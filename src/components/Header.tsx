import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown, Coins, HelpCircle, History, Moon, Sun, RefreshCw, Layers } from 'lucide-react';
import { Account } from '../types';

interface HeaderProps {
  account: Account;
  onSwitchAccount: (mode: 'demo' | 'real') => void;
  onResetDemo: () => void;
  onOpenCashier: () => void;
  onOpenGuide: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeView: 'trade' | 'history' | 'stats';
  onSwitchView: (view: 'trade' | 'history' | 'stats') => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  currentUser?: any;
}

export default function Header({
  account,
  onSwitchAccount,
  onResetDemo,
  onOpenCashier,
  onOpenGuide,
  theme,
  onToggleTheme,
  activeView,
  onSwitchView,
  onOpenSettings,
  onOpenAuth,
  currentUser
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatBalance = (bal: number) => {
    return bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <header className={`sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b px-3 sm:px-6 transition-colors duration-200 gap-2 overflow-x-auto ${
      theme === 'dark' ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
    }`}>
      {/* Brand Logo & Core navigation */}
      <div className="flex items-center space-x-2 sm:space-x-8 flex-shrink-0">
        <div className="flex items-center space-x-1 sm:space-x-2 cursor-pointer flex-shrink-0" onClick={() => onSwitchView('trade')}>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-black rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold italic text-sm">M</span>
          </div>
          <div className="hidden sm:block">
            <span className={`text-xs sm:text-base font-bold tracking-tight ${theme === 'dark' ? 'text-zinc-50' : 'text-black'}`}>
              MARITECH <span className="font-normal opacity-50">INC.</span>
            </span>
          </div>
        </div>

        {/* View Selection Tabs */}
        <nav className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => onSwitchView('trade')}
            className={`text-sm font-medium py-5 transition-all scroll-smooth cursor-pointer ${
              activeView === 'trade'
                ? theme === 'dark' ? 'border-b-2 border-white text-white' : 'border-b-2 border-black text-black'
                : 'text-gray-405 hover:text-black'
            }`}
          >
            <span>Trader</span>
          </button>
          <button
            onClick={() => onSwitchView('history')}
            className={`text-sm font-medium py-5 transition-all scroll-smooth cursor-pointer ${
              activeView === 'history'
                ? theme === 'dark' ? 'border-b-2 border-white text-white' : 'border-b-2 border-black text-black'
                : 'text-gray-405 hover:text-black'
            }`}
          >
            <span>Reports</span>
          </button>
          <button
            onClick={onOpenGuide}
            className={`text-sm font-medium py-5 text-gray-450 hover:text-black cursor-pointer`}
          >
            <span>Platform Academy</span>
          </button>
        </nav>
      </div>

      {/* Center - Real-time UTC standard clock */}
      <div className={`hidden lg:flex items-center space-x-2 rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
        theme === 'dark' ? 'bg-zinc-900/50 text-zinc-400 border border-zinc-800/40' : 'bg-gray-50 text-gray-450 border border-gray-100'
      }`}>
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        <span>UTC {time.toISOString().replace('T', ' ').substring(0, 19)}</span>
      </div>

      {/* Right - Controls and Account Selector */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-auto">
        {/* Theme toggle Button */}
        <button
          onClick={onToggleTheme}
          className={`rounded-lg p-1 sm:p-1.5 transition-colors flex-shrink-0 ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-900/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-brand-accent shadow-[0_0_10px_rgba(245,158,11,0.3)]" /> : <Moon className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-indigo-500" />}
        </button>

        {/* Total balance displays */}
        <div className="text-right hidden sm:flex flex-col justify-center flex-shrink-0">
          <div className="text-[8px] uppercase tracking-wider text-gray-400 font-bold">Total Balance</div>
          <div className={`text-xs sm:text-sm font-mono font-black tracking-tight ${theme === 'dark' ? 'text-zinc-50' : 'text-black'}`}>
            ${formatBalance(account.balance)}
          </div>
        </div>

        {/* Interactive Account Hub */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`flex items-center space-x-1 rounded-md px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold transition-all cursor-pointer select-none border flex-shrink-0 ${
              theme === 'dark'
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-850'
                : 'bg-white border-gray-200 text-black hover:bg-gray-50'
            }`}
          >
            <span className="hidden sm:inline">{account.mode === 'demo' ? 'DEMO' : 'REAL'}</span>
            <span className="sm:hidden">{account.mode === 'demo' ? 'D' : 'R'}</span>
            <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Account selector dropdown menu */}
          {showDropdown && (
            <div className={`absolute right-0 mt-2 w-64 rounded-xl p-3 shadow-2xl z-50 ring-1 ring-black/10 border ${
              theme === 'dark' ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-gray-200 bg-white text-[#111827]'
            }`}>
              <div className="text-[10px] font-bold text-gray-450 uppercase pb-2 mb-2 border-b border-gray-100 select-none">
                Select Wallet Type
              </div>

              {/* DEMO CONTAINER */}
              <div
                onClick={() => {
                  onSwitchAccount('demo');
                  setShowDropdown(false);
                }}
                className={`group flex items-center justify-between rounded-lg p-2.5 cursor-pointer transition-all ${
                  account.mode === 'demo'
                    ? theme === 'dark' ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-50 border border-gray-100'
                    : theme === 'dark' ? 'hover:bg-zinc-900/55' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-bold">Demo Account</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    USD {account.mode === 'demo' ? formatBalance(account.balance) : '10,000.00'}
                  </span>
                </div>
                {account.mode === 'demo' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetDemo();
                    }}
                    className={`rounded-md p-1.5 transition-all ${theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-400 hover:bg-gray-200'}`}
                    title="Replenish Virtual Funds ($10,000)"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* REAL CONTAINER */}
              <div
                onClick={() => {
                  onSwitchAccount('real');
                  setShowDropdown(false);
                }}
                className={`mt-1.5 group flex items-center justify-between rounded-lg p-2.5 cursor-pointer transition-all ${
                  account.mode === 'real'
                    ? theme === 'dark' ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-50 border border-gray-100'
                    : theme === 'dark' ? 'hover:bg-zinc-900/55' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-bold">Real Account</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    USD {account.mode === 'real' ? formatBalance(account.balance) : '0.00'}
                  </span>
                </div>
                <span className="text-[9px] font-bold rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-sans tracking-wide">
                  Live
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sleek cashier action BUTTON */}
        <button
          onClick={() => {
            if (!currentUser) {
              onOpenAuth();
              return;
            }
            onOpenCashier();
          }}
          disabled={false}
          className={`px-2 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-black/10 active:scale-95 flex-shrink-0 ${
            currentUser
              ? 'bg-slate-900 hover:bg-black text-white'
              : 'bg-gray-300 text-gray-500 hover:bg-gray-400'
          }`}
          title={currentUser ? 'Open Cashier' : 'Login required to access Cashier'}
        >
          <span>{currentUser ? 'Cashier' : 'Login'}</span>
        </button>

        {/* Settings button - added after Cashier */}
        <button
          onClick={onOpenSettings}
          className={`rounded-md p-1.5 sm:p-2 transition-all cursor-pointer border flex-shrink-0 ${
            theme === 'dark' 
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' 
              : 'bg-white border-gray-200 text-gray-500 hover:text-black hover:bg-gray-50'
          }`}
          title="Personal Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
        </button>

        {/* Auth button */}
        {!currentUser && (
          <button
            onClick={onOpenAuth}
            className="rounded-lg px-2 sm:px-5 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 active:scale-95 flex-shrink-0"
          >
            <span className="hidden sm:inline">Sign In</span>
            <span className="sm:hidden">Sign</span>
          </button>
        )}
      </div>
    </header>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
