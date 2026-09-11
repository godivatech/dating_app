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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Queue Header & SLA Banner */}
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
          <Camera size={19} color="var(--text-secondary)" />
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Photo Verification Queue
            </h2>
            <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
              {photos.length} photo{photos.length === 1 ? '' : 's'} awaiting administrative verification
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {photos.length > 0 && (
            <button
              onClick={handleBatchApproveAll}
              className="btn btn-glass btn-sm"
              title="Approve all currently queued photos"
            >
              <CheckCheck size={14} color="var(--color-success)" />
              <span>Approve All ({photos.length})</span>
            </button>
          )}

          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="var(--color-success)" />
            <span>Automated pre-screening complete</span>
          </div>
        </div>
      </div>

      {/* Grid or Empty State */}
      {photos.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={24} color="var(--color-success)" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Queue Clear
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.45 }}>
            All member profile photos have been inspected and verified against community standards.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          {photos.map((item) => {
            const isBusy = processingId === item.photoId;
            return (
              <div
                key={item.photoId}
                className="glass-card"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
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
                      top: '10px',
                      left: '10px',
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      fontSize: '11px',
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
                      top: '10px',
                      right: '10px',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Inspect user profile dossier"
                  >
                    <Eye size={12} />
                    <span>Dossier</span>
                  </button>
                </div>

                {/* Card Meta & Actions */}
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.displayName}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => setRejectingItem(item)}
                      disabled={isBusy}
                      className="btn btn-danger"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <X size={15} />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleReview(item.photoId, 'APPROVE')}
                      disabled={isBusy}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Check size={15} />
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setRejectingItem(null)}
        >
          <div
            className="glass-card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="var(--color-danger)" />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Reject Photo: {rejectingItem.displayName}
                </h3>
              </div>
              <button
                onClick={() => setRejectingItem(null)}
                className="btn btn-glass btn-sm"
                style={{ padding: '6px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Select a standard community guideline violation reason or specify a custom reason:
              </div>

              {/* Standard Reason Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 500,
                        backgroundColor: isSelected ? 'var(--color-danger-bg)' : 'var(--bg-surface)',
                        color: isSelected ? 'var(--color-danger)' : 'var(--text-secondary)',
                        border: isSelected ? '1px solid var(--color-danger)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              {/* Custom Reason Field */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  Or Custom Rejection Reason
                </label>
                <input
                  type="text"
                  className="input-search"
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Specify custom reason (optional)..."
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn btn-glass"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="btn btn-danger"
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
