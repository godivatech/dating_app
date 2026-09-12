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
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in w-full max-w-[560px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start sm:items-center justify-between gap-3 bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-100">
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Discipline Action &amp; Sanctions
              </h2>
              <div className="text-xs sm:text-[13px] text-slate-500 mt-0.5 truncate">
                Target: <strong className="text-slate-800">{userName}</strong>
                <span className="font-mono text-[11px] text-slate-400 ml-1.5 hidden xs:inline">
                  ({userId.length > 12 ? `${userId.slice(0, 8)}...` : userId})
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body (Scrollable if height constrained) */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {/* Action Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Administrative Action
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              {actionOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedAction === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedAction(opt.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} color={opt.color} className="flex-shrink-0" />
                      <span className={`text-xs sm:text-[13px] font-bold ${
                        isSelected ? 'text-slate-900' : 'text-slate-700'
                      }`}>
                        {opt.label}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500 leading-tight">
                      {opt.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick-fill Reason Templates */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="px-2.5 py-1 rounded-full text-xs bg-slate-100 border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
                >
                  Preset {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Audit Reason &amp; Justification <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear factual audit justification for this administrative sanction..."
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:border-slate-400 outline-none transition-colors resize-y"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-glass text-xs sm:text-sm px-3.5 py-2"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn text-xs sm:text-sm px-4 py-2 ${
                selectedAction === 'BAN'
                  ? 'btn-danger'
                  : selectedAction === 'UNBAN'
                  ? 'btn-success'
                  : 'btn-warning'
              }`}
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
