import React, { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { api, AuditLogItem } from '../services/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getAuditLogs().then(setLogs);
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.actionType.toLowerCase().includes(search.toLowerCase()) ||
      l.reason.toLowerCase().includes(search.toLowerCase()) ||
      l.targetUserName?.toLowerCase().includes(search.toLowerCase()),
  );

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
              Tamper-evident chronological log of staff sanctions and approvals
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={15}
            color="var(--text-tertiary)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail..."
          />
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
            {filteredLogs.map((log) => (
              <tr
                key={log.id}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {log.adminId}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span
                    className={`badge ${
                      log.actionType.includes('BAN')
                        ? 'badge-danger'
                        : log.actionType.includes('MUTE') || log.actionType.includes('SHADOWBAN')
                        ? 'badge-warning'
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
