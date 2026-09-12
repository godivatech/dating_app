import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Search,
  Eye,
  XCircle,
} from 'lucide-react';
import { DisciplineModal, DisciplineAction } from '../components/DisciplineModal';
import { UserDrawer } from '../components/UserDrawer';
import { api, AbuseReportItem } from '../services/api';

export const ModerationView: React.FC = () => {
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const data = await api.getReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const [selectedDisciplineTarget, setSelectedDisciplineTarget] = useState<{
    id: string;
    name: string;
    reportId: string;
  } | null>(null);

  const handleDismiss = async (report: AbuseReportItem) => {
    await api.dismissReport(report.id, report.targetUserId);
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status: 'DISMISSED' } : r)),
    );
  };

  const handleExecuteDiscipline = async (
    action: DisciplineAction,
    reason: string,
  ) => {
    if (!selectedDisciplineTarget) return;
    await api.executeDiscipline(selectedDisciplineTarget.id, action, reason);
    setReports((prev) =>
      prev.map((r) =>
        r.id === selectedDisciplineTarget.reportId
          ? { ...r, status: 'RESOLVED' }
          : r,
      ),
    );
    setSelectedDisciplineTarget(null);
  };

  // Filter logic
  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (reasonFilter && r.reason !== reasonFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchReporter = r.reporterName.toLowerCase().includes(q) || r.reporterId.toLowerCase().includes(q);
      const matchTarget = r.targetName.toLowerCase().includes(q) || r.targetUserId.toLowerCase().includes(q);
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchSnippet = r.reportedContentSnippet.toLowerCase().includes(q);
      if (!matchReporter && !matchTarget && !matchReason && !matchSnippet) return false;
    }
    return true;
  });

  const openCount = reports.filter((r) => r.status === 'OPEN').length;
  const resolvedCount = reports.filter((r) => r.status === 'RESOLVED').length;
  const dismissedCount = reports.filter((r) => r.status === 'DISMISSED').length;

  return (
    <div className="animate-fade-in flex flex-col gap-4 sm:gap-5">
      {/* Header Banner */}
      <div className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex-shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Trust &amp; Safety Queue
            </h2>
            <div className="text-xs sm:text-[13px] text-slate-500">
              Member reports queue with contextual chat evidence and dossier inspection
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-warning text-xs">{openCount} Open Case(s)</span>
          <span className="badge badge-active text-xs">{resolvedCount} Actioned</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {[
            { id: 'ALL', label: `All (${reports.length})` },
            { id: 'OPEN', label: `Open (${openCount})` },
            { id: 'RESOLVED', label: `Actioned (${resolvedCount})` },
            { id: 'DISMISSED', label: `Dismissed (${dismissedCount})` },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`btn btn-sm text-xs px-3 py-1.5 ${active ? 'btn-primary' : 'btn-glass'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Reason dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1 lg:max-w-xl lg:justify-end">
          <div className="relative flex-1 w-full">
            <Search
              size={14}
              className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              className="input-search text-xs sm:text-sm pl-8 py-2 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by accused, reporter or reason..."
            />
          </div>

          <select
            className="select-filter text-xs sm:text-sm w-full sm:w-auto"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="">All Violation Reasons</option>
            <option value="Guidelines Violation">Guidelines Violation</option>
            <option value="Aggressive messaging reported by match">Aggressive Messaging</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
            <option value="SPAM">Spam or Solicitation</option>
            <option value="FAKE_PROFILE">Fake Profile / Impersonation</option>
            <option value="UNDERAGE">Suspected Minor</option>
          </select>
        </div>
      </div>

      {/* Reports Feed */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Loading safety reports...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            No Reports Matching Filter
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
            All reports in this view have been processed or no cases match your search.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredReports.map((report) => {
            const isOpen = report.status === 'OPEN';
            return (
              <div
                key={report.id}
                className="glass-card"
                style={{
                  padding: '22px 24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span
                        className={`badge ${
                          isOpen
                            ? 'badge-warning'
                            : report.status === 'RESOLVED'
                            ? 'badge-active'
                            : 'badge-neutral'
                        }`}
                      >
                        {report.status}
                      </span>
                      <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {report.reason}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span>
                        Reporter: <strong style={{ color: 'var(--text-secondary)' }}>{report.reporterName}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(report.reportedAt).toLocaleDateString()} at {new Date(report.reportedAt).toLocaleTimeString()}
                      </span>
                      <span>•</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Case #{report.id.slice(-6)}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-xs sm:text-[13.5px] text-slate-600">
                      Accused: <strong className="text-slate-900">{report.targetName}</strong>
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 ${report.targetStrikeCount >= 3 ? 'text-rose-600' : 'text-amber-600'}`}>
                      Active Strikes: {report.targetStrikeCount} / 4
                    </div>
                  </div>
                </div>

                {/* Evidence Snippet Container */}
                <div className="p-3 sm:p-3.5 rounded-lg bg-slate-50 border border-slate-200 mb-3.5 text-xs sm:text-sm italic text-slate-600 flex items-start gap-2.5 break-words min-w-0">
                  <MessageSquare size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="break-words min-w-0">&ldquo;{report.reportedContentSnippet}&rdquo;</span>
                </div>

                {/* Action Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  {/* Left: Inspect Member Profile */}
                  <button
                    onClick={() => setInspectUserId(report.targetUserId)}
                    className="btn btn-glass btn-sm text-xs sm:text-sm"
                    title="Open full dossier with photos, bio, and strikes"
                  >
                    <Eye size={14} />
                    <span>Inspect Accused Dossier</span>
                  </button>

                  {/* Right: Actions */}
                  {isOpen ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleDismiss(report)}
                        className="btn btn-glass btn-sm text-xs flex-1 sm:flex-initial"
                      >
                        <XCircle size={14} />
                        <span>Dismiss (Unfounded)</span>
                      </button>
                      <button
                        onClick={() =>
                          setSelectedDisciplineTarget({
                            id: report.targetUserId,
                            name: report.targetName,
                            reportId: report.id,
                          })
                        }
                        className="btn btn-warning btn-sm text-xs flex-1 sm:flex-initial"
                      >
                        <AlertTriangle size={14} />
                        <span>Issue Sanction</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-[13px] font-medium text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle size={15} />
                      <span>{report.status === 'RESOLVED' ? 'Actioned and recorded in safety audit log.' : 'Dismissed as unfounded.'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discipline Modal */}
      {selectedDisciplineTarget && (
        <DisciplineModal
          isOpen={true}
          onClose={() => setSelectedDisciplineTarget(null)}
          userId={selectedDisciplineTarget.id}
          userName={selectedDisciplineTarget.name}
          onConfirm={handleExecuteDiscipline}
        />
      )}

      {/* Full User Dossier Drawer */}
      <UserDrawer
        userId={inspectUserId}
        onClose={() => setInspectUserId(null)}
        onDisciplineSuccess={() => fetchReports()}
      />
    </div>
  );
};
