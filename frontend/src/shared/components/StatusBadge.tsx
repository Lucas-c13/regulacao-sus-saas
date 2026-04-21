import React from 'react';

type BadgeType = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  type?: BadgeType;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  label, 
  type = 'neutral',
  dot = true
}) => {
  const styles: Record<BadgeType, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200'
  };

  const dots: Record<BadgeType, string> = {
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${styles[type]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dots[type]}`} />}
      {label}
    </span>
  );
};
