import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Play, 
  Dna, 
  Cpu, 
  Zap, 
  Activity, 
  Layers, 
  Database, 
  ShieldCheck, 
  Sliders, 
  Sparkles, 
  Terminal, 
  FileCode, 
  CheckCircle2, 
  Clock, 
  CloudRain, 
  Network, 
  Flame, 
  Microscope,
  Server,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Filter,
  Upload,
  FolderUp,
  Settings2,
  FileText,
  Check,
  Plus,
  Trash2,
  HelpCircle,
  BarChart3,
  FlaskConical
} from 'lucide-react';
import { invokeCloudBioWorkload, BioWorkloadPayload, CloudJobExecutionResult } from '../lib/cloud-functions';

export interface AnalysisCatalogItem {
  id: string;
  category: string;
  categoryNumber: string;
  title: string;
  subtitle: string;
  description: string;
  tools: string[];
  defaultParams: Record<string, any>;
  sampleGenes: string[];
  targetMode?: 'basic' | 'advanced' | 'discovery' | 'workspace';
}

export interface ExperimentalGroup {
  id: string;
  name: string;
  designation: 'control' | 'treated' | 'baseline' | 'perturbation';
  count: number;
  color: string;
}

export interface AiDatasetDetectionResult {
  fileName: string;
  detectedType: string;
  organism: string;
  sampleCount: number;
  featureCount: number;
  sampleGroups: ExperimentalGroup[];
  detectedAttributes: string[];
  suggestedPipelines: string[];
  confidenceScore: number;
  aiAnalysisSummary: string;
}

