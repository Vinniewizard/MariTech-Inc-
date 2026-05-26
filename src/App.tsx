import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Chart from './components/Chart';
import TradeControls from './components/TradeControls';
import PositionsList from './components/PositionsList';
import WizardBot from './components/WizardBot';
import CashierModal from './components/CashierModal';
import GuideModal from './components/GuideModal';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import { ASSETSList } from './data';
import { Asset, Tick, Contract, TradeHistoryItem, Account, IndicatorConfig } from './types';
import { Bot, HelpCircle, RefreshCw, Sparkles, TrendingUp, TrendingDown, Volume2, VolumeX } from 'lucide-react';

// Initialize asset history with realistic price walk
function initializeAssetHistory(assets: Asset[]): Record<string, Tick[]> {
  const initialHistory: Record<string, Tick[]> = {};
  const baseTime = Date.now();

  assets.forEach((asset) => {
    let currentPrice = asset.price;
    const tickHistory: Tick[] = [];

    // Prepopulate 120 historic ticks per index asset
    for (let i = 120; i >= 0; i--) {
      const walkFactor = (Math.random() - 0.5 + asset.trendBias) * 1.5;
      currentPrice = currentPrice * (1 + walkFactor * (asset.volatility / 100));
      tickHistory.push({
        time: baseTime - i * 1200,
        price: currentPrice
      });
    }
    initialHistory[asset.id] = tickHistory;
  });

  return initialHistory;
}

