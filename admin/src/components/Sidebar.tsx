import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Camera,
  CreditCard,
  FileText,
  Flame,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'users'
  | 'moderation'
  | 'photos'
  | 'revenue'
  | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingPhotosCount?: number;
  pendingReportsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingPhotosCount = 0,
  pendingReportsCount = 0,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as NavTab, label: 'User Directory', icon: Users },
    {
      id: 'moderation' as NavTab,
      label: 'Trust & Safety',
      icon: ShieldAlert,
      badge: pendingReportsCount > 0 ? pendingReportsCount : undefined,
    },
    {
      id: 'photos' as NavTab,
      label: 'Photo Queue',
      icon: Camera,
      badge: pendingPhotosCount > 0 ? pendingPhotosCount : undefined,
    },
    { id: 'revenue' as NavTab, label: 'Revenue & Packs', icon: CreditCard },
    { id: 'audit' as NavTab, label: 'Audit Logs', icon: FileText },
  ];

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--navbar-height)',
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-brand-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Flame size={20} color="var(--primary-brand)" />
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            TRUELOVE <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>ADMIN</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        <div
          style={{
            padding: '4px 12px 10px 12px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Platform
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--primary-brand-subtle)' : 'transparent',
                color: isActive ? 'var(--primary-brand)' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--primary-brand-subtle)' : '1px solid transparent',
                borderLeft: isActive ? '3.5px solid var(--primary-brand)' : '1px solid transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                <Icon
                  size={18}
                  color={isActive ? 'var(--primary-brand)' : 'var(--text-tertiary)'}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin Profile Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary-brand-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--primary-brand)',
            }}
          >
            SA
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Super Administrator
            </div>
            <div
              style={{
                fontSize: '11.5px',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="live-indicator" style={{ width: '7px', height: '7px' }} /> Online
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
