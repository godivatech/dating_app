import React, { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  CreditCard,
  Heart,
  ShieldAlert,
  Camera,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { api, AnalyticsOverview } from '../services/api';
import { NavTab } from '../components/Sidebar';

interface OverviewViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    api.getAnalyticsOverview()
      .then((data) => {
        if (isMounted) setAnalytics(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '32px', color: 'var(--text-tertiary)' }}>
        Loading platform telemetry...
      </div>
    );
  }

  const totalUsersCount = analytics?.totalUsers || 0;
  const totalPaidSubsCount = analytics?.activeSubscriptions?.total || 0;
  const subCoveragePct = totalUsersCount > 0 ? ((totalPaidSubsCount / totalUsersCount) * 100).toFixed(1) : '0.0';
  const directNotePacksCount = analytics?.directNotePacksCount || 0;
  const freeMembersCount = Math.max(0, totalUsersCount - totalPaidSubsCount);
  const noteAdoptionPct = freeMembersCount > 0 ? Math.min(100, ((directNotePacksCount / freeMembersCount) * 100)).toFixed(1) : '0.0';

  const kpis = [
    {
      title: 'Total Members',
      value: (analytics?.totalUsers ?? 0).toLocaleString(),
      change: 'Verified members',
      icon: Users,
    },
    {
      title: 'Active Today (DAU)',
      value: (analytics?.activeToday ?? 0).toLocaleString(),
      change: 'Daily active',
      icon: Activity,
    },
    {
      title: 'Monthly Run-Rate (MRR)',
      value: `₹${(analytics?.estimatedMonthlyRevenueInr ?? 0).toLocaleString()}`,
      change: 'Live recurring run-rate',
      icon: CreditCard,
    },
    {
      title: 'Mutual Matches',
      value: (analytics?.totalMatches ?? 0).toLocaleString(),
      change: 'Active matches',
      icon: Heart,
    },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-5 sm:gap-6">
      {/* KPI Grid (2 boxes per row on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-card p-3 sm:p-4 lg:p-5 flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2.5 min-w-0">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                  {kpi.title}
                </span>
                <Icon size={16} className="text-slate-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
              </div>

              <div className="font-heading text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-1.5 sm:mb-2 truncate">
                {kpi.value}
              </div>

              <div className="flex items-center gap-1 text-[10.5px] sm:text-xs min-w-0">
                <span className="text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded font-semibold border border-emerald-200 truncate max-w-full">
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Highlights & Urgent Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Revenue & Direct Notes Deep Dive */}
        <div className="glass-card p-3.5 sm:p-5 lg:p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5 flex-wrap">
            <div>
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                Monetization &amp; Coin Economy Performance
              </h2>
              <div className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
                Truelove Plus (₹299) • Truelove Gold (₹499) • Coin Wallet (₹99 / ₹199 / ₹499)
              </div>
            </div>
            <button
              onClick={() => onNavigate('revenue')}
              className="btn btn-glass btn-sm text-xs sm:text-sm"
            >
              <span>Ledger</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
            <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">
                Active Plus Subs
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 leading-tight truncate">
                {analytics?.activeSubscriptions?.sparkPlus ?? 0}
              </div>
              <div className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                ₹299 / mo tier
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">
                Active Gold Subs
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 leading-tight truncate">
                {analytics?.activeSubscriptions?.sparkGold ?? 0}
              </div>
              <div className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                ₹499 / mo tier
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">
                Coin Recharges &amp; Packs
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 leading-tight truncate">
                {analytics?.directNotePacksCount ?? 0}
              </div>
              <div className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                Prepaid micro-revenue
              </div>
            </div>
          </div>

          {/* Progress Bars (Dynamic, Clean) */}
          <div className="flex flex-col gap-3.5">
            <div>
              <div className="flex justify-between text-xs sm:text-[13px] mb-1.5">
                <span className="text-slate-600">Subscription Coverage (% of verified base)</span>
                <span className="font-bold text-slate-900">{subCoveragePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(subCoveragePct)))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-[13px] mb-1.5">
                <span className="text-slate-600">Direct Note Adoption among Free Users</span>
                <span className="font-bold text-slate-900">{noteAdoptionPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-rose-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(noteAdoptionPct)))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Moderation Attention Card */}
        <div className="glass-card p-4 sm:p-6 flex flex-col lg:col-span-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 tracking-tight">
            Moderation Attention
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-5">
            Pending review queues requiring action
          </p>

          <div className="flex flex-col gap-3 flex-1">
            {/* Photo Moderation Queue Item */}
            <div className="p-3 sm:p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Camera size={18} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                    Photo Queue
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Pending validation
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('photos')}
                className="btn btn-primary btn-sm text-xs px-2.5 py-1.5 flex-shrink-0"
              >
                Review ({analytics?.pendingPhotosCount || 0})
              </button>
            </div>

            {/* Reports Queue Item */}
            <div className="p-3 sm:p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert size={18} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                    Abuse Reports
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Member flags
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('moderation')}
                className="btn btn-glass btn-sm text-xs px-2.5 py-1.5 flex-shrink-0"
              >
                Inspect ({analytics?.pendingReportsCount || 0})
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
            <span>SLA: 100% of reports addressed under 15 mins.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
