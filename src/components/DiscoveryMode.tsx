import React, { useState } from 'react';
import { 
  Dna, 
  Compass, 
  Layers, 
  Activity, 
  Search, 
  ShieldAlert, 
  Zap, 
  Sparkles, 
  Filter, 
  ChevronRight, 
  ExternalLink,
  Pill,
  Network,
  BarChart2,
  Cpu,
  Flame,
  Trophy,
  GitFork,
  HeartPulse
} from 'lucide-react';
import { SynapticProtein, SynGOOntologyNode } from '../types';
import { SynapticInteractiveMap } from './SynapticInteractiveMap';
import { SynapticNetworkGraph } from './SynapticNetworkGraph';
import { InSilicoPerturbationLab } from './InSilicoPerturbationLab';
import { MultiOmicsExplorer } from './MultiOmicsExplorer';
import { BioinformaticsSequenceAlignment } from './BioinformaticsSequenceAlignment';
import { BioinformaticsSingleCellScanpy } from './BioinformaticsSingleCellScanpy';
import { BioinformaticsRamachandran } from './BioinformaticsRamachandran';
import { BioinformaticsPhylogenetics } from './BioinformaticsPhylogenetics';
import { BioinformaticsMassSpec } from './BioinformaticsMassSpec';
import { RosettaMutagenesisStudio } from './RosettaMutagenesisStudio';
import { GenomicLocusBrowser } from './GenomicLocusBrowser';
import { DagWorkflowStudio } from './DagWorkflowStudio';
import { KaplanMeierSurvivalEngine } from './KaplanMeierSurvivalEngine';
import { PlatformSupremacyBenchmark } from './PlatformSupremacyBenchmark';
import { MultiModelVerificationStudio } from './MultiModelVerificationStudio';
import { GWASVariantPrioritizer } from './GWASVariantPrioritizer';
import { MicrobiomeAnalyzer } from './MicrobiomeAnalyzer';
import { DrugRepurposingEngine } from './DrugRepurposingEngine';
import { ClinicalGenomicsPanel } from './ClinicalGenomicsPanel';
import { IDiscoverPanel } from './IDiscoverPanel';
import { Scale, Stethoscope, Pill as PillIcon, Bug } from 'lucide-react';

interface DiscoveryModeProps {
  proteins: SynapticProtein[];
  syngoTree: SynGOOntologyNode[];
  onSelectProtein: (protein: SynapticProtein) => void;
  onLaunchCoScientistForPathway: (query: string) => void;
}

