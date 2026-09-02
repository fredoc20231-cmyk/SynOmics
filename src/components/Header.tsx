import React from 'react';
import { 
  Dna, 
  Sparkles, 
  Activity, 
  Database, 
  Sliders, 
  FlaskConical, 
  Share2, 
  Network,
  Layers,
  Cpu
} from 'lucide-react';

export type ActiveTab = 
  | 'synomics_agent'
  | 'synapse_map' 
  | 'multi_omics' 
  | 'network_graph' 
  | 'in_silico' 
  | 'protocol_lab';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickQuery: (query: string) => void;
  isAgentRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickQuery,
  isAgentRunning
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      {/* Top Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Dna className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-emerald-200">
                  SynOmics
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  SynOmics Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Universal Multi-Omics AI Co-Scientist &amp; Precision Biology Platform
              </p>
            </div>
          </div>

          {/* Quick Presets Dropdown / Direct Action */}
          <div className="hidden md:flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
            </span>
            <button
              onClick={() => onQuickQuery("Investigate oncogenic KRAS G12D signaling in pancreatic cancer, identify synthetic lethal partners and screen drug repurposing candidates")}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            >
              KRAS G12D Synthetic Lethality
            </button>
            <button
              onClick={() => onQuickQuery("Analyze TP53 hotspot R175H structural destabilization & zinc rescue")}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            >
              TP53 R175H Structural Rescue
            </button>
            <button
              onClick={() => onQuickQuery("Screen druggable targets restoring excitatory/inhibitory E/I balance in Schizophrenia")}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            >
              E/I Balance in SCZ
            </button>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Gemini 3.7 Flash
              </span>
            </div>

            {isAgentRunning && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium animate-pulse">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>SynOmics Co-Scientist Reasoning...</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-900">
          <button
            onClick={() => onTabChange('synomics_agent')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'synomics_agent'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>SynOmics Co-Scientist</span>
          </button>

          <button
            onClick={() => onTabChange('synapse_map')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'synapse_map'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-300" />
            <span>Subcellular Architecture Map</span>
          </button>

          <button
            onClick={() => onTabChange('multi_omics')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'multi_omics'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-300" />
            <span>Multi-Omics Catalog</span>
          </button>

          <button
            onClick={() => onTabChange('network_graph')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'network_graph'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Network className="w-4 h-4 text-purple-300" />
            <span>Interactome Graph</span>
          </button>

          <button
            onClick={() => onTabChange('in_silico')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'in_silico'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-pink-300" />
            <span>In-Silico Perturbation</span>
          </button>

          <button
            onClick={() => onTabChange('protocol_lab')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'protocol_lab'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-yellow-300" />
            <span>Bio-Protocol Studio</span>
          </button>
        </div>
      </div>
    </header>
  );
};

