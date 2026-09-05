import React, { useEffect, useState } from 'react';
import { Camera, Check, X, ShieldCheck } from 'lucide-react';
import { api, PhotoQueueItem } from '../services/api';

export const PhotosView: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="var(--color-success)" />
          <span>Automated pre-screening complete</span>
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

                  {/* Clean 1-Click Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleReview(item.photoId, 'REJECT', 'Rejected: Guidelines violation')}
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
    </div>
  );
};
