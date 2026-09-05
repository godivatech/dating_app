import React, { useEffect, useState } from 'react';
import {
  Search,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, AdminUserListItem } from '../services/api';
import { UserDrawer } from '../components/UserDrawer';
import { DisciplineModal, DisciplineAction } from '../components/DisciplineModal';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Inspection Drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Quick Discipline Modal
  const [disciplineTarget, setDisciplineTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        page,
        limit: 10,
      });
      setUsers(res.users);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, roleFilter, page]);

  const handleDiscipline = async (action: DisciplineAction, reason: string) => {
    if (!disciplineTarget) return;
    await api.executeDiscipline(disciplineTarget.id, action, reason);
    setDisciplineTarget(null);
    fetchUsers();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search & Filter Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search
            size={14}
            color="var(--text-tertiary)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone (+91...), or member ID..."
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            className="select-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>

          <select
            className="select-filter"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="USER">Members</option>
            <option value="MODERATOR">Moderators</option>
            <option value="ADMIN">Administrators</option>
          </select>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
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
                <th style={{ padding: '14px 20px' }}>Member</th>
                <th style={{ padding: '14px 20px' }}>Phone Number</th>
                <th style={{ padding: '14px 20px' }}>Safety Standing</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Joined</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                    Loading member accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                    No member records found matching query criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Persona Photo & Name */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={
                              user.primaryPhotoUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                            }
                            alt="avatar"
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: 'var(--radius-sm)',
                              objectFit: 'cover',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {user.displayName || 'Unset Name'}, {user.age || '—'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              ID: {user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 20px', fontSize: '13.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {user.phoneNumber}
                      </td>

                      {/* Safety Standing */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className={`badge ${
                              user.activeStrikes === 0
                                ? 'badge-active'
                                : user.activeStrikes < 3
                                ? 'badge-warning'
                                : 'badge-danger'
                            }`}
                          >
                            {user.activeStrikes === 0 ? 'Good Standing' : `${user.activeStrikes} Strike${user.activeStrikes > 1 ? 's' : ''}`}
                          </span>
                          {user.isMuted && (
                            <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                              MUTED
                            </span>
                          )}
                          {user.isShadowBanned && (
                            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                              SHADOWBANNED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          className={`badge ${
                            user.status === 'ACTIVE'
                              ? 'badge-active'
                              : user.status === 'BANNED'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedUserId(user.id)}
                            className="btn btn-glass btn-sm"
                            title="Inspect complete member profile dossier"
                          >
                            <Eye size={13} />
                            <span>Inspect</span>
                          </button>
                          <button
                            onClick={() =>
                              setDisciplineTarget({
                                id: user.id,
                                name: user.displayName || 'User',
                              })
                            }
                            className="btn btn-glass btn-sm"
                            title="Apply discipline sanctions"
                          >
                            <AlertTriangle size={13} />
                            <span>Sanction</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13.5px',
            color: 'var(--text-tertiary)',
          }}
        >
          <div>
            Showing <strong style={{ color: 'var(--text-secondary)' }}>{users.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>{totalCount}</strong> members
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-glass btn-sm"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span style={{ padding: '0 8px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={users.length < 10}
              className="btn btn-glass btn-sm"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* User Dossier Drawer */}
      <UserDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onDisciplineSuccess={() => fetchUsers()}
      />

      {/* Quick Discipline Modal */}
      {disciplineTarget && (
        <DisciplineModal
          isOpen={true}
          onClose={() => setDisciplineTarget(null)}
          userId={disciplineTarget.id}
          userName={disciplineTarget.name}
          onConfirm={handleDiscipline}
        />
      )}
    </div>
  );
};
