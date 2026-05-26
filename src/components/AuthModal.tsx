import React, { useState } from 'react';
import { X, Mail, Lock, Phone, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onSuccess: (user: any) => void;
}

type AuthView = 'login' | 'register' | 'forgot_password';

export default function AuthModal({ isOpen, onClose, theme, onSuccess }: AuthModalProps) {
  const [view, setView] = useState<AuthView>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('maritech_users') || '[]');

      if (view === 'register') {
        const exists = users.find((u: any) => u.email === email || u.phone === phone);
        if (exists) {
          setFormError('User already registered with this email or phone.');
          setIsLoading(false);
          return;
        }

        // Phone number should be exactly 10 starting with either 254 or 07
        if (!/^(07\d{8}|254\d{7})$/.test(phone)) {
          setFormError('Phone number must be exactly 10 digits starting with 254 or 07.');
          setIsLoading(false);
          return;
        }

        const newUser = { email, phone, password };
        users.push(newUser);
        localStorage.setItem('maritech_users', JSON.stringify(users));

        setSuccessMsg('Account created successfully!');
        setIsLoading(false);
        setTimeout(() => {
          onSuccess(newUser);
          onClose();
          setSuccessMsg('');
        }, 1500);
      } else if (view === 'login') {
        const user = users.find((u: any) => u.email === email && u.password === password);
        if (!user) {
          setFormError('Invalid email or password.');
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        onSuccess(user);
        onClose();
      } else if (view === 'forgot_password') {
        setIsLoading(false);
        setSuccessMsg('Instructions sent to your email.');
        setTimeout(() => {
          setView('login');
          setSuccessMsg('');
        }, 3000);
      }
    }, 1000);
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setSuccessMsg('');
    setFormError('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl transition-all ${
        isDark ? 'bg-zinc-900 border border-zinc-800 text-white' : 'bg-white text-zinc-900'
      }`}>
        
        {/* Header Graphic/Gradient */}
        <div className="relative h-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-violet-500 to-fuchsia-500 opacity-90" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 mix-blend-overlay" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-2 bg-black/20 text-white hover:bg-black/40 transition-colors backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {view === 'login' && 'Welcome Back'}
              {view === 'register' && 'Create Account'}
              {view === 'forgot_password' && 'Reset Password'}
            </h2>
            <p className="text-white/80 text-sm mt-1">
              {view === 'login' && 'Enter your details to access your portfolio.'}
              {view === 'register' && 'Join MariTech and start trading today.'}
              {view === 'forgot_password' && "We'll send you instructions to reset it."}
            </p>
          </div>
        </div>

        <div className="p-6">
          {successMsg ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 animate-bounce" />
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Success!</h3>
              <p className={`mt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-lg flex items-center mb-4">
                  <span>{formError}</span>
                </div>
              )}
              
              {/* Email Field - Used in all views */}
              <div className="space-y-1">
                <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className={`h-4.5 w-4.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                      isDark 
                        ? 'bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-500'
                    } border`}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Phone Field - Only for register */}
              {view === 'register' && (
                <div className="space-y-1">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className={`h-4.5 w-4.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-500'
                      } border`}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>
              )}

              {/* Password Field - Used in login and register */}
              {(view === 'login' || view === 'register') && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {view === 'register' ? 'New Password' : 'Password'}
                    </label>
                    {view === 'login' && (
                      <button 
                        type="button"
                        onClick={() => switchView('forgot_password')}
                        className="text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className={`h-4.5 w-4.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`block w-full pl-10 pr-10 py-2.5 rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-500'
                      } border`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password Field - Only for register */}
              {view === 'register' && (
                <div className="space-y-1">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className={`h-4.5 w-4.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`block w-full pl-10 pr-10 py-2.5 rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                        isDark 
                          ? 'bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-500'
                      } border`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || (view === 'register' && password !== confirmPassword && confirmPassword !== '')}
                className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {view === 'login' && 'Sign In'}
                      {view === 'register' && 'Create Account'}
                      {view === 'forgot_password' && 'Send Reset Link'}
                    </span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </>
                )}
              </button>

              {/* Footer Links */}
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm">
                {view === 'login' && (
                  <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                    Don't have an account?{' '}
                    <button 
                      type="button" 
                      onClick={() => switchView('register')}
                      className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      Sign up now
                    </button>
                  </p>
                )}
                {view === 'register' && (
                  <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                    Already have an account?{' '}
                    <button 
                      type="button" 
                      onClick={() => switchView('login')}
                      className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      Sign in
                    </button>
                  </p>
                )}
                {view === 'forgot_password' && (
                  <button 
                    type="button" 
                    onClick={() => switchView('login')}
                    className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    Back to Sign In
                  </button>
                )}
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