export const BIOINFORMATICS_TAXONOMY: AnalysisCatalogItem[] = [
  // I. SEQUENCE & GENOMIC ANALYSES
  {
    id: 'seq-variant-gatk',
    category: 'Sequence & Genomic Analyses',
    categoryNumber: 'I',
    title: 'Whole-Genome / Exome Variant Calling (GATK / DeepVariant)',
    subtitle: 'SNVs, InDels, SVs & CNV Detection with VCF Annotation',
    description: 'High-throughput somatic and germline variant discovery pipeline with GATK4 HaplotypeCaller, Google DeepVariant CNN, and SnpEff/VEP functional consequence annotation.',
    tools: ['BWA-MEM2', 'GATK4', 'DeepVariant', 'VEP', 'ClinVar'],
    defaultParams: { genome: 'GRCh38.p13', minDepth: 30, qualThreshold: 30, emitAllSites: false },
    sampleGenes: ['TP53', 'BRCA1', 'EGFR', 'KRAS', 'BRAF'],
    targetMode: 'workspace'
  },
  {
    id: 'seq-gwas-finemapping',
    category: 'Sequence & Genomic Analyses',
    categoryNumber: 'I',
    title: 'GWAS & Statistical Fine-Mapping (PLINK / SuSiE)',
    subtitle: 'Case-Control Polygenic Association & LD Trait Mapping',
    description: 'Calculates single-variant linear/logistic regression, Manhattan & QQ metrics, and SuSiE Bayesian fine-mapping with 1000 Genomes linkage disequilibrium matrices.',
    tools: ['PLINK 2.0', 'SuSiE', 'LDSC', 'MAGMA'],
    defaultParams: { pvalCutoff: '5e-8', mafFilter: 0.01, hwePval: '1e-6' },
    sampleGenes: ['PPARG', 'TCF7L2', 'APOE', 'TREM2'],
    targetMode: 'discovery'
  },
  {
    id: 'seq-epigenomics-chip',
    category: 'Sequence & Genomic Analyses',
    categoryNumber: 'I',
    title: 'Epigenomics & Chromatin Accessibility (ChIP-seq / ATAC-seq)',
    subtitle: 'MACS3 Peak Calling, ChromHMM & HOMER Motif Discovery',
    description: 'Maps histone modifications (H3K4me3, H3K27ac) and open chromatin architectures across genomic loci to identify active enhancers and transcriptional regulators.',
    tools: ['MACS3', 'HOMER', 'ChromHMM', 'DeepTools'],
    defaultParams: { qvalue: 0.05, peakType: 'narrow', effectiveGenomeSize: 'hs' },
    sampleGenes: ['MYC', 'SOX2', 'NANOG', 'OCT4'],
    targetMode: 'workspace'
  },

  // II. TRANSCRIPTOMIC ANALYSES
  {
    id: 'tx-deseq2-bulk',
    category: 'Transcriptomic Analyses',
    categoryNumber: 'II',
    title: 'Bulk RNA-seq Differential Expression (STAR / DESeq2)',
    subtitle: 'Variance Stabilizing Transformation, DEG & Volcano Mapping',
    description: 'End-to-end transcriptomic quantification via STAR + Salmon, paired with negative binomial GLM testing in DESeq2/edgeR with Benjamini-Hochberg FDR correction.',
    tools: ['STAR', 'Salmon', 'DESeq2', 'EnhancedVolcano'],
    defaultParams: { padjCutoff: 0.05, log2FoldChange: 1.5, normalization: 'rlog' },
    sampleGenes: ['KRAS', 'EGFR', 'MYC', 'VEGFA', 'CDKN2A'],
    targetMode: 'discovery'
  },
  {
    id: 'tx-scrna-scanpy',
    category: 'Transcriptomic Analyses',
    categoryNumber: 'II',
    title: 'Single-Cell & Single-Nucleus RNA-seq (Scanpy / Seurat)',
    subtitle: 'SCTransform, Leiden Community Detection & Cell Markers',
    description: 'Resolves cellular heterogeneity across immune and tissue cell types with Leiden clustering, UMAP projections, and cell-cell communication (CellChat).',
    tools: ['Scanpy', 'Seurat v5', 'Harmony', 'CellBender', 'Scrublet'],
    defaultParams: { resolution: 0.6, nPcs: 30, minGenes: 500, maxMitoPct: 5 },
    sampleGenes: ['CD8A', 'CD4', 'MS4A1', 'CD14', 'IL7R'],
    targetMode: 'workspace'
  },
  {
    id: 'tx-spatial-visium',
    category: 'Transcriptomic Analyses',
    categoryNumber: 'II',
    title: 'Spatial Transcriptomics & In-Situ Sequencing (10x Visium / Xenium)',
    subtitle: 'Spatial Deconvolution, Cell-Type Niche & Morans I Co-localization',
    description: 'Integrates histology imaging with spatial transcriptomic spot deconvolution (cell2location / RCTD) to delineate microenvironments and spatial niches.',
    tools: ['Scanpy Spatial', 'cell2location', 'Seurat Spatial', 'Squidpy'],
    defaultParams: { spatialNeighbors: 6, deconvolutionEpochs: 250 },
    sampleGenes: ['EPCAM', 'ACTA2', 'PDCD1', 'MKI67'],
    targetMode: 'discovery'
  },

  // III. PROTEOMIC ANALYSES
  {
    id: 'prot-ms-quant',
    category: 'Proteomic Analyses',
    categoryNumber: 'III',
    title: 'Tandem Mass Spectrometry & PTM Characterization (MaxQuant / DIA-NN)',
    subtitle: 'Phosphoproteomics, PhosphoSitePlus & Kinase Enrichment',
    description: 'Deep quantitative proteomics for cellular micro-fractions. Identifies Ser/Thr/Tyr phosphorylation kinetics and ubiquitination dynamics.',
    tools: ['MaxQuant', 'DIA-NN', 'Perseus', 'MSFragger'],
    defaultParams: { fdrProteome: 0.01, fdrSite: 0.01, quantMethod: 'LFQ' },
    sampleGenes: ['MAPK1', 'AKT1', 'STAT3', 'SRC'],
    targetMode: 'workspace'
  },
  {
    id: 'prot-structure-alphafold',
    category: 'Proteomic Analyses',
    categoryNumber: 'III',
    title: 'Structural Proteomics & Rosetta ddG Mutagenesis',
    subtitle: 'AlphaFold 3 Multimer Docking & FoldX Thermodynamic Stability',
    description: 'Computes atomic residue interaction networks, Ramachandran dihedral angles, and free-energy ΔΔG stability shifts following clinical missense mutations.',
    tools: ['AlphaFold 3', 'RosettaCommons', 'FoldX 5', 'PyMOL'],
    defaultParams: { numRecycles: 3, relaxStructure: true, forceField: 'ref2015' },
    sampleGenes: ['EGFR', 'KRAS', 'TP53', 'BRAF', 'PIK3CA'],
    targetMode: 'workspace'
  },

  // IV. METABOLOMIC ANALYSES
  {
    id: 'metab-untargeted-lcms',
    category: 'Metabolomic Analyses',
    categoryNumber: 'IV',
    title: 'Untargeted & Targeted Metabolomics (MetaboAnalyst / XCMS)',
    subtitle: 'LC-MS/MS Feature Extraction & Metabolic Pathway Flux',
    description: 'Profiles amino acids, lipidomic intermediates, and central carbon metabolism with peak alignment, retention time correction, and KEGG pathway enrichment.',
    tools: ['XCMS 3', 'MetaboAnalystR', 'CAMERA', 'GNPS'],
    defaultParams: { ppmTolerance: 5.0, minPeakWidth: 5, snrThreshold: 10 },
    sampleGenes: ['HK2', 'LDHA', 'SLC2A1', 'IDH1'],
    targetMode: 'discovery'
  },

  // V. SYSTEMS & INTEGRATIVE ANALYSES
  {
    id: 'sys-mofa-fusion',
    category: 'Systems & Integrative Analyses',
    categoryNumber: 'V',
    title: 'Multi-Omics Factor Analysis & Latent Space Fusion (MOFA+)',
    subtitle: 'Cross-Omic Latent Factor Decomposition & Connectivity Mapping',
    description: 'Integrates paired Genomics, Epigenomics, scRNA-seq, and Mass Spec into shared latent biological variance axes to discover coordinated disease signatures.',
    tools: ['MOFA+', 'mixOmics', 'WGCNA', 'CMap / LINCS'],
    defaultParams: { numFactors: 15, convergenceTolerance: 0.001 },
    sampleGenes: ['TP53', 'MYC', 'PTEN', 'PIK3CA'],
    targetMode: 'advanced'
  },

  // VI. CLINICAL & PHENOTYPIC ANALYSES
  {
    id: 'clin-kaplan-meier',
    category: 'Clinical & Phenotypic Analyses',
    categoryNumber: 'VI',
    title: 'Kaplan-Meier Survival & Cox Proportional Hazards Engine',
    subtitle: 'Log-Rank P-Values, Hazard Ratios & Biomarker Stratification',
    description: 'Performs patient stratification, progression-free survival (PFS) modeling, and multivariate Cox regression adjusted for age, sex, and medication covariates.',
    tools: ['Lifelines', 'survival (R)', 'forestplot', 'Statsmodels'],
    defaultParams: { ciAlpha: 0.05, stratificationMethod: 'median_expression' },
    sampleGenes: ['EGFR', 'TP53', 'KRAS', 'BRCA1'],
    targetMode: 'workspace'
  },

  // VII. IMAGING & RADIOMICS
  {
    id: 'img-radiomics-segment',
    category: 'Imaging & Radiomics',
    categoryNumber: 'VII',
    title: 'Super-Resolution Cellular Imaging & Volumetric Radiomics',
    subtitle: 'STED / STORM Nanodomain Sizing & PyRadiomics Feature Extraction',
    description: 'Segments subcellular puncta, organelles, and membrane nanodomain lattices in super-resolution microscopy while extracting first-order and GLCM/GLRLM texture descriptors from medical imaging datasets.',
    tools: ['PyRadiomics', 'CellPose 3', 'StarDist', 'Bio-Formats'],
    defaultParams: { binWidth: 25, voxelResampling: [1, 1, 1] },
    sampleGenes: ['EGFR', 'ACTB', 'GAPDH'],
    targetMode: 'workspace'
  },

  // VIII. MICROBIOME ANALYSES
  {
    id: 'micro-qiime2-asv',
    category: 'Microbiome Analyses',
    categoryNumber: 'VIII',
    title: 'Host-Microbiome & Metagenomic Profiling (QIIME2 / DADA2)',
    subtitle: '16S Amplicon Sequence Variants & Microbial Metabolite Coupling',
    description: 'Reconstructs microbial ASVs, Alpha/Beta diversity (Shannon, Bray-Curtis, UniFrac), and PICRUSt2 functional metagenomic predictions impacting systemic immune signaling.',
    tools: ['QIIME2', 'DADA2', 'PICRUSt2', 'Phyloseq'],
    defaultParams: { truncLenF: 240, truncLenR: 200, maxEE: 2 },
    sampleGenes: ['TLR4', 'IL6', 'TNF', 'STAT3'],
    targetMode: 'discovery'
  },

  // IX. MACHINE LEARNING & PREDICTIVE MODELING
  {
    id: 'ml-deep-transformers',
    category: 'Machine Learning & AI',
    categoryNumber: 'IX',
    title: 'Biomedical Transformers & Graph Neural Networks (ESM-2 / AlphaFold)',
    subtitle: 'Zero-Shot Variant Effect Prediction & Molecular Representation',
    description: 'Leverages ESM-2 3B-parameter protein language models and TorchDrug Graph Neural Networks to compute zero-shot functional pathogenicity logits for human missense alleles across universal proteomes.',
    tools: ['ESM-2', 'ProtTrans', 'PyTorch Geometric', 'XGBoost'],
    defaultParams: { modelCheckpoint: 'esm2_t33_650M_UR50D', batchSize: 16 },
    sampleGenes: ['TP53', 'EGFR', 'BRAF', 'KRAS', 'BRCA1'],
    targetMode: 'advanced'
  },

  // X. STATISTICAL & COMPUTATIONAL METHODS
  {
    id: 'stat-causal-inference',
    category: 'Statistical Methods',
    categoryNumber: 'X',
    title: 'Mendelian Randomization & Causal Inference (TwoSampleMR)',
    subtitle: 'IVW, Weighted Median, MR-Egger Pleiotropy & Colocalization',
    description: 'Disentangles reverse causality in disease biomarkers using genetic instrumental variables and Bayesian colocalization (coloc).',
    tools: ['TwoSampleMR', 'MendelianRandomization', 'coloc', 'MR-PRESSO'],
    defaultParams: { pvalInstrument: '5e-8', ldClumpR2: 0.001 },
    sampleGenes: ['APOE', 'TREM2', 'CD33', 'IL6R'],
    targetMode: 'discovery'
  },

  // XI. FUNCTIONAL & PERTURBATION ANALYSES
  {
    id: 'func-perturb-crispr',
    category: 'Functional & Perturbation Analyses',
    categoryNumber: 'XI',
    title: 'In-Silico Knockout & CRISPR Perturbation Simulation (scPerturb / Perturb-seq)',
    subtitle: 'Cellular Viability, Expression State Shifts & Rescue Compound Virtual Screen',
    description: 'Simulates single-gene or multiplexed CRISPR knockout perturbations across cellular networks. Quantifies cellular state trajectory shifts and predicts small-molecule rescue candidates from LINCS L1000.',
    tools: ['scPerturb', 'CellOracle', 'CMap / LINCS', 'Perturb-seq'],
    defaultParams: { targetKnockdownPct: 0.85, perturbationModel: 'linear_additive', numTopRescueCandidates: 10 },
    sampleGenes: ['TP53', 'MYC', 'EGFR', 'KRAS', 'METTL3'],
    targetMode: 'workspace'
  },

  // XII. HIGH-PERFORMANCE WORKFLOWS & DAG
  {
    id: 'hpc-dag-nextflow',
    category: 'HPC & Workflow Infrastructure',
    categoryNumber: 'XII',
    title: 'Automated DAG Pipeline Orchestration (Nextflow / Snakemake)',
    subtitle: 'Containerized Multi-Step Execution on Scalable Cloud HPC',
    description: 'Generates and executes reproducible Nextflow DSL2 / Snakemake pipelines inside Docker containers on scalable compute nodes with real-time telemetry.',
    tools: ['Nextflow DSL2', 'Snakemake 7', 'Google Cloud Run', 'Docker'],
    defaultParams: { maxMemory: '64GB', maxCpus: 16, resumePipeline: true },
    sampleGenes: ['EGFR', 'TP53', 'METTL3', 'KRAS'],
    targetMode: 'workspace'
  },

  // XIII. WET-LAB PROTOCOLS
  {
    id: 'lab-protocol-apex2',
    category: 'Wet-Lab & Experimental Protocols',
    categoryNumber: 'XIII',
    title: 'Subcellular Fractionation & APEX2 Proximity Labeling Protocol',
    subtitle: 'Step-by-step wet-lab SOP, sucrose gradient centrifugation & proximity labeling',
    description: 'Generates reproducible, standardized laboratory standard operating procedures (SOP) for subcellular organelle enrichment, density gradient fractionation, and APEX2/TurboID proximity biotinylation.',
    tools: ['Bio-Protocol Designer', 'APEX2 Matrix', 'Percoll Gradient', 'Triton-X Lysis'],
    defaultParams: { startingMaterial: 'Human Cell Lines / Tissue', fractionType: 'Membrane & Nuclear Fractions', centrifugationRCF: '100,000 x g' },
    sampleGenes: ['METTL3', 'EGFR', 'TP53', 'ACTB'],
    targetMode: 'workspace'
  },

  // XIV. CANCER & IMMUNOGENOMICS
  {
    id: 'domain-cancer-tmb',
    category: 'Specialized Domain Analyses',
    categoryNumber: 'XIV',
    title: 'Cancer Immunogenomics & Neoantigen Prediction (NetMHCpan / TMB)',
    subtitle: 'Tumor Mutational Burden, Microsatellite Instability & HLA Binding',
    description: 'Computes TMB/MSI scores and predicts 8-11mer neoantigen MHC-I binding affinities for personalized peptide vaccine targeting and checkpoint response prediction.',
    tools: ['NetMHCpan 4.1', 'MHCflurry', 'Manta', 'Mutect2'],
    defaultParams: { hlaAlleles: 'HLA-A*02:01,HLA-B*07:02', affinityThresholdNm: 500 },
    sampleGenes: ['TP53', 'EGFR', 'BRAF', 'KRAS'],
    targetMode: 'discovery'
  },

  // XV. EMERGING CUTTING-EDGE
  {
    id: 'emerging-longread-nano',
    category: 'Emerging & Cutting-Edge',
    categoryNumber: 'XV',
    title: 'Oxford Nanopore Direct RNA & Epitranscriptomic Modification Calling (Dorado / m6A)',
    subtitle: 'Direct RNA Methylation (m6A, m5C, Ψ), Poly(A) Tail Length & Full-Length Isoforms',
    description: 'Analyzes native RNA direct sequencing reads to characterize alternative splicing diversity, full-length transcript isoforms, and m6A/m5C/pseudouridine epitranscriptomic marks without reverse transcription bias.',
    tools: ['Dorado', 'Megalodon', 'Nanopolish', 'StringTie2', 'm6A-SAC-seq'],
    defaultParams: { minReadLength: 500, basecallingModel: 'rna004_130bps_sup' },
    sampleGenes: ['METTL3', 'METTL14', 'FTO', 'ALKBH5', 'YTHDF2', 'EGFR'],
    targetMode: 'workspace'
  }
];

interface ComprehensiveAnalysisHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchAnalysis: (item: AnalysisCatalogItem, customParams: Record<string, any>, selectedGene: string) => void;
  initialAnalysisId?: string;
  initialCategory?: string;
}

export const ComprehensiveAnalysisHubModal: React.FC<ComprehensiveAnalysisHubModalProps> = ({
  isOpen,
  onClose,
  onLaunchAnalysis,
  initialAnalysisId,
  initialCategory
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'catalog' | 'dataset-upload'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<AnalysisCatalogItem>(BIOINFORMATICS_TAXONOMY[0]);
  const [selectedGene, setSelectedGene] = useState<string>(selectedItem.sampleGenes[0] || 'SHANK3');
  const [customParams, setCustomParams] = useState<Record<string, any>>(selectedItem.defaultParams);
  const [isExecutingCloud, setIsExecutingCloud] = useState(false);
  const [cloudResult, setCloudResult] = useState<CloudJobExecutionResult | null>(null);

  // Sync selectedItem whenever initialAnalysisId or initialCategory changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (initialAnalysisId) {
      const raw = initialAnalysisId.toLowerCase().trim();
      const matched = BIOINFORMATICS_TAXONOMY.find(item => {
        const idLower = item.id.toLowerCase();
        const titleLower = item.title.toLowerCase();
        if (idLower === raw) return true;
        if (raw === 'rnaseq' || raw === 'rna-seq' || raw === 'bulk-rnaseq') {
          return item.id === 'tx-deseq2-bulk';
        }
        if (raw === 'single_cell' || raw === 'singlecell' || raw === 'scrna' || raw === 'snrna') {
          return item.id === 'tx-scrna-scanpy';
        }
        if (raw === 'perturbation' || raw === 'crispr' || raw === 'knockout') {
          return item.id === 'func-perturb-crispr';
        }
        if (raw === 'docking' || raw === 'alphafold' || raw === 'rosetta' || raw === 'ddg') {
          return item.id === 'prot-structure-alphafold';
        }
        if (raw === 'protocol' || raw === 'apex2' || raw === 'wetlab') {
          return item.id === 'lab-protocol-apex2';
        }
        if (raw === 'variant' || raw === 'gatk' || raw === 'vcf') {
          return item.id === 'seq-variant-calling';
        }
        return idLower.includes(raw) || titleLower.includes(raw);
      });

      if (matched) {
        setSelectedItem(matched);
        setSelectedCategoryFilter(matched.category);
        setSelectedGene(matched.sampleGenes[0] || 'SHANK3');
        setCustomParams(matched.defaultParams);
      }
    } else if (initialCategory) {
      setSelectedCategoryFilter(initialCategory);
      const firstInCat = BIOINFORMATICS_TAXONOMY.find(i => i.category === initialCategory);
      if (firstInCat) {
        setSelectedItem(firstInCat);
        setSelectedGene(firstInCat.sampleGenes[0] || 'SHANK3');
        setCustomParams(firstInCat.defaultParams);
      }
    }
  }, [isOpen, initialAnalysisId, initialCategory]);

  // Dataset Auto-Detection & Experimental Design State
  const [isDetectingDataset, setIsDetectingDataset] = useState(false);
  const [detectedDataset, setDetectedDataset] = useState<AiDatasetDetectionResult | null>(null);
  const [selectedAssayFilter, setSelectedAssayFilter] = useState<string>('auto');
  const [groups, setGroups] = useState<ExperimentalGroup[]>([
    { id: 'grp-1', name: 'Control / WT Baseline', designation: 'control', count: 6, color: '#059669' },
    { id: 'grp-2', name: 'Disease / Perturbation Cohort', designation: 'treated', count: 6, color: '#4F46E5' }
  ]);
  const [attributes, setAttributes] = useState<string[]>(['Gene_Symbol', 'Ensembl_ID', 'Normalized_Counts', 'Log2FC', 'p_adj']);
  const [newAttributeInput, setNewAttributeInput] = useState('');
  const [datasetOrganism, setDatasetOrganism] = useState('Homo sapiens (GRCh38)');

  // Dynamically compute recommended pipelines strictly based on detected or selected assay type
  const recommendedPipelinesForDataset = React.useMemo(() => {
    let target = selectedAssayFilter;
    if (target === 'auto') {
      if (detectedDataset) {
        const dt = (detectedDataset.detectedType + ' ' + (detectedDataset.aiAnalysisSummary || '')).toLowerCase();
        if (dt.includes('rna') || dt.includes('transcript') || dt.includes('deseq2') || dt.includes('counts')) target = 'rnaseq';
        else if (dt.includes('single') || dt.includes('anndata') || dt.includes('spatial') || dt.includes('h5ad')) target = 'singlecell';
        else if (dt.includes('prot') || dt.includes('tmt') || dt.includes('mass') || dt.includes('ms')) target = 'proteomics';
        else if (dt.includes('vcf') || dt.includes('genom') || dt.includes('gwas') || dt.includes('variant')) target = 'genomics';
        else if (dt.includes('docking') || dt.includes('alphafold') || dt.includes('pdb')) target = 'structural';
        else if (dt.includes('metabol') || dt.includes('lipid')) target = 'metabolomics';
        else if (dt.includes('chip') || dt.includes('atac') || dt.includes('epigen')) target = 'epigenomics';
      } else if (initialAnalysisId) {
        const raw = initialAnalysisId.toLowerCase();
        if (raw.includes('rna')) target = 'rnaseq';
        else if (raw.includes('single') || raw.includes('cell')) target = 'singlecell';
        else if (raw.includes('genom') || raw.includes('variant') || raw.includes('vcf')) target = 'genomics';
        else if (raw.includes('prot') || raw.includes('tmt')) target = 'proteomics';
        else if (raw.includes('docking') || raw.includes('alphafold')) target = 'structural';
      }
    }

    if (target === 'rnaseq') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'tx-deseq2-bulk' ||
        item.id === 'tx-scrna-scanpy' ||
        item.id === 'tx-spatial-visium' ||
        item.id === 'emerging-longread-nano' ||
        item.id === 'sys-mofa-fusion' ||
        item.id === 'func-perturb-crispr'
      );
    }

    if (target === 'singlecell') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'tx-scrna-scanpy' ||
        item.id === 'tx-spatial-visium' ||
        item.id === 'func-perturb-crispr' ||
        item.id === 'tx-deseq2-bulk' ||
        item.id === 'sys-mofa-fusion'
      );
    }

    if (target === 'genomics') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'seq-variant-calling' ||
        item.id === 'seq-gwas-finemapping' ||
        item.id === 'stat-causal-inference' ||
        item.id === 'ml-deep-transformers' ||
        item.id === 'domain-cancer-tmb'
      );
    }

    if (target === 'proteomics') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'prot-ms-quant' ||
        item.id === 'prot-structure-alphafold' ||
        item.id === 'lab-protocol-apex2' ||
        item.id === 'sys-mofa-fusion'
      );
    }

    if (target === 'structural') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'prot-structure-alphafold' ||
        item.id === 'prot-ms-quant' ||
        item.id === 'ml-deep-transformers'
      );
    }

    if (target === 'epigenomics') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.id === 'seq-epigenomics-chip' ||
        item.id === 'seq-variant-calling' ||
        item.id === 'emerging-longread-nano'
      );
    }

    if (target === 'metabolomics') {
      return BIOINFORMATICS_TAXONOMY.filter(item => 
        item.category === 'Metabolomic Analyses' ||
        item.id === 'metab-untargeted-lcms' ||
        item.id === 'sys-mofa-fusion'
      );
    }

    return BIOINFORMATICS_TAXONOMY.slice(0, 6);
  }, [selectedAssayFilter, detectedDataset, initialAnalysisId]);

  if (!isOpen) return null;

  const categories = ['All', ...Array.from(new Set(BIOINFORMATICS_TAXONOMY.map(i => i.category)))];

  const filteredItems = BIOINFORMATICS_TAXONOMY.filter(item => {
    const matchesCat = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tools.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelectItem = (item: AnalysisCatalogItem) => {
    setSelectedItem(item);
    setSelectedGene(item.sampleGenes[0] || 'SHANK3');
    setCustomParams(item.defaultParams);
    setCloudResult(null);
  };

  const handleExecuteCloudJob = async () => {
    setIsExecutingCloud(true);
    try {
      const payload: BioWorkloadPayload = {
        analysisId: selectedItem.id,
        category: selectedItem.category,
        method: selectedItem.title,
        parameters: { 
          ...customParams, 
          gene: selectedGene,
          datasetDesign: detectedDataset ? {
            fileName: detectedDataset.fileName,
            groups: groups,
            attributes: attributes,
            organism: datasetOrganism
          } : undefined
        },
        targetGenes: [selectedGene],
        referenceGenome: customParams.genome || 'GRCh38.p13'
      };

      const res = await invokeCloudBioWorkload(payload, {
        serviceName: 'synomics-cloudrun-hpc',
        memoryLimit: '8Gi',
        cpuCount: 4
      });

      setCloudResult(res);
    } catch (err) {
      console.error('Cloud Run execution error:', err);
    } finally {
      setIsExecutingCloud(false);
    }
  };

  const handleConfirmLaunch = () => {
    const enrichedParams = {
      ...customParams,
      datasetDesign: detectedDataset ? {
        fileName: detectedDataset.fileName,
        groups: groups,
        attributes: attributes,
        organism: datasetOrganism
      } : undefined
    };
    onLaunchAnalysis(selectedItem, enrichedParams, selectedGene);
    onClose();
  };

  // AI Auto-Detection Invocation
  const runAiDetection = async (fileName: string, sampleContent?: string) => {
    setIsDetectingDataset(true);
    try {
      const res = await fetch('/api/synomics/ai-detect-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileContentSample: sampleContent })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDetectedDataset(data);
        if (data.sampleGroups && data.sampleGroups.length > 0) {
          setGroups(data.sampleGroups.map((g: any, i: number) => ({
            id: `grp-${i + 1}`,
            name: g.name,
            designation: g.designation || (i === 0 ? 'control' : 'treated'),
            count: g.count || 6,
            color: g.color || (i === 0 ? '#059669' : '#4F46E5')
          })));
        }
        if (data.detectedAttributes) {
          setAttributes(data.detectedAttributes);
        }
        if (data.organism) {
          setDatasetOrganism(data.organism);
        }
      }
    } catch (err) {
      console.error('AI Dataset Detection Failed:', err);
    } finally {
      setIsDetectingDataset(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runAiDetection(file.name);
  };

  const handleAddGroup = () => {
    const nextIdx = groups.length + 1;
    setGroups([
      ...groups,
      {
        id: `grp-${Date.now()}`,
        name: `Condition / Treatment ${nextIdx}`,
        designation: 'treated',
        count: 4,
        color: '#D97706'
      }
    ]);
  };

  const handleRemoveGroup = (id: string) => {
    if (groups.length <= 1) return;
    setGroups(groups.filter(g => g.id !== id));
  };

  const handleUpdateGroup = (id: string, updates: Partial<ExperimentalGroup>) => {
    setGroups(groups.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const handleAddAttribute = () => {
    if (!newAttributeInput.trim()) return;
    if (!attributes.includes(newAttributeInput.trim())) {
      setAttributes([...attributes, newAttributeInput.trim()]);
    }
    setNewAttributeInput('');
  };

  const handleRemoveAttribute = (attr: string) => {
    setAttributes(attributes.filter(a => a !== attr));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2DDD2] dark:border-[#1E293B] flex items-center justify-between bg-white dark:bg-[#12161F]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-brand font-bold text-lg text-[#0F172A] dark:text-[#F8FAFC]">
                  New Scientific Analysis Catalog
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  15 Core Taxonomies • HPC Ready
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Launch production-grade multi-omics workflows, cloud container workloads, and machine learning pipelines.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#E8E1D2] dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher & Filter Strip */}
        <div className="px-6 py-3 border-b border-[#E2DDD2] dark:border-[#1E293B] bg-[#F3EFE6]/70 dark:bg-[#0B0F17] flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setActiveViewTab('catalog')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'catalog'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161D2B] text-slate-600 dark:text-slate-300 border border-[#E2DDD2] dark:border-slate-800'
              }`}
            >
              <Dna className="w-3.5 h-3.5" />
              <span>Scientific Pipeline Catalog</span>
            </button>
            <button
              onClick={() => setActiveViewTab('dataset-upload')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'dataset-upload'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161D2B] text-slate-600 dark:text-slate-300 border border-[#E2DDD2] dark:border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Dataset &amp; AI Auto-Detection</span>
              {detectedDataset && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </button>
          </div>

          {activeViewTab === 'catalog' ? (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search methods, genes, tools (DESeq2, GATK)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#12161F] border border-[#E2DDD2] dark:border-slate-800 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] scrollbar-none">
                {categories.slice(0, 4).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap font-medium transition-all ${
                      selectedCategoryFilter === cat
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-white/80 dark:bg-[#161D2B] text-slate-600 dark:text-slate-400 border border-[#E2DDD2] dark:border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>AI Multi-Omics Parser &amp; Experimental Design Studio</span>
            </div>
          )}
        </div>

        {/* Main Body */}
        {activeViewTab === 'catalog' ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {/* Left Column: List of Pipelines */}
            <div className="md:col-span-5 border-r border-[#E2DDD2] dark:border-[#1E293B] overflow-y-auto p-4 space-y-2.5 bg-[#FAF9F5] dark:bg-[#0E131E]">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 px-1 uppercase tracking-wider flex items-center justify-between">
                <span>Available Analysis Modules ({filteredItems.length})</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">Google Cloud Run V2</span>
              </div>

              {filteredItems.map((item) => {
                const isSelected = selectedItem.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white dark:bg-[#161D2B] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-white/70 dark:bg-[#12161F]/60 border-[#E2DDD2] dark:border-slate-800/80 hover:bg-white dark:hover:bg-[#161D2B]/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#E8E1D2] dark:bg-slate-800 text-[#475569] dark:text-slate-300">
                          {item.categoryNumber}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[200px]">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {item.targetMode?.toUpperCase() || 'WORKFLOW'}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 line-clamp-1 mb-1">
                      {item.title}
                    </h3>
                    
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-1 flex-wrap">
                      {item.tools.slice(0, 3).map((tool, idx) => (
                        <span key={idx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {tool}
                        </span>
                      ))}
                      {item.tools.length > 3 && (
                        <span className="text-[9px] text-slate-400">+{item.tools.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Module Configuration & Execution Engine */}
            <div className="md:col-span-7 flex flex-col h-full overflow-y-auto bg-white dark:bg-[#12161F] p-5 space-y-5">
              
              {/* Header info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Section {selectedItem.categoryNumber}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {selectedItem.category}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-slate-100 tracking-tight">
                  {selectedItem.title}
                </h2>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                  {selectedItem.subtitle}
                </p>
                <p className="text-xs text-[#475569] dark:text-slate-300 mt-2 leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>

              {/* Step 1: Input Data to Analyze (User Requirement) */}
              <div className="p-4 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5">
                    <FolderUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>1. Input Data to Analyze</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    detectedDataset 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {detectedDataset ? 'Dataset Ready' : 'Data Input Required'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Upload your experimental matrix or select a pre-calibrated benchmark dataset for this {selectedItem.title} pipeline.
                </p>

                {/* Upload or Benchmark Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="p-3 rounded-xl border border-dashed border-emerald-500/50 hover:border-emerald-600 bg-white dark:bg-[#161D2B] hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Upload Your File
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        .csv, .tsv, .vcf, .h5ad, .fastq
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.vcf,.h5ad,.fastq,.fq,.fasta,.fa,.pdb"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      const benchmarkMap: Record<string, string> = {
                        'tx-deseq2-bulk': 'Universal_RNAseq_DESeq2_Counts.csv',
                        'tx-scrna-scanpy': 'SingleCell_AnnData_Scanpy.h5ad',
                        'prot-ms-quant': 'Quantitative_Proteome_TMT16plex.txt',
                        'prot-structure-alphafold': 'AlphaFold3_Protein_Structure.pdb',
                        'seq-variant-calling': 'ClinVar_DeNovo_Exome_Variants.vcf',
                        'func-perturb-crispr': 'Genome_Wide_CRISPR_PerturbSeq.csv',
                        'emerging-longread-nano': 'Direct_RNA_Nanopore_m6A_Marks.tsv',
                        'lab-protocol-apex2': 'Subcellular_Fractionation_Table.tsv'
                      };
                      const benchmarkFile = benchmarkMap[selectedItem.id] || 'Multi_Omics_Universal_Matrix.csv';
                      runAiDetection(benchmarkFile);
                    }}
                    className="p-3 rounded-xl border border-[#E2DDD2] dark:border-slate-700 bg-white dark:bg-[#161D2B] hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-all flex items-center gap-3 text-left"
                  >
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Use Benchmark Matrix
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Auto-detected {selectedItem.title.split(' ')[0]} dataset
                      </div>
                    </div>
                  </button>
                </div>

                {/* Live Dataset Summary / Status */}
                {detectedDataset ? (
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono font-bold text-emerald-900 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[220px]">{detectedDataset.fileName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                        {(detectedDataset.confidenceScore * 100).toFixed(0)}% AI Confirmed
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                      <div className="bg-white/80 dark:bg-black/40 p-1.5 rounded-lg text-center">
                        <span className="text-slate-400 block text-[9px]">TOTAL SAMPLES</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {groups.reduce((a, b) => a + b.count, 0)} Samples
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-black/40 p-1.5 rounded-lg text-center">
                        <span className="text-slate-400 block text-[9px]">CONDITIONS</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {groups.length} Arms (WT/KO)
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-black/40 p-1.5 rounded-lg text-center">
                        <span className="text-slate-400 block text-[9px]">ORGANISM</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                          H. sapiens
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {groups.map((g) => (
                          <span key={g.id} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {g.name}: N={g.count} ({g.designation})
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveViewTab('dataset-upload')}
                        className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline shrink-0 ml-2"
                      >
                        Edit Cohorts
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span>No custom dataset uploaded yet. Benchmark matrix will be automatically used upon launch.</span>
                    <button
                      onClick={() => runAiDetection('Synaptic_Bulk_RNAseq_DESeq2.csv')}
                      className="font-bold underline cursor-pointer hover:text-amber-900 dark:hover:text-amber-100"
                    >
                      Load Sample
                    </button>
                  </div>
                )}
              </div>

              {/* Target Gene Selection */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] space-y-2">
                <label className="text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center justify-between">
                  <span>2. Target Biological Locus / Gene Symbol</span>
                  <span className="text-[10px] font-normal text-slate-400">HUGO / Ensembl Gene ID</span>
                </label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedGene}
                    onChange={(e) => setSelectedGene(e.target.value.toUpperCase())}
                    placeholder="e.g., TP53, KRAS, EGFR, BRCA1..."
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-mono font-bold"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
                  {selectedItem.sampleGenes.map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGene(g)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                        selectedGene === g
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipeline Execution Parameters */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>3. Execution Parameters &amp; Algorithms</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    Auto-Tuned for HPC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(customParams).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                        {key}
                      </label>
                      <input
                        type="text"
                        value={String(val)}
                        onChange={(e) => setCustomParams({ ...customParams, [key]: e.target.value })}
                        className="w-full px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloud Run Live Workload Output Box */}
              {cloudResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Cloud Run Job {cloudResult.jobId} Executed
                    </span>
                    <span className="font-mono text-[10px]">
                      {cloudResult.executionTimeMs}ms • {cloudResult.containerHost}
                    </span>
                  </div>

                  <div className="bg-black/90 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto max-h-32 space-y-0.5">
                    {cloudResult.logs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E2DDD2] dark:border-[#1E293B] mt-auto">
                <button
                  onClick={handleExecuteCloudJob}
                  disabled={isExecutingCloud}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white dark:bg-[#161D2B] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-xs cursor-pointer"
                >
                  <Server className={`w-4 h-4 ${isExecutingCloud ? 'animate-spin text-emerald-500' : 'text-slate-500'}`} />
                  <span>{isExecutingCloud ? 'Running Cloud Workload...' : 'Run on Cloud Run HPC'}</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onClose}
                    className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmLaunch}
                    className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {detectedDataset 
                        ? `Start Analysis on ${detectedDataset.fileName}`
                        : 'Start Analysis on Data'
                      }
                    </span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* Experimental Dataset Upload, AI Auto-Detection & Group Design View */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-[#12161F]">
            
            {/* Top Upload Banner / Dropzone */}
            <div className="border-2 border-dashed border-emerald-500/40 dark:border-emerald-600/40 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                <FolderUp className={`w-6 h-6 ${isDetectingDataset ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">
                  Upload Experimental Dataset / Omics Matrix
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 max-w-xl mx-auto">
                  Drag and drop raw count matrices, VCFs, single-cell AnnData (.h5ad), TMT mass spectrometry tables, or FASTA/FASTQ files. AI will automatically detect format, sample counts, and suggested experimental conditions.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <label className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span>Choose Local File</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,.vcf,.h5ad,.fastq,.fq,.fasta,.fa,.pdb"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="text-xs text-slate-400 font-medium">or try curated sample data:</div>
                
                <button
                  onClick={() => runAiDetection('Synaptic_Bulk_RNAseq_DESeq2.csv')}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#161D2B] hover:bg-slate-100 text-xs font-mono text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  Bulk RNA-Seq (Counts)
                </button>
                <button
                  onClick={() => runAiDetection('Hippocampal_SingleCell_Scanpy.h5ad')}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#161D2B] hover:bg-slate-100 text-xs font-mono text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  Single-Cell AnnData
                </button>
                <button
                  onClick={() => runAiDetection('PSD95_Proteome_TMT16plex.txt')}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#161D2B] hover:bg-slate-100 text-xs font-mono text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                >
                  TMT-16plex Proteome
                </button>
              </div>
            </div>

            {/* AI Auto-Detection Result Card */}
            {detectedDataset && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-indigo-950/40 border border-emerald-300 dark:border-emerald-800/80 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Analysis Confirmed ({(detectedDataset.confidenceScore * 100).toFixed(1)}% Confidence)
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-slate-100">
                      {detectedDataset.fileName}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-800 dark:text-emerald-300 font-semibold">
                    {detectedDataset.detectedType}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {detectedDataset.aiAnalysisSummary}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-white/60 dark:border-white/10">
                    <div className="text-[10px] text-slate-400">ORGANISM</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{datasetOrganism}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-white/60 dark:border-white/10">
                    <div className="text-[10px] text-slate-400">TOTAL SAMPLES</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{groups.reduce((a, b) => a + b.count, 0)} Samples</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-white/60 dark:border-white/10">
                    <div className="text-[10px] text-slate-400">FEATURES / GENES</div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">{detectedDataset.featureCount.toLocaleString()} Features</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-white/60 dark:border-white/10">
                    <div className="text-[10px] text-slate-400">EXPERIMENTAL GROUPS</div>
                    <div className="font-bold text-rose-600 dark:text-rose-400">{groups.length} Conditions</div>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Experimental Design: Groups & Designations */}
            <div className="p-5 rounded-2xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Experimental Cohort &amp; Group Designations (Control vs. Treated)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Define biological groups, sample count per arm, and statistical comparison contrast roles.
                  </p>
                </div>

                <button
                  onClick={handleAddGroup}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cohort Group</span>
                </button>
              </div>

              {/* Groups Table / List */}
              <div className="space-y-2.5">
                {groups.map((group, idx) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white font-mono" style={{ backgroundColor: group.color }}>
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF9F5] dark:bg-[#12161F] border border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-slate-100"
                        placeholder="Cohort label..."
                      />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {/* Designation (Control vs Treated) */}
                      <select
                        value={group.designation}
                        onChange={(e) => handleUpdateGroup(group.id, { designation: e.target.value as any })}
                        className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#FAF9F5] dark:bg-[#12161F] border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                      >
                        <option value="control">Role: Control (Baseline / WT)</option>
                        <option value="treated">Role: Treated (Disease / Perturbation)</option>
                        <option value="baseline">Role: Baseline Cohort</option>
                        <option value="perturbation">Role: Drug / Knockdown</option>
                      </select>

                      {/* Sample Count */}
                      <div className="flex items-center gap-1 text-xs font-mono text-slate-500">
                        <span>N =</span>
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={group.count}
                          onChange={(e) => handleUpdateGroup(group.id, { count: parseInt(e.target.value) || 1 })}
                          className="w-16 px-2 py-1 rounded-lg text-xs font-mono font-bold bg-[#FAF9F5] dark:bg-[#12161F] border border-slate-200 dark:border-slate-700 text-center text-[#0F172A] dark:text-slate-100"
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveGroup(group.id)}
                        disabled={groups.length <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                        title="Remove Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attributes / Feature Tags Matrix */}
            <div className="p-5 rounded-2xl bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] space-y-3">
              <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Detected Metadata Attributes &amp; Quantified Columns</span>
              </h4>
              
              <div className="flex items-center gap-2 flex-wrap">
                {attributes.map((attr) => (
                  <span
                    key={attr}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{attr}</span>
                    <button
                      onClick={() => handleRemoveAttribute(attr)}
                      className="text-slate-400 hover:text-rose-500 text-xs ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
                
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="+ Add column attribute..."
                    value={newAttributeInput}
                    onChange={(e) => setNewAttributeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white dark:bg-[#161D2B] border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddAttribute}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* AI Suggested Catalog Pipelines Grid with Interactive Assay Selector */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Recommended Pipelines for this Dataset Design</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      {recommendedPipelinesForDataset.length} Matched
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Filtered specifically to match your selected dataset type and experimental design.
                  </p>
                </div>

                {/* Assay Modality Filter Tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: 'auto', label: 'Auto (AI Detected)' },
                    { id: 'rnaseq', label: 'RNA-Seq' },
                    { id: 'singlecell', label: 'Single-Cell' },
                    { id: 'genomics', label: 'Genomics / VCF' },
                    { id: 'proteomics', label: 'Proteomics' },
                    { id: 'structural', label: 'AlphaFold 3' },
                    { id: 'epigenomics', label: 'ATAC/ChIP' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedAssayFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        selectedAssayFilter === tab.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-[#161D2B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-500'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendedPipelinesForDataset.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-800 hover:border-emerald-500 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-600 font-bold mb-1">
                        <span>{item.category}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-[9px] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {item.tools[0]}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 line-clamp-1">
                        {item.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        handleConfirmLaunch();
                      }}
                      className="mt-3 w-full py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 text-emerald-800 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Launch with this Dataset</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
