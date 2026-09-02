export type AppOperatingMode = 
  | 'basic' 
  | 'advanced' 
  | 'discovery' 
  | 'workspace' 
  | 'gwas' 
  | 'microbiome' 
  | 'drug_discovery' 
  | 'clinical';

export type BioOrganism = 
  | 'Homo sapiens (GRCh38)'
  | 'Mus musculus (GRCm39)'
  | 'Rattus norvegicus'
  | 'Danio rerio (Zebrafish)'
  | 'Drosophila melanogaster'
  | 'Caenorhabditis elegans'
  | 'Saccharomyces cerevisiae'
  | 'Arabidopsis thaliana'
  | 'Escherichia coli'
  | 'SARS-CoV-2 / Viral'
  | 'Other / Custom Organism';

export type BioOmicsDomain = 
  | 'Genomics & Variant Calling'
  | 'Transcriptomics (RNA-Seq)'
  | 'Epitranscriptomics (m6A / m1A / m5C / Ψ)'
  | 'Single-Cell & Spatial'
  | 'Microbiome & Metagenomics'
  | 'Proteomics & Mass Spec'
  | 'Metabolomics & Lipidomics'
  | 'Epigenomics (ATAC/ChIP)'
  | 'Structural Biology & AlphaFold'
  | 'Drug Discovery & Docking'
  | 'Clinical Genomics & Rare Disease'
  | 'Multi-Omics Integration';

export type BiologicalDomain =
  | 'genomics'
  | 'transcriptomics'
  | 'proteomics'
  | 'single_cell'
  | 'spatial_omics'
  | 'microbiome'
  | 'epigenomics'
  | 'metabolomics'
  | 'structural_biology'
  | 'pharmacology'
  | 'clinical_genomics'
  | 'synthetic_biology'
  | 'cell_biology'
  | 'immunology'
  | 'neuroscience'
  | 'oncology'
  | 'microbiology'
  | 'evolutionary_biology';

export type BiologicalDisease =
  | 'cancer'
  | 'autism_spectrum_disorder'
  | 'alzheimers_disease'
  | 'parkinsons_disease'
  | 'schizophrenia'
  | 'type2_diabetes'
  | 'cardiovascular_disease'
  | 'inflammatory_bowel_disease'
  | 'rare_genetic_disorder'
  | 'infectious_disease'
  | 'epilepsy'
  | 'amyotrophic_lateral_sclerosis'
  | string;

export type CellularCompartment =
  | 'nucleus'
  | 'cytoplasm'
  | 'mitochondria'
  | 'endoplasmic_reticulum'
  | 'golgi_apparatus'
  | 'plasma_membrane'
  | 'extracellular'
  | 'lysosome'
  | 'peroxisome'
  | 'chromatin'
  | string;

export interface BiologicalEntity {
  id: string;
  geneSymbol: string;
  name: string;
  uniprotId?: string;
  ensemblId?: string;
  complex?: string;
  synonyms?: string[];
  modality?: string;
  estimatedCopyNumberPerSynapse?: number;
  copyNumberPerSynapse?: number;
  compartment: CellularCompartment;
  subcellularLocation?: string;
  biologicalDomain: BiologicalDomain;
  organism: 'human' | 'mouse' | 'rat' | 'zebrafish' | 'fly' | 'worm' | 'yeast' | 'arabidopsis' | string;
  molecularWeightKDa?: number;
  primaryFunction: string;
  pathways: string[];
  keyInteractors: string[];
  associatedDiseases: {
    disease: BiologicalDisease;
    associationType: 'GWAS Significant Locus' | 'De Novo Mutation' | 'Rare CNV' | 'Altered Expression' | 'Post-translational Defect' | 'Oncogenic Driver' | 'Immune Checkpoint' | string;
    evidenceScore: number; // 0 to 1
    description: string;
  }[];
  expressionByCellType: {
    cellType: string;
    tpm: number;
    zScore: number;
  }[];
  goAnnotations: {
    goId: string;
    term: string;
    domain: 'Biological Process' | 'Cellular Component' | 'Molecular Function';
  }[];
  druggability: {
    isDruggable: boolean;
    knownModulators: string[];
    therapeuticStatus: 'Approved' | 'Clinical Trials' | 'Preclinical' | 'Undrugged';
  };
  differentialAbundanceInADLog2FC?: number;
  differentialAbundanceInSCZLog2FC?: number;
  differentialAbundanceInASDLog2FC?: number;
  differentialAbundanceInOncologyLog2FC?: number;
  postTranslationalModifications?: {
    type: string;
    site: string;
    regulatoryRole: string;
  }[];
  epitranscriptomicRole?: string;
}

