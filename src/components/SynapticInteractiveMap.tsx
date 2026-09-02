import React, { useState } from 'react';
import { SynapticProtein, SynapticCompartment } from '../types';
import { Layers, Info, Sparkles, Activity, ShieldAlert, Pill, Eye, Filter } from 'lucide-react';

interface SynapticInteractiveMapProps {
  proteins: SynapticProtein[];
  onSelectProtein: (protein: SynapticProtein) => void;
}

export const SynapticInteractiveMap: React.FC<SynapticInteractiveMapProps> = ({
  proteins,
  onSelectProtein
}) => {
  const [selectedCompartment, setSelectedCompartment] = useState<SynapticCompartment | 'all'>('all');
  const [hoveredProtein, setHoveredProtein] = useState<SynapticProtein | null>(null);
  const [showCopyNumbers, setShowCopyNumbers] = useState(true);
  const [highlightDisease, setHighlightDisease] = useState<string>('all');

  const filteredProteins = proteins.filter(p => {
    if (selectedCompartment !== 'all' && p.compartment !== selectedCompartment) return false;
    if (highlightDisease !== 'all' && !p.associatedDiseases.some(d => d.disease === highlightDisease)) return false;
    return true;
  });

  const getCompartmentColor = (comp: SynapticCompartment) => {
    switch (comp) {
      case 'presynaptic_active_zone': return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
      case 'synaptic_vesicle': return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300';
      case 'synaptic_cleft': return 'border-violet-500/40 bg-violet-500/10 text-violet-300';
      case 'postsynaptic_density': return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300';
      case 'dendritic_spine_core': return 'border-pink-500/40 bg-pink-500/10 text-pink-300';
      case 'tripartite_astrocytic_process': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
      default: return 'border-slate-700 bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" /> Synaptic Subcompartment Spatial Architecture
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Nanoscale spatial layout spanning presynaptic active zone, 20nm synaptic cleft nanocolumns, and deep PSD scaffold lattice.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compartment filter */}
          <select
            value={selectedCompartment}
            onChange={(e) => setSelectedCompartment(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Subcompartments</option>
            <option value="presynaptic_active_zone">Presynaptic Active Zone</option>
            <option value="synaptic_vesicle">Synaptic Vesicles</option>
            <option value="synaptic_cleft">Synaptic Cleft & Adhesion</option>
            <option value="postsynaptic_density">Postsynaptic Density (PSD)</option>
            <option value="tripartite_astrocytic_process">Tripartite Astrocyte (EAAT2)</option>
          </select>

          {/* Disease highlighter */}
          <select
            value={highlightDisease}
            onChange={(e) => setHighlightDisease(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Highlight: All Diseases</option>
            <option value="autism_spectrum_disorder">Autism Spectrum Disorder</option>
            <option value="schizophrenia">Schizophrenia</option>
            <option value="alzheimers_disease">Alzheimer's Disease</option>
            <option value="epilepsy">Epilepsy</option>
          </select>

          {/* Toggle Copy Numbers */}
          <button
            onClick={() => setShowCopyNumbers(!showCopyNumbers)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
              showCopyNumbers
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            {showCopyNumbers ? '✓ Copy Numbers' : 'Copy Numbers'}
          </button>
        </div>
      </div>

      {/* Interactive 2.5D Synaptic Map Canvas */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 overflow-hidden shadow-2xl p-6">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#312e81_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* 1. Tripartite Astrocytic Process (PAPs) - Left side overlay */}
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Perisynaptic Astrocytic Process (Tripartite Synapse)
            </span>
            <span className="text-[11px] font-mono text-emerald-400/80">Clears &gt;90% of Synaptic Glutamate</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {proteins.filter(p => p.compartment === 'tripartite_astrocytic_process').map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProtein(p)}
                onMouseEnter={() => setHoveredProtein(p)}
                onMouseLeave={() => setHoveredProtein(null)}
                className={`px-3.5 py-2 rounded-xl border font-mono text-xs transition-all flex items-center space-x-2 ${
                  getCompartmentColor(p.compartment)
                } hover:scale-105 hover:shadow-lg shadow-emerald-500/10`}
              >
                <span className="font-bold text-white">{p.geneSymbol}</span>
                {showCopyNumbers && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-emerald-300">
                    ~{p.estimatedCopyNumberPerSynapse} / spine
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Presynaptic Bouton / Active Zone */}
        <div className="p-5 rounded-2xl bg-amber-950/15 border border-amber-500/30 mb-4 relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-amber-300">
                Presynaptic Axon Terminal & Cytomatrix Active Zone (CAZ)
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Vesicle Fusion Engine & CaV2.1 Clustering
            </span>
          </div>

          {/* Synaptic Vesicle Subcluster */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-mono text-cyan-400 font-semibold uppercase flex items-center gap-1.5">
              Synaptic Vesicles (Docked & Reserve Pool)
            </span>
            <div className="flex flex-wrap gap-2">
              {proteins.filter(p => p.compartment === 'synaptic_vesicle').map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelectProtein(p)}
                  onMouseEnter={() => setHoveredProtein(p)}
                  onMouseLeave={() => setHoveredProtein(null)}
                  className={`px-3 py-1.5 rounded-lg border font-mono text-xs transition-all flex items-center space-x-2 ${
                    getCompartmentColor(p.compartment)
                  } hover:scale-105`}
                >
                  <span className="font-bold text-white">{p.geneSymbol}</span>
                  {showCopyNumbers && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-cyan-200">
                      ~{p.estimatedCopyNumberPerSynapse} copies
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Presynaptic Active Zone Scaffolds & SNAREs */}
          <div className="flex flex-wrap gap-2 pt-1">
            {proteins.filter(p => p.compartment === 'presynaptic_active_zone').map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProtein(p)}
                onMouseEnter={() => setHoveredProtein(p)}
                onMouseLeave={() => setHoveredProtein(null)}
                className={`px-3.5 py-2 rounded-xl border font-mono text-xs transition-all flex items-center space-x-2 ${
                  getCompartmentColor(p.compartment)
                } hover:scale-105 hover:shadow-lg shadow-amber-500/10`}
              >
                <span className="font-bold text-white">{p.geneSymbol}</span>
                <span className="text-[10px] text-amber-200/80">({p.name.split(' ')[0]})</span>
                {showCopyNumbers && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-amber-300">
                    ~{p.estimatedCopyNumberPerSynapse}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Synaptic Cleft (20nm Gap) with Trans-Synaptic Adhesion Bridges */}
        <div className="py-4 px-6 rounded-xl bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-violet-950/40 border-y-2 border-dashed border-violet-500/40 my-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-violet-300">
              Synaptic Cleft (~20 nm Intercellular Matrix)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-500/30 font-mono">
              Nanocolumn Alignment
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {proteins.filter(p => p.compartment === 'synaptic_cleft').map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProtein(p)}
                onMouseEnter={() => setHoveredProtein(p)}
                onMouseLeave={() => setHoveredProtein(null)}
                className={`px-3.5 py-1.5 rounded-xl border font-mono text-xs transition-all flex items-center space-x-2 ${
                  getCompartmentColor(p.compartment)
                } hover:scale-105 shadow-md shadow-violet-500/10`}
              >
                <span className="font-bold text-white">{p.geneSymbol}</span>
                {showCopyNumbers && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-violet-200">
                    ~{p.estimatedCopyNumberPerSynapse}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Postsynaptic Density (PSD Core & Deep Scaffold Lattice) */}
        <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/40 relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-300">
                Postsynaptic Density (PSD Core: 0-30nm &amp; Deep Scaffold Matrix)
              </span>
            </div>
            <span className="text-[11px] font-mono text-indigo-300/80">
              Ionotropic Receptors (AMPA/NMDA) &amp; MAGUK Liquid Condensates
            </span>
          </div>

          {/* PSD Core Proteins */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {proteins.filter(p => p.compartment === 'postsynaptic_density').map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProtein(p)}
                onMouseEnter={() => setHoveredProtein(p)}
                onMouseLeave={() => setHoveredProtein(null)}
                className={`p-3 rounded-xl border text-left font-mono transition-all flex flex-col justify-between ${
                  getCompartmentColor(p.compartment)
                } hover:scale-102 hover:border-indigo-400 hover:shadow-lg shadow-indigo-500/20`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white">{p.geneSymbol}</span>
                  {showCopyNumbers && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 font-semibold">
                      ~{p.estimatedCopyNumberPerSynapse} / spine
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-300 line-clamp-1 font-sans">
                  {p.name.split('(')[0]}
                </span>
                <span className="text-[10px] text-indigo-400/80 mt-1 font-mono">
                  {p.molecularWeightKDa} kDa • {p.complex.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Hovered Protein Preview Card */}
      {hoveredProtein && (
        <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/40 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center space-x-3">
            <span className="font-mono font-bold text-white text-sm bg-indigo-600/20 px-2.5 py-1 rounded border border-indigo-500/30">
              {hoveredProtein.geneSymbol}
            </span>
            <div>
              <span className="font-semibold text-slate-200">{hoveredProtein.name}</span>
              <p className="text-slate-400 font-mono text-[11px]">
                {hoveredProtein.primaryFunction}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectProtein(hoveredProtein)}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" /> Inspect Details
          </button>
        </div>
      )}
    </div>
  );
};
