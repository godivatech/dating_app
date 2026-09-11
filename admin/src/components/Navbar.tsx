import React from 'react';
import { RefreshCw, Database, Globe } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  mode: 'live' | 'mock';
  onToggleMode: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  mode,
  onToggleMode,
  onRefresh,
  isRefreshing,
  onOpenAuth,
}) => {
  return (
    <header
      style={{
        height: 'var(--navbar-height)',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 36px',
        zIndex: 10,
      }}
    >
      {/* Title & Context */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Action Controls & Cluster Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Clean Infrastructure Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          <span className="live-indicator" style={{ width: '7px', height: '7px' }} />
          <Database size={13} color="var(--text-tertiary)" />
          <span>Neon PG</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>Redis</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>AES-256</span>
        </div>

        {/* Auth Credentials Modal Trigger */}
        <button
          onClick={onOpenAuth}
          className="btn btn-glass"
          style={{
            fontSize: '13px',
            padding: '7px 13px',
          }}
          title="Manage live admin bearer credentials & authentication"
        >
          <span>Gateway Auth</span>
        </button>

        {/* API Gateway Mode Toggle */}
        <button
          onClick={onToggleMode}
          className="btn btn-glass"
          style={{
            color: mode === 'live' ? 'var(--color-success)' : 'var(--text-secondary)',
            fontSize: '13px',
            padding: '7px 13px',
          }}
          title="Click to toggle between live NestJS backend and interactive offline mock simulation"
        >
          <Globe size={14} />
          <span>{mode === 'live' ? 'Live API' : 'Simulation Mode'}</span>
        </button>

        {/* Refresh Data Button */}
        <button
          onClick={onRefresh}
          className="btn btn-glass"
          disabled={isRefreshing}
          style={{ padding: '7px 10px' }}
          title="Refresh view data"
        >
          <RefreshCw
            size={14}
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : undefined,
              color: 'var(--text-secondary)',
            }}
          />
        </button>
      </div>
    </header>
  );
};
