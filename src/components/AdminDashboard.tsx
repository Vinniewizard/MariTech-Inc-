import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, DollarSign, ArrowDownCircle } from 'lucide-react';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

interface User {
  id: string;
  email: string;
  fullName: string;
  demoBalance: number;
  realBalance: number;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalDeposits: number;
  totalDepositsCount: number;
  totalWithdrawals: number;
  topDepositAmount: number;
}

interface PendingDeposit {
  id: string;
  userId: string;
  amount: number;
  receiptPath?: string;
  message?: string;
  status: string;
  createdAt: string;
}

interface GameSettings {
  globalTrendBias: number;
  forceOutcome?: 'win' | 'loss' | '';
  volatilityMultiplier: number;
}

export default function AdminDashboard({ isOpen, onClose, theme }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'deposits' | 'game'>('stats');
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings>({ globalTrendBias: 0, volatilityMultiplier: 1 });
  const [isGameLoading, setIsGameLoading] = useState(false);

  const fetchData = async (key: string) => {
    setLoading(true);
    try {
      const [usersRes, statsRes, pendingRes, gameRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/stats', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/pending-deposits', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/game-settings', { headers: { 'x-admin-key': key } })
      ]);

      if (usersRes.ok && statsRes.ok) {
        const usersData = await usersRes.json();
        const statsData = await statsRes.json();
        const pendingData = await pendingRes.json();
        const gameData = await gameRes.json();

        setUsers(usersData.users);
        setStats(statsData.stats);
        setPendingDeposits(pendingData.deposits || []);
        setGameSettings(gameData.settings || { globalTrendBias: 0, volatilityMultiplier: 1 });
        setIsAuthenticated(true);
      } else {
        alert('Invalid admin key');
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      alert('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDeposit = async (id: string, action: 'approve' | 'decline') => {
    if (!confirm(`Are you sure you want to ${action} this deposit?`)) return;

    try {
      const res = await fetch('/api/admin/process-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ depositId: id, action })
      });

      if (res.ok) {
        setPendingDeposits(prev => prev.filter(d => d.id !== id));
        // Refresh users and stats
        fetchData(adminKey);
      } else {
        alert('Failed to process deposit');
      }
    } catch (error) {
      console.error('Error processing deposit:', error);
    }
  };

  const handleUpdateGameSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGameLoading(true);
    try {
      const res = await fetch('/api/admin/game-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ settings: gameSettings })
      });

      if (res.ok) {
        alert('Game settings updated successfully');
      } else {
        alert('Failed to update game settings');
      }
    } catch (error) {
      console.error('Error updating game settings:', error);
    } finally {
      setIsGameLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(adminKey);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/45 p-4 transition-all backdrop-blur-sm">
      <div className={`relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-lg border shadow-2xl transition-all box-border p-6 ${
        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-black transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Admin Dashboard
        </h2>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-bold mb-2">Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin secret key"
                className={`w-full rounded px-3 py-2 border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-cyan-500'
                    : 'bg-white border-gray-200 text-black focus:border-cyan-500'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 rounded transition-all disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Access Admin Panel'}
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center space-x-2 border-b border-slate-800 mb-6 overflow-x-auto pb-2">
              {[
                { id: 'stats', label: 'Overview', icon: TrendingUp },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'deposits', label: 'Pending Deposits', icon: ArrowDownCircle },
                { id: 'game', label: 'Game Control', icon: DollarSign }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase transition-all rounded ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-white shadow-lg'
                      : 'text-slate-500 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.id === 'deposits' && pendingDeposits.length > 0 && (
                    <span className="bg-red-500 text-white text-[8px] px-1 rounded-full">{pendingDeposits.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {activeTab === 'stats' && stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Total Users</p>
                        <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      </div>
                      <Users className="h-6 w-6 text-cyan-500" />
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Total Deposits</p>
                        <p className="text-2xl font-bold">${stats.totalDeposits.toFixed(2)}</p>
                      </div>
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Deposit Count</p>
                        <p className="text-2xl font-bold">{stats.totalDepositsCount}</p>
                      </div>
                      <ArrowDownCircle className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Withdrawals</p>
                        <p className="text-2xl font-bold">{stats.totalWithdrawals}</p>
                      </div>
                      <TrendingUp className="h-6 w-6 text-violet-500" />
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Top Deposit</p>
                        <p className="text-2xl font-bold">${stats.topDepositAmount.toFixed(2)}</p>
                      </div>
                      <DollarSign className="h-6 w-6 text-cyan-500" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Registered Users</h3>
                  <div className="overflow-x-auto">
                    <table className={`w-full text-sm border-collapse border rounded-lg overflow-hidden ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                      <thead>
                        <tr className={theme === 'dark' ? 'bg-slate-900' : 'bg-gray-100'}>
                          <th className="border p-3 text-left font-bold">ID</th>
                          <th className="border p-3 text-left font-bold">Email</th>
                          <th className="border p-3 text-left font-bold">Name</th>
                          <th className="border p-3 text-right font-bold">Demo Balance</th>
                          <th className="border p-3 text-right font-bold">Real Balance</th>
                          <th className="border p-3 text-left font-bold">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className={theme === 'dark' ? 'hover:bg-slate-900/50' : 'hover:bg-gray-50'}>
                            <td className="border p-3 text-xs font-mono">{user.id.substring(0, 8)}...</td>
                            <td className="border p-3 text-xs">{user.email}</td>
                            <td className="border p-3 text-xs">{user.fullName}</td>
                            <td className="border p-3 text-right font-mono">${user.demoBalance.toFixed(2)}</td>
                            <td className="border p-3 text-right font-mono">${user.realBalance.toFixed(2)}</td>
                            <td className="border p-3 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'deposits' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Pending M-Pesa Deposits</h3>
                  {pendingDeposits.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-bold border border-slate-800 rounded-lg">
                      No pending deposits found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingDeposits.map(d => (
                        <div key={d.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/50 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">User ID / Email</p>
                              <p className="text-sm font-mono truncate max-w-[200px]">{d.userId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Amount</p>
                              <p className="text-lg font-bold text-green-500">${d.amount}</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Receipt Preview</p>
                            <a href={d.receiptPath} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-black rounded border border-slate-700 overflow-hidden group">
                              <img src={d.receiptPath} alt="Receipt" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold text-white uppercase">View Full Image</span>
                              </div>
                            </a>
                          </div>

                          {d.message && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Transaction Message</p>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700 max-h-24 overflow-y-auto">
                                <p className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap">{d.message}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleProcessDeposit(d.id, 'approve')}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-xs uppercase"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleProcessDeposit(d.id, 'decline')}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-xs uppercase"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'game' && (
                <div className="max-w-2xl space-y-6">
                  <div className="border border-slate-800 rounded-lg p-6 bg-slate-900 shadow-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-cyan-500">
                      <TrendingUp className="h-5 w-5" />
                      Global Market Control
                    </h3>
                    
                    <form onSubmit={handleUpdateGameSettings} className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold uppercase text-slate-400">Market Bias (Trend)</label>
                          <span className={`text-xs font-bold ${gameSettings.globalTrendBias > 0 ? 'text-green-500' : gameSettings.globalTrendBias < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {gameSettings.globalTrendBias > 0 ? 'Bullish' : gameSettings.globalTrendBias < 0 ? 'Bearish' : 'Neutral'} ({gameSettings.globalTrendBias})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-0.05"
                          max="0.05"
                          step="0.001"
                          value={gameSettings.globalTrendBias}
                          onChange={(e) => setGameSettings({...gameSettings, globalTrendBias: parseFloat(e.target.value)})}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase">
                          <span>Heavy Sell</span>
                          <span>Neutral</span>
                          <span>Heavy Buy</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold uppercase text-slate-400">Volatility Multiplier</label>
                          <span className="text-xs font-bold text-white">{gameSettings.volatilityMultiplier}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={gameSettings.volatilityMultiplier}
                          onChange={(e) => setGameSettings({...gameSettings, volatilityMultiplier: parseFloat(e.target.value)})}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-400">Force Global Outcome</label>
                        <select
                          value={gameSettings.forceOutcome || ''}
                          onChange={(e) => setGameSettings({...gameSettings, forceOutcome: e.target.value as any})}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-bold text-white outline-none focus:border-cyan-500 transition-all"
                        >
                          <option value="">No Override (Natural Market)</option>
                          <option value="win">Force WIN for all users</option>
                          <option value="loss">Force LOSS for all users</option>
                        </select>
                        <p className="text-[9px] text-slate-500 italic">
                          Warning: Forcing outcomes will override technical price settlement logic.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isGameLoading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isGameLoading ? 'Updating System...' : 'Deploy Global Market Settings'}
                      </button>
                    </form>
                  </div>

                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <p className="text-[10px] text-amber-200/80 leading-relaxed">
                      <strong>Admin Protocol:</strong> Changes deployed here affect all active symbols real-time. Market Bias adds drift to the price generation algorithm. Forcing outcomes will manipulate final contract settlements regardless of the visible price at expiration.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setIsAuthenticated(false);
                setAdminKey('');
              }}
              className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-all"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
