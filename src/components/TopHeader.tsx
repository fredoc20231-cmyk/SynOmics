import React, { useState } from 'react';
import { 
  MessageSquare, 
  Sparkles, 
  Compass, 
  Columns2, 
  ChevronDown, 
  Download, 
  SlidersHorizontal, 
  Bot, 
  Layers, 
  Database,
  Check,
  Share2,
  FileDown,
  Plus,
  Mic,
  Volume2,
  Sun,
  Moon,
  FlaskConical,
  UploadCloud,
  FolderOpen
} from 'lucide-react';
import { AppOperatingMode } from '../types';
import { ReportExportFormat } from '../utils/reportExporter';

interface TopHeaderProps {
  currentMode: AppOperatingMode;
  onModeChange: (mode: AppOperatingMode) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onSelectPresetQuery: (query: string) => void;
  onExportReport: (format: ReportExportFormat) => void;
  isAgentRunning: boolean;
  totalProteinsCount: number;
  onNewSession?: () => void;
  onOpenNewAnalysisModal?: () => void;
  onOpenFileUploadModal?: () => void;
  onOpenVoiceModal?: () => void;
  isSpeaking?: boolean;
  isListening?: boolean;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentMode,
  onModeChange,
  selectedModel,
  onSelectModel,
  onSelectPresetQuery,
  onExportReport,
  isAgentRunning,
  totalProteinsCount,
  onNewSession,
  onOpenNewAnalysisModal,
  onOpenFileUploadModal,
  onOpenVoiceModal,
  isSpeaking = false,
  isListening = false,
  isDarkMode = false,
  onToggleDarkMode,
  currentUser,
  onSignIn,
  onSignOut
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [presetsDropdownOpen, setPresetsDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Only the configured Gemini model actually runs server-side. We do not
  // list providers (Claude/GPT/DeepSeek) or a "consensus ensemble" that this
  // build does not execute.
  const models = [
    { id: 'synomics_7', name: 'SynOmics Co-Scientist (Gemini 2.5 Flash)', badge: 'Default' },
    { id: 'gemini_2_5', name: 'Gemini 2.5 Flash (Direct)', badge: 'Reasoning' }
  ];

  const presets = [
    {
      title: 'm6A Epitranscriptomic Modification Profiling',
      query: 'Analyze MeRIP-seq and direct RNA modification profiling data. Identify DRACH consensus motifs, quantify m6A methylation stoichiometry across 3\' UTR and stop codons, and evaluate RNA stability mediated by YTHDF2 / ALKBH5.'
    },
    {
      title: 'EGFR Kinase Inhibitor Docking & ADMET',
      query: 'Perform virtual molecular docking of Gefitinib against EGFR tyrosine kinase (PDB 1M17). Calculate thermodynamic binding affinity (ΔG in kcal/mol), estimated Ki (nM), and comprehensive ADMET profile.'
    },
    {
      title: 'Tumor vs. Normal RNA-Seq Differential Expression',
      query: 'Execute DESeq2 differential expression on RNA-seq count matrix. Generate Volcano plot, PCA sample clustering, and perform KEGG / Reactome pathway enrichment analysis.'
    },
    {
      title: 'Single-Cell Tumor Microenvironment (Scanpy)',
      query: 'Analyze single-cell RNA-seq AnnData matrix. Filter low-quality cells, compute Leiden community clustering, calculate UMAP embeddings, and identify marker genes across T-cells, macrophages, and malignant cells.'
    },
    {
      title: 'KRAS G12C Allosteric Pocket Optimization',
      query: 'Analyze KRAS G12C switch-II binding pocket (PDB 6OIM). Propose de novo bioisosteric modifications to enhance covalent binding kinetics and reduce metabolic clearance.'
    },
    {
      title: 'TMT-16plex Mass Spectrometry Proteomics',
      query: 'Process quantitative bottom-up TMT-16plex LC-MS/MS proteomic matrix. Compute median-polish normalization, log2 fold-changes, and reconstruct protein-protein kinase interaction networks.'
    }
  ];

  return (
    <header className="h-13 shrink-0 border-b border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5]/90 dark:bg-[#0B0F17]/90 backdrop-blur-md px-4 flex items-center justify-between z-20 font-sans">
      {/* Left: Model Selector & Fast Action Shortcuts */}
      <div className="flex items-center gap-2.5">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] shadow-2xs transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate max-w-[180px] sm:max-w-[220px]">
              {models.find(m => m.id === selectedModel)?.name || 'SynOmics-CoScientist 7'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          </button>

          {modelDropdownOpen && (
            <div 
              className="absolute left-0 top-9 w-72 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xl py-1.5 z-50 text-xs animate-fade-in-up"
              onClick={() => setModelDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                Select AI Engine Model
              </div>
              {models.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition-colors ${
                    selectedModel === m.id ? 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-semibold' : 'text-[#334155] dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    <span className="truncate">{m.name}</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {m.badge}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Functional Fast-Action Buttons */}
        {onOpenFileUploadModal && (
          <button
            onClick={onOpenFileUploadModal}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 text-xs font-semibold text-[#334155] dark:text-slate-300 shadow-2xs transition-colors cursor-pointer"
            title="Upload CSV, TSV, VCF, FASTQ, H5AD, or PDB dataset"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Ingest Data</span>
          </button>
        )}

        {onOpenNewAnalysisModal && (
          <button
            onClick={onOpenNewAnalysisModal}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-indigo-600 dark:hover:border-indigo-500 text-xs font-semibold text-[#334155] dark:text-slate-300 shadow-2xs transition-colors cursor-pointer"
            title="Open Interactive Multi-Omics Analysis Studio"
          >
            <FlaskConical className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Analysis Hub</span>
          </button>
        )}
      </div>

      {/* Center: Clean 2-Tab Mode Switcher (Chat & Analysis Hub) */}
      <div className="flex items-center p-1 rounded-xl bg-[#EFE9DC] dark:bg-[#151D2C] border border-[#DDD5C5] dark:border-[#1E293B] shadow-inner text-xs font-medium">
        <button
          onClick={() => onModeChange('basic')}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg transition-all cursor-pointer ${
            currentMode === 'basic'
              ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs font-semibold'
              : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => onModeChange('discovery')}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg transition-all cursor-pointer ${
            currentMode !== 'basic'
              ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs font-semibold'
              : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-500" />
          <span>Analysis Hub</span>
        </button>
      </div>

      {/* Right: Presets & Report Export Dropdowns */}
      <div className="flex items-center gap-2">
        {/* + New Analysis Trigger */}
        {(onNewSession || onOpenNewAnalysisModal) && (
          <button
            onClick={onNewSession || onOpenNewAnalysisModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Start a new empty chat like ChatGPT or Claude"
          >
            <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="hidden sm:inline">+ New Analysis</span>
          </button>
        )}

        {/* Voice Listening & Speaking Trigger */}
        {onOpenVoiceModal && (
          <button
            onClick={onOpenVoiceModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs ${
              isSpeaking
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800 animate-pulse'
                : isListening
                ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800 animate-pulse'
                : 'bg-white/70 dark:bg-[#151D2C] border-[#E2DDD2] dark:border-[#1E293B] hover:bg-white dark:hover:bg-[#192233] text-[#334155] dark:text-slate-300'
            }`}
            title="Voice & Speech Settings (Secret API Enabled)"
          >
            {isSpeaking ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            ) : isListening ? (
              <Mic className="w-3.5 h-3.5 text-rose-600 animate-ping" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span className="hidden md:inline">
              {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Voice'}
            </span>
          </button>
        )}


        {/* Preset Triggers Dropdown */}
        <div className="relative">
          <button
            onClick={() => setPresetsDropdownOpen(!presetsDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:bg-white dark:hover:bg-[#192233] text-xs text-[#334155] dark:text-slate-300 transition-colors shadow-2xs"
            title="Scientific Inquiry Presets"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden lg:inline font-medium">Presets</span>
            <ChevronDown className="w-3 h-3 text-[#64748B]" />
          </button>

          {presetsDropdownOpen && (
            <div 
              className="absolute right-0 top-9 w-80 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xl py-1.5 z-50 text-xs animate-fade-in-up"
              onClick={() => setPresetsDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                Preset Scientific Inquiries
              </div>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPresetQuery(p.query)}
                  className="w-full px-3 py-2 text-left hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition-colors block border-b border-[#F3EFE6] dark:border-slate-800 last:border-none"
                >
                  <div className="font-medium text-[#0F172A] dark:text-slate-100 text-xs">{p.title}</div>
                  <div className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">{p.query}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Report Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:bg-white dark:hover:bg-[#192233] text-xs text-[#334155] dark:text-slate-300 transition-colors shadow-2xs"
            title="Export Synthesis Report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden lg:inline font-medium">Export</span>
          </button>

          {exportDropdownOpen && (
            <div 
              className="absolute right-0 top-9 w-56 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-[#1E293B] shadow-2xl py-1.5 z-50 text-xs animate-fade-in-up divide-y divide-slate-100 dark:divide-slate-800"
              onClick={() => setExportDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#64748B] dark:text-slate-400 font-bold">
                Download Analysis Report
              </div>
              <div className="py-1">
                <button
                  onClick={() => onExportReport('pdf')}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/30 flex items-center justify-between text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileDown className="w-3.5 h-3.5 text-rose-600" />
                    <span className="font-semibold">Publication PDF</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">.pdf</span>
                </button>
                <button
                  onClick={() => onExportReport('docx')}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex items-center justify-between text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileDown className="w-3.5 h-3.5 text-blue-600" />
                    <span>Word Document</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">.docx</span>
                </button>
                <button
                  onClick={() => onExportReport('html')}
                  className="w-full px-3 py-2 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 flex items-center justify-between text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Interactive Web</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">.html</span>
                </button>
                <button
                  onClick={() => onExportReport('json')}
                  className="w-full px-3 py-2 text-left hover:bg-amber-50/50 dark:hover:bg-amber-950/30 flex items-center justify-between text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Structured JSON</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">.json</span>
                </button>
                <button
                  onClick={() => onExportReport('text')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Plain Text / MD</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#64748B]">.txt</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dark/Light Theme Toggle */}
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="flex items-center justify-center p-2 rounded-lg bg-white/70 dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:bg-white dark:hover:bg-[#192233] text-[#334155] dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
            title={isDarkMode ? 'Switch to Warm Linen Light Theme' : 'Switch to Obsidian Dark Theme'}
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>
        )}

        {/* Firebase Authentication & Cloud Sync Profile */}
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-white dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-500 transition-colors text-xs text-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || 'User'} 
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="max-w-[100px] truncate text-[11px] font-medium hidden sm:inline">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#151D2C] border border-[#E2DDD2] dark:border-[#1E293B] rounded-xl shadow-xl py-2 z-50 text-xs"
                onClick={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#E2DDD2] dark:border-[#1E293B]">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser.displayName || 'Researcher'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">
                    {currentUser.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Firebase Cloud Sync Active</span>
                  </div>
                </div>

                <button
                  onClick={onSignOut}
                  className="w-full mt-1 px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-between cursor-pointer"
                >
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>Sign In</span>
          </button>
        )}

        {/* Running Indicator */}
        {isAgentRunning && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Reasoning...</span>
          </div>
        )}
      </div>
    </header>
  );
};
