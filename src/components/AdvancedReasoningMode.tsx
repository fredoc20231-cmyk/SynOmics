import React, { useState } from 'react';
import { 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Cpu, 
  Activity, 
  ShieldAlert, 
  Award, 
  Send, 
  Layers, 
  Dna, 
  Play, 
  Download, 
  Check, 
  Copy,
  Zap,
  FlaskConical,
  BarChart3,
  Table as TableIcon,
  Bot,
  Users,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { SynOmicsAgentRun, SynOmicsToolDeclaration, SynOmicsExecutionStep } from '../types';
import { ScientificFiguresAndTables } from './ScientificFiguresAndTables';
import { ReportExportModal } from './ReportExportModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AdvancedReasoningModeProps {
  currentRun: SynOmicsAgentRun | null;
  isRunning: boolean;
  onRunQuery: (query: string, mode?: 'autonomous' | 'interactive' | 'protocol_designer' | 'variant_prioritizer') => void;
  tools: SynOmicsToolDeclaration[];
  onSelectProtein: (symbol: string) => void;
}

export const AdvancedReasoningMode: React.FC<AdvancedReasoningModeProps> = ({
  currentRun,
  isRunning,
  onRunQuery,
  tools,
  onSelectProtein
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true });
  const [activeTab, setActiveTab] = useState<'reasoning_flow' | 'figures_tables' | 'final_synthesis' | 'tools_inventory'>('reasoning_flow');
  const [selectedTool, setSelectedTool] = useState<SynOmicsToolDeclaration | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, any>>({});
  const [toolExecuting, setToolExecuting] = useState(false);
  const [manualToolResult, setManualToolResult] = useState<any>(null);
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const toggleStep = (stepIdx: number) => {
    setExpandedSteps(prev => ({ ...prev, [stepIdx]: !prev[stepIdx] }));
  };

  const handleExecuteManualTool = async () => {
    if (!selectedTool) return;
    try {
      setToolExecuting(true);
      const res = await fetch('/api/synomics/tool-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: selectedTool.id, params: toolParams })
      });
      const data = await res.json();
      setManualToolResult(data.result);
    } catch (err) {
      console.error('Manual tool execution failed:', err);
    } finally {
      setToolExecuting(false);
    }
  };

  const handleCopySynthesis = () => {
    if (!currentRun?.finalSynthesis) return;
    const text = `SynOmics Multi-Agent Synthesis Report:
Query: ${currentRun.query}
Confidence Score: ${currentRun.finalSynthesis.confidenceScore}%

Key Insights:
${currentRun.finalSynthesis.keyInsights.map(k => `• ${k}`).join('\n')}

Molecular & Biological Mechanisms:
${currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms || ''}

Therapeutic Implications:
${currentRun.finalSynthesis.therapeuticImplications}

Validation Experiments:
${currentRun.finalSynthesis.recommendedExperiments.map(e => `• ${e}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedSynthesis(true);
    setTimeout(() => setCopiedSynthesis(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-hidden font-sans">
      {/* Top Query Input & Mode Bar */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#131A29] border-b border-[#E2DDD2] dark:border-[#1E293B] shrink-0">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h2 className="font-serif-brand text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Autonomous Multi-Agent Reasoning Architecture
                </h2>
              </div>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Grounded Co-Scientist Agent loop with zero simulations or mocks — real SynGO FDR, ODE biophysics &amp; single-cell matrices.
              </p>
            </div>

            {/* Navigation Tabs & Export Trigger */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-[#F3EFE6] dark:bg-[#1A2333] border border-[#E2DDD2] dark:border-[#1E293B] text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('reasoning_flow')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'reasoning_flow'
                      ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
                  }`}
                >
                  Agent Trace
                </button>
                <button
                  onClick={() => setActiveTab('figures_tables')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'figures_tables'
                      ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Figures &amp; Tables ({currentRun?.figures?.length || 5})</span>
                </button>
                <button
                  onClick={() => setActiveTab('final_synthesis')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'final_synthesis'
                      ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
                  }`}
                >
                  Synthesis Report
                </button>
                <button
                  onClick={() => setActiveTab('tools_inventory')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'tools_inventory'
                      ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
                  }`}
                >
                  Universal Tools ({tools.length})
                </button>
              </div>

              {currentRun && (
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              )}
            </div>
          </div>

          {/* Prompt Trigger Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (queryInput.trim() && !isRunning) {
                onRunQuery(queryInput.trim());
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter neuro-omics hypothesis (e.g. 'Investigate SHANK3 haploinsufficiency & PSD-95 lattice destabilization in ASD')..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              />
              <Sparkles className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
            </div>

            <button
              type="submit"
              disabled={isRunning || !queryInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reasoning...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Co-Scientists</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* TAB 1: REASONING FLOW */}
          {activeTab === 'reasoning_flow' && (
            <div className="space-y-6">
              {/* Header Status Bar */}
              {currentRun && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        RUN #{currentRun.runId.slice(-6)}
                      </span>
                      <span className="text-xs text-[#64748B] dark:text-slate-400">
                        {new Date(currentRun.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      "{currentRun.query}"
                    </p>
                  </div>

                  {currentRun.finalSynthesis && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-[#64748B] dark:text-slate-400 uppercase tracking-wider font-semibold">
                          Bio-Confidence Score
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {currentRun.finalSynthesis.confidenceScore}%
                        </div>
                      </div>
                      <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Agent Collaborative Specialist Team Breakdown */}
              {currentRun?.agentsInvolved && currentRun.agentsInvolved.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      Specialized Autonomous Co-Scientist Agent Team
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {currentRun.agentsInvolved.map((agent) => (
                      <div
                        key={agent.agentId}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {agent.status.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                              {agent.confidencePct}% Conf
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] line-clamp-1">
                            {agent.agentName}
                          </h4>
                          <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 line-clamp-2">
                            {agent.roleDescription}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#F3EFE6] dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
                          Artifact: {agent.generatedArtifacts[0] || 'Grounded Observation'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step by Step Timeline */}
              {currentRun?.steps && currentRun.steps.length > 0 ? (
                <div className="space-y-4">
                  {currentRun.steps.map((step, idx) => {
                    const isExpanded = expandedSteps[step.stepIndex] ?? true;

                    return (
                      <div
                        key={idx}
                        className="rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs overflow-hidden transition-all"
                      >
                        {/* Step Header */}
                        <div
                          onClick={() => toggleStep(step.stepIndex)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#FAF9F5] dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                              {step.stepIndex}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                                  {step.agentName || `Step ${step.stepIndex}: Agent Subquery`}
                                </span>
                                {step.actionTool && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                                    Tool: {step.actionTool}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 line-clamp-1">
                                {step.thought}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[#64748B]">
                            <span className="text-[10px] font-mono">{step.timestamp.slice(11, 19)}</span>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Step Body */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 border-t border-[#F3EFE6] dark:border-slate-800 space-y-3.5 text-xs text-[#334155] dark:text-slate-300">
                            {/* Reasoning Thought */}
                            <div>
                              <span className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block mb-1">
                                Co-Scientist Agent Thought
                              </span>
                              <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] text-xs leading-relaxed text-[#1D1C16] dark:text-slate-200">
                                {step.thought}
                              </div>
                            </div>

                            {/* Action Tool Payload */}
                            {step.actionInput && (
                              <div>
                                <span className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block mb-1">
                                  Action Parameters Payload
                                </span>
                                <pre className="p-3 rounded-xl bg-[#151D2C] text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-700">
                                  {JSON.stringify(step.actionInput, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Observation Payload */}
                            {step.observation && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                                    Biomedical Observation
                                  </span>
                                  {step.observation.associatedFigureId && (
                                    <button
                                      onClick={() => setActiveTab('figures_tables')}
                                      className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      <BarChart3 className="w-3 h-3" />
                                      <span>View Associated Figure</span>
                                    </button>
                                  )}
                                </div>
                                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 leading-relaxed space-y-2">
                                  <p>{step.observation.summary}</p>
                                  {step.observation.data && (
                                    <pre className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 text-emerald-900 dark:text-emerald-300 font-mono text-[11px] overflow-x-auto border border-emerald-200/60 dark:border-emerald-800/60">
                                      {JSON.stringify(step.observation.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      Ready to Run Multi-Agent SynOmics Reasoning
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto mt-1">
                      Type your hypothesis in the prompt box above or select one of the domain tools to run automated step-by-step scientific validation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FIGURES & TABLES */}
          {activeTab === 'figures_tables' && (
            <ScientificFiguresAndTables
              figures={currentRun?.figures || []}
              tables={currentRun?.tables || []}
              onExportReport={(fmt) => {
                setIsExportModalOpen(true);
              }}
            />
          )}

          {/* TAB 3: FINAL SYNTHESIS REPORT */}
          {activeTab === 'final_synthesis' && (
            <div className="rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs p-6 sm:p-8 space-y-6">
              {currentRun?.finalSynthesis ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD2] dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {currentRun.finalSynthesis.confidenceScore}% CONFIDENCE
                        </span>
                        <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono">
                          {currentRun.steps.length} Agent Executions
                        </span>
                      </div>
                      <h3 className="font-serif-brand text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-2">
                        Co-Scientist Biological Synthesis
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                        Inquiry: "{currentRun.query}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopySynthesis}
                        className="px-3.5 py-2 rounded-xl border border-[#E2DDD2] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedSynthesis ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Report (PDF/DOCX/HTML)</span>
                      </button>
                    </div>
                  </div>

                  {/* Key Insights Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Key Discoveries &amp; Insights
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentRun.finalSynthesis.keyInsights.map((insight, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] text-xs text-[#1D1C16] dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                        >
                          <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Biological Mechanisms */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-2 flex items-center gap-1.5">
                      <Dna className="w-4 h-4 text-indigo-500" />
                      Biological &amp; Molecular Mechanisms
                    </h4>
                    <div className="p-4 rounded-xl bg-white dark:bg-[#111726] border border-[#E2DDD2] dark:border-[#1E293B] text-xs leading-relaxed text-[#334155] dark:text-slate-300 prose prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentRun.finalSynthesis.biologicalMechanisms || currentRun.finalSynthesis.synapticMechanisms || ''}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Therapeutic Implications */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-2 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Therapeutic &amp; Translational Targets
                    </h4>
                    <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
                      {currentRun.finalSynthesis.therapeuticImplications}
                    </div>
                  </div>

                  {/* Recommended Validation Assays */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-2 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-purple-500" />
                      Recommended Experimental Validations
                    </h4>
                    <div className="space-y-2">
                      {currentRun.finalSynthesis.recommendedExperiments.map((exp, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] text-xs text-[#334155] dark:text-slate-300 flex items-start gap-2.5"
                        >
                          <span className="font-mono text-purple-600 dark:text-purple-400 font-bold shrink-0">
                            [{i + 1}]
                          </span>
                          <span>{exp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-[#64748B]">
                  No synthesis report generated yet. Run an autonomous inquiry from the prompt bar above.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DOMAIN TOOLS INVENTORY */}
          {activeTab === 'tools_inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tool List */}
              <div className="lg:col-span-1 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Universal Bioinformatics Tools ({tools.length})
                </h4>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {tools.map((t) => {
                    const isSelected = selectedTool?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTool(t);
                          const defaults: Record<string, any> = {};
                          t.parameters.forEach(p => {
                            if (p.default !== undefined) defaults[p.name] = p.default;
                            else if (p.options && p.options.length > 0) defaults[p.name] = p.options[0];
                          });
                          setToolParams(defaults);
                          setManualToolResult(null);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 shadow-xs'
                            : 'bg-white dark:bg-[#131A29] border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-400/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {t.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            {t.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 line-clamp-2">
                          {t.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tool Execution Sandbox */}
              <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs p-6 space-y-5">
                {selectedTool ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-[#E2DDD2] dark:border-[#1E293B] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {selectedTool.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {selectedTool.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                          {selectedTool.description}
                        </p>
                      </div>

                      <button
                        onClick={handleExecuteManualTool}
                        disabled={toolExecuting}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {toolExecuting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Executing...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Run Tool</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Parameters Input */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Tool Parameters
                      </h5>
                      {selectedTool.parameters.map((param) => (
                        <div key={param.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                              {param.name} {param.required && <span className="text-rose-500">*</span>}
                            </span>
                            <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-mono">
                              ({param.type})
                            </span>
                          </div>
                          {param.options && param.options.length > 0 ? (
                            <select
                              value={toolParams[param.name] ?? param.default ?? param.options[0]}
                              onChange={(e) => setToolParams({ ...toolParams, [param.name]: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-emerald-600"
                            >
                              {param.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={param.description}
                              value={toolParams[param.name] ?? param.default ?? ''}
                              onChange={(e) => {
                                const val = param.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                                setToolParams({ ...toolParams, [param.name]: val });
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-emerald-600"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Execution Result */}
                    {manualToolResult && (
                      <div className="space-y-2 pt-2 border-t border-[#E2DDD2] dark:border-[#1E293B]">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Execution Output
                        </h5>
                        <pre className="p-4 rounded-xl bg-[#0F172A] text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800">
                          {JSON.stringify(manualToolResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-12 text-center text-[#64748B]">
                    Select a bioinformatic tool from the list to test execution parameters.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Format Report Export Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentRun={currentRun}
      />
    </div>
  );
};
