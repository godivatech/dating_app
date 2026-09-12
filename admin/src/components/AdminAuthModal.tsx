import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Key, Phone, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { api } from '../services/api';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChanged: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthChanged,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('+919999999999');
  const [manualToken, setManualToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      checkCurrentStatus();
    }
  }, [isOpen]);

  const checkCurrentStatus = async () => {
    const res = await api.verifyAuth();
    if (res.isAuthenticated) {
      setCurrentUser(res.user);
    } else {
      setCurrentUser(null);
    }
  };

  if (!isOpen) return null;

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.loginWithPhone(phoneNumber.trim());
      if (res.success) {
        setStatusMessage({ type: 'success', text: `Authenticated as ${res.user?.phoneNumber || 'Admin'} (${res.user?.role || 'ADMIN'})` });
        setCurrentUser(res.user);
        onAuthChanged();
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Authentication failed' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetManualToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    api.setToken(manualToken.trim());
    api.setMode('live');
    checkCurrentStatus();
    setStatusMessage({ type: 'success', text: 'Bearer token saved. Switched to Live API.' });
    onAuthChanged();
    setManualToken('');
  };

  const handleLogout = () => {
    api.setToken(null);
    api.setMode('mock');
    setCurrentUser(null);
    setStatusMessage({ type: 'success', text: 'Disconnected. Reverted to interactive simulation mode.' });
    onAuthChanged();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in w-full max-w-[460px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto bg-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0 text-rose-600">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Admin Gateway Access
              </h3>
              <div className="text-xs text-slate-500 truncate">
                NestJS Live API Credentials &amp; Role Verification
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Close modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle size={15} className="flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={15} className="flex-shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Current Auth State */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Gateway Connection
              </div>
              <div className={`text-xs sm:text-sm font-semibold mt-0.5 ${currentUser ? 'text-emerald-600' : 'text-slate-600'}`}>
                {currentUser ? `Active (${currentUser.role || 'ADMIN'})` : 'Simulation / Offline Mode'}
              </div>
              {currentUser && (
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                  {currentUser.phoneNumber}
                </div>
              )}
            </div>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="btn btn-glass btn-sm text-rose-600 text-xs hover:bg-rose-50 flex-shrink-0"
              >
                <LogOut size={13} />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Phone Login Section */}
          <form onSubmit={handlePhoneLogin} className="space-y-1.5">
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Instant Staff Dev/Admin Login
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 mb-2">
              Direct backend authentication for administrator role:
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone
                  size={14}
                  className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  className="input-search text-xs sm:text-sm pl-8 py-2 w-full"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919999999999"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-sm text-xs px-3.5 flex-shrink-0"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>

          {/* Manual Token Fallback */}
          <form onSubmit={handleSetManualToken} className="space-y-1.5 pt-2 border-t border-slate-200">
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Or Paste Admin JWT Bearer Token
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key
                  size={14}
                  className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="password"
                  className="input-search text-xs sm:text-sm pl-8 py-2 w-full"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                />
              </div>
              <button
                type="submit"
                className="btn btn-glass btn-sm text-xs px-3.5 flex-shrink-0"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};
