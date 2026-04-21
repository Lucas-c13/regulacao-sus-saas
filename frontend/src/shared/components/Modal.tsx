import React from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  maxWidth = 'max-w-md',
  footer
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`bg-white w-full ${maxWidth} rounded-[2rem] shadow-2xl border border-white overflow-hidden animate-in zoom-in-95 duration-300`}>
        {/* Header */}
        <div className="p-8 pb-0 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <Icon size={24} />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
