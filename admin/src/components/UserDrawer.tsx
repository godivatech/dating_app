import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Shield,
  Heart,
  MessageSquare,
  MapPin,
  Phone,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { api, UserDetail, SafeCoinTransaction } from '../services/api';
import { DisciplineModal, DisciplineAction } from './DisciplineModal';

interface UserDrawerProps {
  userId: string | null;
  onClose: () => void;
  onDisciplineSuccess?: () => void;
}

export const UserDrawer: React.FC<UserDrawerProps> = ({
  userId,
  onClose,
  onDisciplineSuccess,
}) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDisciplineOpen, setIsDisciplineOpen] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantAmount, setGrantAmount] = useState<number>(50);
  const [grantReason, setGrantReason] = useState<string>('Customer Support Resolution');
  const [isGranting, setIsGranting] = useState(false);
  const [coinHistory, setCoinHistory] = useState<SafeCoinTransaction[]>([]);
  const [showCoinHistory, setShowCoinHistory] = useState(false);

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setCoinHistory([]);
      setShowGrantModal(false);
      setShowCoinHistory(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    api.getUserDetail(userId)
      .then((data) => {
        if (isMounted) setDetail(data);
      })
      .catch((err) => console.error('Failed to load user dossier', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    api.getUserCoinHistory(userId)
      .then((history) => {
        if (isMounted) setCoinHistory(history);
      })
      .catch((err) => console.warn('Failed to load coin history', err));

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const handleDiscipline = async (action: DisciplineAction, reason: string) => {
    if (!detail) return;
    await api.executeDiscipline(detail.id, action, reason);
    const updated = await api.getUserDetail(detail.id);
    setDetail(updated);
    if (onDisciplineSuccess) onDisciplineSuccess();
  };

  return createPortal(
    <>
      {/* Backdrop Scrim */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer (Responsive: 100vw on mobile, max-w-[500px] on tablet/desktop) */}
      <aside className="fixed top-0 right-0 bottom-0 h-full h-[100dvh] max-h-[100dvh] w-full sm:max-w-[480px] md:max-w-[520px] bg-slate-50 border-l border-slate-200 z-[99999] flex flex-col shadow-2xl animate-fade-in overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
          <div className="min-w-0 pr-3">
            <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Member Profile Dossier
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5">
              {detail?.profile?.displayName || 'Loading...'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Close dossier"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading user dossier...
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {/* User Primary Card */}
              <div className="glass-card p-3.5 sm:p-4 flex flex-col xs:flex-row gap-3.5 items-start xs:items-center">
                <img
                  src={
                    detail.profile?.photos?.[0]?.thumbnailUrl ||
                    detail.profile?.photos?.[0]?.mediumUrl ||
                    (detail.profile?.gender === 'MAN'
                      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
                      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80')
                  }
                  alt="Profile"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                />

                <div className="flex-1 min-w-0 w-full">
                  {/* Name + Status + Role cluster (Responsive wrap) */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none">
                      {detail.profile?.displayName}, {detail.profile?.age}
                    </h2>
                    <span
                      className={`badge text-[11px] ${
                        detail.status === 'ACTIVE'
                          ? 'badge-active'
                          : detail.status === 'BANNED'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {detail.status}
                    </span>
                    <select
                      value={detail.role}
                      onChange={async (e) => {
                        const newRole = e.target.value as 'USER' | 'MODERATOR' | 'ADMIN';
                        if (window.confirm(`Change role for ${detail.profile?.displayName || 'this user'} to ${newRole}?`)) {
                          await api.updateUserRole(detail.id, newRole);
                          setDetail({ ...detail, role: newRole });
                          if (onDisciplineSuccess) onDisciplineSuccess();
                        }
                      }}
                      title="Update system authorization role"
                      className={`px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 border border-slate-200 cursor-pointer outline-none ${
                        detail.role === 'ADMIN'
                          ? 'text-rose-600'
                          : detail.role === 'MODERATOR'
                          ? 'text-amber-600'
                          : 'text-slate-600'
                      }`}
                    >
                      <option value="USER">ROLE: USER</option>
                      <option value="MODERATOR">ROLE: MODERATOR</option>
                      <option value="ADMIN">ROLE: ADMIN</option>
                    </select>
                  </div>

                  <div className="text-xs sm:text-[13px] text-slate-600 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="font-mono">{detail.phoneNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        {detail.profile?.locationCity || 'Bengaluru'}, {detail.profile?.locationRegion || 'Karnataka'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Strike Meter & Detailed History */}
              <div className="glass-card p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-slate-500" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Safety Strike Status
                    </span>
                  </div>
                  <span className={`text-xs sm:text-sm font-bold ${
                    (detail.strikes?.length || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {detail.strikes?.length || 0} of 4 Strikes
                  </span>
                </div>

                <div className="flex gap-1.5 mb-2.5">
                  {[1, 2, 3, 4].map((step) => {
                    const isFired = (detail.strikes?.length || 0) >= step;
                    return (
                      <div
                        key={step}
                        className={`flex-1 h-1.5 rounded-full transition-colors ${
                          isFired
                            ? step === 4
                              ? 'bg-rose-600'
                              : 'bg-amber-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                  Strike 1: Warning • Strike 2: 24h Mute • Strike 3: 7d Shadowban • Strike 4: Ban
                </div>

                {/* Strike Details & Reason History */}
                {detail.strikes && detail.strikes.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-200 flex flex-col gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Strike History &amp; Reason Logs ({detail.strikes.length})
                    </div>
                    {detail.strikes.map((strike, sIdx) => {
                      const formattedAction = (strike.actionTaken || 'SANCTION')
                        .replace('ADMIN_', '')
                        .replace(/_/g, ' ');
                      return (
                        <div
                          key={strike.id || sIdx}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                              Strike #{strike.strikeNumber || sIdx + 1}: {formattedAction}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              strike.severity === 'CRITICAL' || strike.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {strike.severity}
                            </span>
                          </div>
                          <div className="text-slate-700 text-xs mt-0.5 leading-relaxed">
                            <span className="font-semibold text-slate-900">Reason: </span>
                            {strike.reason}
                          </div>
                          {strike.evidence && (
                            <div className="text-slate-500 text-[11px]">
                              <span className="font-semibold text-slate-700">Evidence: </span>
                              {strike.evidence}
                            </div>
                          )}
                          <div className="text-[10.5px] text-slate-400 mt-0.5">
                            {new Date(strike.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Photos Gallery */}
              <div className="glass-card p-3.5 sm:p-4">
                <div className="text-xs sm:text-sm font-bold text-slate-900 mb-2.5">
                  Profile Media ({detail.profile?.photos?.length || 0})
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {detail.profile?.photos?.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative rounded-md overflow-hidden aspect-[3/4] bg-slate-100 border border-slate-200"
                    >
                      <img
                        src={photo.thumbnailUrl || ''}
                        alt="Slot"
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/75 ${
                        photo.isPrimary ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {photo.isPrimary ? 'PRIMARY' : `SLOT ${photo.position + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bio & Lifestyle */}
              <div className="glass-card p-3.5 sm:p-4">
                <div className="text-xs sm:text-sm font-bold text-slate-900 mb-2">
                  Bio &amp; Lifestyle
                </div>
                <p className="text-xs sm:text-[13.5px] text-slate-600 mb-3 leading-relaxed">
                  {detail.profile?.bio || 'No personal bio provided.'}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {detail.profile?.interests?.map((int) => (
                    <span
                      key={int.id}
                      className="px-2.5 py-1 rounded text-xs bg-slate-100 border border-slate-200 text-slate-600 font-medium"
                    >
                      {int.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Activity Stats */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="glass-card p-3 sm:p-3.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                    <Heart size={14} />
                    <span>Matches</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {detail.mutualMatchesCount}
                  </div>
                </div>

                <div className="glass-card p-3 sm:p-3.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                    <MessageSquare size={14} />
                    <span>Direct Notes</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {detail.directNotesSentCount}
                  </div>
                </div>
              </div>

              {/* Subscription Row */}
              <div className="glass-card p-3 sm:p-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Crown size={18} className="text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {detail.subscription?.planType || 'FREE TIER'}
                    </div>
                    {detail.subscription?.expiresAt && (
                      <div className="text-[11px] text-slate-400 truncate">
                        Valid through: {new Date(detail.subscription.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`badge flex-shrink-0 text-xs ${detail.subscription ? 'badge-active' : 'badge-neutral'}`}>
                  {detail.subscription ? 'SUBSCRIBED' : 'FREE'}
                </span>
              </div>

              {/* Coin Wallet & Consumable Credits Row */}
              <div className="glass-card p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🪙</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Coin Wallet &amp; Balances
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {detail.creditBalance?.coins ?? 0} COINS
                    </span>
                    <button
                      onClick={() => setShowGrantModal(!showGrantModal)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                      title="Grant coins to user"
                    >
                      + Grant
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 p-1.5 rounded">
                    <div className="font-bold text-slate-900">{detail.creditBalance?.directNotes ?? 0}</div>
                    <div className="text-[10px] text-slate-400">Notes</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <div className="font-bold text-slate-900">{detail.creditBalance?.profileBoosts ?? 0}</div>
                    <div className="text-[10px] text-slate-400">Boosts</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <div className="font-bold text-slate-900">{detail.creditBalance?.callPassMinutes ?? 0}m</div>
                    <div className="text-[10px] text-slate-400">Call Mins</div>
                  </div>
                </div>

                {/* Inline Coin Grant Form */}
                {showGrantModal && (
                  <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-lg animate-fade-in">
                    <div className="text-xs font-bold text-amber-900 mb-2">Grant Truelove Coins</div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={grantAmount}
                          onChange={(e) => setGrantAmount(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-24 px-2 py-1 text-xs border border-amber-300 rounded bg-white text-slate-900 font-bold"
                          placeholder="Amount"
                        />
                        <input
                          type="text"
                          value={grantReason}
                          onChange={(e) => setGrantReason(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded bg-white text-slate-900"
                          placeholder="Reason / ticket note"
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          onClick={() => setShowGrantModal(false)}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!detail?.id || grantAmount <= 0) return;
                            try {
                              setIsGranting(true);
                              await api.grantCoins(detail.id, grantAmount, grantReason);
                              setShowGrantModal(false);
                              onDisciplineSuccess?.();
                              const updated = await api.getUserDetail(detail.id);
                              setDetail(updated);
                              const updatedHistory = await api.getUserCoinHistory(detail.id);
                              setCoinHistory(updatedHistory);
                            } catch (err: any) {
                              alert(err.message || 'Failed to grant coins');
                            } finally {
                              setIsGranting(false);
                            }
                          }}
                          disabled={isGranting || grantAmount <= 0}
                          className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
                        >
                          {isGranting ? 'Granting...' : `Confirm +${grantAmount} Coins`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coin History Toggle & Drawer */}
                {coinHistory.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowCoinHistory(!showCoinHistory)}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center justify-between w-full"
                    >
                      <span>Coin Ledger Transactions ({coinHistory.length})</span>
                      <span>{showCoinHistory ? '▲ Hide' : '▼ View'}</span>
                    </button>

                    {showCoinHistory && (
                      <div className="mt-2 max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                        {coinHistory.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100 text-[11px]"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium text-slate-800 truncate">{tx.description || tx.type}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(tx.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 🪙
                              </div>
                              <div className="text-[10px] text-slate-400">Bal: {tx.balanceAfter}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Drawer Footer Actions (Responsive: handles long UUIDs cleanly) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 flex-shrink-0">
          <div className="text-xs text-slate-400 min-w-0 truncate pr-2">
            ID: <code className="inline-block font-mono text-[11px] text-slate-600 truncate max-w-[120px] sm:max-w-[220px] align-bottom" title={detail?.id}>{detail?.id}</code>
          </div>
          <button
            onClick={() => setIsDisciplineOpen(true)}
            className="btn btn-warning btn-sm text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
          >
            <AlertTriangle size={14} />
            <span>Apply Sanction</span>
          </button>
        </div>
      </aside>

      {/* Discipline Modal */}
      {detail && (
        <DisciplineModal
          isOpen={isDisciplineOpen}
          onClose={() => setIsDisciplineOpen(false)}
          userId={detail.id}
          userName={detail.profile?.displayName || 'User'}
          onConfirm={handleDiscipline}
        />
      )}
    </>,
    document.body,
  );
};