// Backward compatibility alias
export type SynapticProtein = BiologicalEntity;
export type SynapticCompartment = CellularCompartment;
export type SynapticDisease = BiologicalDisease;

export interface GOOntologyNode {
  id: string;
  label: string;
  domain: 'CC' | 'BP' | 'MF';
  geneCount: number;
  genes: string[];
  pValEnrichment: number;
  parent?: string;
}

// Backward compatibility alias
export type SynGOOntologyNode = GOOntologyNode;

export interface BioOmniToolDeclaration {
  id: string;
  name: string;
  category: 
    | 'Genomics & Genetics'
    | 'Transcriptomics'
    | 'Single-Cell & Spatial'
    | 'Proteomics & Mass Spec'
    | 'Microbiome & Metagenomics'
    | 'Epigenomics & Chromatin'
    | 'Drug Discovery & Pharmacology'
    | 'Structural Biology'
    | 'Clinical Genomics'
    | 'Bioinformatics Pipelines'
    | string;
  description: string;
  icon: string;
  parameters: {
    name: string;
    type: 'string' | 'number' | 'array' | 'boolean';
    description: string;
    required: boolean;
    default?: any;
    options?: string[];
  }[];
}

// Backward compatibility alias
export type SynOmicsToolDeclaration = BioOmniToolDeclaration;

export interface AdmetProfile {
  absorption: {
    hiaPct: number; // Human Intestinal Absorption % (e.g. 94.2%)
    caco2Permeability: number; // 10^-6 cm/s (e.g. 24.5)
    bbbPermeable: boolean;
    pGpSubstrate: boolean;
  };
  distribution: {
    ppbPct: number; // Plasma Protein Binding % (e.g. 88.5%)
    vdssLKg: number; // Volume of Distribution (e.g. 1.42 L/kg)
  };
  metabolism: {
    cyp1a2Inhibitor: boolean;
    cyp2c9Inhibitor: boolean;
    cyp2d6Inhibitor: boolean;
    cyp3a4Inhibitor: boolean;
  };
  excretion: {
    halfLifeHours: number; // e.g. 8.4 hrs
    clearanceRate: number; // mL/min/kg (e.g. 12.8)
  };
  toxicity: {
    hergCardiotoxRisk: 'Low' | 'Medium' | 'High';
    amesMutagenicity: boolean;
    diliHepatotoxicity: boolean;
    ld50_mg_kg: number; // e.g. 1250 mg/kg
  };
  druglikeness: {
    lipinskiViolations: number;
    qedScore: number; // 0 to 1
    syntheticAccessibilityScore: number; // 1 (easy) to 10 (hard)
    passRuleOf5: boolean;
  };
}

export interface MolecularDockingResult {
  targetPdbId: string;
  targetGene: string;
  targetResolution: string;
  ligandName: string;
  ligandSmiles: string;
  bindingAffinityKcalMol: number; // e.g. -9.6 kcal/mol
  estimatedKi_nM: number; // e.g. 98.4 nM
  bindingPocket: {
    center: [number, number, number];
    size: [number, number, number];
    volumeA3: number;
  };
  interactingResidues: {
    resName: string;
    resSeq: number;
    interactionType: 'H-Bond' | 'Pi-Stacking' | 'Hydrophobic' | 'Salt-Bridge';
    distanceA: number;
  }[];
  dockingPoses: {
    poseNumber: number;
    affinityKcalMol: number;
    rmsdLowerBound: number;
    rmsdUpperBound: number;
  }[];
}

