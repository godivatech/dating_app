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
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 99998,
        }}
        onClick={onClose}
      />

      <div
        className="glass-card animate-fade-in"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '460px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          zIndex: 99999,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-brand-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} color="var(--primary-brand)" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Admin Gateway Access
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                NestJS Live API Credentials &amp; Role Verification
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-glass btn-sm" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px' }}>
          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: statusMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                border: `1px solid ${statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {statusMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Current Auth State */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Gateway Connection
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: currentUser ? 'var(--color-success)' : 'var(--text-secondary)', marginTop: '2px' }}>
                {currentUser ? `Active (${currentUser.role || 'ADMIN'})` : 'Simulation / Offline'}
              </div>
              {currentUser && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  {currentUser.phoneNumber}
                </div>
              )}
            </div>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="btn btn-glass btn-sm"
                style={{ color: 'var(--color-danger)', fontSize: '12px' }}
              >
                <LogOut size={13} />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Phone Login Section */}
          <form onSubmit={handlePhoneLogin} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Instant Staff Dev/Admin Login
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
              Direct backend authentication for administrator role:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Phone
                  size={14}
                  color="var(--text-tertiary)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="input-search"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919999999999"
                  style={{ width: '100%', paddingLeft: '34px' }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>

          {/* Manual Token Fallback */}
          <form onSubmit={handleSetManualToken}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Or Paste Admin JWT Bearer Token
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Key
                  size={14}
                  color="var(--text-tertiary)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="password"
                  className="input-search"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                  style={{ width: '100%', paddingLeft: '34px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-glass btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
};
