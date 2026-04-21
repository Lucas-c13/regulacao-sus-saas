import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  label = 'Processando...', 
  className = '',
  size = 24
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-slate-500 font-medium space-y-3 ${className}`}>
      <Loader2 className="animate-spin text-primary" size={size} />
      {label && <span className="text-sm tracking-wide">{label}</span>}
    </div>
  );
};