export interface TargetIdentificationResult {
  targetGene: string;
  proteinName: string;
  diseaseAssociation: string;
  omicsEvidence: string;
  druggabilityScore: number; // 0 to 1
  pocketCount: number;
  knownPdbStructures: string[];
  actionableModulators: string[];
}

export interface DeNovoMoleculeSuggestion {
  id: string;
  baseCompound: string;
  modifiedSmiles: string;
  name: string;
  modificationType: 'Bioisosteric Replacement' | 'Fragment Growing' | 'Scaffold Hopping' | 'Conformational Constraint';
  rationalRationale: string;
  predictedAffinityGainKcalMol: number; // e.g. -1.4 kcal/mol
  predictedAdmetImprovement: string;
}

export interface ModelVerificationVote {
  modelId: string;
  modelName: string;
  provider: string;
  status: 'verified' | 'flagged' | 'caveat';
  confidencePct: number;
  reasoning: string;
  statisticalAudit: {
    fdrCheck: 'passed' | 'marginal' | 'failed';
    effectSizeRigor: 'high' | 'medium' | 'low';
    nomenclatureIntegrity: 'valid_hgnc' | 'warning';
  };
  keyCritique: string;
}

export interface MultiModelConsensusVerification {
  consensusId: string;
  timestamp: string;
  overallConsensusPct: number;
  unanimousAgreement: boolean;
  targetAnalysis: string;
  primaryHypothesis: string;
  evaluatingModels: ModelVerificationVote[];
  consensusSummary: string;
  consensusRecommendations: string[];
}

export interface ScientificFigure {
  id: string;
  figureNumber: number;
  title: string;
  subtitle: string;
  type: 'line_chart' | 'bar_chart' | 'radar_chart' | 'volcano_plot' | 'network_graph' | 'dag_flow';
  caption: string;
  data: {
    labels?: string[];
    series?: {
      name: string;
      values: number[];
      color?: string;
    }[];
    points?: { x: number; y: number; label?: string; significance?: boolean; category?: string }[];
    nodes?: { id: string; label: string; group?: string; size?: number }[];
    edges?: { source: string; target: string; weight?: number; label?: string }[];
    meta?: Record<string, any>;
  };
}

export interface ScientificTable {
  id: string;
  tableNumber: number;
  title: string;
  description: string;
  columns: {
    key: string;
    label: string;
    type?: 'string' | 'number' | 'badge' | 'pvalue' | 'log2fc';
    align?: 'left' | 'center' | 'right';
  }[];
  rows: Record<string, any>[];
  footerSummary?: string;
}

export interface MultiAgentContribution {
  agentId: string;
  agentName: string;
  specialty: string;
  roleDescription: string;
  status: 'completed' | 'active' | 'idle';
  confidencePct: number;
  generatedArtifacts: string[];
}

export interface BioOmniExecutionStep {
  stepIndex: number;
  agentName?: string;
  agentRole?: string;
  thought: string;
  actionTool?: string;
  actionInput?: Record<string, any>;
  observation?: {
    summary: string;
    data?: any;
    status: 'success' | 'warning' | 'error';
    associatedFigureId?: string;
    associatedTableId?: string;
  };
  timestamp: string;
}

// Backward compatibility alias
export type SynOmicsExecutionStep = BioOmniExecutionStep;

export interface BioOmniAgentRun {
  runId: string;
  timestamp: string;
  query: string;
  mode: 'autonomous' | 'interactive' | 'protocol_designer' | 'variant_prioritizer';
  status: 'idle' | 'running' | 'completed' | 'failed';
  agentsInvolved?: MultiAgentContribution[];
  steps: BioOmniExecutionStep[];
  figures?: ScientificFigure[];
  tables?: ScientificTable[];
  consensusVerification?: MultiModelConsensusVerification;
  finalSynthesis?: {
    keyInsights: string[];
    biologicalMechanisms?: string;
    synapticMechanisms?: string; // backward compatibility
    therapeuticImplications: string;
    recommendedExperiments: string[];
    confidenceScore: number; // 0-100
  };
}

// Backward compatibility alias
export type SynOmicsAgentRun = BioOmniAgentRun;

