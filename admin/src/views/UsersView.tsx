import React, { useEffect, useState } from 'react';
import {
  Search,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
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

  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = [
      'User ID',
      'Phone Number',
      'Display Name',
      'Age',
      'Gender',
      'Status',
      'Role',
      'Active Strikes',
      'Is Muted',
      'Is Shadowbanned',
      'Joined Date',
    ];
    const rows = users.map((u) => [
      `"${u.id}"`,
      `"${u.phoneNumber}"`,
      `"${(u.displayName || 'Unset').replace(/"/g, '""')}"`,
      u.age || '',
      `"${u.gender || ''}"`,
      `"${u.status}"`,
      `"${u.role}"`,
      u.activeStrikes,
      u.isMuted,
      u.isShadowBanned,
      `"${new Date(u.createdAt).toISOString()}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `truelove_members_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Search & Filter Toolbar */}
      <div className="glass-card p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 w-full md:min-w-[280px]">
          <Search
            size={14}
            className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            className="input-search text-xs sm:text-sm pl-9 py-2 w-full"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone (+91...), or member ID..."
          />
        </div>

        {/* Filter Dropdowns & Export */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          <select
            className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial"
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
            className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial"
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

          <button
            onClick={handleExportCSV}
            className="btn btn-glass btn-sm text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
            title="Export current user list to CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left min-w-[760px]">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Member</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Phone Number</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Safety Standing</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Joined</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    Loading member accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    No member records found matching query criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-200 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Persona Photo & Name */}
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              user.primaryPhotoUrl ||
                              (user.gender === 'MAN'
                                ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                                : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80')
                            }
                            alt="avatar"
                            className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-slate-200"
                          />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                              {user.displayName || 'Unset Name'}, {user.age || '—'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono truncate max-w-[130px]" title={user.id}>
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-[13.5px] font-mono text-slate-600 whitespace-nowrap">
                        {user.phoneNumber}
                      </td>

                      {/* Safety Standing */}
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`badge text-xs ${
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
                            <span className="badge badge-warning text-[10px]">
                              MUTED
                            </span>
                          )}
                          {user.isShadowBanned && (
                            <span className="badge badge-neutral text-[10px]">
                              SHADOWBANNED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                        <span
                          className={`badge text-xs ${
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
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-[13px] text-slate-500 whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setSelectedUserId(user.id)}
                            className="btn btn-glass btn-sm text-xs"
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
                            className="btn btn-glass btn-sm text-xs"
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

        {/* Responsive Pagination Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-[13.5px] text-slate-500">
          <div>
            Showing <strong className="text-slate-700">{users.length}</strong> of{' '}
            <strong className="text-slate-700">{totalCount}</strong> members
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-glass btn-sm"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span className="px-2 font-bold text-slate-700">
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
