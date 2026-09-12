import React from 'react';
import { RefreshCw, Database, Globe, Menu, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  mode: 'live' | 'mock';
  onToggleMode: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenAuth: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  mode,
  onToggleMode,
  onRefresh,
  isRefreshing,
  onOpenAuth,
  onToggleMobileMenu,
}) => {
  return (
    <header className="h-16 lg:h-[70px] border-b border-slate-200 bg-white flex items-center justify-between px-3.5 sm:px-6 lg:px-8 z-10 sticky top-0 flex-shrink-0">
      {/* Left: Mobile Hamburger & Title Context */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
        {/* Hamburger Menu on Mobile/Tablet (< 1024px) */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="font-heading text-base sm:text-lg lg:text-xl font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <div className="text-xs sm:text-[13px] text-slate-500 truncate hidden sm:block">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right: Action Controls & Status Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
        {/* Clean Infrastructure Status Pill (Responsive) */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-100/80 border border-slate-200 text-xs font-medium text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <Database size={13} className="text-slate-400" />
          <span className="font-semibold text-slate-700">Neon PG</span>
          <span className="hidden md:inline text-slate-300">•</span>
          <span className="hidden md:inline">Redis</span>
          <span className="hidden lg:inline text-slate-300">•</span>
          <span className="hidden lg:inline">AES-256</span>
        </div>

        {/* Auth Credentials Modal Trigger */}
        <button
          onClick={onOpenAuth}
          className="btn btn-glass px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium gap-1.5"
          title="Manage live admin bearer credentials & authentication"
        >
          <ShieldCheck size={14} className="text-slate-500" />
          <span className="hidden xs:inline">Gateway</span>
          <span>Auth</span>
        </button>

        {/* API Gateway Mode Toggle */}
        <button
          onClick={onToggleMode}
          className={`btn px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md flex items-center gap-2 transition-all ${
            mode === 'live'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm'
              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
          }`}
          title="Click to toggle between live NestJS backend and interactive offline mock simulation"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              mode === 'live'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                : 'bg-slate-400'
            }`}
          />
          <Globe size={13} />
          <span className="hidden sm:inline">
            {mode === 'live' ? 'Live API (Connected)' : 'Simulation Mode'}
          </span>
          <span className="sm:hidden">
            {mode === 'live' ? 'Live' : 'Mock'}
          </span>
        </button>

        {/* Refresh Data Button */}
        <button
          onClick={onRefresh}
          className="btn btn-glass p-1.5 sm:p-2"
          disabled={isRefreshing}
          title="Refresh view data"
        >
          <RefreshCw
            size={14}
            className={`text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>
    </header>
  );
};
