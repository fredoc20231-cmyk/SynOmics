import React, { useState } from 'react';
import { SynOmicsAgentRun, SynOmicsToolDeclaration } from '../types';
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
  RefreshCw
} from 'lucide-react';

export interface SynOmicsAgentWorkspaceProps {
  currentRun: SynOmicsAgentRun | null;
  isRunning: boolean;
  onRunQuery: (query: string, mode?: string) => Promise<void>;
  tools: SynOmicsToolDeclaration[];
  onSelectProtein: (symbol: string) => void;
}

export const SynOmicsAgentWorkspace: React.FC<SynOmicsAgentWorkspaceProps> = ({
  currentRun,
  isRunning,
  onRunQuery,
  tools,
  onSelectProtein
}) => {
  const [inputQuery, setInputQuery] = useState(
    'Perform differential gene expression and pathway enrichment analysis on KRAS-mutant vs wild-type transcriptome profiles'
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
    const text = `# SynOmics Co-Scientist Report
Query: ${currentRun.query}
Date: ${new Date(currentRun.timestamp).toLocaleString()}
Confidence: ${currentRun.finalSynthesis.confidenceScore}%

## Key Insights
${currentRun.finalSynthesis.keyInsights.map(k => `- ${k}`).join('\n')}

## Molecular Mechanisms
${currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms || ''}

## Therapeutic Implications
${currentRun.finalSynthesis.therapeuticImplications}

## Recommended Experiments
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
      const res = await fetch('/api/synomics/tool-execute', {
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
      case 'GitFork': return <GitFork className="w-4 h-4 text-indigo-400" />;
      case 'Activity': return <Activity className="w-4 h-4 text-cyan-400" />;
      case 'Flame': return <Flame className="w-4 h-4 text-amber-400" />;
      case 'Pill': return <Pill className="w-4 h-4 text-pink-400" />;
      case 'Sliders': return <Sliders className="w-4 h-4 text-purple-400" />;
      case 'FlaskConical': return <FlaskConical className="w-4 h-4 text-yellow-400" />;
      default: return <Terminal className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Query & SynOmics Agent Controller */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                SynOmics-A1 Synaptic Co-Scientist Agent
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous multi-step reasoning across proteomics, single-cell transcriptomics, SynGO, and in-silico perturbations.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setAgentMode('autonomous')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                agentMode === 'autonomous' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Autonomous Co-Scientist
            </button>
            <button
              onClick={() => setAgentMode('variant_prioritizer')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                agentMode === 'variant_prioritizer' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Variant Prioritizer
            </button>
            <button
              onClick={() => setAgentMode('protocol_designer')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                agentMode === 'protocol_designer' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Protocol Designer
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            rows={3}
            placeholder="Ask SynOmics a complex multi-omics hypothesis (e.g. 'How does METTL3 m6A methylation regulate oncogenic mRNA stability and translation?')..."
            className="w-full p-4 pr-32 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm resize-none font-medium leading-relaxed"
          />

          <div className="absolute right-3 bottom-3 flex items-center space-x-2">
            <button
              type="submit"
              disabled={isRunning || !inputQuery.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reasoning...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute Co-Scientist</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested Queries */}
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Recommended:
          </span>
          <button
            onClick={() => setInputQuery("Perform differential gene expression and pathway enrichment on KRAS-mutant vs wild-type transcriptome")}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            KRAS Differential Expression
          </button>
          <button
            onClick={() => setInputQuery("Annotate rare missense variants in TP53 and score functional pathogenicity with CADD and AlphaMissense")}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            TP53 Variant Prioritization
          </button>
          <button
            onClick={() => setInputQuery("Cluster single-cell droplet RNA-seq atlas with Scanpy and compute Leiden community resolution")}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            scRNA-seq Leiden Clustering
          </button>
        </div>
      </div>

      {/* Main Co-Scientist Reasoning Trace Stream */}
      {currentRun && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-400" /> Autonomous Reasoning & Tool Execution Traces
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentRun.steps.length} Steps Executed
              </span>
            </div>

            {currentRun.finalSynthesis && (
              <button
                onClick={handleCopyReport}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Markdown' : 'Export Full Report'}</span>
              </button>
            )}
          </div>

          {/* Execution Steps */}
          <div className="space-y-4">
            {currentRun.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md relative overflow-hidden space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-xs">
                      {step.stepIndex}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">
                      SynOmics Thought & Intent
                    </span>
                  </div>

                  {step.actionTool && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300">
                      {getToolIcon(step.actionTool)}
                      <span className="font-semibold">{step.actionTool}</span>
                    </div>
                  )}
                </div>

                {/* Thought Content */}
                <p className="text-sm text-slate-200 leading-relaxed font-medium bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
                  {step.thought}
                </p>

                {/* Action Input */}
                {step.actionInput && (
                  <div className="text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-slate-400 flex items-center gap-2 overflow-x-auto">
                    <span className="text-slate-500 font-bold">Action Input:</span>
                    <code>{JSON.stringify(step.actionInput)}</code>
                  </div>
                )}

                {/* Observation Output */}
                {step.observation && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Tool Observation Summary
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {step.observation.summary}
                    </p>

                    {step.observation.data && (
                      <div className="text-xs font-mono bg-slate-950/80 p-2.5 rounded border border-slate-800 text-slate-300 overflow-x-auto">
                        <pre className="text-[11px] text-indigo-200">
                          {JSON.stringify(step.observation.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Final Multi-Modal Scientific Synthesis */}
          {currentRun.finalSynthesis && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      SynOmics Co-Scientist Final Scientific Synthesis
                    </h3>
                    <p className="text-xs text-slate-400">
                      Peer-review-grade biological conclusions, mechanistic breakdown & translational roadmap
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                  <span className="text-xs text-slate-400 font-medium">Confidence Score:</span>
                  <span className="text-sm font-mono font-bold text-indigo-300">
                    {currentRun.finalSynthesis.confidenceScore}%
                  </span>
                </div>
              </div>

              {/* Key Insights Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Key Multi-Omics Discoveries
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentRun.finalSynthesis.keyInsights.map((insight, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-mono text-xs shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synaptic Molecular Mechanisms */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Molecular &amp; Biological Pathomechanisms
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms || ''}
                </p>
              </div>

              {/* Therapeutic & Translational Potential */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-emerald-400" /> Therapeutic Interventions & Druggable Nodes
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentRun.finalSynthesis.therapeuticImplications}
                </p>
              </div>

              {/* Recommended Validation Experiments */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-yellow-400" /> Recommended Wet-Lab / Dry-Lab Validation Roadmap
                </h4>
                <div className="space-y-2">
                  {currentRun.finalSynthesis.recommendedExperiments.map((exp, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{exp}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SynOmics-E1 Unified Tool Execution Environment (Direct Sandbox) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" /> SynOmics-E1 Synaptic Action Space (Direct Tool Testing)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute individual SynOmics domain tools directly to query raw neuro-omics APIs and database tables.
            </p>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map(t => (
            <div
              key={t.id}
              onClick={() => {
                setActiveToolSandbox(t.id);
                setSandboxParams({});
                setSandboxResult(null);
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                activeToolSandbox === t.id
                  ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    {getToolIcon(t.icon)}
                  </div>
                  <span className="font-semibold text-xs text-white">{t.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                  {t.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {t.description}
              </p>
            </div>
          ))}
        </div>

        {/* Interactive Sandbox Execution Panel */}
        {activeToolSandbox && (
          <div className="p-5 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  Executing: {tools.find(t => t.id === activeToolSandbox)?.name}
                </span>
              </div>
              <button
                onClick={() => handleRunSandboxTool(activeToolSandbox)}
                disabled={isExecutingSandbox}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isExecutingSandbox ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                <span>Run Action</span>
              </button>
            </div>

            {/* Parameters Helper */}
            <div className="text-xs text-slate-400 space-y-2">
              <span className="font-semibold text-slate-300">Tool Parameters:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tools.find(t => t.id === activeToolSandbox)?.parameters.map(p => (
                  <div key={p.name} className="p-2 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1">
                    <span className="font-mono text-indigo-300 font-medium">{p.name} ({p.type})</span>
                    <span className="text-[11px] text-slate-400">{p.description}</span>
                    {p.options && (
                      <select
                        onChange={(e) => setSandboxParams({ ...sandboxParams, [p.name]: e.target.value })}
                        className="mt-1 p-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs font-mono"
                      >
                        {p.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sandbox Result */}
            {sandboxResult && (
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 font-mono">Live Tool Return Value:</span>
                <pre className="text-xs font-mono text-slate-200 overflow-x-auto max-h-60 p-2 bg-slate-950 rounded">
                  {JSON.stringify(sandboxResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

