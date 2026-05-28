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

type PaymentMethod = 'nowpayments' | 'crypto' | 'paybill';

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Cashier API route is returning HTML instead of JSON. Check the Cloudflare Worker/API deployment and D1 binding.');
  }

  return response.json();
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('nowpayments');
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('BTC');
  const [depositAddress, setDepositAddress] = useState<{ address?: string; tag?: string; url?: string; paymentId?: string } | null>(null);
  const [txHash, setTxHash] = useState('');
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [addressTag, setAddressTag] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [apiError, setApiError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  const isCryptoRoute = paymentMethod === 'nowpayments' || paymentMethod === 'crypto';

  useEffect(() => {
    if (!isOpen || activeTab !== 'deposit' || !isCryptoRoute) return;

    let cancelled = false;
    setIsAddressLoading(true);
    setApiError('');
    setDepositAddress(null);

    const userId = currentUser?.id || currentUser?.email || account.id;

    // For NOWPayments, we create a payment record immediately to get an address
    fetch(`/api/cashier/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        coin: selectedCoin,
        userId
      })
    })
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Unable to create NOWPayments session.');
        }
        if (!cancelled) {
          setDepositAddress({
            address: data.address,
            paymentId: data.payment_id
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDepositAddress(null);
          setApiError(error.message || 'Unable to load deposit address.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsAddressLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isCryptoRoute, isOpen, selectedCoin, amount]);

  if (!isOpen) return null;

  const selectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setSuccessMsg('');
    setApiError('');

    if (method === 'nowpayments') {
      setSelectedCoin('BTC');
      setSelectedNetwork('BTC');
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
      const userId = currentUser?.id || currentUser?.email || account.id;

      if (paymentMethod === 'paybill') {
        if (activeTab === 'deposit' && !receiptFile) {
          throw new Error('Please upload your M-Pesa receipt for verification.');
        }

        if (activeTab === 'deposit') {
          const formData = new FormData();
          formData.append('receipt', receiptFile!);
          formData.append('userId', userId);
          formData.append('amount', amount.toString());
          formData.append('paymentMethod', 'paybill');
          if (receiptFile) formData.append('receipt', receiptFile);
          if (mpesaMessage) formData.append('message', mpesaMessage);

          if (!receiptFile && !mpesaMessage) {
            throw new Error('Please provide either an M-Pesa receipt image or the transaction message.');
          }

          const response = await fetch('/api/cashier/upload-receipt', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Receipt upload failed.');
          }

          setReceiptFile(null);
          setMpesaMessage('');
          setSuccessMsg('Deposit details submitted! MariTech admin will verify and credit your account within 30 minutes.');
          return;
        } else {
          // Paybill withdrawal? Usually it's to M-Pesa. For now, let's say it's pending.
          throw new Error('M-Pesa withdrawals are currently processed manually. Please contact support with your M-Pesa number.');
        }
      }

      if (!isCryptoRoute) {
        throw new Error('This payment route is not connected to a live processor.');
      }

      if (activeTab === 'deposit') {
        if (!depositAddress?.paymentId) {
          throw new Error('Please wait for the deposit address to load.');
        }

        const response = await fetch(`/api/cashier/verify-deposit?paymentId=${depositAddress.paymentId}&userId=${userId}`);
        const data = await readApiResponse(response);
        
        if (!response.ok || !data.success) {
          setPaymentStatus(data.status || 'waiting');
          throw new Error(data.message || 'Deposit not yet confirmed on the blockchain.');
        }

        const creditedAmount = Number(data.creditedAmount) || amount;
        onDeposit(creditedAmount);
        setSuccessMsg(`Deposit successful! $${creditedAmount.toLocaleString()} has been credited via NOWPayments.`);
      } else {
        if (!targetAddress.trim()) {
          throw new Error('Enter the receiving wallet address.');
        }

        const response = await fetch('/api/cashier/dispatch-withdrawal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAddress: targetAddress.trim(),
            amount,
            coin: selectedCoin,
            userId
          })
        });
        const data = await readApiResponse(response);
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Withdrawal dispatch failed.');
        }

        onWithdraw(amount);
        setTargetAddress('');
        setAddressTag('');
        setSuccessMsg(`Withdrawal submitted. $${amount.toLocaleString()} is now being processed to your ${selectedCoin} wallet.`);
      }
    } catch (error: any) {
      setApiError(error.message || 'Cashier request failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/45 p-0 transition-all backdrop-blur-sm sm:items-center sm:p-4">
      <div className={`relative w-screen max-w-full sm:w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-lg border shadow-2xl transition-all sm:my-0 sm:rounded-xl box-border px-3 py-3 sm:p-6 ${
        theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded p-1 sm:p-1.5 text-gray-400 hover:bg-gray-100 hover:text-black transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        <div className="mb-3 sm:mb-5">
          <h2 className={`text-sm sm:text-base font-bold tracking-tight font-sans flex items-center gap-1 sm:gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            <Wallet2 className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
            <span className="truncate">MariTech Banking Ledger</span>
          </h2>
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-mono font-bold uppercase tracking-wide truncate block">
            WALLET: MT-{account.id.substring(0, 8).toUpperCase()}
          </span>
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-mono font-bold uppercase tracking-wide">
            MODE: {account.mode.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 mb-3 sm:mb-5 select-none border border-gray-200/50">
          <button
            onClick={() => {
              setActiveTab('deposit');
              setSuccessMsg('');
              setApiError('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-2 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'deposit' ? (theme === 'dark' ? 'bg-slate-800 text-brand-primary shadow' : 'bg-white text-black shadow') : 'text-slate-400 hover:text-brand-primary'
            }`}
          >
            <ArrowDownCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>Deposit</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('withdraw');
              setSuccessMsg('');
              setApiError('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-2 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'withdraw' ? (theme === 'dark' ? 'bg-slate-800 text-brand-accent shadow' : 'bg-white text-black shadow') : 'text-slate-400 hover:text-brand-accent'
            }`}
          >
            <ArrowUpRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>Withdraw</span>
          </button>
        </div>

        {successMsg ? (
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 sm:p-5 text-center space-y-3 sm:space-y-4">
            <div className="mx-auto flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 font-bold" />
            </div>
            <p className="text-[9px] sm:text-xs text-gray-700 font-bold">{successMsg}</p>
            <button
              onClick={() => setSuccessMsg('')}
              className="rounded bg-black text-white px-4 sm:px-5 py-2.5 sm:py-2 text-[9px] sm:text-xs font-bold uppercase hover:bg-gray-950 transition-all cursor-pointer"
            >
              Continue Banking
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                USD Amount
              </label>
              <div className="flex rounded-md bg-gray-50 border border-gray-200 items-center px-3 focus-within:border-black min-h-11 sm:min-h-10">
                <DollarSign className="h-4 w-4 text-gray-450 flex-shrink-0" />
                <input
                  type="number"
                  min={10}
                  max={50000}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent font-mono text-base sm:text-sm font-bold focus:outline-none text-current"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {[50, 100, 500, 2000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val)}
                  className="rounded bg-gray-50 border border-gray-150 hover:bg-gray-100 py-2 sm:py-1 text-[11px] sm:text-[10px] font-bold text-gray-500 hover:text-black transition-all cursor-pointer"
                >
                  +${val}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Select payment route
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => selectPaymentMethod('paybill')}
                  className={`rounded-lg border p-3 sm:p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 sm:gap-1 ${
                    paymentMethod === 'paybill' ? 'border-green-500 text-current bg-green-50/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className={`h-5 w-5 sm:h-4 sm:w-4 ${paymentMethod === 'paybill' ? 'text-green-500' : ''}`} />
                  <span className="text-[9px] sm:text-[8px] font-bold">M-Pesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectPaymentMethod('nowpayments')}
                  className={`rounded-lg border p-3 sm:p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 sm:gap-1 ${
                    paymentMethod === 'nowpayments' ? 'border-brand-accent text-current bg-amber-50/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className={`h-5 w-5 sm:h-4 sm:w-4 ${paymentMethod === 'nowpayments' ? 'text-brand-accent' : ''}`} />
                  <span className="text-[9px] sm:text-[8px] font-bold">BTC (API)</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectPaymentMethod('crypto')}
                  className={`rounded-lg border p-3 sm:p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 sm:gap-1 ${
                    paymentMethod === 'crypto' ? 'border-brand-secondary text-current bg-slate-800/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Wallet2 className={`h-5 w-5 sm:h-4 sm:w-4 ${paymentMethod === 'crypto' ? 'text-brand-secondary' : ''}`} />
                  <span className="text-[9px] sm:text-[8px] font-bold">Crypto</span>
                </button>
              </div>
            </div>

            {isCryptoRoute && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Coin
                    </label>
                    <select
                      value={selectedCoin}
                      onChange={(e) => {
                        setSelectedCoin(e.target.value);
                        if (e.target.value === 'BTC') setSelectedNetwork('BTC');
                        else if (e.target.value === 'ETH') setSelectedNetwork('ETH');
                        else if (e.target.value === 'USDTTRC20') setSelectedNetwork('TRX');
                        else if (e.target.value === 'USDT') setSelectedNetwork('ETH');
                      }}
                      className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-3 sm:py-2 text-xs text-white font-bold outline-none appearance-none cursor-pointer"
                    >
                      <option value="BTC">BTC (Bitcoin)</option>
                      <option value="ETH">ETH (Ethereum)</option>
                      <option value="USDT">USDT (ERC20)</option>
                      <option value="USDTTRC20">USDT (TRC20)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Network
                    </label>
                    <div className="w-full rounded bg-slate-900 border border-slate-800 px-3 py-3 sm:py-2 text-xs text-brand-primary font-bold">
                      {selectedNetwork}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                      {paymentMethod === 'nowpayments' ? 'NOWPayments BTC' : 'Crypto Transfer'}
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
                            {isAddressLoading ? 'Generating NOWPayments address...' : depositAddress?.address || 'Address unavailable'}
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

                      <div className="p-3 bg-brand-primary/5 rounded border border-brand-primary/20">
                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                          Send exactly <span className="text-brand-primary font-bold">{depositAddress?.amount || '...'} {selectedCoin}</span> to the address above. Your balance is credited automatically after confirmation.
                        </p>
                        {depositAddress?.paymentId && (
                           <p className="text-[9px] text-slate-500 mt-2 font-mono">Session ID: {depositAddress.paymentId}</p>
                        )}
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
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-3 sm:py-2 text-xs text-white font-mono focus:border-brand-primary outline-none transition-all"
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
                          className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-3 sm:py-2 text-xs text-white font-mono focus:border-brand-primary outline-none transition-all"
                        />
                      </div>

                      <div className="p-3 bg-amber-500/5 rounded border border-amber-500/20">
                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                          Live withdrawal dispatch uses the NOWPayments API for {selectedCoin}.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {apiError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2.5 sm:p-3 text-[9px] sm:text-[10px] font-bold text-red-600">
                {apiError}
              </div>
            )}

            {paymentMethod === 'paybill' && (
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                    M-Pesa Lipa Na Paybill
                  </span>
                  <DollarSign className="h-3.5 w-3.5 text-green-500" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Business Number</p>
                    <p className="text-sm font-mono font-bold text-white">542542</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Account Number</p>
                    <p className="text-sm font-mono font-bold text-white">00204484326150</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Option A: Paste M-Pesa Confirmation Message
                  </label>
                  <textarea
                    value={mpesaMessage}
                    onChange={(e) => setMpesaMessage(e.target.value)}
                    placeholder="Paste the message here (e.g. QXJ7... Confirmed. Ksh...)"
                    className="w-full h-20 bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-white font-mono focus:border-green-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Option B: Upload Payment Receipt (Screenshot)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-green-500 file:text-white hover:file:bg-green-600 cursor-pointer"
                  />
                  {receiptFile && <p className="text-[9px] text-green-500 font-bold">Selected: {receiptFile.name}</p>}
                </div>

                <div className="p-3 bg-green-500/5 rounded border border-green-500/20">
                  <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                    Instructions: Pay <span className="text-green-500 font-bold">${amount}</span> to the Paybill above, take a screenshot of the confirmation message, and upload it here.
                  </p>
                </div>
              </div>
            )}

            {!isCryptoRoute && paymentMethod !== 'paybill' && (
              <div className="rounded-md bg-gray-50 p-3 border border-gray-150 text-[10px] font-mono text-gray-500 space-y-1">
                <div className="flex justify-between font-bold text-black">
                  <span>Processor</span>
                  <span>Not connected</span>
                </div>
                <div>Use BTC (API), Crypto or M-Pesa for transfers.</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="flex w-full items-center justify-center space-x-2 rounded bg-black text-white py-4 sm:py-3.5 font-bold hover:bg-gray-950 transition-all text-xs sm:text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                  <span>{activeTab === 'deposit' ? 'Verifying Payment...' : 'Submitting Withdrawal...'}</span>
                </>
              ) : (
                <span>{activeTab === 'deposit' 
                  ? (paymentMethod === 'paybill' ? 'Upload & Notify Admin' : 'Verify Deposit') 
                  : 'Dispatch Withdrawal'}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
