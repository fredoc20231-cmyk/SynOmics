import React, { useState, useEffect } from 'react';
import { 
  Dna, 
  Layers, 
  Activity, 
  Sparkles, 
  Zap, 
  ShieldAlert, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Cpu,
  BarChart3,
  Search,
  Download,
  Flame,
  Grid,
  FileText
} from 'lucide-react';
import { SynapticProtein } from '../types';

interface RosettaMutagenesisStudioProps {
  proteins: SynapticProtein[];
  onOpen3DViewer?: (gene: string) => void;
}

const AMINO_ACIDS = [
  { code: 'A', name: 'Alanine (Ala)' },
  { code: 'R', name: 'Arginine (Arg)' },
  { code: 'N', name: 'Asparagine (Asn)' },
  { code: 'D', name: 'Aspartate (Asp)' },
  { code: 'C', name: 'Cysteine (Cys)' },
  { code: 'E', name: 'Glutamate (Glu)' },
  { code: 'Q', name: 'Glutamine (Gln)' },
  { code: 'G', name: 'Glycine (Gly)' },
  { code: 'H', name: 'Histidine (His)' },
  { code: 'I', name: 'Isoleucine (Ile)' },
  { code: 'L', name: 'Leucine (Leu)' },
  { code: 'K', name: 'Lysine (Lys)' },
  { code: 'M', name: 'Methionine (Met)' },
  { code: 'F', name: 'Phenylalanine (Phe)' },
  { code: 'P', name: 'Proline (Pro)' },
  { code: 'S', name: 'Serine (Ser)' },
  { code: 'T', name: 'Threonine (Thr)' },
  { code: 'W', name: 'Tryptophan (Trp)' },
  { code: 'Y', name: 'Tyrosine (Tyr)' },
  { code: 'V', name: 'Valine (Val)' }
];

const PRESET_MUTATIONS = [
  { gene: 'KRAS', wt: 'G', pos: 12, mut: 'D', domain: 'P-Loop GTPase Core', condition: 'Pancreatic / Colorectal Adenocarcinoma', label: 'KRAS p.Gly12Asp (G12D)' },
  { gene: 'TP53', wt: 'R', pos: 175, mut: 'H', domain: 'DNA-Binding Domain (Zn-finger)', condition: 'Li-Fraumeni / Somatic Hotspot', label: 'TP53 p.Arg175His' },
  { gene: 'EGFR', wt: 'L', pos: 858, mut: 'R', domain: 'Tyrosine Kinase Domain', condition: 'Non-Small Cell Lung Cancer (NSCLC)', label: 'EGFR p.Leu858Arg' },
  { gene: 'BRAF', wt: 'V', pos: 600, mut: 'E', domain: 'Kinase Activation Loop', condition: 'Cutaneous Melanoma / CRC', label: 'BRAF p.Val600Glu (V600E)' },
  { gene: 'PIK3CA', wt: 'E', pos: 545, mut: 'K', domain: 'Helical Domain', condition: 'Breast / Endometrial Carcinoma', label: 'PIK3CA p.Glu545Lys' }
];

