import React, { useEffect, useState } from 'react';
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
import { api, UserDetail } from '../services/api';
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

  useEffect(() => {
    if (!userId) {
      setDetail(null);
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

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 60,
        }}
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '500px',
          maxWidth: '100vw',
          backgroundColor: 'var(--bg-canvas)',
          borderLeft: '1px solid var(--border-subtle)',
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Member Profile Dossier
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {detail?.profile?.displayName || 'Loading...'}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-glass btn-sm" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div style={{ padding: '36px', textAlign: 'center', fontSize: '14px', color: 'var(--text-tertiary)' }}>
              Loading user dossier...
            </div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* User Primary Card */}
              <div
                className="glass-card"
                style={{
                  padding: '18px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                }}
              >
                <img
                  src={
                    detail.profile?.photos?.[0]?.thumbnailUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                  }
                  alt="Profile"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: 'var(--radius-md)',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {detail.profile?.displayName}, {detail.profile?.age}
                    </h2>
                    <span
                      className={`badge ${
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
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: detail.role === 'ADMIN' ? 'var(--primary-brand)' : detail.role === 'MODERATOR' ? 'var(--color-warning)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="USER">ROLE: USER</option>
                      <option value="MODERATOR">ROLE: MODERATOR</option>
                      <option value="ADMIN">ROLE: ADMIN</option>
                    </select>
                  </div>

                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Phone size={14} color="var(--text-tertiary)" />
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{detail.phoneNumber}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <MapPin size={14} color="var(--text-tertiary)" />
                      <span>
                        {detail.profile?.locationCity || 'Bengaluru'}, {detail.profile?.locationRegion || 'Karnataka'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Strike Meter */}
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--text-secondary)" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Safety Strike Status
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: (detail.strikes?.length || 0) === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {detail.strikes?.length || 0} of 4 Strikes
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {[1, 2, 3, 4].map((step) => {
                    const isFired = (detail.strikes?.length || 0) >= step;
                    return (
                      <div
                        key={step}
                        style={{
                          flex: 1,
                          height: '6px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isFired
                            ? step === 4
                              ? 'var(--color-danger)'
                              : 'var(--color-warning)'
                            : 'var(--border-subtle)',
                        }}
                      />
                    );
                  })}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Strike 1: Warning • Strike 2: 24h Mute • Strike 3: 7d Shadowban • Strike 4: Ban
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Profile Media ({detail.profile?.photos?.length || 0})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {detail.profile?.photos?.map((photo) => (
                    <div
                      key={photo.id}
                      style={{
                        position: 'relative',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        aspectRatio: '3/4',
                        backgroundColor: 'var(--bg-canvas)',
                      }}
                    >
                      <img
                        src={photo.thumbnailUrl || ''}
                        alt="Slot"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          left: '6px',
                          padding: '3px 7px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(0,0,0,0.75)',
                          color: photo.isPrimary ? 'var(--color-success)' : '#FFFFFF',
                        }}
                      >
                        {photo.isPrimary ? 'PRIMARY' : `SLOT ${photo.position + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bio & Interests */}
              <div className="glass-card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Bio &amp; Lifestyle
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.45 }}>
                  {detail.profile?.bio || 'No personal bio provided.'}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {detail.profile?.interests?.map((int) => (
                    <span
                      key={int.id}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12.5px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {int.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Activity Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600 }}>
                    <Heart size={15} color="var(--text-tertiary)" />
                    <span>Matches Formed</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {detail.mutualMatchesCount}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600 }}>
                    <MessageSquare size={15} color="var(--text-tertiary)" />
                    <span>Direct Notes</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {detail.directNotesSentCount}
                  </div>
                </div>
              </div>

              {/* Subscription Row */}
              <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Crown size={18} color="var(--color-warning)" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Subscription: {detail.subscription?.planType || 'FREE TIER'}
                    </div>
                    {detail.subscription?.expiresAt && (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        Valid through: {new Date(detail.subscription.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`badge ${detail.subscription ? 'badge-active' : 'badge-neutral'}`}>
                  {detail.subscription ? 'SUBSCRIBED' : 'FREE'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            User: <code style={{ color: 'var(--text-secondary)' }}>{detail?.id}</code>
          </div>
          <button
            onClick={() => setIsDisciplineOpen(true)}
            className="btn btn-warning"
          >
            <AlertTriangle size={15} />
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
    </>
  );
};
