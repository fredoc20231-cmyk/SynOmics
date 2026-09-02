import React, { useState } from 'react';
import { Pill, Sparkles, Download, Filter, Search, CheckCircle2, ShieldAlert, ArrowUpRight, Zap, Target, Layers } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface CandidateDrug {
  compound: string;
  targets: string[];
  reversalScore: number; // -100 to +100
  moa: string;
  clinicalPhase: string;
  indication: string;
  admet: {
    qed: number; // 0 to 1
    lipinskiViolations: number;
    solubility: string;
    bbbPermeable: boolean;
    hergRisk: string;
  };
  evidenceSources: string[];
}

const PRESET_CANDIDATES: Record<string, CandidateDrug[]> = {
  'Glioblastoma Multiforme (EGFRvIII/PTEN-loss)': [
    {
      compound: 'Osimertinib (Tagrisso)',
      targets: ['EGFR', 'HER2'],
      reversalScore: -96.4,
      moa: '3rd-Gen Irreversible Mutant-Selective EGFR TKI',
      clinicalPhase: 'FDA Approved (NSCLC, GBM trials)',
      indication: 'High CNS Penetrance, Brain Metastases',
      admet: { qed: 0.76, lipinskiViolations: 0, solubility: 'High', bbbPermeable: true, hergRisk: 'Low' },
      evidenceSources: ['LINCS L1000', 'CTRPv2', 'DepMap Achilles']
    },
    {
      compound: 'Everolimus (RAD001)',
      targets: ['MTOR', 'FKBP1A'],
      reversalScore: -92.1,
      moa: 'mTORC1 Allosteric Inhibitor & Autophagy Inducer',
      clinicalPhase: 'FDA Approved (Oncology / SEGA)',
      indication: 'Blocks downstream PI3K/AKT hyperactivation',
      admet: { qed: 0.62, lipinskiViolations: 1, solubility: 'Moderate', bbbPermeable: true, hergRisk: 'Low' },
      evidenceSources: ['Connectivity Map', 'DrugBank 5.1']
    },
    {
      compound: 'Disulfiram + Copper',
      targets: ['NPL4', 'VCP', 'ALDH2'],
      reversalScore: -89.5,
      moa: 'p97/VCP Segregase Inhibitor & Proteotoxic Stess Inducer',
      clinicalPhase: 'Phase II (Glioblastoma / Addiction)',
      indication: 'Crosses blood-brain barrier, targets cancer stem cells',
      admet: { qed: 0.84, lipinskiViolations: 0, solubility: 'Good', bbbPermeable: true, hergRisk: 'Very Low' },
      evidenceSources: ['Nature 2017 Screen', 'LINCS L1000']
    }
  ],
  'Pancreatic Ductal Adenocarcinoma (KRAS G12D)': [
    {
      compound: 'MRTX1133',
      targets: ['KRAS'],
      reversalScore: -97.2,
      moa: 'Non-covalent Selective KRAS G12D Inhibitor',
      clinicalPhase: 'Phase I/II Clinical Trials',
      indication: 'Selective for active/inactive state of G12D mutant',
      admet: { qed: 0.72, lipinskiViolations: 0, solubility: 'High', bbbPermeable: false, hergRisk: 'Low' },
      evidenceSources: ['Mirati Phase 1', 'LINCS L1000', 'Cancer Cell 2022']
    },
    {
      compound: 'Trametinib (Mekinist)',
      targets: ['MAP2K1', 'MAP2K2'],
      reversalScore: -93.8,
      moa: 'Allosteric MEK1/MEK2 Kinase Inhibitor',
      clinicalPhase: 'FDA Approved (Melanoma / PDAC combos)',
      indication: 'Suppresses downstream MAPK/ERK hyper-proliferation',
      admet: { qed: 0.69, lipinskiViolations: 1, solubility: 'Moderate', bbbPermeable: false, hergRisk: 'Low' },
      evidenceSources: ['DepMap CRISPR', 'CTD Database']
    },
    {
      compound: 'Hydroxychloroquine (Plaquenil)',
      targets: ['PPT1', 'Lysosomal Acidification'],
      reversalScore: -86.5,
      moa: 'Autophagy Inhibitor & Palmitoyl-Protein Thioesterase 1 Blocker',
      clinicalPhase: 'Phase II Combinations (PDAC / Gemcitabine)',
      indication: 'Starves KRAS-addicted metabolic pinocytosis',
      admet: { qed: 0.85, lipinskiViolations: 0, solubility: 'High', bbbPermeable: true, hergRisk: 'Moderate' },
      evidenceSources: ['Perelman School Trials', 'LINCS L1000']
    }
  ],
  'Alzheimer Disease Neuroinflammation': [
    {
      compound: 'Baricitinib (Olumiant)',
      targets: ['JAK1', 'JAK2'],
      reversalScore: -94.2,
      moa: 'Selective JAK1/JAK2 Kinase Inhibitor',
      clinicalPhase: 'FDA Approved (RA / COVID-19; AD trials)',
      indication: 'Suppresses microglial interferon/cytokine storm',
      admet: { qed: 0.81, lipinskiViolations: 0, solubility: 'High', bbbPermeable: true, hergRisk: 'Low' },
      evidenceSources: ['LINCS L1000', 'NIA-LOAD Cohort']
    },
    {
      compound: 'Rapamycin (Sirolimus)',
      targets: ['MTOR', 'FKBP1A'],
      reversalScore: -91.8,
      moa: 'mTORC1 Inhibitor & Tau/Abeta Autophagic Clearance',
      clinicalPhase: 'Approved / Phase II (PEARL Longevity)',
      indication: 'Reverses neuronal senescence and proteostatic stress',
      admet: { qed: 0.68, lipinskiViolations: 1, solubility: 'Moderate', bbbPermeable: true, hergRisk: 'Low' },
      evidenceSources: ['Connectivity Map', 'DrugAge 2024']
    }
  ]
};

