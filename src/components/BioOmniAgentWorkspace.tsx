import React, { useState } from 'react';
import { BioOmniAgentRun, BioOmniToolDeclaration } from '../types';
import { 
  Sparkles, 
  Send, 
  Terminal, 
  CheckCircle2, 
  ArrowRight, 
  Database, 
  GitFork, 
  Activity, 
  Flame, 
  Pill, 
  Sliders, 
  FlaskConical, 
  Download, 
  Copy, 
  Check, 
  Lightbulb, 
  Layers, 
  ShieldCheck,
  RefreshCw,
  Dna,
  Binary
} from 'lucide-react';

export interface BioOmniAgentWorkspaceProps {
  currentRun: BioOmniAgentRun | null;
  isRunning: boolean;
  onRunQuery: (query: string, mode?: string) => Promise<void>;
  tools: BioOmniToolDeclaration[];
  onSelectProtein: (symbol: string) => void;
}

export const BioOmniAgentWorkspace: React.FC<BioOmniAgentWorkspaceProps> = ({
  currentRun,
  isRunning,
  onRunQuery,
  tools,
  onSelectProtein
}) => {
  const [inputQuery, setInputQuery] = useState(
    'Investigate oncogenic KRAS G12D signaling in pancreatic cancer, identify synthetic lethal partners and screen drug repurposing candidates'
  );
  const [agentMode, setAgentMode] = useState<'autonomous' | 'interactive' | 'protocol_designer' | 'variant_prioritizer'>('autonomous');
  const [copied, setCopied] = useState(false);
  const [activeToolSandbox, setActiveToolSandbox] = useState<string | null>(null);
  const [sandboxParams, setSandboxParams] = useState<Record<string, any>>({});
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [isExecutingSandbox, setIsExecutingSandbox] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isRunning) return;
    onRunQuery(inputQuery.trim(), agentMode);
  };

  const handleCopyReport = () => {
    if (!currentRun?.finalSynthesis) return;
    const text = `# SynOmics Universal Co-Scientist Investigation Report
Query: ${currentRun.query}
Date: ${new Date(currentRun.timestamp).toLocaleString()}
Confidence: ${currentRun.finalSynthesis.confidenceScore}%

## Key Insights
${currentRun.finalSynthesis.keyInsights.map(k => `- ${k}`).join('\n')}

## Biological & Molecular Mechanisms
${currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms || ''}

## Therapeutic Implications & Druggability
${currentRun.finalSynthesis.therapeuticImplications}

## Recommended Validation Experiments
${currentRun.finalSynthesis.recommendedExperiments.map(e => `- ${e}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSandboxTool = async (toolId: string) => {
    setIsExecutingSandbox(true);
    setSandboxResult(null);
    try {
      const res = await fetch('/api/bio/tool-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, params: sandboxParams })
      });
      const data = await res.json();
      setSandboxResult(data.result);
    } catch (err) {
      console.error('Failed to execute tool sandbox:', err);
    } finally {
      setIsExecutingSandbox(false);
    }
  };

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'Database': return <Database className="w-4 h-4 text-emerald-400" />;
      case 'Activity': return <Activity className="w-4 h-4 text-blue-400" />;
      case 'GitFork': return <GitFork className="w-4 h-4 text-purple-400" />;
      case 'FlaskConical': return <FlaskConical className="w-4 h-4 text-amber-400" />;
      case 'Pill': return <Pill className="w-4 h-4 text-rose-400" />;
      case 'Dna': return <Dna className="w-4 h-4 text-cyan-400" />;
      case 'Binary': return <Binary className="w-4 h-4 text-indigo-400" />;
      default: return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Prompt Engine Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              SynOmics Autonomous Co-Scientist Agent Loop
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {(['autonomous', 'interactive', 'protocol_designer', 'variant_prioritizer'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAgentMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  agentMode === m
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Enter complex multi-omics hypothesis or target query..."
              disabled={isRunning}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={isRunning || !inputQuery.trim()}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Reasoning...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Run Investigation
              </>
            )}
          </button>
        </form>

        {/* Quick query pills */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-400">Quick Starters:</span>
          {[
            'KRAS G12D synthetic lethal screen & drug repurposing in PDAC',
            'TP53 hotspot R175H structural destabilization & zinc rescue',
            'Type 2 Diabetes GWAS fine-mapping & islet eQTL colocalization',
            'Gut microbiome dysbiosis and butyrate depletion in IBD',
            'BRCA1 frameshift ACMG 5-tier classification & PARPi sensitivity'
          ].map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInputQuery(prompt)}
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {prompt.split(' ')[0]} {prompt.split(' ')[1]}...
            </button>
          ))}
        </div>
      </div>

      {/* Main Agent Reasoning Stream */}
      {currentRun && (
        <div className="space-y-6">
          {/* Executive Synthesis Card */}
          {currentRun.finalSynthesis && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-50 to-slate-100 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-500/30 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Peer-Review Grade Biological Synthesis
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Evaluated across {currentRun.steps.length} multi-omics execution steps • Confidence: {currentRun.finalSynthesis.confidenceScore}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Report'}
                  </button>
                </div>
              </div>

              {/* Key Insights */}
              <div className="mb-4">
                <h4 className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> High-Confidence Biological Insights
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {currentRun.finalSynthesis.keyInsights.map((insight, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mechanistic Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Molecular &amp; Pathway Dynamics</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Therapeutic Implications &amp; Translation</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {currentRun.finalSynthesis.therapeuticImplications}
                  </p>
                </div>
              </div>

              {/* Validation Experiments */}
              {currentRun.finalSynthesis.recommendedExperiments && (
                <div className="mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold block mb-1.5">
                    Recommended Wet-Lab / In-Silico Validation Experiments:
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {currentRun.finalSynthesis.recommendedExperiments.map((exp, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                        • {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Autonomous Step Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" /> Multi-Agent Execution Steps &amp; Grounded Observations
            </h3>

            {currentRun.steps.map((step, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/20">
                      {step.stepIndex}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {step.actionTool}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 italic mb-3 pl-8">
                  "{step.thought}"
                </div>

                <div className="pl-8 space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Observation Summary:</span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {step.observation.summary}
                    </p>
                    {step.observation.data && (
                      <pre className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-950 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                        {JSON.stringify(step.observation.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Tool Sandbox Grid */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" /> SynOmics Co-Scientist Tool Registry ({tools.length} Universal Tools)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct dry-lab execution engine across Genomics, Transcriptomics, Proteomics, Single-Cell, Spatial Omics, and Metagenomics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveToolSandbox(t.id === activeToolSandbox ? null : t.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                activeToolSandbox === t.id
                  ? 'bg-emerald-500/5 dark:bg-emerald-950/30 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  {getToolIcon(t.icon)}
                  {t.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                  {t.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {t.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Export alias for backward compatibility
export const SynOmicsAgentWorkspace = BioOmniAgentWorkspace;
