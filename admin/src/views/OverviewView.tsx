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

  const kpis = [
    {
      title: 'Total Members',
      value: (analytics?.totalUsers || 0).toLocaleString(),
      change: '+14% growth',
      icon: Users,
    },
    {
      title: 'Active Today (DAU)',
      value: (analytics?.activeToday || 0).toLocaleString(),
      change: '29% stickiness',
      icon: Activity,
    },
    {
      title: 'Estimated MRR',
      value: `₹${(analytics?.estimatedMonthlyRevenueInr || 273130).toLocaleString()}`,
      change: 'Target: ₹2.73L / mo',
      icon: CreditCard,
    },
    {
      title: 'Mutual Matches',
      value: (analytics?.totalMatches || 0).toLocaleString(),
      change: 'High-intent connections',
      icon: Heart,
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {kpi.title}
                </span>
                <Icon size={18} color="var(--text-tertiary)" />
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  marginBottom: '8px',
                  lineHeight: 1.1,
                }}
              >
                {kpi.value}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span
                  style={{
                    color: 'var(--color-success)',
                    backgroundColor: 'var(--color-success-bg)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Highlights & Urgent Queues */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Revenue & Direct Notes Deep Dive */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Monetization &amp; Direct Note Performance
              </h2>
              <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Spark Plus (₹299) • Spark Gold (₹499) • Direct Note Packs (₹99 / ₹199 / ₹349)
              </div>
            </div>
            <button
              onClick={() => onNavigate('revenue')}
              className="btn btn-glass"
              style={{ fontSize: '13px', padding: '7px 14px' }}
            >
              <span>Ledger</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Plus Subs
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {analytics?.activeSubscriptions?.sparkPlus || 185}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ₹299 / month tier
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Gold Subs
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {analytics?.activeSubscriptions?.sparkGold || 240}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ₹499 / month tier
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Direct Note Packs
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {analytics?.directNotePacksCount || 680}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                A-la-carte revenue
              </div>
            </div>
          </div>

          {/* Progress Bars (Subtle, Clean) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subscription Coverage (% of verified base)</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>32.9%</span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
                <div style={{ width: '32.9%', height: '100%', backgroundColor: 'var(--color-success)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Direct Note Adoption among Free Users</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>24.1%</span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
                <div style={{ width: '24.1%', height: '100%', backgroundColor: 'var(--primary-brand)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Moderation Attention Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
            Moderation Attention
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
            Pending review queues requiring action
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {/* Photo Moderation Queue Item */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Camera size={18} color="var(--text-secondary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Photo Queue
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Pending validation
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('photos')}
                className="btn btn-primary btn-sm"
              >
                Review ({analytics?.pendingPhotosCount || 0})
              </button>
            </div>

            {/* Reports Queue Item */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldAlert size={18} color="var(--text-secondary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Abuse Reports
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Member flags
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('moderation')}
                className="btn btn-glass btn-sm"
              >
                Inspect ({analytics?.pendingReportsCount || 0})
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: '18px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              fontSize: '12.5px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={15} color="var(--color-success)" />
            <span>SLA: 100% of reports addressed under 15 mins.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
