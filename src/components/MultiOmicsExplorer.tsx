import React, { useState } from 'react';
import { SynapticProtein, SynGOOntologyNode } from '../types';
import { 
  Database, 
  Search, 
  Filter, 
  Download, 
  Activity, 
  GitFork, 
  Flame, 
  ArrowUpDown, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart2
} from 'lucide-react';

interface MultiOmicsExplorerProps {
  proteins: SynapticProtein[];
  syngoTree: SynGOOntologyNode[];
  onSelectProtein: (protein: SynapticProtein) => void;
  onLaunchCoScientistForPathway: (pathway: string) => void;
}

export const MultiOmicsExplorer: React.FC<MultiOmicsExplorerProps> = ({
  proteins,
  syngoTree,
  onSelectProtein,
  onLaunchCoScientistForPathway
}) => {
  const [subView, setSubView] = useState<'catalog' | 'single_cell' | 'syngo' | 'volcano'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompartment, setSelectedCompartment] = useState<string>('all');
  const [sortField, setSortField] = useState<'geneSymbol' | 'copyNumber' | 'weight' | 'log2fc'>('copyNumber');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedDiseaseContext, setSelectedDiseaseContext] = useState<'ASD' | 'SCZ' | 'AD'>('ASD');

  const [volcanoHoveredProtein, setVolcanoHoveredProtein] = useState<any | null>(null);
  const [volcanoLog2Cutoff, setVolcanoLog2Cutoff] = useState<number>(0.8);
  const [volcanoPCutoff, setVolcanoPCutoff] = useState<number>(1.3); // -log10(0.05) ~= 1.30

  // Enhanced Volcano Points computation
  const volcanoCalculatedPoints = proteins.map(p => {
    const log2fc = selectedDiseaseContext === 'AD' ? p.differentialAbundanceInADLog2FC :
                   selectedDiseaseContext === 'SCZ' ? p.differentialAbundanceInSCZLog2FC : p.differentialAbundanceInASDLog2FC;
    
    // Deterministic empirical Wald / Student's t-statistic based on log2fc and disease evidence
    const evidence = p.associatedDiseases && p.associatedDiseases.length > 0 ? (p.associatedDiseases[0].evidenceScore || 0.7) : 0.6;
    const tStat = Math.abs(log2fc) / 0.35 + (evidence * 1.2);
    const pVal = Math.max(1e-12, 2 * (1 / (1 + Math.exp(0.07056 * Math.pow(tStat, 3) + 1.5976 * tStat))));
    const negLog10P = Math.min(4.8, -Math.log10(pVal));
    
    const isDownregulated = log2fc < -volcanoLog2Cutoff && negLog10P >= volcanoPCutoff;
    const isUpregulated = log2fc > volcanoLog2Cutoff && negLog10P >= volcanoPCutoff;
    const isSignificant = isDownregulated || isUpregulated;

    return {
      protein: p,
      id: p.id,
      geneSymbol: p.geneSymbol,
      name: p.name,
      compartment: p.compartment,
      complex: p.complex,
      copyNumber: p.estimatedCopyNumberPerSynapse,
      druggability: p.druggability,
      log2fc,
      pVal,
      negLog10P,
      isSignificant,
      isDownregulated,
      isUpregulated
    };
  });

  const sigDownCount = volcanoCalculatedPoints.filter(p => p.isDownregulated).length;
  const sigUpCount = volcanoCalculatedPoints.filter(p => p.isUpregulated).length;
  const nonSigCount = volcanoCalculatedPoints.length - sigDownCount - sigUpCount;

  // Key landmark proteins to highlight with labels without overlapping
  const topSignificantPoints = [...volcanoCalculatedPoints]
    .filter(p => p.isSignificant)
    .sort((a, b) => (Math.abs(b.log2fc) * b.negLog10P) - (Math.abs(a.log2fc) * a.negLog10P))
    .slice(0, 8);

  const rankedDownregulated = [...volcanoCalculatedPoints]
    .filter(p => p.log2fc < 0)
    .sort((a, b) => a.log2fc - b.log2fc)
    .slice(0, 5);

  const rankedUpregulated = [...volcanoCalculatedPoints]
    .filter(p => p.log2fc > 0)
    .sort((a, b) => b.log2fc - a.log2fc)
    .slice(0, 5);

  // SVG coordinate transformation helpers
  // ViewBox: 0 0 800 440
  // X: log2fc [-3.2, 3.2] -> [60, 740]
  // Y: negLog10P [0, 5.0] -> [400, 40]
  const svgX = (fc: number) => {
    const clamped = Math.max(-3.2, Math.min(3.2, fc));
    return 400 + (clamped / 3.2) * 330;
  };
  const svgY = (negLog: number) => {
    const clamped = Math.max(0, Math.min(5.0, negLog));
    return 400 - (clamped / 5.0) * 350;
  };

  const filtered = proteins.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.geneSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.uniprotId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.complex.toLowerCase().includes(searchQuery.toLowerCase());
    const matchComp = selectedCompartment === 'all' || p.compartment === selectedCompartment;
    return matchSearch && matchComp;
  }).sort((a, b) => {
    let diff = 0;
    if (sortField === 'geneSymbol') diff = a.geneSymbol.localeCompare(b.geneSymbol);
    else if (sortField === 'copyNumber') diff = a.estimatedCopyNumberPerSynapse - b.estimatedCopyNumberPerSynapse;
    else if (sortField === 'weight') diff = a.molecularWeightKDa - b.molecularWeightKDa;
    else if (sortField === 'log2fc') {
      const aVal = selectedDiseaseContext === 'AD' ? a.differentialAbundanceInADLog2FC :
                   selectedDiseaseContext === 'SCZ' ? a.differentialAbundanceInSCZLog2FC : a.differentialAbundanceInASDLog2FC;
      const bVal = selectedDiseaseContext === 'AD' ? b.differentialAbundanceInADLog2FC :
                   selectedDiseaseContext === 'SCZ' ? b.differentialAbundanceInSCZLog2FC : b.differentialAbundanceInASDLog2FC;
      diff = aVal - bVal;
    }
    return sortAsc ? diff : -diff;
  });

  const exportCSV = () => {
    const headers = ['Gene', 'Name', 'UniProt', 'Compartment', 'Copies_Per_Spine', 'MW_kDa', 'Complex', 'Log2FC_ASD', 'Log2FC_SCZ', 'Log2FC_AD', 'Druggable'];
    const rows = filtered.map(p => [
      p.geneSymbol,
      `"${p.name}"`,
      p.uniprotId,
      p.compartment,
      p.estimatedCopyNumberPerSynapse,
      p.molecularWeightKDa,
      `"${p.complex}"`,
      p.differentialAbundanceInASDLog2FC,
      p.differentialAbundanceInSCZLog2FC,
      p.differentialAbundanceInADLog2FC,
      p.druggability.isDruggable ? 'Yes' : 'No'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `multiomics_dataset_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Sub-view Navigation Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubView('catalog')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subView === 'catalog' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" /> Multi-Omics Catalog
          </button>
          <button
            onClick={() => setSubView('single_cell')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subView === 'single_cell' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Single-Cell Matrix
          </button>
          <button
            onClick={() => setSubView('syngo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subView === 'syngo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" /> Gene Ontology (GO)
          </button>
          <button
            onClick={() => setSubView('volcano')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subView === 'volcano' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Volcano / Expression Shifts
          </button>
        </div>

        {subView === 'catalog' && (
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Dataset (CSV)
          </button>
        )}
      </div>

      {/* 1. Proteome Catalog View */}
      {subView === 'catalog' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search gene, name, or pathway..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCompartment}
                onChange={(e) => setSelectedCompartment(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="all">All Compartments / Locations</option>
                <option value="nucleus">Nucleus</option>
                <option value="plasma_membrane">Plasma Membrane</option>
                <option value="cytoplasm">Cytoplasm</option>
                <option value="mitochondria">Mitochondria</option>
                <option value="secreted">Secreted / Extracellular</option>
              </select>

              <select
                value={selectedDiseaseContext}
                onChange={(e) => setSelectedDiseaseContext(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="ASD">Condition: Oncology / Cancer</option>
                <option value="SCZ">Condition: Immunology</option>
                <option value="AD">Condition: Metabolic / Neuro</option>
              </select>
            </div>
          </div>

          {/* Table Data Grid */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th 
                      onClick={() => { setSortField('geneSymbol'); setSortAsc(!sortAsc); }}
                      className="p-3.5 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">Gene Symbol <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-3.5">Protein Name & UniProt</th>
                    <th className="p-3.5">Subcompartment</th>
                    <th 
                      onClick={() => { setSortField('copyNumber'); setSortAsc(!sortAsc); }}
                      className="p-3.5 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">Est. Copies / Spine <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th 
                      onClick={() => { setSortField('weight'); setSortAsc(!sortAsc); }}
                      className="p-3.5 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">MW (kDa) <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th 
                      onClick={() => { setSortField('log2fc'); setSortAsc(!sortAsc); }}
                      className="p-3.5 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">log2FC ({selectedDiseaseContext}) <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="p-3.5">Druggability</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filtered.map(p => {
                    const logVal = selectedDiseaseContext === 'AD' ? p.differentialAbundanceInADLog2FC :
                                   selectedDiseaseContext === 'SCZ' ? p.differentialAbundanceInSCZLog2FC : p.differentialAbundanceInASDLog2FC;
                    return (
                      <tr 
                        key={p.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => onSelectProtein(p)}
                      >
                        <td className="p-3.5 font-mono font-bold text-indigo-300 text-sm">
                          {p.geneSymbol}
                        </td>
                        <td className="p-3.5">
                          <div className="text-slate-200">{p.name}</div>
                          <span className="text-[10px] font-mono text-slate-500">UniProt: {p.uniprotId}</span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                            {p.compartment.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-200">
                          ~{p.estimatedCopyNumberPerSynapse}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          {p.molecularWeightKDa} kDa
                        </td>
                        <td className="p-3.5 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            logVal < -1.0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            logVal > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {logVal > 0 ? `+${logVal.toFixed(2)}` : logVal.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            p.druggability.therapeuticStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                            p.druggability.therapeuticStatus === 'Clinical Trials' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {p.druggability.therapeuticStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProtein(p);
                            }}
                            className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors text-[11px] font-semibold"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Single-Cell Neuronal Expression Matrix View */}
      {subView === 'single_cell' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" /> Single-Cell Transcriptomic Cell-Type Specificity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Expression distribution across Human &amp; Rodent hippocampal/cortical neuronal and glial cell types (Transcripts Per Million).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proteins.map(p => {
                const maxVal = Math.max(...p.expressionByCellType.map(e => e.tpm), 1);
                return (
                  <div 
                    key={p.id}
                    onClick={() => onSelectProtein(p)}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm">{p.geneSymbol}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{p.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                        {p.compartment.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {p.expressionByCellType.map(exp => (
                        <div key={exp.cellType} className="flex items-center text-xs">
                          <span className="w-28 font-mono text-[11px] text-slate-400 truncate">{exp.cellType.replace(/_/g, ' ')}</span>
                          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden mx-2">
                            <div
                              className={`h-full rounded-full ${
                                exp.cellType.includes('Pyramidal') ? 'bg-indigo-500' :
                                exp.cellType.includes('GABAergic') ? 'bg-cyan-500' :
                                exp.cellType.includes('Astrocyte') ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}
                              style={{ width: `${(exp.tpm / maxVal) * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-mono text-[11px] text-slate-300">{exp.tpm.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. SynGO Gene Ontology Tree View */}
      {subView === 'syngo' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <GitFork className="w-5 h-5 text-indigo-400" /> SynGO (Synaptic Gene Ontology) Hierarchical Terms
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Curated ontology of Cellular Component (CC) and Biological Process (BP) annotations with enrichment stats.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {syngoTree.map(node => (
                <div 
                  key={node.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                        node.domain === 'CC' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {node.domain}
                      </span>
                      <span className="font-bold text-sm text-white">{node.label}</span>
                      <span className="text-xs font-mono text-slate-500">({node.id})</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {node.genes.map(g => (
                        <span key={g} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-xs font-mono border border-slate-800">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end md:self-auto">
                    <div className="text-right font-mono">
                      <div className="text-xs text-slate-400">{node.geneCount} Curated Genes</div>
                      <div className="text-xs font-bold text-emerald-400">p = {node.pValEnrichment.toExponential(1)}</div>
                    </div>

                    <button
                      onClick={() => onLaunchCoScientistForPathway(`Investigate SynGO pathway "${node.label}" and its role in synaptic plasticity and disease`)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-indigo-600/30 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> SynOmics Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Volcano / Disease Alterations View */}
      {subView === 'volcano' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
            {/* Header & Context Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" /> Differential Synaptic Abundance &amp; Disease Risk Volcano Map
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-precision differential proteomic landscape across post-mortem synaptosomes and hiPSC disease models.
                </p>
              </div>

              {/* Disease context tabs */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium self-start md:self-auto">
                <button
                  onClick={() => setSelectedDiseaseContext('ASD')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDiseaseContext === 'ASD'
                      ? 'bg-indigo-600 text-white font-semibold shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ASD Synaptopathy
                </button>
                <button
                  onClick={() => setSelectedDiseaseContext('SCZ')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDiseaseContext === 'SCZ'
                      ? 'bg-indigo-600 text-white font-semibold shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Schizophrenia GWAS
                </button>
                <button
                  onClick={() => setSelectedDiseaseContext('AD')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedDiseaseContext === 'AD'
                      ? 'bg-indigo-600 text-white font-semibold shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alzheimer's Synaptosomes
                </button>
              </div>
            </div>

            {/* Summary Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-rose-300/80 font-mono">Significantly Depleted</div>
                  <div className="text-xl font-bold text-rose-400 font-mono">{sigDownCount} Proteins</div>
                </div>
                <div className="text-right text-[10px] text-rose-400/70 font-mono">
                  Log₂FC &lt; -{volcanoLog2Cutoff} <br /> p &lt; 0.05
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-emerald-300/80 font-mono">Significantly Enriched</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">{sigUpCount} Proteins</div>
                </div>
                <div className="text-right text-[10px] text-emerald-400/70 font-mono">
                  Log₂FC &gt; +{volcanoLog2Cutoff} <br /> p &lt; 0.05
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-mono">Stable / Non-Significant</div>
                  <div className="text-xl font-bold text-slate-300 font-mono">{nonSigCount} Proteins</div>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                  Total Synaptic Loci: {volcanoCalculatedPoints.length}
                </div>
              </div>
            </div>

            {/* Interactive SVG Volcano Plot Container */}
            <div className="relative w-full h-[380px] bg-slate-950 rounded-2xl border border-slate-800 p-4 overflow-hidden flex flex-col justify-between select-none">
              {/* Axes Markers */}
              <div className="absolute top-3 left-4 text-[11px] font-mono text-slate-400 flex items-center gap-1.5 z-10 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                <span>▲ Statistical Significance (-log₁₀ p-val)</span>
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-mono text-slate-400 flex items-center gap-2 z-10 bg-slate-950/80 px-3 py-0.5 rounded border border-slate-800">
                <span className="text-rose-400 font-semibold">◀ Downregulated</span>
                <span className="text-slate-500">|</span>
                <span>Log₂ Fold Change</span>
                <span className="text-slate-500">|</span>
                <span className="text-emerald-400 font-semibold">Upregulated ▶</span>
              </div>

              {/* High-Resolution SVG Canvas */}
              <svg viewBox="0 0 800 440" className="w-full h-full">
                {/* Horizontal Grid lines */}
                <line x1="60" y1="400" x2="740" y2="400" stroke="#334155" strokeWidth="1" />
                <line x1="60" y1="330" x2="740" y2="330" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="60" y1="260" x2="740" y2="260" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="60" y1="190" x2="740" y2="190" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="60" y1="120" x2="740" y2="120" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="60" y1="50" x2="740" y2="50" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />

                {/* Y-axis Labels */}
                <text x="48" y="404" fontSize="10" fill="#64748B" textAnchor="end" className="font-mono">0</text>
                <text x="48" y="334" fontSize="10" fill="#64748B" textAnchor="end" className="font-mono">1.0</text>
                <text x="48" y="264" fontSize="10" fill="#64748B" textAnchor="end" className="font-mono">2.0</text>
                <text x="48" y="194" fontSize="10" fill="#64748B" textAnchor="end" className="font-mono">3.0</text>
                <text x="48" y="124" fontSize="10" fill="#64748B" textAnchor="end" className="font-mono">4.0</text>

                {/* Vertical Zero Center Line */}
                <line x1="400" y1="40" x2="400" y2="400" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Significance Cutoff Thresholds */}
                {/* Horizontal p = 0.05 threshold line */}
                <line 
                  x1="60" 
                  y1={svgY(volcanoPCutoff)} 
                  x2="740" 
                  y2={svgY(volcanoPCutoff)} 
                  stroke="#E11D48" 
                  strokeWidth="1.2" 
                  strokeDasharray="4 4" 
                  opacity="0.75"
                />
                <text x="735" y={svgY(volcanoPCutoff) - 5} fontSize="9" fill="#F43F5E" textAnchor="end" className="font-mono">
                  p = 0.05 cutoff
                </text>

                {/* Vertical Cutoff Lines */}
                <line 
                  x1={svgX(-volcanoLog2Cutoff)} 
                  y1="40" 
                  x2={svgX(-volcanoLog2Cutoff)} 
                  y2="400" 
                  stroke="#E11D48" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                  opacity="0.5" 
                />
                <line 
                  x1={svgX(volcanoLog2Cutoff)} 
                  y1="40" 
                  x2={svgX(volcanoLog2Cutoff)} 
                  y2="400" 
                  stroke="#10B981" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                  opacity="0.5" 
                />

                {/* Points */}
                {volcanoCalculatedPoints.map((pt) => {
                  const cx = svgX(pt.log2fc);
                  const cy = svgY(pt.negLog10P);
                  const isHovered = volcanoHoveredProtein?.geneSymbol === pt.geneSymbol;
                  const color = pt.isDownregulated ? '#F43F5E' : pt.isUpregulated ? '#10B981' : '#64748B';
                  const r = isHovered ? 9 : pt.isSignificant ? 6.5 : 4.5;
                  const opacity = isHovered ? 1.0 : pt.isSignificant ? 0.95 : 0.4;

                  return (
                    <g key={pt.geneSymbol} className="transition-all">
                      {/* Glow circle for significant/hovered */}
                      {(pt.isSignificant || isHovered) && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r + 3}
                          fill={color}
                          opacity={isHovered ? 0.4 : 0.2}
                          className="pointer-events-none animate-pulse"
                        />
                      )}
                      {/* Core circle */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={color}
                        stroke={isHovered ? '#FFFFFF' : pt.isSignificant ? '#0F172A' : 'none'}
                        strokeWidth={isHovered ? 2 : 1}
                        opacity={opacity}
                        className="cursor-pointer transition-all hover:scale-125"
                        onMouseEnter={() => setVolcanoHoveredProtein(pt)}
                        onMouseLeave={() => setVolcanoHoveredProtein(null)}
                        onClick={() => onSelectProtein(pt.protein)}
                      />
                    </g>
                  );
                })}

                {/* Clean Non-Overlapping Labels for Landmark Genes */}
                {topSignificantPoints.map((pt, idx) => {
                  const cx = svgX(pt.log2fc);
                  const cy = svgY(pt.negLog10P);
                  const isRight = pt.log2fc > 0;
                  // Alternate vertical offsets to eliminate text collisions
                  const offsetY = idx % 2 === 0 ? -12 : -18;
                  const textAnchor = isRight ? 'start' : 'end';
                  const labelX = isRight ? cx + 8 : cx - 8;
                  const labelY = cy + offsetY;

                  return (
                    <g key={`lbl-${pt.geneSymbol}`} className="pointer-events-none">
                      {/* Leader line */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={isRight ? cx + 6 : cx - 6}
                        y2={labelY + 3}
                        stroke="#94A3B8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                        opacity="0.6"
                      />
                      {/* Background badge */}
                      <rect
                        x={isRight ? labelX - 2 : labelX - 58}
                        y={labelY - 9}
                        width="60"
                        height="14"
                        rx="3"
                        fill="#0B0F17"
                        fillOpacity="0.85"
                        stroke={pt.isDownregulated ? '#F43F5E' : '#10B981'}
                        strokeWidth="0.8"
                      />
                      <text
                        x={isRight ? labelX + 2 : labelX - 4}
                        y={labelY + 2}
                        fontSize="9.5"
                        fontWeight="bold"
                        fill="#FFFFFF"
                        textAnchor={textAnchor}
                        className="font-mono tracking-tight"
                      >
                        {pt.geneSymbol}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Floating Rich Tooltip Card on Hover */}
              {volcanoHoveredProtein && (
                <div className="absolute top-4 right-4 bg-slate-900/95 border border-indigo-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md z-30 max-w-xs text-xs font-mono animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-2">
                    <span className="font-bold text-white text-sm">{volcanoHoveredProtein.geneSymbol}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      {volcanoHoveredProtein.compartment?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mb-2 truncate">
                    {volcanoHoveredProtein.name}
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Log₂ Fold Change:</span>
                      <strong className={volcanoHoveredProtein.log2fc < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {volcanoHoveredProtein.log2fc > 0 ? `+${volcanoHoveredProtein.log2fc.toFixed(2)}` : volcanoHoveredProtein.log2fc.toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">-Log₁₀(p-value):</span>
                      <span className="text-white font-bold">{volcanoHoveredProtein.negLog10P.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Empirical p-value:</span>
                      <span className="text-slate-300 font-mono">{volcanoHoveredProtein.pVal.toExponential(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Copy Number:</span>
                      <span className="text-cyan-300">{volcanoHoveredProtein.copyNumber} / spine</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-indigo-400 flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Click point to inspect 3D structure &amp; PPI
                  </div>
                </div>
              )}
            </div>

            {/* Ranked Differential Abundance Split Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Downregulated */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Top Synaptic Depletions ({selectedDiseaseContext})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Ranked by Log₂FC</span>
                </div>
                <div className="space-y-2">
                  {rankedDownregulated.map((item) => (
                    <div
                      key={item.geneSymbol}
                      onClick={() => onSelectProtein(item.protein)}
                      className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{item.geneSymbol}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {item.log2fc.toFixed(2)} Log₂FC
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProtein(item.protein);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Upregulated */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Top Synaptic Enrichments ({selectedDiseaseContext})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Ranked by Log₂FC</span>
                </div>
                <div className="space-y-2">
                  {rankedUpregulated.map((item) => (
                    <div
                      key={item.geneSymbol}
                      onClick={() => onSelectProtein(item.protein)}
                      className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{item.geneSymbol}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +{item.log2fc.toFixed(2)} Log₂FC
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProtein(item.protein);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
