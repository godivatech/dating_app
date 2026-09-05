import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewView } from './views/OverviewView';
import { UsersView } from './views/UsersView';
import { ModerationView } from './views/ModerationView';
import { PhotosView } from './views/PhotosView';
import { RevenueView } from './views/RevenueView';
import { AuditLogsView } from './views/AuditLogsView';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [apiMode, setApiMode] = useState<'live' | 'mock'>(api.getMode());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState(0);

  const refreshGlobalMetrics = async () => {
    setIsRefreshing(true);
    try {
      const photos = await api.getPendingPhotos();
      setPendingPhotos(photos.length);
    } catch (err) {
      console.warn('Failed to refresh counts', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshGlobalMetrics();
  }, [apiMode]);

  const handleToggleMode = () => {
    const nextMode = apiMode === 'live' ? 'mock' : 'live';
    api.setMode(nextMode);
    setApiMode(nextMode);
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
          subtitle: 'Spark Plus, Spark Gold, Direct Notes micro-pack purchase logs',
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
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingPhotosCount={pendingPhotos}
        pendingReportsCount={2}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          mode={apiMode}
          onToggleMode={handleToggleMode}
          onRefresh={refreshGlobalMetrics}
          isRefreshing={isRefreshing}
        />

        <main className="view-viewport">
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
    </div>
  );
};
