import React, { useState } from 'react';
import { BiologicalEntity, CellularCompartment } from '../types';
import { Layers, Info, Sparkles, Activity, ShieldAlert, Pill, Eye, Filter, Dna } from 'lucide-react';

export interface BioInteractiveMapProps {
  proteins: BiologicalEntity[];
  onSelectProtein: (protein: BiologicalEntity) => void;
}

export const BioInteractiveMap: React.FC<BioInteractiveMapProps> = ({
  proteins,
  onSelectProtein
}) => {
  const [selectedCompartment, setSelectedCompartment] = useState<CellularCompartment | 'all'>('all');
  const [hoveredProtein, setHoveredProtein] = useState<BiologicalEntity | null>(null);
  const [showCopyNumbers, setShowCopyNumbers] = useState(true);
  const [highlightDisease, setHighlightDisease] = useState<string>('all');

  const filteredProteins = proteins.filter(p => {
    if (selectedCompartment !== 'all' && p.compartment !== selectedCompartment) return false;
    if (highlightDisease !== 'all' && !p.associatedDiseases.some(d => d.disease.toLowerCase().includes(highlightDisease.toLowerCase()))) return false;
    return true;
  });

  const getCompartmentBadge = (comp: string) => {
    switch (comp) {
      case 'plasma_membrane': return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400';
      case 'nucleus_chromatin': return 'border-purple-500/40 bg-purple-500/10 text-purple-400';
      case 'cytoplasm_cytoskeleton': return 'border-blue-500/40 bg-blue-500/10 text-blue-400';
      case 'mitochondria_metabolism': return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
      case 'endoplasmic_reticulum': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
      case 'extracellular_secretome': return 'border-rose-500/40 bg-rose-500/10 text-rose-400';
      default: return 'border-slate-500/40 bg-slate-500/10 text-slate-300';
    }
  };

  const COMPARTMENTS: { id: CellularCompartment; title: string; desc: string; color: string }[] = [
    { id: 'plasma_membrane', title: 'Cell Surface & Receptor Complexes', desc: 'EGFR, HER2, GPCRs, Ion Channels, SCN5A', color: 'border-cyan-500/30 bg-cyan-950/20' },
    { id: 'cytoplasm_cytoskeleton', title: 'Cytoplasmic Signaling & Kinases', desc: 'KRAS, BRAF, AKT1, MEK1, AMPK', color: 'border-blue-500/30 bg-blue-950/20' },
    { id: 'nucleus_chromatin', title: 'Nuclear Transcription & DNA Repair', desc: 'TP53, BRCA1, MYC, TCF7L2, PPARG', color: 'border-purple-500/30 bg-purple-950/20' },
    { id: 'mitochondria_metabolism', title: 'Mitochondrial Bioenergetics & Apoptosis', desc: 'BCL2, BAX, MTOR, Complex I-V', color: 'border-amber-500/30 bg-amber-950/20' },
    { id: 'endoplasmic_reticulum', title: 'ER / Golgi Secretory & Folding', desc: 'CFTR, BiP, Calreticulin, Glycan Transferases', color: 'border-emerald-500/30 bg-emerald-950/20' },
    { id: 'extracellular_secretome', title: 'Extracellular Matrix & Cytokines', desc: 'TNF-alpha, IL-6, VEGFA, PCSK9', color: 'border-rose-500/30 bg-rose-950/20' }
  ];

  return (
    <div className="space-y-6">
      {/* Controls & Filter Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" /> Subcellular Spatial Multi-Compartment Architecture
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Nanoscale spatial layout across Membrane Receptors, Cytoplasmic Signal Transduction, Nuclear Transcription, and Extracellular Secretome.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCompartment}
            onChange={(e) => setSelectedCompartment(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Subcellular Loci</option>
            <option value="plasma_membrane">Plasma Membrane</option>
            <option value="cytoplasm_cytoskeleton">Cytoplasm &amp; Cytoskeleton</option>
            <option value="nucleus_chromatin">Nucleus &amp; Chromatin</option>
            <option value="mitochondria_metabolism">Mitochondria &amp; Metabolism</option>
            <option value="endoplasmic_reticulum">Endoplasmic Reticulum</option>
            <option value="extracellular_secretome">Extracellular Secretome</option>
          </select>

          <select
            value={highlightDisease}
            onChange={(e) => setHighlightDisease(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Disease Phenotypes</option>
            <option value="cancer">Oncology / Carcinoma</option>
            <option value="diabetes">Type 2 Diabetes / Metabolic</option>
            <option value="cardio">Cardiovascular / Arrhythmia</option>
            <option value="alzheimer">Neurodegeneration</option>
            <option value="cystic">Rare Genetic Disorders</option>
          </select>

          <button
            onClick={() => setShowCopyNumbers(!showCopyNumbers)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              showCopyNumbers
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" /> Copy Numbers
          </button>
        </div>
      </div>

      {/* Compartment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPARTMENTS.map((comp) => {
          const compProteins = filteredProteins.filter(p => p.compartment === comp.id);
          return (
            <div
              key={comp.id}
              className={`p-4 rounded-2xl border transition-all ${comp.color} ${
                selectedCompartment === comp.id || selectedCompartment === 'all' ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {comp.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {compProteins.length} targets
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{comp.desc}</p>

              <div className="flex flex-wrap gap-1.5">
                {compProteins.map((p) => (
                  <button
                    key={p.geneSymbol}
                    onClick={() => onSelectProtein(p)}
                    onMouseEnter={() => setHoveredProtein(p)}
                    onMouseLeave={() => setHoveredProtein(null)}
                    className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>{p.geneSymbol}</span>
                    {showCopyNumbers && p.copyNumberPerSynapse && (
                      <span className="text-[10px] font-normal text-slate-400 font-mono">
                        {p.copyNumberPerSynapse}#
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SynapticInteractiveMap = BioInteractiveMap;
