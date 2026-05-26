import React, { useEffect, useState } from 'react';
import { CreditCard, ArrowDownCircle, ArrowUpRight, DollarSign, Wallet2, Check, RefreshCw, X, Shield } from 'lucide-react';
import { Account } from '../types';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  currentUser?: any;
  theme: 'dark' | 'light';
}

type PaymentMethod = 'card' | 'crypto' | 'wire' | 'binance';

export default function CashierModal({
  isOpen,
  onClose,
  account,
  onDeposit,
  onWithdraw,
  currentUser,
  theme
}: CashierModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('binance');
  const [selectedCoin, setSelectedCoin] = useState('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState('BSC');
  const [depositAddress, setDepositAddress] = useState<{ address?: string; tag?: string; url?: string } | null>(null);
  const [txHash, setTxHash] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [addressTag, setAddressTag] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [apiError, setApiError] = useState('');

  const isCryptoRoute = paymentMethod === 'binance' || paymentMethod === 'crypto';

  useEffect(() => {
    if (!isOpen || activeTab !== 'deposit' || !isCryptoRoute) return;

    let cancelled = false;
    setIsAddressLoading(true);
    setApiError('');

    fetch(`/api/cashier/deposit-address?coin=${selectedCoin}&network=${selectedNetwork}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Unable to load Binance deposit address.');
        }
        if (!cancelled) setDepositAddress(data.address);
      })
      .catch((error) => {
        if (!cancelled) {
          setDepositAddress(null);
          setApiError(error.message || 'Unable to load Binance deposit address.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsAddressLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isCryptoRoute, isOpen, selectedCoin, selectedNetwork]);

  if (!isOpen) return null;

  const selectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setSuccessMsg('');
    setApiError('');

    if (method === 'binance') {
      setSelectedCoin('USDT');
      setSelectedNetwork('BSC');
    } else if (method === 'crypto') {
      setSelectedCoin('USDT');
      setSelectedNetwork('ETH');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    if (activeTab === 'withdraw' && amount > account.balance) {
      setApiError('Withdrawal amount cannot exceed your active balance.');
      return;
    }

    setIsProcessing(true);
    setSuccessMsg('');
    setApiError('');

    try {
      if (!isCryptoRoute) {
        throw new Error('This payment route is not connected to a live processor. Use Binance or Crypto.');
      }

      const userId = currentUser?.id || currentUser?.email || account.id;

      if (activeTab === 'deposit') {
        if (!txHash.trim()) {
          throw new Error('Enter the Binance transaction hash after sending funds.');
        }

        const response = await fetch('/api/cashier/verify-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: txHash.trim(),
            amount,
            coin: selectedCoin,
            network: selectedNetwork,
            userId
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Binance deposit verification failed.');
        }

        const creditedAmount = Number(data.creditedAmountUsd) || amount;
        onDeposit(creditedAmount);
        setTxHash('');
        setSuccessMsg(`Binance verified ${selectedCoin}/${selectedNetwork} deposit. $${creditedAmount.toLocaleString()} has been credited to your MariTech ${account.mode === 'demo' ? 'Demo' : 'Real'} wallet.`);
      } else {
        if (!targetAddress.trim()) {
          throw new Error('Enter the receiving wallet address.');
        }

        const response = await fetch('/api/cashier/dispatch-withdrawal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAddress: targetAddress.trim(),
            addressTag: addressTag.trim(),
            amount,
            coin: selectedCoin,
            network: selectedNetwork,
            userId
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Binance withdrawal dispatch failed.');
        }

        onWithdraw(amount);
        setTargetAddress('');
        setAddressTag('');
        setSuccessMsg(`Withdrawal submitted to Binance. $${amount.toLocaleString()} is now processing to your ${selectedCoin}/${selectedNetwork} wallet.`);
      }
    } catch (error: any) {
      setApiError(error.message || 'Cashier request failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 transition-all backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl border p-6 shadow-2xl relative transition-all ${
        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-black transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <h2 className={`text-base font-bold tracking-tight font-sans flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            <Wallet2 className={`h-4.5 w-4.5 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
            <span>MariTech Banking Ledger</span>
          </h2>
          <span className="text-[9px] text-gray-400 font-mono font-bold uppercase tracking-wide">
            WALLET: MT-{account.id.substring(0, 10).toUpperCase()} | MODE: {account.mode.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 mb-5 select-none border border-gray-200/50">
          <button
            onClick={() => {
              setActiveTab('deposit');
              setSuccessMsg('');
              setApiError('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'deposit' ? (theme === 'dark' ? 'bg-slate-800 text-brand-primary shadow' : 'bg-white text-black shadow') : 'text-slate-400 hover:text-brand-primary'
            }`}
          >
            <ArrowDownCircle className="h-3.5 w-3.5" />
            <span>Fund Deposit</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('withdraw');
              setSuccessMsg('');
              setApiError('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'withdraw' ? (theme === 'dark' ? 'bg-slate-800 text-brand-accent shadow' : 'bg-white text-black shadow') : 'text-slate-400 hover:text-brand-accent'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Withdraw Cash</span>
          </button>
        </div>

        {successMsg ? (
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-5 text-center space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check className="h-5 w-5 font-bold" />
            </div>
            <p className="text-xs text-gray-700 font-bold">{successMsg}</p>
            <button
              onClick={() => setSuccessMsg('')}
              className="rounded bg-black text-white px-5 py-2 text-xs font-bold uppercase hover:bg-gray-950 transition-all cursor-pointer"
            >
              Continue Banking
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                USD Amount to Transfer
              </label>
              <div className="flex rounded-md bg-gray-50 border border-gray-200 items-center px-3 focus-within:border-black h-10">
                <DollarSign className="h-4 w-4 text-gray-450" />
                <input
                  type="number"
                  min={10}
                  max={50000}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent font-mono text-sm font-bold focus:outline-none text-current"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[50, 100, 500, 2000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val)}
                  className="rounded bg-gray-50 border border-gray-150 hover:bg-gray-100 py-1 text-[10px] font-bold text-gray-500 hover:text-black transition-all cursor-pointer"
                >
                  +${val}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Select payment route
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => selectPaymentMethod('card')}
                  className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'card' ? 'border-brand-primary text-current bg-slate-800/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className={`h-4 w-4 ${paymentMethod === 'card' ? 'text-brand-primary' : ''}`} />
                  <span className="text-[8px] font-bold">Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectPaymentMethod('binance')}
                  className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'binance' ? 'border-brand-accent text-current bg-amber-50/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className={`h-4 w-4 ${paymentMethod === 'binance' ? 'text-brand-accent' : ''}`} />
                  <span className="text-[8px] font-bold">Binance</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectPaymentMethod('crypto')}
                  className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'crypto' ? 'border-brand-secondary text-current bg-slate-800/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Wallet2 className={`h-4 w-4 ${paymentMethod === 'crypto' ? 'text-brand-secondary' : ''}`} />
                  <span className="text-[8px] font-bold">Crypto</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectPaymentMethod('wire')}
                  className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'wire' ? 'border-slate-400 text-current bg-slate-800/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className={`h-4 w-4 ${paymentMethod === 'wire' ? 'text-slate-600' : ''}`} />
                  <span className="text-[8px] font-bold">Wire</span>
                </button>
              </div>
            </div>

            {isCryptoRoute && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Coin
                    </label>
                    <select
                      value={selectedCoin}
                      onChange={(e) => setSelectedCoin(e.target.value)}
                      className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-2 text-xs text-white font-bold outline-none"
                    >
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Network
                    </label>
                    <select
                      value={selectedNetwork}
                      onChange={(e) => setSelectedNetwork(e.target.value)}
                      className="w-full rounded bg-slate-950 border border-slate-800 px-2 py-2 text-xs text-white font-bold outline-none"
                    >
                      <option value="BSC">BSC / BEP20</option>
                      <option value="ETH">Ethereum / ERC20</option>
                      <option value="TRX">Tron / TRC20</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                      {paymentMethod === 'binance' ? 'Binance Transfer' : 'Crypto Transfer'}
                    </span>
                    <Shield className="h-3.5 w-3.5 text-brand-primary" />
                  </div>

                  {activeTab === 'deposit' ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                          MariTech {selectedCoin} ({selectedNetwork}) deposit address
                        </p>
                        <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded border border-slate-800">
                          <code className="text-[10px] text-brand-primary font-mono truncate flex-1">
                            {isAddressLoading ? 'Loading live Binance address...' : depositAddress?.address || 'Address unavailable'}
                          </code>
                          <button
                            type="button"
                            disabled={!depositAddress?.address}
                            onClick={() => depositAddress?.address && navigator.clipboard.writeText(depositAddress.address)}
                            className="text-slate-500 hover:text-white transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                        {depositAddress?.tag && (
                          <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded border border-slate-800">
                            <code className="text-[10px] text-brand-primary font-mono truncate flex-1">
                              Memo/Tag: {depositAddress.tag}
                            </code>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(depositAddress.tag || '')}
                              className="text-slate-500 hover:text-white transition-colors"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Binance Transaction Hash
                        </label>
                        <input
                          type="text"
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          placeholder="Paste confirmed Binance tx hash"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-brand-primary outline-none transition-all"
                        />
                      </div>

                      <div className="p-3 bg-brand-primary/5 rounded border border-brand-primary/20">
                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                          Send exactly <span className="text-brand-primary font-bold">${amount} {selectedCoin}</span>. Your balance is credited only after Binance reports the transaction as successful.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Receiving Wallet Address
                        </label>
                        <input
                          type="text"
                          value={targetAddress}
                          onChange={(e) => setTargetAddress(e.target.value)}
                          placeholder={`Paste ${selectedCoin}/${selectedNetwork} address`}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-brand-primary outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Memo / Tag
                        </label>
                        <input
                          type="text"
                          value={addressTag}
                          onChange={(e) => setAddressTag(e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-brand-primary outline-none transition-all"
                        />
                      </div>

                      <div className="p-3 bg-amber-500/5 rounded border border-amber-500/20">
                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                          Live withdrawal dispatch uses the Binance withdrawal API for {selectedCoin}/{selectedNetwork}.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {apiError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[10px] font-bold text-red-600">
                {apiError}
              </div>
            )}

            {!isCryptoRoute && (
              <div className="rounded-md bg-gray-50 p-3 border border-gray-150 text-[10px] font-mono text-gray-500 space-y-1">
                <div className="flex justify-between font-bold text-black">
                  <span>{paymentMethod === 'card' ? 'Card processor' : 'Wire processor'}</span>
                  <span>Not connected</span>
                </div>
                <div>Use Binance or Crypto for production transfers.</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="flex w-full items-center justify-center space-x-2 rounded bg-black text-white py-3.5 font-bold hover:bg-gray-950 transition-all text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                  <span>{activeTab === 'deposit' ? 'Verifying Binance Deposit...' : 'Submitting Withdrawal...'}</span>
                </>
              ) : (
                <span>
                  {activeTab === 'deposit' ? 'Verify Deposit' : 'Dispatch Withdrawal'}
                </span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