export const DrugRepurposingEngine: React.FC = () => {
  const [selectedDisease, setSelectedDisease] = useState('Glioblastoma Multiforme (EGFRvIII/PTEN-loss)');
  const [selectedCompoundName, setSelectedCompoundName] = useState<string>('Osimertinib (Tagrisso)');
  const [searchTerm, setSearchTerm] = useState('');

  const candidates = PRESET_CANDIDATES[selectedDisease] || PRESET_CANDIDATES['Glioblastoma Multiforme (EGFRvIII/PTEN-loss)'];
  const filteredCandidates = candidates.filter(c => 
    c.compound.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.targets.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.moa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCompound = candidates.find(c => c.compound === selectedCompoundName) || candidates[0];

  const radarData = [
    { metric: 'QED Drug-Likeness', value: Math.round(activeCompound.admet.qed * 100) },
    { metric: 'Target Specificity', value: 92 },
    { metric: 'Reversal Tau Score', value: Math.abs(activeCompound.reversalScore) },
    { metric: 'Safety / hERG Profile', value: activeCompound.admet.hergRisk === 'Low' ? 90 : 65 },
    { metric: 'CNS Penetrance', value: activeCompound.admet.bbbPermeable ? 95 : 30 },
    { metric: 'Clinical Stage', value: activeCompound.clinicalPhase.includes('Approved') ? 100 : 70 }
  ];

  return (
    <div className="space-y-6">
      {/* Honest framing: this is a curated literature-derived reference set, not a
          live CMap/L1000 run against the user's own expression data. */}
      <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 flex items-start gap-3" role="status">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          Curated reference set of literature-derived repurposing hypotheses. A live
          connectivity-map / LINCS&nbsp;L1000 signature-reversal run against your own
          expression data is not wired in this build — the reversal (τ) scores and
          ADMET values shown are <strong>curated priors, not computed</strong> from
          your input.
        </p>
      </div>
      {/* Top Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20">
                Curated repurposing reference (literature-derived) — not a live CMap run
              </span>
              <span className="text-xs text-slate-400 font-mono">Curated τ priors (illustrative)</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Pill className="w-5 h-5 text-cyan-500" /> Drug Repurposing &amp; Target Inversion Engine
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              A curated catalog of FDA-approved and investigational compounds with literature-reported
              potential to reverse disease gene-expression signatures. Values are curated references to
              guide hypotheses; they are not computed from user-supplied data in this build.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedDisease}
              onChange={(e) => {
                setSelectedDisease(e.target.value);
                const newCandidates = PRESET_CANDIDATES[e.target.value] || [];
                if (newCandidates.length > 0) setSelectedCompoundName(newCandidates[0].compound);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Glioblastoma Multiforme (EGFRvIII/PTEN-loss)">Glioblastoma Multiforme (EGFRvIII/PTEN-loss)</option>
              <option value="Pancreatic Ductal Adenocarcinoma (KRAS G12D)">Pancreatic Ductal Carcinoma (KRAS G12D)</option>
              <option value="Alzheimer Disease Neuroinflammation">Alzheimer Neuroinflammation &amp; Autophagy</option>
            </select>

            <button
              onClick={() => {
                const csv = `Compound,Targets,Reversal_Tau_Score,Mechanism_of_Action,Clinical_Phase,Indication,QED,BBB_Permeable\n` +
                  candidates.map(c => `"${c.compound}","${c.targets.join('; ')}",${c.reversalScore},"${c.moa}","${c.clinicalPhase}","${c.indication}",${c.admet.qed},${c.admet.bbbPermeable}`).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `synomics_drug_repurposing_${Date.now()}.csv`;
                a.click();
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Repurposing Report
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Ranked Candidate Reversal Bar Chart + ADMET Radar View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Bar Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-500" /> Curated Reversal Score (τ, literature-derived)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A more negative curated τ reflects stronger reported signature inversion. Curated priors — not computed from your data.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={candidates.map(c => ({ name: c.compound.split(' ')[0], fullCompound: c.compound, score: c.reversalScore, targets: c.targets.join(', ') }))} 
                margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
              >
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[-100, 0]} stroke="#94a3b8" fontSize={11} label={{ value: 'Reversal Tau Score', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip 
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-2.5 bg-slate-950 text-white rounded-lg text-xs shadow-xl border border-slate-800">
                        <div className="font-bold text-cyan-400">{d.fullCompound}</div>
                        <div>Reversal Score: {d.score}</div>
                        <div>Targets: {d.targets}</div>
                      </div>
                    );
                  }}
                />
                <Bar 
                  dataKey="score" 
                  radius={[0, 0, 4, 4]}
                  onClick={(entry: any) => entry?.fullCompound && setSelectedCompoundName(entry.fullCompound)}
                >
                  {candidates.map((c, i) => (
                    <Cell 
                      key={`bar-${i}`} 
                      fill={c.compound === selectedCompoundName ? '#06b6d4' : '#0891b2'} 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 col: ADMET & Target Radar */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-500" /> ADMET &amp; Druggability Radar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                {activeCompound.compound}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" stroke="#94a3b8" fontSize={9} />
                <PolarRadiusAxis domain={[0, 100]} stroke="#64748b" fontSize={8} />
                <Radar name={activeCompound.compound} dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Selected Compound Deep-Dive + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Compound Profile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-50 to-slate-100 dark:from-cyan-950/30 dark:via-slate-900 dark:to-slate-900 border border-cyan-500/20 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500 text-white">
              {activeCompound.clinicalPhase}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">τ = {activeCompound.reversalScore}</span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {activeCompound.compound}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Target Nodes: <span className="font-bold text-cyan-600 dark:text-cyan-400">{activeCompound.targets.join(', ')}</span>
          </p>

          <div className="mt-4 space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mechanism of Action</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{activeCompound.moa}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Therapeutic Context &amp; CNS Access</span>
              <p className="text-slate-700 dark:text-slate-300 mt-0.5">{activeCompound.indication}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${activeCompound.admet.bbbPermeable ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                  {activeCompound.admet.bbbPermeable ? '✓ BBB Permeable' : 'Non-CNS Restricted'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  QED Score: {activeCompound.admet.qed}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Compound Comparison Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-cyan-500" /> Prioritized Repurposing Candidates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked by transcriptomic signature inversion score
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search compound or target..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Compound</th>
                  <th className="py-2.5 px-3">Targets</th>
                  <th className="py-2.5 px-3">Reversal Score</th>
                  <th className="py-2.5 px-3">Clinical Stage</th>
                  <th className="py-2.5 px-3">QED</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCandidates.map((c) => (
                  <tr 
                    key={c.compound}
                    onClick={() => setSelectedCompoundName(c.compound)}
                    className={`cursor-pointer transition-colors ${selectedCompoundName === c.compound ? 'bg-cyan-500/10 dark:bg-cyan-950/40 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      {c.compound}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-cyan-600 dark:text-cyan-400">{c.targets.join(', ')}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{c.reversalScore}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{c.clinicalPhase}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{c.admet.qed}</td>
                    <td className="py-2.5 px-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCompoundName(c.compound);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white text-[11px] transition-colors"
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
      </div>
    </div>
  );
};