export default function App() {
  // Theme state: default sleek Light
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  // Account states
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('maritech_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [account, setAccount] = useState<Account>(() => {
    const saved = localStorage.getItem('maritech_account');
    if (saved) return JSON.parse(saved);
    return {
      mode: 'demo',
      balance: 10000.00,
      currency: 'USD',
      id: `m-ac-${Math.random().toString(36).substring(2, 10)}`
    };
  });
  const [realAccountBalance, setRealAccountBalance] = useState<number>(() => {
    return Number(localStorage.getItem('maritech_real_balance')) || 0.0;
  });

  // Layout Tab views
  const [activeTabView, setActiveTabView] = useState<'trade' | 'history' | 'stats'>('trade');
  const [positionsTab, setPositionsTab] = useState<'positions' | 'statements' | 'stats'>('positions');

  // Asset configurations
  const [activeAsset, setActiveAsset] = useState<Asset>(ASSETSList[0]);
  const [assetsRegistry, setAssetsRegistry] = useState<Asset[]>(ASSETSList);
  const [assetsTicksMap, setAssetsTicksMap] = useState<Record<string, Tick[]>>(() =>
    initializeAssetHistory(ASSETSList)
  );

  // Indicator Settings
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>({
    sma: { enabled: false, period: 10 },
    ema: { enabled: false, period: 20 },
    rsi: { enabled: false, period: 14 }
  });

  // Contracts & History Log portfolios
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>(() => {
    const saved = localStorage.getItem('maritech_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist state changes
  useEffect(() => {
    localStorage.setItem('maritech_account', JSON.stringify(account));
    localStorage.setItem('maritech_history', JSON.stringify(tradeHistory));
    localStorage.setItem('maritech_real_balance', String(realAccountBalance));
    if (currentUser) {
      localStorage.setItem('maritech_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('maritech_current_user');
    }
  }, [account, tradeHistory, realAccountBalance, currentUser]);

  // Modals & Panels Switches
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Floating notifications / toaster logs
  const [visualNotice, setVisualNotice] = useState<{ id: string; text: string; success: boolean } | null>(null);

  const triggerToast = (text: string, success: boolean) => {
    const id = Math.random().toString();
    setVisualNotice({ id, text, success });
    setTimeout(() => {
      setVisualNotice((prev) => (prev?.id === id ? null : prev));
    }, 4500);

    // Audio indicators if toggled
    if (soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (success) {
          // Harmonious Win code
          osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
        } else {
          // Melancholy Loss code
          osc.frequency.setValueAtTime(311.13, audioCtx.currentTime); // E-flat4
          osc.frequency.setValueAtTime(220.00, audioCtx.currentTime + 0.15); // A3
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
        }
      } catch (e) {
        console.warn('Simulated audio synthesize failed.', e);
      }
    }
  };

  // Switch Theme selector
  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Switchees Demowrithe wallets
  const handleSwitchAccount = (mode: 'demo' | 'real') => {
    if (mode === account.mode) return;
    setAccount((prev) => {
      const oldBalance = prev.balance;
      const targetBal = prev.mode === 'demo' ? oldBalance : account.balance;

      if (prev.mode === 'demo') {
        // Save demo balance, load real
        return { ...prev, mode: 'real', balance: realAccountBalance };
      } else {
        // Save real balance, load saved state or preset
        setRealAccountBalance(oldBalance);
        return { ...prev, mode: 'demo', balance: prev.balance === 0 ? 10000.00 : prev.balance };
      }
    });
    triggerToast(`Switched workspace to ${mode.toUpperCase()} sandbox mode.`, true);
  };

  // Reset demo tokens
  const handleResetDemoBalance = () => {
    if (account.mode !== 'demo') return;
    setAccount((prev) => ({ ...prev, balance: 10000.00 }));
    triggerToast("Your demo trade bag has been replenished with virtual $10,000.00!", true);
  };

  // Credit balance after server-side cashier verification
  const handleDepositCashier = (amount: number) => {
    setAccount((prev) => {
      const nextBal = prev.balance + amount;
      if (prev.mode === 'real') {
        setRealAccountBalance(nextBal);
      }
      return { ...prev, balance: nextBal };
    });
    triggerToast(`Deposited $${amount.toLocaleString()} into portfolio.`, true);
  };

  // Debit balance after server-side cashier dispatch
  const handleWithdrawCashier = (amount: number) => {
    setAccount((prev) => {
      const nextBal = Math.max(0, prev.balance - amount);
      if (prev.mode === 'real') {
        setRealAccountBalance(nextBal);
      }
      return { ...prev, balance: nextBal };
    });
    triggerToast(`Withdrew $${amount.toLocaleString()} from portfolio.`, true);
  };

  // Indicator Switch Toggles
  const handleToggleIndicator = (type: 'sma' | 'ema' | 'rsi') => {
    setIndicatorConfig((prev) => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled }
    }));
  };

  // Core background ticker generator loop
  useEffect(() => {
    const loopInterval = setInterval(() => {
      setAssetsTicksMap((prevTicksMap) => {
        const nextTicksMap = { ...prevTicksMap };
        const now = Date.now();

        assetsRegistry.forEach((asset) => {
          const currentHistory = prevTicksMap[asset.id] || [];
          if (currentHistory.length === 0) return;

          const lastTick = currentHistory[currentHistory.length - 1];

          // Brownian walk step with asset drift bias
          const walkFactor = (Math.random() - 0.5 + asset.trendBias) * 1.5;
          const nextPrice = lastTick.price * (1 + walkFactor * (asset.volatility / 100));

          const newTick: Tick = { time: now, price: nextPrice };
          const updatedHistory = [...currentHistory.slice(-300), newTick]; // keep performance bounded (max 300 ticks)

          nextTicksMap[asset.id] = updatedHistory;

          // Sync floating base price on the registry
          setAssetsRegistry((prevReg) =>
            prevReg.map((item) =>
              item.id === asset.id
                ? { ...item, price: nextPrice, change: lastTick ? ((nextPrice - asset.price) / asset.price) * 100 : item.change }
                : item
            )
          );

          // Update active contract metrics on the ticking target
          setActiveContracts((prevContracts) => {
            const indexMatchedContracts = prevContracts.filter((c) => c.assetId === asset.id);
            if (indexMatchedContracts.length === 0) return prevContracts;

            return prevContracts.map((contract) => {
              if (contract.assetId !== asset.id || contract.status !== 'active') return contract;

              const ticksPassed = contract.ticksPassed + 1;
              const isExpired = ticksPassed >= contract.duration;

              // Proximity checks for profit
              let currentProfit = 0;
              let status: 'active' | 'won' | 'lost' = 'active';

              // Determine Barrier levels
              const actualBarrier = contract.barrier || contract.entryPrice;

              if (contract.type === 'rise-fall') {
                const goingUp = contract.direction === 'rise';
                if (goingUp) {
                  currentProfit = nextPrice > contract.entryPrice ? contract.stake * 0.955 : -contract.stake;
                } else {
                  currentProfit = nextPrice < contract.entryPrice ? contract.stake * 0.955 : -contract.stake;
                }
              } else if (contract.type === 'higher-lower') {
                const isHigher = contract.direction === 'higher';
                if (isHigher) {
                  currentProfit = nextPrice > actualBarrier ? contract.stake * 0.955 : -contract.stake;
                } else {
                  currentProfit = nextPrice < actualBarrier ? contract.stake * 0.955 : -contract.stake;
                }
              } else if (contract.type === 'touch-no-touch') {
                const isTouch = contract.direction === 'touch';
                const hasTouched = isTouch
                  ? nextPrice >= actualBarrier
                  : nextPrice < actualBarrier; // simple trigger evaluation

                if (isTouch) {
                  // Win instantly on touch
                  if (hasTouched) {
                    currentProfit = contract.stake * 0.955;
                    status = 'won';
                  } else {
                    currentProfit = -contract.stake;
                  }
                } else {
                  // No touch loses if it touches
                  if (!hasTouched) {
                    currentProfit = -contract.stake;
                    status = 'lost';
                  } else {
                    currentProfit = contract.stake * 0.955;
                  }
                }
              } else if (contract.type === 'digit-over-under') {
                const lastDigit = parseInt(nextPrice.toFixed(asset.decimals).split('').pop() || '0');
                const isOver = contract.direction === 'over';
                const success = isOver 
                  ? lastDigit > (contract.targetDigit || 0)
                  : lastDigit < (contract.targetDigit || 0);
                
                currentProfit = success ? contract.stake * 0.90 : -contract.stake;
              }

              // Settle immediately on expiration or Touch win triggers
              if (isExpired || status !== 'active') {
                const finalStatus = status !== 'active' ? status : (currentProfit >= 0 ? 'won' : 'lost');
                const earned = finalStatus === 'won' ? contract.payout : 0;

                // credit payouts
                if ( earned > 0) {
                  setAccount((prevAcc) => ({ ...prevAcc, balance: prevAcc.balance + earned }));
                }

                // Add to statements history log
                setTradeHistory((prevHistory) => [
                  ...prevHistory,
                  {
                    id: contract.id,
                    assetName: contract.assetName,
                    assetSymbol: contract.assetSymbol,
                    type: contract.type,
                    direction: contract.direction,
                    stake: contract.stake,
                    payout: contract.payout,
                    profit: finalStatus === 'won' ? contract.payout - contract.stake : -contract.stake,
                    status: finalStatus,
                    entryPrice: contract.entryPrice,
                    exitPrice: nextPrice,
                    purchaseTime: contract.entryTime
                  }
                ]);

                // Flying alerts
                triggerToast(
                  finalStatus === 'won'
                    ? `Contract Succeeded! Cleared payout +$${contract.payout.toFixed(2)} on ${contract.assetSymbol}.`
                    : `Contract Expired. Loss -$${contract.stake.toFixed(2)} on ${contract.assetSymbol}.`,
                  finalStatus === 'won'
                );

                // return empty so filter removes it from loops
                return null as any;
              }

              // Early buyout calculations: 45% stake minimum if in loss, scaling with time
              const ratioRemaining = (contract.duration - ticksPassed) / contract.duration;
              const baseSell = contract.stake * 0.90;
              const sellPrice = currentProfit >= 0
                ? baseSell + currentProfit * (1 - ratioRemaining * 0.4)
                : Math.max(contract.stake * 0.15, baseSell * ratioRemaining);

              return {
                ...contract,
                currentPrice: nextPrice,
                currentProfit,
                ticksPassed,
                sellPrice,
                ticksHistory: [...contract.ticksHistory, newTick]
              };
            }).filter(Boolean);
          });
        });

        return nextTicksMap;
      });
    }, 1000);

    return () => clearInterval(loopInterval);
  }, [assetsRegistry]);

  const handlePurchaseContract = (config: {
    type: ContractType;
    direction: any;
    stake: number;
    duration: number;
    durationUnit: 'ticks' | 'seconds' | 'minutes';
    barrierOffset?: number;
    targetDigit?: number;
  }) => {
    // Standard balances verification
    if (account.balance < config.stake) {
      triggerToast("Transaction Rejected: Insufficient balance.", false);
      return;
    }

    const currentTickHistory = assetsTicksMap[activeAsset.id] || [];
    const latestPrice = currentTickHistory[currentTickHistory.length - 1]?.price || activeAsset.price;

    const payoutRate = 0.955;
    const targetPayout = config.stake * (1 + payoutRate);

    // Compute Barrier level if offset is provided
    let barrier: number | undefined;
    if (config.barrierOffset) {
      const isUpDir = config.direction === 'rise' || config.direction === 'higher' || config.direction === 'touch';
      barrier = isUpDir ? latestPrice + config.barrierOffset : latestPrice - config.barrierOffset;
    }

    const newContract: Contract = {
      id: `mt-${Math.random().toString(36).substring(2, 12)}`,
      assetId: activeAsset.id,
      assetName: activeAsset.name,
      assetSymbol: activeAsset.symbol,
      type: config.type,
      direction: config.direction,
      stake: config.stake,
      payout: targetPayout,
      basis: 'stake',
      barrier,
      barrierOffset: config.barrierOffset,
      entryPrice: latestPrice,
      entryTime: Date.now(),
      duration: config.duration,
      durationUnit: config.durationUnit,
      expiryTime: Date.now() + config.duration * 1000, // estimated seconds anchor
      status: 'active',
      currentPrice: latestPrice,
      currentProfit: 0,
      sellPrice: config.stake * 0.85,
      targetDigit: config.targetDigit,
      ticksPassed: 0,
      ticksHistory: [{ time: Date.now(), price: latestPrice }]
    };

    // Deduct stake instantly from live budget
    setAccount((prevAcc) => ({ ...prevAcc, balance: prevAcc.balance - config.stake }));
    setActiveContracts((prev) => [...prev, newContract]);

    triggerToast(`Options Contract secured: Purchased ${config.direction.toUpperCase()} on ${activeAsset.symbol}.`, true);
  };

  // Handle selling contract early (Early buyout / Cashout)
  const handleSellContractEarly = (contractId: string) => {
    const contract = activeContracts.find((c) => c.id === contractId);
    if (!contract || contract.status !== 'active') return;

    const refund = contract.sellPrice || contract.stake * 0.5;

    // Settle contract record
    setAccount((prevAcc) => ({ ...prevAcc, balance: prevAcc.balance + refund }));

    setTradeHistory((prevHistory) => [
      ...prevHistory,
      {
        id: contract.id,
        assetName: contract.assetName,
        assetSymbol: contract.assetSymbol,
        type: contract.type,
        direction: contract.direction,
        stake: contract.stake,
        payout: refund,
        profit: refund - contract.stake,
        status: 'sold',
        entryPrice: contract.entryPrice,
        exitPrice: contract.currentPrice,
        purchaseTime: contract.entryTime
      }
    ]);

    setActiveContracts((prev) => prev.filter((c) => c.id !== contractId));
    triggerToast(`Contract liquidated early for $${refund.toFixed(2)} refund.`, true);
  };

  // Sync active views smoothly
  const handleSwitchView = (view: 'trade' | 'history' | 'stats') => {
    setActiveTabView(view);
    if (view === 'history') setPositionsTab('statements');
    else if (view === 'stats') setPositionsTab('stats');
    else setPositionsTab('positions');
  };

  const handlePositionsTabChange = (tab: 'positions' | 'statements' | 'stats') => {
    setPositionsTab(tab);
    if (tab === 'positions') setActiveTabView('trade');
    else if (tab === 'statements') setActiveTabView('history');
    else setActiveTabView('stats');
  };

  const activeTicks = assetsTicksMap[activeAsset.id] || [];

  return (
    <div className={`min-h-screen font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col transition-colors duration-200`}>
      {/* 1. Header Navigation System */}
      <Header
        account={account}
        onSwitchAccount={handleSwitchAccount}
        onResetDemo={handleResetDemoBalance}
        onOpenCashier={() => setIsCashierOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeView={activeTabView}
        onSwitchView={handleSwitchView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        currentUser={currentUser}
      />

      {/* Floating System-Wide Alerts */}
      {visualNotice && (
        <div className={`fixed bottom-6 left-6 z-50 flex items-center space-x-2.5 rounded-xl border px-4 py-3.5 shadow-2xl transition-all duration-300 transform translate-y-0 scale-100 ${
          visualNotice.success
            ? 'border-green-500 bg-white text-green-600'
            : 'border-red-500 bg-white text-red-600'
        }`}>
          <div className={`h-2.5 w-2.5 rounded-full animate-ping ${visualNotice.success ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="font-mono text-xs font-semibold leading-tight">{visualNotice.text}</span>
        </div>
      )}

      {/* 2. MAIN TRADERWORKSPACE */}
      <main className="flex-1 flex flex-col p-3 md:p-4 gap-4 max-w-7xl mx-auto w-full">
        <div className={`flex flex-wrap items-center justify-end rounded-xl p-3 border select-none gap-3 shrink-0 transition-colors ${
          theme === 'dark' ? 'bg-zinc-905 border-zinc-800 text-zinc-350' : 'bg-white border-gray-100 text-gray-500 shadow-sm'
        }`}>

          <div className="flex items-center space-x-4 text-xs">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                triggerToast(soundEnabled ? 'Synthesizer muted.' : 'Harmonic synthesizer activated.', true);
              }}
              className={`flex items-center space-x-1.5 transition-colors cursor-pointer font-semibold ${
                theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-gray-450 hover:text-black'
              }`}
              title="Platform Sound Effects"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-green-500 animate-bounce" /> : <VolumeX className="h-4 w-4" />}
              <span className="text-[10px] uppercase">{soundEnabled ? 'SFX ON' : 'SFX OFF'}</span>
            </button>

            {/* AI Assistant Activator */}
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className="flex items-center space-x-1.5 text-black hover:opacity-80 font-bold transition-all cursor-pointer"
            >
              <Bot className="h-4 w-4 text-purple-500" />
              <span className="text-[10px] uppercase">Wizard Bot</span>
            </button>
          </div>
        </div>

        {/* Central Workspace grids */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 items-stretch">
          {/* Chart Left column */}
          <div className="flex-1 flex flex-col gap-4">
            <Chart
              theme={theme}
              asset={activeAsset}
              ticks={activeTicks}
              activeContracts={activeContracts}
              indicatorConfig={indicatorConfig}
              chartType="line"
              onToggleChartType={() => {}} // custom handled inline
              onToggleIndicator={handleToggleIndicator}
            />

            {/* Bottom active position lists panel */}
            <PositionsList
              theme={theme}
              activeContracts={activeContracts}
              closedContracts={tradeHistory}
              onSellContract={handleSellContractEarly}
              activeTab={positionsTab}
              onChangeTab={handlePositionsTabChange}
            />
          </div>

          {/* Core trade ticket right side column */}
          <TradeControls
            theme={theme}
            assets={assetsRegistry}
            selectedAsset={activeAsset}
            onSelectAsset={setActiveAsset}
            onPurchase={handlePurchaseContract}
            balance={account.balance}
          />
        </div>
      </main>

      {/* FLOAT AI ASSISTANT OVERLAY TRIGGER */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg active:scale-95 transition-all cursor-pointer ${
            theme === 'dark' ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
          }`}
          title="Ask Wizard Bot for market wisdom"
        >
          <Bot className="h-5 w-5 animate-pulse" />
        </button>
      )}

      {/* MODAL & SLIDERS OVERLAYS */}
      <WizardBot
        theme={theme}
        asset={activeAsset}
        tickHistory={activeTicks}
        indicatorConfig={indicatorConfig}
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      <CashierModal
        isOpen={isCashierOpen}
        onClose={() => setIsCashierOpen(false)}
        account={account}
        onDeposit={handleDepositCashier}
        onWithdraw={handleWithdrawCashier}
        currentUser={currentUser}
        theme={theme}
      />

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        account={account}
        theme={theme}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
        onLogout={() => setCurrentUser(null)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        theme={theme}
        onSuccess={setCurrentUser}
      />

      {/* FOOTER */}
      <footer className={`h-10 border-t text-[10px] font-mono flex items-center justify-between px-6 select-none shrink-0 transition-colors ${
        theme === 'dark' ? 'border-zinc-800 bg-zinc-950 text-zinc-400' : 'border-gray-100 bg-white text-gray-400'
      }`}>
        <span>© 2026 MariTech Inc.</span>
      </footer>
    </div>
  );
}
