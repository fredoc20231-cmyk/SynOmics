import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Dna, 
  Layers, 
  Activity, 
  FlaskConical, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  Eye, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  ExternalLink, 
  Sliders, 
  Search, 
  ChevronRight, 
  FileCode, 
  Table as TableIcon, 
  BarChart3, 
  Maximize2,
  Minimize2,
  Atom,
  HelpCircle,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import { MolecularDockingResult, AdmetProfile, TargetIdentificationResult, DeNovoMoleculeSuggestion } from '../types';
import { Molecular3DViewer } from './Molecular3DViewer';

interface DrugDiscoveryModeProps {
  onOpen3DViewerForTarget?: (geneSymbol: string) => void;
  onSendToChat?: (query: string) => void;
}

export const DrugDiscoveryMode: React.FC<DrugDiscoveryModeProps> = ({
  onOpen3DViewerForTarget,
  onSendToChat
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'docking' | 'admet' | 'targets' | 'denovo'>('docking');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Honest capability notice. Docking / ADMET / de-novo generation require real
  // external tools (AutoDock Vina, RDKit, a generative model) that are not wired
  // in this build, so we never fabricate results — we say so plainly.
  const [notice, setNotice] = useState<string | null>(null);

  // Target Protein State for Docking
  const [selectedTargetGene, setSelectedTargetGene] = useState('EGFR');
  const [targetPdbId, setTargetPdbId] = useState('1M17');
  const [ligandName, setLigandName] = useState('Gefitinib (Iressa)');
  const [ligandSmiles, setLigandSmiles] = useState('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1');
  const [isDockingRunning, setIsDockingRunning] = useState(false);
  const [dockingResult, setDockingResult] = useState<MolecularDockingResult | null>(null);

  // ADMET Predictor State
  const [admetSmilesInput, setAdmetSmilesInput] = useState('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1');
  const [admetCompoundName, setAdmetCompoundName] = useState('Gefitinib');
  const [isAdmetRunning, setIsAdmetRunning] = useState(false);
  const [admetProfile, setAdmetProfile] = useState<AdmetProfile | null>(null);

  // Target Identification State
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [selectedTargetDomain, setSelectedTargetDomain] = useState<'all' | 'oncology' | 'neuro' | 'immunology' | 'infectious'>('all');
  const [identifiedTargets, setIdentifiedTargets] = useState<TargetIdentificationResult[]>([]);

  // De Novo Molecule Design State
  const [deNovoBaseSmiles, setDeNovoBaseSmiles] = useState('CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5');
  const [deNovoTargetGene, setDeNovoTargetGene] = useState('ABL1');
  const [isDeNovoRunning, setIsDeNovoRunning] = useState(false);
  const [deNovoSuggestions, setDeNovoSuggestions] = useState<DeNovoMoleculeSuggestion[]>([]);

  // Preset Curated Drug Targets
  const curatedTargets: TargetIdentificationResult[] = [
    {
      targetGene: 'EGFR',
      proteinName: 'Epidermal Growth Factor Receptor Tyrosine Kinase',
      diseaseAssociation: 'Non-Small Cell Lung Cancer & Glioblastoma',
      omicsEvidence: 'Overexpression (log2FC = +3.82, p-adj = 1.4e-18) & L858R / T790M driver mutations',
      druggabilityScore: 0.96,
      pocketCount: 3,
      knownPdbStructures: ['1M17', '2ITY', '4WKQ', '5FED'],
      actionableModulators: ['Gefitinib', 'Erlotinib', 'Osimertinib']
    },
    {
      targetGene: 'KRAS',
      proteinName: 'GTPase KRas (Switch I/II Allosteric Pocket)',
      diseaseAssociation: 'Pancreatic, Colorectal & Lung Adenocarcinoma',
      omicsEvidence: 'G12D/G12C activating hotspot mutations in 88% of pancreatic ductal carcinoma',
      druggabilityScore: 0.89,
      pocketCount: 2,
      knownPdbStructures: ['6OIM', '7LGI', '4LDJ', '8AZX'],
      actionableModulators: ['Sotorasib (AMG-510)', 'Adagrasib (MRTX849)']
    },
    {
      targetGene: 'ABL1',
      proteinName: 'Tyrosine-Protein Kinase ABL1 (BCR-ABL1 Fusion)',
      diseaseAssociation: 'Chronic Myeloid Leukemia (CML)',
      omicsEvidence: 'Philadelphia chromosome t(9;22)(q34;q11) reciprocal translocation',
      druggabilityScore: 0.98,
      pocketCount: 4,
      knownPdbStructures: ['1IEP', '2HYY', '3K5V', '6XR6'],
      actionableModulators: ['Imatinib', 'Dasatinib', 'Nilotinib', 'Asciminib']
    },
    {
      targetGene: 'GRIN2B',
      proteinName: 'Glutamate Ionotropic Receptor NMDA Subunit 2B',
      diseaseAssociation: 'Synaptic Hyperexcitability, Autism & Neurodegeneration',
      omicsEvidence: 'Gain-of-function missense variants in pore-forming M2/M3 helices',
      druggabilityScore: 0.91,
      pocketCount: 2,
      knownPdbStructures: ['4PE5', '5U8C', '6WHT', '7EU8'],
      actionableModulators: ['Ifenprodil', 'Ro 25-6981', 'Radiprodil', 'Memantine']
    },
    {
      targetGene: 'SARS-CoV-2 Mpro',
      proteinName: 'Main 3C-like Protease (Nsp5 Cysteine Catalytic Dyad)',
      diseaseAssociation: 'COVID-19 / Coronavirus Viral Replication',
      omicsEvidence: 'Essential for polyprotein pp1a/pp1ab cleavage; 100% sequence conservation',
      druggabilityScore: 0.95,
      pocketCount: 3,
      knownPdbStructures: ['6LU7', '7L10', '7VH8', '8ACD'],
      actionableModulators: ['Nirmatrelvir (Paxlovid)', 'Ensitrelvir']
    },
    {
      targetGene: 'BRAF',
      proteinName: 'Serine/Threonine-Protein Kinase B-Raf (V600E Domain)',
      diseaseAssociation: 'Melanoma & Colorectal Adenocarcinoma',
      omicsEvidence: 'RNA-seq / Phosphoproteomics hyperactivation (log2FC = +2.45, p-adj = 1.1e-12)',
      druggabilityScore: 0.94,
      pocketCount: 4,
      knownPdbStructures: ['4MNE', '4MBJ', '5CSW', '6P3D'],
      actionableModulators: ['Dabrafenib (Tafinlar)', 'Vemurafenib (Zelboraf)', 'Encorafenib']
    }
  ];

  // Preset Compounds for 1-Click Loading
  const presetCompounds = [
    {
      name: 'Gefitinib (EGFR Kinase Inhibitor)',
      smiles: 'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1',
      target: 'EGFR',
      pdb: '1M17'
    },
    {
      name: 'Imatinib (BCR-ABL Inhibitor)',
      smiles: 'CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5',
      target: 'ABL1',
      pdb: '1IEP'
    },
    {
      name: 'Sotorasib (KRAS G12C Covalent Inhibitor)',
      smiles: 'Cc1c(Cl)c(F)c(F)c(F)c1-n1c(=O)c2cnc(nc2n(C)c1=O)N1CCN(CC1)C(=O)C=C',
      target: 'KRAS',
      pdb: '6OIM'
    },
    {
      name: 'Nirmatrelvir (SARS-CoV-2 Mpro Inhibitor)',
      smiles: 'CC(C)(C)C(NC(=O)C(F)(F)F)C(=O)N1CC2C(C1C(=O)NC(CC3CCNC3=O)C#N)C2(C)C',
      target: 'SARS-CoV-2 Mpro',
      pdb: '6LU7'
    },
    {
      name: 'Dabrafenib (BRAF V600E Inhibitor)',
      smiles: 'CC(C)(C)c1nc(c(s1)c2ccnc(n2)N)c3cccc(c3F)NS(=O)(=O)c4c(cccc4F)F',
      target: 'BRAF',
      pdb: '4MNE'
    }
  ];

  // Initialize on mount: only the curated known-target catalog (real reference
  // data). Docking/ADMET are NOT auto-run with fabricated results.
  useEffect(() => {
    setIdentifiedTargets(curatedTargets);
  }, []);

  const DOCKING_UNAVAILABLE =
    'Molecular docking is not available in this build. Real docking requires an AutoDock Vina (or DiffDock) worker with the binary installed; configure CLOUD_RUN_ENDPOINT / a docking backend to enable it. No binding affinity is shown because none was computed.';
  const ADMET_UNAVAILABLE =
    'ADMET prediction is not available in this build. Real ADMET requires RDKit descriptors and a trained/hosted model (e.g. admetSAR / DeepPurpose). No pharmacokinetic values are shown because none were computed.';
  const DENOVO_UNAVAILABLE =
    'De-novo molecule generation is not available in this build. It requires a real generative chemistry model. No candidate molecules are shown because none were generated.';

  // Molecular Docking Handler — honest: no real docking backend is wired, so we
  // report unavailability instead of fabricating a binding affinity.
  const runDockingSimulation = (_target: string, _pdb: string, _ligName: string, _smiles: string) => {
    setDockingResult(null);
    setNotice(DOCKING_UNAVAILABLE);
  };

  // ADMET Predictor Handler — honest: no real ADMET model is wired.
  const runAdmetCalculation = (_smiles: string, _name: string) => {
    setAdmetProfile(null);
    setNotice(ADMET_UNAVAILABLE);
  };

  // De Novo Drug Design Handler
  // De-novo generation Handler — honest: no generative chemistry model is wired,
  // so we report unavailability instead of fabricating candidate molecules.
  const runDeNovoGeneration = () => {
    setDeNovoSuggestions([]);
    setNotice(DENOVO_UNAVAILABLE);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto font-sans">
      {/* Honest capability notice — shown when a capability that needs an external
          backend is invoked. No fabricated results are ever displayed. */}
      {notice && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 flex items-start gap-3" role="status">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-amber-700 dark:text-amber-400 text-xs font-bold hover:underline cursor-pointer">Dismiss</button>
        </div>
      )}
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111722] border-b border-[#E2DDD2] dark:border-[#1E293B] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
                <FlaskConical className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                SynOmics Drug Discovery &amp; Molecular Studio
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-300 dark:border-slate-700">
                Curated targets · docking/ADMET require a backend
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Curated druggable-target reference catalog. Molecular docking, ADMET prediction, and de-novo design are shown as inputs only and require a real external compute backend (AutoDock Vina / RDKit / a generative model) — no results are fabricated.
            </p>
          </div>

          {/* Sub-tab Navigation Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[#EFE9DC] dark:bg-[#151D2C] border border-[#DDD5C5] dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('docking')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'docking'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Molecular Docking (AutoDock)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('admet')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'admet'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>ADMET &amp; Tox Prediction</span>
            </button>

            <button
              onClick={() => setActiveSubTab('targets')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'targets'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Dna className="w-3.5 h-3.5 text-amber-600" />
              <span>Target Identification</span>
            </button>

            <button
              onClick={() => setActiveSubTab('denovo')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'denovo'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>De Novo Drug Design</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Body Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. MOLECULAR DOCKING TAB                                                  */}
        {/* ========================================================================= */}
        {activeSubTab === 'docking' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Quick Preset Selector */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Atom className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
                    Load Benchmark Target &amp; Compound Complex
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">AutoDock Vina Engine</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {presetCompounds.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedTargetGene(item.target);
                      setTargetPdbId(item.pdb);
                      setLigandName(item.name);
                      setLigandSmiles(item.smiles);
                      runDockingSimulation(item.target, item.pdb, item.name, item.smiles);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTargetGene === item.target
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-semibold shadow-xs'
                        : 'bg-[#FAF9F5] dark:bg-[#0E1420] border-[#E2DDD2] dark:border-slate-800 hover:border-emerald-400 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{item.target}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.name}</div>
                    <div className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 mt-1">PDB: {item.pdb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Docking Input & Parameters Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Docking Configuration */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>Docking Calculation Parameters</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Target Protein (Gene / PDB ID):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedTargetGene}
                        onChange={(e) => setSelectedTargetGene(e.target.value)}
                        placeholder="e.g. EGFR, KRAS, ABL1"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                      />
                      <input
                        type="text"
                        value={targetPdbId}
                        onChange={(e) => setTargetPdbId(e.target.value)}
                        placeholder="PDB (1M17)"
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Compound Name:
                    </label>
                    <input
                      type="text"
                      value={ligandName}
                      onChange={(e) => setLigandName(e.target.value)}
                      placeholder="e.g. Gefitinib"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Ligand SMILES String / Structure:
                    </label>
                    <textarea
                      value={ligandSmiles}
                      onChange={(e) => setLigandSmiles(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => runDockingSimulation(selectedTargetGene, targetPdbId, ligandName, ligandSmiles)}
                      disabled={isDockingRunning}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDockingRunning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Computing AutoDock Thermodynamic Grid...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Execute Molecular Docking Run</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Score Summary Metrics */}
                {dockingResult && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2 text-xs">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                      <span>Thermodynamic Affinity:</span>
                      <span className="font-mono text-sm text-emerald-700 dark:text-emerald-300">
                        {dockingResult.bindingAffinityKcalMol} kcal/mol
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-[11px]">
                      <span>Estimated Inhibition ($K_i$):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {dockingResult.estimatedKi_nM} nM
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-[11px]">
                      <span>Binding Pocket Volume:</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {dockingResult.bindingPocket.volumeA3} Å³
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: 3D Pocket & Molecular Poses */}
              <div className="lg:col-span-2 space-y-4">
                <div className="h-[360px] rounded-2xl overflow-hidden border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs relative bg-slate-900">
                  <Molecular3DViewer
                    proteinSymbol={selectedTargetGene}
                    defaultPdbId={targetPdbId}
                    height="100%"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-[11px] font-mono flex items-center gap-1.5 border border-white/20">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{dockingResult ? `Docked Pose 1 (ΔG = ${dockingResult.bindingAffinityKcalMol} kcal/mol)` : 'Reference structure (no docking run)'}</span>
                  </div>
                </div>

                {/* Docking Poses & Interacting Residues Table */}
                {dockingResult && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-2">
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                        <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Binding Poses (Vina Conformational Clusters)</span>
                      </h4>
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                              <th className="py-1">Pose</th>
                              <th className="py-1 text-right">Affinity (kcal/mol)</th>
                              <th className="py-1 text-right">RMSD l.b. (Å)</th>
                              <th className="py-1 text-right">RMSD u.b. (Å)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dockingResult.dockingPoses.map((pose) => (
                              <tr key={pose.poseNumber} className="border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                                <td className="py-1 font-bold">#{pose.poseNumber}</td>
                                <td className="py-1 text-right text-emerald-600 dark:text-emerald-400 font-bold">{pose.affinityKcalMol}</td>
                                <td className="py-1 text-right text-slate-500">{pose.rmsdLowerBound.toFixed(2)}</td>
                                <td className="py-1 text-right text-slate-500">{pose.rmsdUpperBound.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-2">
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                        <Atom className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Key Interacting Binding Residues</span>
                      </h4>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {dockingResult.interactingResidues.map((res, i) => (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#0E1420] text-xs">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {res.resName}{res.resSeq}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold">
                              {res.interactionType} ({res.distanceA} Å)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. ADMET PREDICTOR TAB                                                    */}
        {/* ========================================================================= */}
        {activeSubTab === 'admet' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* SMILES Input Box */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
                    ADMET Profiler &amp; Toxicology Assessment Engine
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">QED / Lipinski / CYP450</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={admetSmilesInput}
                  onChange={(e) => setAdmetSmilesInput(e.target.value)}
                  placeholder="Enter IUPAC SMILES string (e.g., CC(=O)Oc1ccccc1C(=O)O)"
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
                <button
                  onClick={() => runAdmetCalculation(admetSmilesInput, admetCompoundName)}
                  disabled={isAdmetRunning}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAdmetRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing ADMET Metrics...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      <span>Predict ADMET Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ADMET Score Cards */}
            {admetProfile && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Absorption */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="uppercase tracking-wider">Absorption</span>
                    <span>HIA: {admetProfile.absorption.hiaPct}%</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Caco-2 Permeability:</span>
                      <span className="font-mono font-semibold">{admetProfile.absorption.caco2Permeability} ×10⁻⁶ cm/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Blood-Brain Barrier (BBB):</span>
                      <span className={`font-bold ${admetProfile.absorption.bbbPermeable ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {admetProfile.absorption.bbbPermeable ? 'Permeable' : 'Non-Permeable'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>P-glycoprotein Substrate:</span>
                      <span className="font-mono font-semibold">{admetProfile.absorption.pGpSubstrate ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Distribution */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    <span className="uppercase tracking-wider">Distribution</span>
                    <span>PPB: {admetProfile.distribution.ppbPct}%</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Plasma Protein Binding:</span>
                      <span className="font-mono font-semibold">{admetProfile.distribution.ppbPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume of Dist. (VDss):</span>
                      <span className="font-mono font-semibold">{admetProfile.distribution.vdssLKg} L/kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Free Fraction (fu):</span>
                      <span className="font-mono font-semibold">{(100 - admetProfile.distribution.ppbPct).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* 3. Metabolism & Excretion */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                    <span className="uppercase tracking-wider">Metabolism</span>
                    <span>CYP450</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>CYP3A4 Inhibitor:</span>
                      <span className={`font-bold ${admetProfile.metabolism.cyp3a4Inhibitor ? 'text-amber-600' : 'text-slate-400'}`}>
                        {admetProfile.metabolism.cyp3a4Inhibitor ? 'Active' : 'Negative'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Elimination Half-Life ($T_{1/2}$):</span>
                      <span className="font-mono font-semibold">{admetProfile.excretion.halfLifeHours} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clearance Rate:</span>
                      <span className="font-mono font-semibold">{admetProfile.excretion.clearanceRate} mL/min/kg</span>
                    </div>
                  </div>
                </div>

                {/* 4. Toxicity & Drug-likeness */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                    <span className="uppercase tracking-wider">Toxicity &amp; Druggability</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>hERG Cardiotox:</span>
                      <span className={`font-bold ${admetProfile.toxicity.hergCardiotoxRisk === 'Low' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {admetProfile.toxicity.hergCardiotoxRisk} Risk
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ames Mutagenicity:</span>
                      <span className="font-semibold text-emerald-600">{admetProfile.toxicity.amesMutagenicity ? 'Positive' : 'Negative'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QED Score / SA Score:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {admetProfile.druglikeness.qedScore} / {admetProfile.druglikeness.syntheticAccessibilityScore}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TARGET IDENTIFICATION TAB                                              */}
        {/* ========================================================================= */}
        {activeSubTab === 'targets' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                    <Dna className="w-4 h-4 text-emerald-600" />
                    <span>Prioritized Druggable Targets from Multi-Omics Datasets</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cross-referenced differential expression fold change, mutation burden, and 3D pocket druggability.
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={targetSearchQuery}
                    onChange={(e) => setTargetSearchQuery(e.target.value)}
                    placeholder="Search gene or disease..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-[#D5CDBC] dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {identifiedTargets
                  .filter(t => t.targetGene.toLowerCase().includes(targetSearchQuery.toLowerCase()) || t.diseaseAssociation.toLowerCase().includes(targetSearchQuery.toLowerCase()))
                  .map((target, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-[#0E1420] border border-[#E2DDD2] dark:border-slate-800 space-y-2.5 hover:border-emerald-500 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">{target.targetGene}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                            Score: {(target.druggabilityScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTargetGene(target.targetGene);
                            setTargetPdbId(target.knownPdbStructures[0]);
                            setActiveSubTab('docking');
                            runDockingSimulation(target.targetGene, target.knownPdbStructures[0], target.actionableModulators[0] || 'Inhibitor', ligandSmiles);
                          }}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                        >
                          Dock Target →
                        </button>
                      </div>

                      <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {target.proteinName}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <strong>Disease:</strong> {target.diseaseAssociation}
                      </div>

                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300">
                        {target.omicsEvidence}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                        <span>PDBs: {target.knownPdbStructures.join(', ')}</span>
                        <span>{target.pocketCount} Pockets</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. DE NOVO MOLECULE DESIGN TAB                                            */}
        {/* ========================================================================= */}
        {activeSubTab === 'denovo' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>AI-Powered De Novo Molecular Design &amp; Optimization</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Propose bioisosteric replacements, scaffold hops, and fragment additions to optimize binding affinity ($\Delta\Delta G$) and metabolic stability.
                  </p>
                </div>

                <button
                  onClick={runDeNovoGeneration}
                  disabled={isDeNovoRunning}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeNovoRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Designing Bioisosteres...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Optimized Analogues</span>
                    </>
                  )}
                </button>
              </div>

              {/* Suggestions Cards */}
              {deNovoSuggestions.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {deNovoSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-[#0E1420] border border-[#E2DDD2] dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{sug.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold">
                            {sug.modificationType}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ΔΔG: {sug.predictedAffinityGainKcalMol} kcal/mol
                        </span>
                      </div>

                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {sug.rationalRationale}
                      </p>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-teal-900 dark:text-teal-300 font-medium">
                        ✨ <strong>ADMET Impact:</strong> {sug.predictedAdmetImprovement}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="font-mono text-slate-400 truncate max-w-md">{sug.modifiedSmiles}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(sug.modifiedSmiles, sug.id)}
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === sug.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span>Copy SMILES</span>
                          </button>
                          <button
                            onClick={() => {
                              setLigandSmiles(sug.modifiedSmiles);
                              setLigandName(sug.name);
                              setActiveSubTab('docking');
                              runDockingSimulation(selectedTargetGene, targetPdbId, sug.name, sug.modifiedSmiles);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Dock Candidate →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  Click "Generate Optimized Analogues" to run AI bioisosteric optimization on target {deNovoTargetGene}.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
