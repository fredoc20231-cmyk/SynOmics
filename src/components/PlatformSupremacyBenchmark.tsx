import React, { useState } from 'react';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Minus, 
  Layers, 
  Cpu, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Dna, 
  Network, 
  Activity, 
  Flame,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface BenchmarkRow {
  feature: string;
  category: string;
  sheenSynomics: { status: 'full' | 'partial' | 'none'; note: string };
  legacyBioAi: { status: 'full' | 'partial' | 'none'; note: string };
  rosettaBio: { status: 'full' | 'partial' | 'none'; note: string };
  galaxyProject: { status: 'full' | 'partial' | 'none'; note: string };
  ucscGenome: { status: 'full' | 'partial' | 'none'; note: string };
  cbioPortal: { status: 'full' | 'partial' | 'none'; note: string };
}

const BENCHMARK_DATA: BenchmarkRow[] = [
  {
    feature: 'Runge-Kutta 4th-Order Synaptic ODE Electrophysiology',
    category: 'Biophysics & Electrophysiology',
    sheenSynomics: { status: 'full', note: 'Real-time numerical ODE solver (0.1ms step, AMPA/NMDA/GABA/Ca2+ currents)' },
    legacyBioAi: { status: 'partial', note: 'Static Python scripts, no interactive UI simulation' },
    rosettaBio: { status: 'none', note: 'Macromolecular structural only, no electrophysiology' },
    galaxyProject: { status: 'none', note: 'Tool wrapper only, lacks live ODE state integration' },
    ucscGenome: { status: 'none', note: 'Genomic coordinate browser only' },
    cbioPortal: { status: 'none', note: 'Clinical genomics queries only' }
  },
  {
    feature: 'In-Silico Mutagenesis & FoldX / Rosetta ΔΔG Energetics',
    category: 'Structural Biology',
    sheenSynomics: { status: 'full', note: 'Instant ΔΔG kcal/mol decomposition into VDW, electrostatics, solvation, and entropy' },
    legacyBioAi: { status: 'none', note: 'Requires external batch pipeline' },
    rosettaBio: { status: 'full', note: 'Core strength (slow HPC background queues)' },
    galaxyProject: { status: 'partial', note: 'Wraps Rosetta via command line XML' },
    ucscGenome: { status: 'none', note: 'Does not model protein folding energetics' },
    cbioPortal: { status: 'none', note: 'Lollipop mutation viewer only' }
  },
  {
    feature: 'Single-Cell snRNA-seq Scanpy Pipeline (Real Science 2019 data)',
    category: 'Transcriptomics',
    sheenSynomics: { status: 'full', note: 'Live CPM library-size normalization, HVG dispersion, SVD/PCA & Wilcoxon markers' },
    legacyBioAi: { status: 'partial', note: 'Scanpy code snippet generation only' },
    rosettaBio: { status: 'none', note: 'No single-cell transcriptomics capabilities' },
    galaxyProject: { status: 'full', note: 'Scanpy toolsuite available in cloud' },
    ucscGenome: { status: 'partial', note: 'UCSC Cell Browser tracks' },
    cbioPortal: { status: 'none', note: 'Bulk RNA-seq and mutation profiles only' }
  },
  {
    feature: 'Visual DAG Scientific Workflow Builder (Nextflow/Snakemake)',
    category: 'High-Performance Workflows',
    sheenSynomics: { status: 'full', note: 'Visual node DAG builder with 1-click Nextflow DSL2 & Snakemake export' },
    legacyBioAi: { status: 'none', note: 'No visual DAG workflow system' },
    rosettaBio: { status: 'none', note: 'Proprietary RosettaScripts XML only' },
    galaxyProject: { status: 'full', note: 'Core strength (Galaxy .ga workflow format)' },
    ucscGenome: { status: 'none', note: 'Static track hub system' },
    cbioPortal: { status: 'none', note: 'No workflow builder' }
  },
  {
    feature: 'UCSC / IGV GRCh38 Coordinate Track Browser',
    category: 'Genomics & Epigenetics',
    sheenSynomics: { status: 'full', note: 'Integrated exons, ClinVar variants, CADD scores, and human brain ChIP/ATAC peaks' },
    legacyBioAi: { status: 'none', note: 'Lacks interactive coordinate canvas' },
    rosettaBio: { status: 'none', note: 'Protein structures only' },
    galaxyProject: { status: 'partial', note: 'External link out to IGV/UCSC' },
    ucscGenome: { status: 'full', note: 'Core strength (gold standard track hub)' },
    cbioPortal: { status: 'partial', note: 'Gene locus summary' }
  },
  {
    feature: 'Kaplan-Meier Survival Analysis with Log-Rank Statistics',
    category: 'Clinical Genetics',
    sheenSynomics: { status: 'full', note: 'Interactive cumulative S(t) curves, Chi-Square log-rank, Hazard Ratios (HR)' },
    legacyBioAi: { status: 'none', note: 'No cohort survival modeling' },
    rosettaBio: { status: 'none', note: 'No patient cohort analytics' },
    galaxyProject: { status: 'partial', note: 'R package wrappers (survival/survminer)' },
    ucscGenome: { status: 'none', note: 'No patient survival data' },
    cbioPortal: { status: 'full', note: 'Core strength (cancer clinical cohorts)' }
  },
  {
    feature: 'Autonomous AI Co-Scientist Agent & Live Python Terminal',
    category: 'AI & Automation',
    sheenSynomics: { status: 'full', note: 'Autonomous multi-step Co-Scientist loop + real sandboxed Python 3 execution' },
    legacyBioAi: { status: 'full', note: 'Standard CLI-based agent frameworks' },
    rosettaBio: { status: 'none', note: 'No autonomous AI agentic loop' },
    galaxyProject: { status: 'none', note: 'Manual user-driven workflow curation' },
    ucscGenome: { status: 'none', note: 'Traditional web database' },
    cbioPortal: { status: 'none', note: 'Query-based portal' }
  },
  {
    feature: 'Tandem MS/MS Proteomics CID Fragmentation Engine',
    category: 'Proteomics',
    sheenSynomics: { status: 'full', note: 'In-silico tryptic cleavage + b/y-ion series m/z fragmentation modeling' },
    legacyBioAi: { status: 'none', note: 'No tandem mass spec engine' },
    rosettaBio: { status: 'none', note: 'No mass spectrometry solver' },
    galaxyProject: { status: 'partial', note: 'MaxQuant / OpenMS wrappers' },
    ucscGenome: { status: 'none', note: 'No proteomics engine' },
    cbioPortal: { status: 'partial', note: 'CPTAC proteomics abundance' }
  }
];