export interface SampleGroupDesignation {
  id: string;
  name: string;
  designation: 'control' | 'treated' | 'baseline' | 'replicate' | 'batch' | 'time_point' | 'covariate' | 'other';
  count: number;
  color: string;
}

export interface UploadedBioFile {
  id: string;
  name: string;
  size: number;
  type: string; // 'FASTA' | 'PDB' | 'VCF' | 'FASTQ' | 'CSV' | 'TSV' | 'BIGWIG' | 'BED' | 'BAM' | 'GTF' | 'GZIP' | 'ZIP' | 'JSON' | 'H5AD' | 'mzML' | 'OTHER';
  uploadedAt: string;
  previewText?: string;
  parsedSummary?: {
    recordsCount?: number;
    genesDetected?: string[];
    variantCount?: number;
    organism?: string;
    notes?: string;
    detectedModality?: string;
    suggestedPipelines?: string[];
    attributes?: string[];
  };
  experimentalDesign?: {
    groups: SampleGroupDesignation[];
    pairing?: 'single_end' | 'paired_end' | 'paired_samples' | 'time_series' | 'independent';
    organism?: string;
    selectedPipeline?: string;
    customNotes?: string;
  };
  archiveContents?: Array<{
    name: string;
    size: number;
    detectedType: string;
  }>;
}

export interface ChatActionItem {
  id: string;
  label: string;
  icon?: 'volcano' | 'structure' | 'perturbation' | 'protocol' | 'workspace' | 'syngo' | 'terminal' | 'sparkles' | 'dna' | 'cloud';
  mode?: AppOperatingMode;
  targetGene?: string;
  pipelineType?: string;
  query?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedFiles?: UploadedBioFile[];
  agentRun?: BioOmniAgentRun;
  codeSnippet?: {
    language: string;
    code: string;
    filename?: string;
  };
  molecularTarget?: string;
  show3DViewer?: boolean;
  biologicalDomain?: BiologicalDomain | string;
  visualizationHint?: 'volcano' | 'network' | 'pca' | 'umap' | 'structure3d' | 'heatmap' | 'manhattan' | 'survival' | 'phylogenetic' | 'spatial' | 'perturbation';
  suggestedActions?: ChatActionItem[];
}

export interface ChatSession {
  id: string;
  title: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  isArchived?: boolean;
}

export interface InSilicoPerturbationResult {
  targetGene: string;
  perturbationType: 'Knockout' | 'Overexpression' | 'Phospho-null (Ala mutant)' | 'Dominant Negative' | 'Targeted Degradation (PROTAC)';
  systemImpactPct?: number; // e.g. -42%
  synapticStrengthChangePct?: number; // backward compatibility
  eiBalanceShift?: string;
  cellularStateShift?: string;
  pathwayStabilityScore?: number; // 0-100
  psdStabilityScore?: number; // backward compatibility
  phenotypeImpact?: string;
  spineDensityImpact?: string; // backward compatibility
  affectedComplexes: string[];
  compensatoryUpregulations: string[];
  suggestedRescueCompounds: {
    compound: string;
    mechanism: string;
    target: string;
    efficacyScore: number;
  }[];
}

export interface BioProtocolStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  reagents: string[];
  instructions: string;
  criticalQualityControls: string;
  temperatureCelsius?: number;
}

export interface BioProtocol {
  protocolId: string;
  title: string;
  author: string;
  category: string;
  overview: string;
  estimatedTotalTime: string;
  equipment: string[];
  reagentsRequired: { name: string; catalogRef?: string; concentration: string }[];
  steps: BioProtocolStep[];
  troubleshootingGuide: { problem: string; possibleCause: string; correctiveAction: string }[];
}

export interface Molecular3DTarget {
  id: string;
  pdbId: string;
  name: string;
  geneSymbol: string;
  resolution: string;
  experimentalMethod: string;
  organism: string;
  chains: string[];
  bindingPockets: {
    id: string;
    name: string;
    druggabilityScore: number;
    keyResidues: string[];
    ligand: string;
    affinityKd: string;
    deltaG: string;
  }[];
  description: string;
}
