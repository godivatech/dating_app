import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewView } from './views/OverviewView';
import { UsersView } from './views/UsersView';
import { ModerationView } from './views/ModerationView';
import { PhotosView } from './views/PhotosView';
import { RevenueView } from './views/RevenueView';
import { AuditLogsView } from './views/AuditLogsView';
import { AdminAuthModal } from './components/AdminAuthModal';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [apiMode, setApiMode] = useState<'live' | 'mock'>(api.getMode());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);


  const refreshGlobalMetrics = async () => {
    setIsRefreshing(true);
    try {
      const [photos, reports] = await Promise.all([
        api.getPendingPhotos(),
        api.getReports({ status: 'OPEN' }),
      ]);
      setPendingPhotos(photos.length);
      setPendingReports(reports.length);
    } catch (err) {
      console.warn('Failed to refresh counts', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshGlobalMetrics();
  }, [apiMode, refreshKey]);

  const handleToggleMode = async () => {
    const nextMode = apiMode === 'live' ? 'mock' : 'live';
    setIsRefreshing(true);
    try {
      await api.setMode(nextMode);
      setApiMode(api.getMode());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to toggle API mode', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshKey((k) => k + 1);
    refreshGlobalMetrics();
  };

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'overview':
        return {
          title: 'Operations Dashboard',
          subtitle: 'Live platform telemetry, member acquisition, and run-rate metrics',
        };
      case 'users':
        return {
          title: 'Member Directory & Profiles',
          subtitle: 'Search, deep dossier inspection, and manual safety discipline',
        };
      case 'moderation':
        return {
          title: 'Trust & Safety Queue',
          subtitle: 'Reported member investigations and progressive sanctions',
        };
      case 'photos':
        return {
          title: 'Photo Verification Queue',
          subtitle: 'Human verification of uploaded profile photos & selfies',
        };
      case 'revenue':
        return {
          title: 'Revenue, Tiers & Packs',
          subtitle: 'Truelove Plus, Truelove Gold, Direct Notes micro-pack purchase logs',
        };
      case 'audit':
        return {
          title: 'Security & Action Audit Trail',
          subtitle: 'Complete chronological history of administrative operations',
        };
    }
  };

  const currentMeta = getTabTitle(activeTab);

  return (
    <div className="app-container">
      {/* Navigation Sidebar (Desktop pinned + Mobile slide-over) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingPhotosCount={pendingPhotos}
        pendingReportsCount={pendingReports}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          mode={apiMode}
          onToggleMode={handleToggleMode}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />


        <main className="view-viewport" key={`${activeTab}-${apiMode}-${refreshKey}`}>
          {activeTab === 'overview' && (
            <OverviewView onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'users' && <UsersView />}
          {activeTab === 'moderation' && <ModerationView />}
          {activeTab === 'photos' && <PhotosView />}
          {activeTab === 'revenue' && <RevenueView />}
          {activeTab === 'audit' && <AuditLogsView />}
        </main>
      </div>

      {/* Admin Gateway Authentication Modal */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthChanged={() => {
          setApiMode(api.getMode());
          setRefreshKey((k) => k + 1);
          refreshGlobalMetrics();
        }}
      />
    </div>
  );
};