export const PlatformSupremacyBenchmark: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = ['all', 'Biophysics & Electrophysiology', 'Structural Biology', 'Transcriptomics', 'High-Performance Workflows', 'Genomics & Epigenetics', 'Clinical Genetics', 'AI & Automation', 'Proteomics'];

  const filteredData = activeCategory === 'all' 
    ? BENCHMARK_DATA 
    : BENCHMARK_DATA.filter(r => r.category === activeCategory);

  const renderStatus = (item: { status: 'full' | 'partial' | 'none'; note: string }) => {
    if (item.status === 'full') {
      return (
        <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span className="text-[11px] leading-tight">{item.note}</span>
        </div>
      );
    }
    if (item.status === 'partial') {
      return (
        <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
          <Minus className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <span className="text-[11px] leading-tight">{item.note}</span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-1.5 text-slate-400 dark:text-slate-500">
        <XCircle className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 mt-0.5" />
        <span className="text-[11px] leading-tight">{item.note}</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Platform Supremacy & Comparative Bioinformatics Benchmark
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              SynOmics vs. Global Bio-Platforms
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Objective side-by-side feature and architectural comparison evaluating SynOmics against Rosetta.bio, Legacy Bio-AI Agents, Galaxy Project, UCSC Genome Browser, and cBioPortal across multi-omics, biophysics, structural energetics, and AI reasoning.
          </p>
        </div>

        {/* Aggregate Score Card */}
        <div className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-center">
          <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">Overall Capability Coverage</span>
          <span className="text-xl font-mono font-bold text-indigo-900 dark:text-indigo-100 block">100% (8/8 Modules)</span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize ${
              activeCategory === cat
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-[#131A29] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat === 'all' ? 'All Bioinformatics Domains' : cat}
          </button>
        ))}
      </div>

      {/* Main Benchmark Comparison Table */}
      <div className="bg-white dark:bg-[#131A29] rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3 px-4 w-64">Bioinformatics Capability</th>
                <th className="py-3 px-4 w-72 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-x border-indigo-200 dark:border-indigo-800">
                  SynOmics
                </th>
                <th className="py-3 px-4 w-48">Rosetta.bio</th>
                <th className="py-3 px-4 w-48">Legacy Bio-AI Agents</th>
                <th className="py-3 px-4 w-48">Galaxy Project</th>
                <th className="py-3 px-4 w-48">cBioPortal / UCSC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-xs text-slate-900 dark:text-slate-100">
                    <div>{row.feature}</div>
                    <span className="text-[10px] text-slate-400 font-normal">{row.category}</span>
                  </td>

                  {/* SynOmics Column */}
                  <td className="py-3.5 px-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-x border-indigo-100 dark:border-indigo-900">
                    {renderStatus(row.sheenSynomics)}
                  </td>

                  {/* Rosetta.bio */}
                  <td className="py-3.5 px-4">
                    {renderStatus(row.rosettaBio)}
                  </td>

                  {/* Legacy Bio-AI Agents */}
                  <td className="py-3.5 px-4">
                    {renderStatus(row.legacyBioAi)}
                  </td>

                  {/* Galaxy Project */}
                  <td className="py-3.5 px-4">
                    {renderStatus(row.galaxyProject)}
                  </td>

                  {/* cBioPortal / UCSC */}
                  <td className="py-3.5 px-4">
                    {renderStatus(row.cbioPortal.status === 'none' ? row.ucscGenome : row.cbioPortal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
