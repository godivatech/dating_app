import React, { useEffect, useState } from 'react';
import { FileText, Search, Download, Filter } from 'lucide-react';
import { api, AuditLogItem } from '../services/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api.getAuditLogs()
      .then(setLogs)
      .finally(() => setIsLoading(false));
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (actionFilter && !l.actionType.toUpperCase().includes(actionFilter.toUpperCase())) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const matchAction = l.actionType.toLowerCase().includes(s);
      const matchReason = l.reason.toLowerCase().includes(s);
      const matchTarget = l.targetUserName?.toLowerCase().includes(s) || l.targetUserId.toLowerCase().includes(s);
      const matchAdmin = l.adminId.toLowerCase().includes(s);
      if (!matchAction && !matchReason && !matchTarget && !matchAdmin) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Log ID', 'Timestamp', 'Moderator/Admin ID', 'Action Executed', 'Target User ID', 'Target User Name', 'Reason/Justification'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.adminId}"`,
      `"${l.actionType}"`,
      `"${l.targetUserId}"`,
      `"${(l.targetUserName || 'Member').replace(/"/g, '""')}"`,
      `"${l.reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `truelove_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={19} color="var(--text-secondary)" />
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Administrative Audit Log
            </h2>
            <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
              Tamper-evident chronological log of staff sanctions, role changes, and photo reviews
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Action Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-tertiary)" />
            <select
              className="select-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="">All Action Types</option>
              <option value="BAN">Bans &amp; Suspensions</option>
              <option value="MUTE">Mutes</option>
              <option value="SHADOWBAN">Shadowbans</option>
              <option value="WARN">Warnings</option>
              <option value="PHOTO">Photo Reviews</option>
              <option value="ROLE">Role Updates</option>
              <option value="DISMISS">Dismissals</option>
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search
              size={14}
              color="var(--text-tertiary)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="input-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
              style={{ paddingLeft: '32px', fontSize: '12.5px' }}
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="btn btn-glass btn-sm"
            title="Download audit trail as CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                fontSize: '12.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-tertiary)',
              }}
            >
              <th style={{ padding: '14px 20px' }}>Timestamp</th>
              <th style={{ padding: '14px 20px' }}>Moderator / Admin</th>
              <th style={{ padding: '14px 20px' }}>Action Executed</th>
              <th style={{ padding: '14px 20px' }}>Target Member</th>
              <th style={{ padding: '14px 20px' }}>Audit Reason / Justification</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                  Loading security audit trail...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                  No audit log records found matching query criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {log.adminId}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span
                      className={`badge ${
                        log.actionType.includes('BAN')
                          ? 'badge-danger'
                          : log.actionType.includes('MUTE') || log.actionType.includes('SHADOWBAN') || log.actionType.includes('WARN')
                          ? 'badge-warning'
                          : log.actionType.includes('APPROVE') || log.actionType.includes('RESTORE')
                          ? 'badge-active'
                          : 'badge-neutral'
                      }`}
                    >
                      {log.actionType}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.targetUserName || 'Member'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {log.targetUserId}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    {log.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
