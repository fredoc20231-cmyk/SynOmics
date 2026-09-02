import React, { useState } from 'react';
import { BioProtocol } from '../types';
import { 
  FlaskConical, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Copy, 
  Check, 
  ChevronRight, 
  ShieldCheck,
  Thermometer
} from 'lucide-react';

interface BioProtocolStudioProps {
  protocols: BioProtocol[];
}

export const BioProtocolStudio: React.FC<BioProtocolStudioProps> = ({
  protocols
}) => {
  const [selectedProtocol, setSelectedProtocol] = useState<BioProtocol>(protocols[0] || {} as any);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [customTechnique, setCustomTechnique] = useState('Cryo-Electron Tomography (Cryo-ET) of Synaptosomes');
  const [customSample, setCustomSample] = useState('Human iPSC-derived cortical neurons');
  const [copied, setCopied] = useState(false);

  const handleGenerateCustomProtocol = async () => {
    setIsGeneratingCustom(true);
    try {
      const res = await fetch('/api/synomics/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTechnique: customTechnique,
          sampleType: customSample,
          specificObjectives: `High-resolution synaptic subcompartment imaging and nanoscale proteomic validation.`
        })
      });
      const data = await res.json();
      if (data.status === 'success' && data.protocol) {
        const fullProtocol: BioProtocol = {
          protocolId: `custom_${Date.now()}`,
          author: 'SynOmics AI Protocol Generator (Gemini 3.7 Flash)',
          category: 'Cryo-ET Sample Prep',
          ...data.protocol
        };
        setSelectedProtocol(fullProtocol);
        setActiveStepIndex(0);
      }
    } catch (err) {
      console.error('Error generating custom protocol:', err);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  const handleCopyProtocol = () => {
    if (!selectedProtocol) return;
    const text = `# ${selectedProtocol.title}
Author: ${selectedProtocol.author}
Total Time: ${selectedProtocol.estimatedTotalTime}

## Overview
${selectedProtocol.overview}

## Reagents & Buffers
${selectedProtocol.reagentsRequired.map(r => `- ${r.name} (${r.concentration})`).join('\n')}

## Step-by-Step Procedure
${selectedProtocol.steps.map(s => `### Step ${s.stepNumber}: ${s.title} (${s.durationMinutes} min, ${s.temperatureCelsius ? `${s.temperatureCelsius}°C` : 'RT'})
${s.instructions}
QC: ${s.criticalQualityControls}`).join('\n\n')}

## Troubleshooting Matrix
${selectedProtocol.troubleshootingGuide.map(t => `- Problem: ${t.problem}\n  Cause: ${t.possibleCause}\n  Action: ${t.correctiveAction}`).join('\n\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Custom AI Generator */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-yellow-950/20 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-yellow-400" /> Bio-Protocol Studio &amp; Reproducible Assay Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Peer-review grade wet-lab &amp; dry-lab protocols for synaptosome fractionation, APEX2 proximity labeling, and Cryo-ET imaging.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyProtocol}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Markdown' : 'Copy Protocol'}</span>
            </button>
          </div>
        </div>

        {/* Protocol Selector / Generator Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {protocols.map(p => (
            <button
              key={p.protocolId}
              onClick={() => { setSelectedProtocol(p); setActiveStepIndex(0); }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                selectedProtocol?.protocolId === p.protocolId
                  ? 'bg-yellow-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-yellow-300 font-semibold block w-fit mb-1.5">
                {p.category}
              </span>
              <h4 className="text-xs font-bold text-white line-clamp-1">{p.title}</h4>
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> {p.estimatedTotalTime}
              </span>
            </button>
          ))}

          {/* Generate Custom with AI */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 flex flex-col justify-between space-y-2">
            <span className="text-[10px] font-mono font-bold text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> SynOmics Custom Protocol Generator
            </span>
            <input
              type="text"
              value={customTechnique}
              onChange={(e) => setCustomTechnique(e.target.value)}
              placeholder="Technique (e.g. Cryo-ET, Patch-Clamp)..."
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <button
              onClick={handleGenerateCustomProtocol}
              disabled={isGeneratingCustom}
              className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isGeneratingCustom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate with Gemini</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Protocol View */}
      {selectedProtocol && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Left Column: Overview, Equipment & Reagents */}
          <div className="space-y-6">
            {/* Overview Card */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 font-bold">
                {selectedProtocol.category}
              </span>
              <h3 className="text-sm font-bold text-white leading-snug">{selectedProtocol.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedProtocol.overview}</p>
              <div className="text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                <span>Total Duration:</span>
                <span className="text-slate-200 font-bold">{selectedProtocol.estimatedTotalTime}</span>
              </div>
            </div>

            {/* Reagents Required */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                Required Reagents &amp; Buffers
              </h4>
              <div className="space-y-2">
                {selectedProtocol.reagentsRequired.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                    <span className="font-semibold text-slate-200 block">{r.name}</span>
                    <span className="text-[11px] font-mono text-indigo-400">Conc: {r.concentration}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Checklist */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                Instruments &amp; Equipment
              </h4>
              <div className="space-y-1.5">
                {selectedProtocol.equipment.map((eq, i) => (
                  <div key={i} className="flex items-center space-x-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{eq}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 2 Columns: Step-by-Step Instructions & Quality Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step Navigation Bar */}
            <div className="flex items-center space-x-2 overflow-x-auto p-2 bg-slate-900 rounded-2xl border border-slate-800 scrollbar-none">
              {selectedProtocol.steps.map((s, idx) => (
                <button
                  key={s.stepNumber}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeStepIndex === idx
                      ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Step {s.stepNumber}</span>
                </button>
              ))}
            </div>

            {/* Active Step Card */}
            {selectedProtocol.steps[activeStepIndex] && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-yellow-400">
                      STEP {selectedProtocol.steps[activeStepIndex].stepNumber} OF {selectedProtocol.steps.length}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      {selectedProtocol.steps[activeStepIndex].title}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-yellow-400" />
                      {selectedProtocol.steps[activeStepIndex].durationMinutes} min
                    </span>
                    {selectedProtocol.steps[activeStepIndex].temperatureCelsius !== undefined && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-cyan-300 border border-slate-800 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                        {selectedProtocol.steps[activeStepIndex].temperatureCelsius}°C
                      </span>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                    Execution Instructions
                  </h5>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {selectedProtocol.steps[activeStepIndex].instructions}
                  </p>
                </div>

                {/* Critical QC Alert */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-1.5">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Critical Quality Control &amp; Stopping Point
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedProtocol.steps[activeStepIndex].criticalQualityControls}
                  </p>
                </div>
              </div>
            )}

            {/* Troubleshooting Decision Matrix */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Troubleshooting Decision Matrix
              </h4>
              <div className="space-y-3">
                {selectedProtocol.troubleshootingGuide.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-rose-300 font-mono">Problem:</span>
                      <span className="text-xs text-slate-200 font-medium">{t.problem}</span>
                    </div>
                    <div className="text-xs text-slate-400 pl-4 border-l-2 border-slate-800 space-y-1">
                      <p><strong className="text-slate-300">Possible Cause:</strong> {t.possibleCause}</p>
                      <p><strong className="text-emerald-400">Corrective Action:</strong> {t.correctiveAction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
