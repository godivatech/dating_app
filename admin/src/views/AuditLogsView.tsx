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
    <div className="animate-fade-in flex flex-col gap-4 sm:gap-5">
      {/* Header Banner */}
      <div className="glass-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Administrative Audit Log
            </h2>
            <div className="text-xs sm:text-[13px] text-slate-500">
              Tamper-evident chronological log of staff sanctions, role changes, and photo reviews
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          {/* Action Filter Dropdown */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Filter size={14} className="text-slate-400 flex-shrink-0" />
            <select
              className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
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
          <div className="relative flex-1 sm:w-56">
            <Search
              size={14}
              className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              className="input-search text-xs sm:text-sm pl-8 py-2 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="btn btn-glass btn-sm text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
            title="Download audit trail as CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Log Feed Card */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left min-w-[760px]">
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-tertiary)',
                }}
              >
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Moderator / Admin</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Action Executed</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Target Member</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Audit Reason / Justification</th>
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
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {log.adminId}
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">
                      <span
                        className={`badge text-xs ${
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
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900">
                        {log.targetUserName || 'Member'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[130px]" title={log.targetUserId}>
                        {log.targetUserId.length > 12 ? `${log.targetUserId.slice(0, 8)}...` : log.targetUserId}
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm text-slate-600 max-w-xs truncate" title={log.reason}>
                      {log.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
