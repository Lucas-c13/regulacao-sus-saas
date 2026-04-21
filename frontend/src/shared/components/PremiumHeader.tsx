import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PremiumHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export const PremiumHeader: React.FC<PremiumHeaderProps> = ({ icon: Icon, title, subtitle, action }) => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary shadow-inner">
          <Icon size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h2>
          <p className="text-slate-500 font-medium">{subtitle}</p>
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-3 w-full md:w-auto">
          {action}
        </div>
      )}
    </div>
  );
};
