import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Camera,
  CreditCard,
  FileText,
  Flame,
  X,
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
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingPhotosCount = 0,
  pendingReportsCount = 0,
  isOpenMobile = false,
  onCloseMobile,
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

  const handleSelectTab = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Scrim */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar (Desktop pinned + Mobile slide-over drawer) */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 w-72 lg:w-64 bg-white border-r border-slate-200 z-50 flex flex-col h-full transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none flex-shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 lg:h-[70px] px-4 sm:px-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
              <Flame size={20} className="text-rose-600" />
            </div>
            <div>
              <div className="font-heading text-[17px] font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                TRUELOVE
                <span className="text-[11px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  ADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
            title="Close sidebar menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3.5 flex flex-col gap-1 flex-1 overflow-y-auto">
          <div className="px-3 pt-1 pb-2 text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
            Platform Operations
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg text-left text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rose-50 text-rose-600 font-semibold border border-rose-100 border-l-[3.5px] border-l-rose-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={isActive ? 'text-rose-600' : 'text-slate-400'}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin Profile Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center font-bold text-xs text-rose-600 flex-shrink-0">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">
                Super Administrator
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Online (Dev)</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
