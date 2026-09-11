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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={19} color="var(--text-secondary)" />
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Trust &amp; Safety Queue
            </h2>
            <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
              Member reports queue with contextual chat evidence and dossier inspection
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-warning">{openCount} Open Case(s)</span>
          <span className="badge badge-active">{resolvedCount} Actioned</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-glass'}`}
                style={{ fontSize: '12.5px', padding: '6px 12px' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Reason dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
            <Search
              size={14}
              color="var(--text-tertiary)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="input-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by accused, reporter or reason..."
              style={{ fontSize: '13px' }}
            />
          </div>

          <select
            className="select-filter"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            style={{ fontSize: '13px' }}
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

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      Accused: <strong style={{ color: 'var(--text-primary)' }}>{report.targetName}</strong>
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px', color: report.targetStrikeCount >= 3 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                      Active Strikes: {report.targetStrikeCount} / 4
                    </div>
                  </div>
                </div>

                {/* Evidence Snippet Container */}
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '16px',
                    fontSize: '14px',
                    fontStyle: 'italic',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <MessageSquare size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  <span>&ldquo;{report.reportedContentSnippet}&rdquo;</span>
                </div>

                {/* Action Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Left: Inspect Member Profile */}
                  <button
                    onClick={() => setInspectUserId(report.targetUserId)}
                    className="btn btn-glass btn-sm"
                    title="Open full dossier with photos, bio, and strikes"
                  >
                    <Eye size={14} />
                    <span>Inspect Accused Dossier</span>
                  </button>

                  {/* Right: Actions */}
                  {isOpen ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => handleDismiss(report)}
                        className="btn btn-glass btn-sm"
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
                        className="btn btn-warning btn-sm"
                      >
                        <AlertTriangle size={14} />
                        <span>Issue Sanction</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