export const RosettaMutagenesisStudio: React.FC<RosettaMutagenesisStudioProps> = ({
  proteins,
  onOpen3DViewer
}) => {
  const [selectedGene, setSelectedGene] = useState('KRAS');
  const [wildtype, setWildtype] = useState('G');
  const [position, setPosition] = useState(12);
  const [mutant, setMutant] = useState('D');
  const [domain, setDomain] = useState('P-Loop GTPase Core');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Saturation Scanning State
  const [activeTab, setActiveTab] = useState<'point-mutation' | 'saturation-scan'>('point-mutation');
  const [isScanningSaturation, setIsScanningSaturation] = useState(false);
  const [saturationResults, setSaturationResults] = useState<any[]>([]);

  const runCalculation = async (gene = selectedGene, wt = wildtype, pos = position, mut = mutant, dom = domain) => {
    setIsCalculating(true);
    try {
      const res = await fetch('/api/synomics/mutagenesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gene,
          wildtype: wt,
          position: pos,
          mutant: mut,
          domain: dom
        })
      });
      const data = await res.json();
      if (data.result) {
        setResult(data.result);
      }
    } catch (err) {
      console.error('Mutagenesis calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  const runSaturationScan = async (gene = selectedGene, pos = position, wt = wildtype) => {
    setIsScanningSaturation(true);
    try {
      const res = await fetch('/api/synomics/mutagenesis-saturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gene,
          position: pos,
          wildtype: wt,
          domain
        })
      });
      const data = await res.json();
      if (data.status === 'success' && data.results) {
        setSaturationResults(data.results);
      }
    } catch (err) {
      console.error('Saturation scanning error:', err);
    } finally {
      setIsScanningSaturation(false);
    }
  };

  useEffect(() => {
    runCalculation();
  }, []);

  const handleApplyPreset = (preset: typeof PRESET_MUTATIONS[0]) => {
    setSelectedGene(preset.gene);
    setWildtype(preset.wt);
    setPosition(preset.pos);
    setMutant(preset.mut);
    setDomain(preset.domain);
    runCalculation(preset.gene, preset.wt, preset.pos, preset.mut, preset.domain);
    if (activeTab === 'saturation-scan') {
      runSaturationScan(preset.gene, preset.pos, preset.wt);
    }
  };

  const downloadReport = (format: 'json' | 'txt' | 'csv') => {
    const reportData = {
      title: `Rosetta In-Silico Mutagenesis & Free Energy (ΔΔG) Report - ${selectedGene}`,
      date: new Date().toISOString(),
      gene: selectedGene,
      wildtype,
      position,
      domain,
      pointMutation: result,
      saturationScanning: saturationResults
    };

    let content = '';
    let mimeType = 'text/plain';
    let ext = format;

    if (format === 'json') {
      content = JSON.stringify(reportData, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      content = `Gene,Position,Wildtype,Mutant,ddG_kcal_mol,Classification,vanDerWaals,Electrostatics,Solvation,ConformationalEntropy\n`;
      if (saturationResults.length > 0) {
        saturationResults.forEach(r => {
          content += `${r.gene},${r.position},${r.wildtype},${r.mutant},${r.ddG_kcal_mol},${r.classification},${r.energyBreakdown?.vanDerWaalsClash || 0},${r.energyBreakdown?.electrostaticDisruption || 0},${r.energyBreakdown?.solvationHydrophobic || 0},${r.energyBreakdown?.conformationalEntropy || 0}\n`;
        });
      } else if (result) {
        content += `${result.gene},${result.position},${result.wildtypeResidue},${result.mutantResidue},${result.ddG_kcal_mol},${result.classification},${result.energyBreakdown?.vanDerWaalsClash || 0},${result.energyBreakdown?.electrostaticDisruption || 0},${result.energyBreakdown?.solvationHydrophobic || 0},${result.energyBreakdown?.conformationalEntropy || 0}\n`;
      }
      mimeType = 'text/csv';
    } else {
      content = `================================================================================
ROSETTA-GRADE IN-SILICO MUTAGENESIS & FREE ENERGY (ΔΔG) REPORT
================================================================================
Gene:            ${selectedGene}
Position:        ${position} (Wildtype: ${wildtype})
Domain:          ${domain}
Generated At:    ${new Date().toLocaleString()}

--------------------------------------------------------------------------------
POINT MUTATION EVALUATION: ${result?.variant || `${wildtype}${position}${mutant}`}
--------------------------------------------------------------------------------
ΔΔG Free Energy: ${result?.ddG_kcal_mol} kcal/mol
Classification:  ${result?.classification}
ClinVar / CADD:  ${result?.clinvarRisk}

Energy Breakdown:
- Steric Clash (vdw):      +${result?.energyBreakdown?.vanDerWaalsClash} kcal/mol
- Electrostatic:           +${result?.energyBreakdown?.electrostaticDisruption} kcal/mol
- Hydrophobic Solvation:   ${result?.energyBreakdown?.solvationHydrophobic} kcal/mol
- Backbone Entropy (ΔS):   +${result?.energyBreakdown?.conformationalEntropy} kcal/mol

Rosetta Ligand Docking:
- Pocket Volume:           ${result?.rosettaLigandDocking?.predictedPocketVolumeA3} Å³
- Docking Score (ΔG_bind): ${result?.rosettaLigandDocking?.dockingScore_dG_bind} kcal/mol
- Estimated Kd:            ${result?.rosettaLigandDocking?.estimatedKd_uM} µM
`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rosetta_Mutagenesis_${selectedGene}_${wildtype}${position}${mutant}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Rosetta-Grade In-Silico Mutagenesis & Free Energy (ΔΔG) Studio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              FoldX & Rosetta Energy Function
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Calculates high-accuracy free energy of folding perturbations (ΔΔG in kcal/mol), decomposed into steric clashes (Van der Waals), electrostatic salt-bridge disruptions, hydrophobic desolvation, and backbone conformational entropy.
          </p>
        </div>

        {/* Action Controls & Report Download */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('point-mutation')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'point-mutation'
                  ? 'bg-white dark:bg-[#131A29] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Point Mutation (FoldX)
            </button>
            <button
              onClick={() => {
                setActiveTab('saturation-scan');
                if (saturationResults.length === 0) {
                  runSaturationScan();
                }
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'saturation-scan'
                  ? 'bg-white dark:bg-[#131A29] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Saturation Scanning (20 AAs)</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => downloadReport('txt')}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#161D2B] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              title="Download TXT Report"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Report</span>
            </button>
            <button
              onClick={() => downloadReport('csv')}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#161D2B] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              title="Download CSV Matrix"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ClinVar Quick Preset Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">ClinVar Loci:</span>
        {PRESET_MUTATIONS.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleApplyPreset(preset)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-[#131A29] hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 border border-[#E2DDD2] dark:border-[#1E293B] transition-colors whitespace-nowrap cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Mutagenesis Control Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Mutation Parameters</h3>
          </div>

          <div className="space-y-3">
            {/* Target Gene */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Gene</label>
              <select
                value={selectedGene}
                onChange={(e) => setSelectedGene(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {proteins.map(p => (
                  <option key={p.id} value={p.geneSymbol}>{p.geneSymbol} ({p.name})</option>
                ))}
              </select>
            </div>

            {/* Residue Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Wildtype Residue</label>
                <select
                  value={wildtype}
                  onChange={(e) => setWildtype(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {AMINO_ACIDS.map(aa => (
                    <option key={aa.code} value={aa.code}>{aa.code} - {aa.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mutant Residue</label>
                <select
                  value={mutant}
                  onChange={(e) => setMutant(e.target.value)}
                  disabled={activeTab === 'saturation-scan'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {AMINO_ACIDS.map(aa => (
                    <option key={aa.code} value={aa.code}>{aa.code} - {aa.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Residue Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Residue Position Index</label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value) || 1)}
                min="1"
                max="2500"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Structural Domain */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Structural Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Run Button */}
            {activeTab === 'point-mutation' ? (
              <button
                onClick={() => runCalculation()}
                disabled={isCalculating}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCalculating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Calculating FoldX / Rosetta Energetics...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Mutagenesis Calculation</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => runSaturationScan()}
                disabled={isScanningSaturation}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isScanningSaturation ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning All 20 Amino Acid Substitutions...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 fill-current text-amber-300" />
                    <span>Run Deep Saturation Scan (20 AAs)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Energetics Breakdown or Saturation Matrix (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'point-mutation' ? (
            result && (
              <>
                {/* Core ΔΔG Score Card */}
                <div className="bg-white dark:bg-[#131A29] p-6 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                          {result.variant}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {result.gene} {result.variant} ({result.wildtypeResidue} → {result.mutantResidue})
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Location: {result.domain} (Position {result.position})</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1.5 rounded-xl text-center ${
                        result.ddG_kcal_mol > 2.0 
                          ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          : result.ddG_kcal_mol > 0.8
                          ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        <span className="block text-[10px] font-bold uppercase tracking-wider">Free Energy Change (ΔΔG)</span>
                        <span className="text-xl font-mono font-bold">
                          {result.ddG_kcal_mol > 0 ? `+${result.ddG_kcal_mol}` : result.ddG_kcal_mol} kcal/mol
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Energy Component Decomposition */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Steric Clash (ΔE_vdw)</span>
                      <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                        +{result.energyBreakdown?.vanDerWaalsClash} kcal/mol
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Volume Δ: {result.sidechainProperties?.volumeChangeA3} Å³</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Electrostatic (ΔE_elec)</span>
                      <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                        +{result.energyBreakdown?.electrostaticDisruption} kcal/mol
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Charge Δ: {result.sidechainProperties?.chargeChange}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Hydrophobic (ΔG_solv)</span>
                      <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                        {result.energyBreakdown?.solvationHydrophobic > 0 ? `+${result.energyBreakdown?.solvationHydrophobic}` : result.energyBreakdown?.solvationHydrophobic} kcal/mol
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Hydropathy Δ: {result.sidechainProperties?.hydropathyChange}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Backbone Entropy (ΔS)</span>
                      <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                        +{result.energyBreakdown?.conformationalEntropy} kcal/mol
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Helix Propensity</span>
                    </div>
                  </div>

                  {/* Pathogenicity & ClinVar Risk */}
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Classification: {result.classification}
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-300 block">
                          ClinVar & CADD Assessment: {result.clinvarRisk}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rosetta Ligand Docking & Binding Pocket Module */}
                <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Rosetta Ligand Docking & Druggability Impact</h4>
                    </div>
                    {onOpen3DViewer && (
                      <button
                        onClick={() => onOpen3DViewer(result.gene)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors"
                      >
                        View 3D Coordinate Mesh
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Predicted Pocket Volume</span>
                      <span className="text-base font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                        {result.rosettaLigandDocking?.predictedPocketVolumeA3} Å³
                      </span>
                      <span className="text-[10px] text-slate-400">Allosteric Surface Cavity</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Docking Binding Score (ΔG_bind)</span>
                      <span className="text-base font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                        {result.rosettaLigandDocking?.dockingScore_dG_bind} kcal/mol
                      </span>
                      <span className="text-[10px] text-slate-400">Rosetta Energy Units (REU)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Estimated Binding Affinity (Kd)</span>
                      <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                        {result.rosettaLigandDocking?.estimatedKd_uM} µM
                      </span>
                      <span className="text-[10px] text-slate-400">Druggability Index: {result.rosettaLigandDocking?.druggabilityIndex}</span>
                    </div>
                  </div>
                </div>
              </>
            )
          ) : (
            /* Saturation Scanning 20-AA Heatmap and Matrix */
            <div className="bg-white dark:bg-[#131A29] p-6 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Deep Mutational Saturation Scan: Position {position} ({wildtype})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Exhaustive in-silico screening of all 19 non-synonymous amino acid substitutions.
                    </p>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {saturationResults.length} / 20 Substitutions Evaluated
                </span>
              </div>

              {/* Heatmap Matrix */}
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
                {saturationResults.map((item) => {
                  const ddG = item.ddG_kcal_mol;
                  const isWT = item.mutant === wildtype;
                  const bgColor = isWT
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                    : ddG > 2.5
                    ? 'bg-rose-500 text-white border-rose-600'
                    : ddG > 1.2
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                    : ddG > 0.0
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800';

                  return (
                    <div
                      key={item.mutant}
                      onClick={() => {
                        setMutant(item.mutant);
                        setActiveTab('point-mutation');
                        runCalculation(selectedGene, wildtype, position, item.mutant, domain);
                      }}
                      className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all hover:scale-105 shadow-2xs ${bgColor}`}
                    >
                      <div className="text-xs font-mono font-bold">{item.mutant}</div>
                      <div className="text-[10px] font-mono mt-0.5 font-semibold">
                        {isWT ? 'WT' : `${ddG > 0 ? '+' : ''}${ddG.toFixed(1)}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Saturation Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs font-sans text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-mono text-[11px]">
                      <th className="py-2 px-2.5">Variant</th>
                      <th className="py-2 px-2.5">ΔΔG (kcal/mol)</th>
                      <th className="py-2 px-2.5">Classification</th>
                      <th className="py-2 px-2.5">vdw Clash</th>
                      <th className="py-2 px-2.5">Electrostatics</th>
                      <th className="py-2 px-2.5">Solvation</th>
                      <th className="py-2 px-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saturationResults.map((row) => (
                      <tr
                        key={row.mutant}
                        className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2 px-2.5 font-mono font-bold">
                          {wildtype}{position}{row.mutant}
                        </td>
                        <td className={`py-2 px-2.5 font-mono font-bold ${
                          row.ddG_kcal_mol > 2.0 ? 'text-rose-600' : row.ddG_kcal_mol > 0.8 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {row.ddG_kcal_mol > 0 ? `+${row.ddG_kcal_mol}` : row.ddG_kcal_mol}
                        </td>
                        <td className="py-2 px-2.5 font-medium">{row.classification}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-500">+{row.energyBreakdown?.vanDerWaalsClash || 0}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-500">+{row.energyBreakdown?.electrostaticDisruption || 0}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-500">{row.energyBreakdown?.solvationHydrophobic || 0}</td>
                        <td className="py-2 px-2.5">
                          <button
                            onClick={() => {
                              setMutant(row.mutant);
                              setActiveTab('point-mutation');
                              runCalculation(selectedGene, wildtype, position, row.mutant, domain);
                            }}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
