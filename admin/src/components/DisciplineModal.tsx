import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, AlertTriangle, CheckCircle, Ban, VolumeX, EyeOff, RotateCcw } from 'lucide-react';

export type DisciplineAction =
  | 'WARN'
  | 'MUTE_24H'
  | 'SHADOWBAN_7D'
  | 'BAN'
  | 'UNBAN'
  | 'RESET_STRIKES';

interface DisciplineModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onConfirm: (action: DisciplineAction, reason: string) => Promise<void>;
}

export const DisciplineModal: React.FC<DisciplineModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onConfirm,
}) => {
  const [selectedAction, setSelectedAction] = useState<DisciplineAction>('MUTE_24H');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const quickReasons = [
    'Violated community standards: Inappropriate or offensive language in direct messages.',
    'Unsolicited external contact information or social media handle sharing.',
    'Commercial solicitation or suspected bot activity.',
    'Multiple user reports confirmed upon human review.',
    'Policy appeal reviewed and approved — sanctions lifted.',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(selectedAction, reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionOptions: Array<{
    id: DisciplineAction;
    label: string;
    description: string;
    icon: any;
    color: string;
    bgColor: string;
  }> = [
    {
      id: 'WARN',
      label: 'Formal Warning',
      description: 'Issues Strike 1 with a high-priority advisory notification.',
      icon: AlertTriangle,
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
    },
    {
      id: 'MUTE_24H',
      label: '24-Hour Chat Mute',
      description: 'Restricts outgoing chat messages for 24h while preserving matches.',
      icon: VolumeX,
      color: 'var(--color-danger)',
      bgColor: 'var(--color-danger-bg)',
    },
    {
      id: 'SHADOWBAN_7D',
      label: '7-Day Shadowban',
      description: 'Completely suppresses user from discovery feeds without alerting bad actor.',
      icon: EyeOff,
      color: '#A78BFA',
      bgColor: 'rgba(167, 139, 250, 0.08)',
    },
    {
      id: 'BAN',
      label: 'Permanent Account Ban',
      description: 'Immediately sets status to BANNED and revokes all active auth sessions.',
      icon: Ban,
      color: 'var(--color-danger)',
      bgColor: 'var(--color-danger-bg)',
    },
    {
      id: 'UNBAN',
      label: 'Reinstate Account (Unban)',
      description: 'Restores user status to ACTIVE and permits login.',
      icon: CheckCircle,
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
    },
    {
      id: 'RESET_STRIKES',
      label: 'Reset Safety Strikes',
      description: 'Clears accumulated strikes back to 0 (Good Standing).',
      icon: RotateCcw,
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
    },
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 26px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--color-danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={22} color="var(--color-danger)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Discipline Action &amp; Sanctions
              </h2>
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Target: <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong> ({userId})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-glass btn-sm"
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '26px' }}>
          {/* Action Selector */}
          <div style={{ marginBottom: '22px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Select Administrative Action
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {actionOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedAction === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedAction(opt.id)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? opt.bgColor : 'var(--bg-surface)',
                      border: isSelected ? `1.5px solid ${opt.color}` : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <Icon size={17} color={opt.color} />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {opt.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.35 }}>
                      {opt.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick-fill Reason Templates */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Quick Presets
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {quickReasons.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(preset)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Preset {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Audit Reason &amp; Justification <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear factual audit justification for this administrative sanction..."
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-glass"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={selectedAction === 'BAN' ? 'btn btn-danger' : selectedAction === 'UNBAN' ? 'btn btn-success' : 'btn btn-warning'}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? 'Executing...' : `Apply ${selectedAction}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
