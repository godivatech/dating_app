import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  X,
  ShieldCheck,
  Eye,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';
import { api, PhotoQueueItem } from '../services/api';
import { UserDrawer } from '../components/UserDrawer';

export const PhotosView: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  // Rejection Dialog State
  const [rejectingItem, setRejectingItem] = useState<PhotoQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Face not clearly visible / Blurry');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPendingPhotos();
      setPhotos(data);
    } catch (err) {
      console.error('Failed to load photos queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleReview = async (
    photoId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ) => {
    setProcessingId(photoId);
    try {
      await api.reviewPhoto(photoId, action, reason);
      setPhotos((prev) => prev.filter((p) => p.photoId !== photoId));
    } catch (err) {
      console.error('Failed to review photo', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    const finalReason = customRejectReason.trim() || rejectReason;
    await handleReview(rejectingItem.photoId, 'REJECT', `Photo rejected: ${finalReason}`);
    setRejectingItem(null);
    setCustomRejectReason('');
  };

  const handleBatchApproveAll = async () => {
    if (photos.length === 0) return;
    if (!window.confirm(`Approve all ${photos.length} pending photos in the queue?`)) return;

    for (const p of photos) {
      await api.reviewPhoto(p.photoId, 'APPROVE');
    }
    setPhotos([]);
  };

  const standardReasons = [
    'Face not clearly visible / Blurry',
    'Explicit or NSFW content',
    'Suspected impersonation or celebrity photo',
    'Underage or minor suspect',
    'Watermark, border, or heavy promotional overlay',
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '32px', color: 'var(--text-tertiary)' }}>
        Loading photo moderation queue...
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4 sm:gap-5">
      {/* Queue Header & SLA Banner */}
      <div className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex-shrink-0">
            <Camera size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Photo Verification Queue
            </h2>
            <div className="text-xs sm:text-[13px] text-slate-500">
              {photos.length} photo{photos.length === 1 ? '' : 's'} awaiting administrative verification
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {photos.length > 0 && (
            <button
              onClick={handleBatchApproveAll}
              className="btn btn-glass btn-sm text-xs sm:text-sm"
              title="Approve all currently queued photos"
            >
              <CheckCheck size={14} className="text-emerald-600" />
              <span>Approve All ({photos.length})</span>
            </button>
          )}

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span className="hidden xs:inline">Pre-screening OK</span>
          </div>
        </div>
      </div>

      {/* Grid or Empty State */}
      {photos.length === 0 ? (
        <div className="glass-card p-10 sm:p-14 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <Check size={24} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Queue Clear
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
            All member profile photos have been inspected and verified against community standards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4.5">
          {photos.map((item) => {
            const isBusy = processingId === item.photoId;
            return (
              <div
                key={item.photoId}
                className="glass-card overflow-hidden flex flex-col"
              >
                {/* Image Container */}
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '4/5',
                    backgroundColor: 'var(--bg-surface)',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={item.photoUrl}
                    alt="Review target"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#FFFFFF',
                    }}
                  >
                    SLOT #{item.position + 1}
                  </div>

                  <button
                    onClick={() => setInspectUserId(item.userId)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '3px 7px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Inspect user profile dossier"
                  >
                    <Eye size={12} />
                    <span className="hidden xs:inline">Dossier</span>
                  </button>
                </div>

                {/* Card Meta & Actions */}
                <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                  <div className="mb-2 sm:mb-3">
                    <div className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 truncate">
                      {item.displayName}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                      {new Date(item.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setRejectingItem(item)}
                      disabled={isBusy}
                      className="btn btn-danger btn-sm text-[11px] sm:text-xs px-1.5 sm:px-3 py-1.5 sm:py-2 w-full justify-center"
                    >
                      <X size={13} />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleReview(item.photoId, 'APPROVE')}
                      disabled={isBusy}
                      className="btn btn-primary btn-sm text-[11px] sm:text-xs px-1.5 sm:px-3 py-1.5 sm:py-2 w-full justify-center"
                    >
                      <Check size={13} />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingItem && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[100] overflow-y-auto"
          onClick={() => setRejectingItem(null)}
        >
          <div
            className="glass-card animate-fade-in w-full max-w-[500px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Reject Photo: {rejectingItem.displayName}
                </h3>
              </div>
              <button
                onClick={() => setRejectingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="text-xs sm:text-sm text-slate-600">
                Select a standard community guideline violation reason or specify a custom reason:
              </div>

              {/* Standard Reason Pills */}
              <div className="flex flex-col gap-2">
                {standardReasons.map((r) => {
                  const isSelected = rejectReason === r && !customRejectReason;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setRejectReason(r);
                        setCustomRejectReason('');
                      }}
                      className={`p-2.5 sm:p-3 rounded-lg text-left text-xs sm:text-sm transition-all border ${
                        isSelected
                          ? 'bg-rose-50 text-rose-700 border-rose-300 font-semibold shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              {/* Custom Reason Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Or Custom Rejection Reason
                </label>
                <input
                  type="text"
                  className="input-search text-xs sm:text-sm w-full py-2 px-3"
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Specify custom reason (optional)..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn btn-glass btn-sm text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="btn btn-danger btn-sm text-xs sm:text-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Dossier Drawer */}
      <UserDrawer
        userId={inspectUserId}
        onClose={() => setInspectUserId(null)}
        onDisciplineSuccess={() => fetchQueue()}
      />
    </div>
  );
};
