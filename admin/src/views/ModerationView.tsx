import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { DisciplineModal, DisciplineAction } from '../components/DisciplineModal';
import { api, AbuseReportItem } from '../services/api';

export const ModerationView: React.FC = () => {
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleDismiss = async (reportId: string) => {
    await api.dismissReport(reportId);
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: 'DISMISSED' } : r)),
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={19} color="var(--text-secondary)" />
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Trust &amp; Safety Queue
            </h2>
            <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
              Member reports queue with contextual chat evidence inspection
            </div>
          </div>
        </div>

        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {reports.filter((r) => r.status === 'OPEN').length} Open Case(s)
        </div>
      </div>

      {/* Reports Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {reports.map((report) => {
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
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span
                      className={`badge ${
                        isOpen ? 'badge-warning' : 'badge-neutral'
                      }`}
                    >
                      {report.status}
                    </span>
                    <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {report.reason}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>
                      Reporter: <strong style={{ color: 'var(--text-secondary)' }}>{report.reporterName}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(report.reportedAt).toLocaleDateString()}
                    </span>
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
                <span>{report.reportedContentSnippet}</span>
              </div>

              {/* Action Controls */}
              {isOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => handleDismiss(report.id)}
                    className="btn btn-glass"
                  >
                    Dismiss (Unfounded)
                  </button>
                  <button
                    onClick={() =>
                      setSelectedDisciplineTarget({
                        id: report.targetUserId,
                        name: report.targetName,
                        reportId: report.id,
                      })
                    }
                    className="btn btn-warning"
                  >
                    <AlertTriangle size={14} />
                    <span>Issue Sanction</span>
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={15} />
                  <span>Report closed and archived in safety audit log.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
    </div>
  );
};
