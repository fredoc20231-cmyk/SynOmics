import React from 'react';
import { Shield, Sparkles } from 'lucide-react';

interface LegalFooterProps {
  onOpenLegalModal?: () => void;
  onOpenDisclaimer?: () => void;
}

export const LegalFooter: React.FC<LegalFooterProps> = ({ onOpenLegalModal, onOpenDisclaimer }) => {
  const handleOpen = onOpenLegalModal || onOpenDisclaimer || (() => {});
  return (
    <footer className="w-full shrink-0 border-t border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0B0F17] py-2.5 px-4 text-center text-xs text-[#64748B] dark:text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 font-sans">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-[#0F172A] dark:text-slate-200">
            SynOmics ®
          </span>
          <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
          <span>SynOmics Universal Bioinformatics Platform, 2026. All rights reserved.</span>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <button
            onClick={handleOpen}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Legal &amp; Scientific Attribution Notice
          </button>
          <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
          <span className="text-[#64748B] dark:text-slate-400">
            Developer: <strong className="text-[#334155] dark:text-slate-300">Dr. Ahmed Fadiel</strong>
          </span>
        </div>
      </div>
    </footer>
  );
};
