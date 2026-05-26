import React, { useState } from 'react';
import { CreditCard, ArrowDownCircle, ArrowUpRight, DollarSign, Wallet2, Check, RefreshCw, X } from 'lucide-react';
import { Account } from '../types';

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}

export default function CashierModal({
  isOpen,
  onClose,
  account,
  onDeposit,
  onWithdraw
}: CashierModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto' | 'wire'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    if (activeTab === 'withdraw' && amount > account.balance) {
      alert("Withdrawal amount cannot exceed your active balance.");
      return;
    }

    setIsProcessing(true);
    setSuccessMsg('');

    setTimeout(() => {
      setIsProcessing(false);
      if (activeTab === 'deposit') {
        onDeposit(amount);
        setSuccessMsg(`Deposit successful! $${amount.toLocaleString()} has been credited to your MariTech ${account.mode === 'demo' ? 'Demo' : 'Real'} wallet.`);
      } else {
        onWithdraw(amount);
        setSuccessMsg(`Withdrawal requested! $${amount.toLocaleString()} is currently processing to your chosen account.`);
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 transition-all backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-150 bg-white p-6 text-black shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-black transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-base font-bold tracking-tight font-sans flex items-center gap-1.5 text-black">
            <Wallet2 className="h-4.5 w-4.5 text-black" />
            <span>MariTech Banking Ledger</span>
          </h2>
          <span className="text-[9px] text-gray-400 font-mono font-bold uppercase tracking-wide">
            WALLET: MT-{account.id.substring(0, 10).toUpperCase()} | MODE: {account.mode.toUpperCase()}
          </span>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 mb-5 select-none border border-gray-200/50">
          <button
            onClick={() => {
              setActiveTab('deposit');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'deposit' ? 'bg-white text-black shadow' : 'text-gray-450 hover:text-black'
            }`}
          >
            <ArrowDownCircle className="h-3.5 w-3.5" />
            <span>Fund Deposit</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('withdraw');
              setSuccessMsg('');
            }}
            className={`flex items-center justify-center space-x-1 rounded py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'withdraw' ? 'bg-white text-black shadow' : 'text-gray-450 hover:text-black'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Withdraw Cash</span>
          </button>
        </div>

        {/* Action content form */}
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
            {/* Amount picker input */}
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
                  className="w-full bg-transparent font-mono text-sm font-bold focus:outline-none text-black"
                />
              </div>
            </div>

            {/* Quick amount chips */}
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

            {/* Payment options */}
            {activeTab === 'deposit' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Select payment route
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setPaymentMethod('card')}
                    className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'card' ? 'border-black text-black bg-gray-50' : 'border-gray-205 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-black" />
                    <span className="text-[9px] font-bold">Credit Card</span>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('crypto')}
                    className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'crypto' ? 'border-black text-black bg-gray-50' : 'border-gray-205 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet2 className="h-4 w-4 text-black" />
                    <span className="text-[9px] font-bold">Bitcoin Token</span>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('wire')}
                    className={`rounded-lg border p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === 'wire' ? 'border-black text-black bg-gray-50' : 'border-gray-205 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4 text-black" />
                    <span className="text-[9px] font-bold">Wire Transfer</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deposit' && paymentMethod === 'card' && (
              <div className="rounded-md bg-gray-50 p-3 border border-gray-150 text-[10px] font-mono text-gray-500 space-y-1">
                <div className="flex justify-between font-bold text-black">
                  <span>Visa Sandbox Standard</span>
                  <span>•••• 4125</span>
                </div>
                <div>Expiry: 12/28 | Cardholder: INVESTOR ACCOUNT</div>
              </div>
            )}

            {/* Action button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="flex w-full items-center justify-center space-x-2 rounded bg-black text-white py-3.5 font-bold hover:bg-gray-950 transition-all text-xs uppercase tracking-wider cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                  <span>Settling Ledger Reserves...</span>
                </>
              ) : (
                <span>
                  Execute {activeTab === 'deposit' ? 'Deposit' : 'Dispatch Withdrawal'}
                </span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