export const DiscoveryMode: React.FC<DiscoveryModeProps> = ({
  proteins,
  syngoTree,
  onSelectProtein,
  onLaunchCoScientistForPathway
}) => {
  const [activePipeline, setActivePipeline] = useState<
    'all_omics' | 'idiscover_frontiers' | 'gwas_prioritization' | 'microbiome_metagenomics' | 'drug_repurposing_l1000' | 'clinical_acmg_pgx' | 'multi_model_verification' | 'platform_benchmark' | 'rosetta_mutagenesis' | 'genomic_locus' | 'dag_workflows' | 'kaplan_meier' | 'seq_alignment' | 'single_cell_scanpy' | 'ramachandran' | 'phylogenetics' | 'mass_spec' | 'synapse_map' | 'network_graph' | 'in_silico_lab' | 'multi_omics_suite'
  >('all_omics');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisease, setSelectedDisease] = useState<string>('all');

  const pipelines = [
    { id: 'all_omics', name: 'Multi-Omics Matrix', icon: Compass, badge: 'Unified' },
    { id: 'idiscover_frontiers', name: 'iDiscover Frontiers', icon: Sparkles, badge: 'OT · GFlowNet · ZKP' },
    { id: 'gwas_prioritization', name: 'GWAS Variant Prioritizer', icon: Dna, badge: 'Fine-Map' },
    { id: 'microbiome_metagenomics', name: 'Microbiome & Dysbiosis', icon: Bug, badge: '16S / WGS' },
    { id: 'drug_repurposing_l1000', name: 'Drug Repurposing (L1000)', icon: PillIcon, badge: 'CMap' },
    { id: 'clinical_acmg_pgx', name: 'Clinical Genomics & ACMG', icon: Stethoscope, badge: 'PGx/ClinVar' },
    { id: 'multi_model_verification', name: 'Multi-Model Consensus', icon: Scale, badge: '4 Models' },
    { id: 'platform_benchmark', name: 'Platform Benchmark', icon: Trophy, badge: 'vs Global Tools' },
    { id: 'rosetta_mutagenesis', name: 'Rosetta Mutagenesis (ΔΔG)', icon: Layers, badge: 'FoldX' },
    { id: 'genomic_locus', name: 'Genomic Tracks (GRCh38)', icon: Dna, badge: 'UCSC / IGV' },
    { id: 'dag_workflows', name: 'Visual DAG Workflows', icon: GitFork, badge: 'Nextflow' },
    { id: 'kaplan_meier', name: 'Kaplan-Meier Survival', icon: HeartPulse, badge: 'cBioPortal' },
    { id: 'single_cell_scanpy', name: 'Single-Cell Scanpy', icon: Activity, badge: 'scRNA-seq' },
    { id: 'seq_alignment', name: 'Sequence Alignment', icon: Dna, badge: 'BLOSUM62' },
    { id: 'ramachandran', name: 'Ramachandran & Contact', icon: Layers, badge: 'Structure' },
    { id: 'phylogenetics', name: 'Phylogenetic Trees', icon: Network, badge: 'Evolution' },
    { id: 'mass_spec', name: 'Proteomics MS/MS', icon: Zap, badge: 'Tandem CID' },
    { id: 'synapse_map', name: '2.5D Subcellular Map', icon: Layers, badge: 'Interactive' },
    { id: 'network_graph', name: 'Interactome Graph', icon: Network, badge: 'Topology' },
    { id: 'in_silico_lab', name: 'In-Silico Perturbation Lab', icon: Zap, badge: 'Simulations' },
    { id: 'multi_omics_suite', name: 'Genomics & GWAS Suite', icon: ShieldAlert, badge: 'Clinico-Genomic' }
  ];

  const filteredProteins = proteins.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.geneSymbol.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.primaryFunction.toLowerCase().includes(q) ||
      p.complex.toLowerCase().includes(q) ||
      (p.synonyms && p.synonyms.some(s => s.toLowerCase().includes(q))) ||
      (p.modality && p.modality.toLowerCase().includes(q)) ||
      (p.epitranscriptomicRole && p.epitranscriptomicRole.toLowerCase().includes(q)) ||
      p.associatedDiseases.some(d => d.description.toLowerCase().includes(q) || d.disease.toLowerCase().includes(q)) ||
      p.keyInteractors.some(k => k.toLowerCase().includes(q));
    const matchesDisease = selectedDisease === 'all' || p.associatedDiseases.some(d => d.disease === selectedDisease);
    return matchesSearch && matchesDisease;
  });

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-hidden font-sans">
      {/* Top Pipeline Switcher Ribbon */}
      <div className="p-3 sm:p-4 bg-white dark:bg-[#131A29] border-b border-[#E2DDD2] dark:border-[#1E293B] shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                <Compass className="w-4 h-4" />
              </div>
              <h2 className="font-serif-brand text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Discovery Mode • Multi-Omics Pipelines
              </h2>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              Explore transcriptomics, epitranscriptomics (m6A / m1A / m5C / Ψ), single-cell atlases, proteomics, druggable pockets, and systems biology networks.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search genes, m6A, targets (e.g. METTL3, EGFR)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-slate-200 placeholder:text-[#94A3B8] focus:outline-none focus:border-emerald-600"
              />
            </div>

            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Biological Domains</option>
              <option value="oncology_solid_tumors">Oncology &amp; Solid Tumors</option>
              <option value="immunology_autoimmune">Immunology &amp; Inflammation</option>
              <option value="metabolic_disorders">Metabolic &amp; Cardiovascular</option>
              <option value="rare_genetic_diseases">Rare Genetic Diseases</option>
              <option value="alzheimers_disease">Neurodegenerative Disorders</option>
              <option value="autism_spectrum_disorder">Neurodevelopmental Disorders</option>
              <option value="schizophrenia">Psychiatric &amp; Complex Traits</option>
            </select>
          </div>
        </div>

        {/* Scrollable Pipeline Pills */}
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none">
          {pipelines.map(pl => {
            const Icon = pl.icon;
            const isActive = activePipeline === pl.id;

            return (
              <button
                key={pl.id}
                onClick={() => setActivePipeline(pl.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                    : 'bg-[#F3EFE6] dark:bg-slate-800/80 text-[#334155] dark:text-slate-300 border-[#E2DDD2] dark:border-slate-700 hover:bg-[#E8E1D2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{pl.name}</span>
                <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-[#64748B] dark:text-slate-400'
                }`}>
                  {pl.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Sub-views routing */}
          {activePipeline === 'idiscover_frontiers' && (
            <div className="-m-4 sm:-m-6 h-[calc(100vh-8rem)]">
              <IDiscoverPanel />
            </div>
          )}

          {activePipeline === 'all_omics' && (
            <div className="space-y-6">
              {/* Top Summary Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Universal Multi-Omics Knowledge Catalog
                  </span>
                  <h3 className="font-serif-brand text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
                    Unified Multi-Omics Proteomics Matrix
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Cross-referenced across &gt;20,000 multi-omics features, subcellular compartments (Nucleus, Cytoplasm, Plasma Membrane, Organelles, Extracellular Matrix), epitranscriptomic regulators (m6A/m1A/m5C/Ψ), and clinico-genomic disease risk scores.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onLaunchCoScientistForPathway('Run multi-omics cross-referencing on all prioritized disease risk genes, epitranscriptomic marks, and oncogenic targets')}
                    className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Co-Scientist Agent</span>
                  </button>
                </div>
              </div>

              {/* Protein Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProteins.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectProtein(p)}
                    className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif-brand text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {p.geneSymbol}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                            {p.molecularWeightKDa} kDa
                          </span>
                          {p.epitranscriptomicRole && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                              {p.epitranscriptomicRole}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-slate-400 truncate max-w-[200px]">
                          {p.name}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#F3EFE6] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#E2DDD2] dark:border-slate-700">
                        ~{p.estimatedCopyNumberPerSynapse} copies/cell
                      </span>
                    </div>

                    <p className="text-xs text-[#334155] dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {p.primaryFunction}
                    </p>

                    <div className="pt-2 border-t border-[#F3EFE6] dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B] dark:text-slate-400 truncate max-w-[150px]">
                        {p.complex}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePipeline === 'gwas_prioritization' && (
            <GWASVariantPrioritizer />
          )}

          {activePipeline === 'microbiome_metagenomics' && (
            <MicrobiomeAnalyzer />
          )}

          {activePipeline === 'drug_repurposing_l1000' && (
            <DrugRepurposingEngine />
          )}

          {activePipeline === 'clinical_acmg_pgx' && (
            <ClinicalGenomicsPanel />
          )}

          {activePipeline === 'multi_model_verification' && (
            <MultiModelVerificationStudio onLaunchCoScientist={onLaunchCoScientistForPathway} />
          )}

          {activePipeline === 'platform_benchmark' && (
            <PlatformSupremacyBenchmark />
          )}

          {activePipeline === 'rosetta_mutagenesis' && (
            <RosettaMutagenesisStudio proteins={proteins} />
          )}

          {activePipeline === 'genomic_locus' && (
            <GenomicLocusBrowser proteins={proteins} />
          )}

          {activePipeline === 'dag_workflows' && (
            <DagWorkflowStudio />
          )}

          {activePipeline === 'kaplan_meier' && (
            <KaplanMeierSurvivalEngine proteins={proteins} />
          )}

          {activePipeline === 'seq_alignment' && (
            <BioinformaticsSequenceAlignment />
          )}

          {activePipeline === 'single_cell_scanpy' && (
            <BioinformaticsSingleCellScanpy />
          )}

          {activePipeline === 'ramachandran' && (
            <BioinformaticsRamachandran />
          )}

          {activePipeline === 'phylogenetics' && (
            <BioinformaticsPhylogenetics />
          )}

          {activePipeline === 'mass_spec' && (
            <BioinformaticsMassSpec />
          )}

          {activePipeline === 'synapse_map' && (
            <SynapticInteractiveMap
              proteins={proteins}
              onSelectProtein={onSelectProtein}
            />
          )}

          {activePipeline === 'network_graph' && (
            <SynapticNetworkGraph
              proteins={proteins}
              onSelectProtein={onSelectProtein}
              onLaunchCoScientistForComplex={(complex) => onLaunchCoScientistForPathway(`Analyze structural topology and mutations in ${complex}`)}
            />
          )}

          {activePipeline === 'in_silico_lab' && (
            <InSilicoPerturbationLab
              proteins={proteins}
              onSelectProtein={onSelectProtein}
              onLaunchCoScientistForPerturbation={(gene, mode) => onLaunchCoScientistForPathway(`Simulate in-silico ${mode} of ${gene} and assess synaptic plasticity`)}
            />
          )}

          {activePipeline === 'multi_omics_suite' && (
            <MultiOmicsExplorer
              proteins={proteins}
              syngoTree={syngoTree}
              onSelectProtein={onSelectProtein}
              onLaunchCoScientistForPathway={onLaunchCoScientistForPathway}
            />
          )}
        </div>
      </div>
    </div>
  );
};
