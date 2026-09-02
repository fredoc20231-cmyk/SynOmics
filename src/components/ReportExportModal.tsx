import React, { useState } from 'react';
import { 
  Download, 
  X, 
  FileText, 
  FileType, 
  Code2, 
  Globe, 
  FileCode, 
  Check, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { SynOmicsAgentRun } from '../types';
import { exportScientificReport, ReportExportFormat } from '../utils/reportExporter';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRun: SynOmicsAgentRun | null;
  sessionTitle?: string;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  currentRun,
  sessionTitle
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ReportExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen || !currentRun) return null;

  const formats: {
    id: ReportExportFormat;
    name: string;
    extension: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    recommended?: boolean;
  }[] = [
    {
      id: 'pdf',
      name: 'Publication-Grade PDF',
      extension: '.pdf',
      icon: <FileText className="w-5 h-5 text-rose-500" />,
      color: 'rose',
      description: 'Fully formatted multi-page scientific manuscript with executive headers, figures catalog, quantitative tables, and print styles.',
      recommended: true
    },
    {
      id: 'docx',
      name: 'Microsoft Word Document',
      extension: '.docx',
      icon: <FileType className="w-5 h-5 text-blue-500" />,
      color: 'blue',
      description: 'Editable Word document formatted with standard WordprocessingML, heading hierarchies, styled tables, and biological synthesis.'
    },
    {
      id: 'html',
      name: 'Interactive Standalone Web Page',
      extension: '.html',
      icon: <Globe className="w-5 h-5 text-emerald-500" />,
      color: 'emerald',
      description: 'Self-contained responsive HTML report with embedded styles, interactive data tables, color-coded badges, and print stylesheets.'
    },
    {
      id: 'json',
      name: 'Raw Structured JSON',
      extension: '.json',
      icon: <Code2 className="w-5 h-5 text-amber-500" />,
      color: 'amber',
      description: 'Complete machine-readable payload containing multi-agent execution telemetry, steps, figure data points, and table matrices.'
    },
    {
      id: 'text',
      name: 'Plain Text / Markdown',
      extension: '.txt',
      icon: <FileCode className="w-5 h-5 text-slate-500" />,
      color: 'slate',
      description: 'Clean ASCII formatted text document with bordered tables, structured step traces, and validation protocols.'
    }
  ];

  const handleExecuteExport = () => {
    setIsExporting(true);
    try {
      exportScientificReport(currentRun, selectedFormat, {
        sessionTitle: sessionTitle || `Autonomous Multi-Agent Investigation (${currentRun.query.slice(0, 40)}...)`
      });
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setIsExporting(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Export failed:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white dark:bg-[#131A29] rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2DDD2] dark:border-[#1E293B] flex items-center justify-between bg-[#FAF9F5] dark:bg-[#0B0F17]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Download Scientific Investigation Report
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Select your preferred publication or data format
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Format Selection */}
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 text-xs text-[#065F46] dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Verified Grounded Dataset:</span> Includes {currentRun.agentsInvolved?.length || 4} specialized agents, {currentRun.figures?.length || 5} scientific figures, and {currentRun.tables?.length || 4} quantitative data tables.
            </div>
          </div>

          <div className="space-y-2">
            {formats.map((fmt) => {
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-[#131A29] border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-400/50'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B] shrink-0">
                    {fmt.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {fmt.name}
                      </span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {fmt.extension}
                      </span>
                      {fmt.recommended && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 leading-relaxed">
                      {fmt.description}
                    </p>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0B0F17] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            {exportSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Downloaded Successfully!</span>
              </>
            ) : isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating {selectedFormat.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Report ({selectedFormat.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
