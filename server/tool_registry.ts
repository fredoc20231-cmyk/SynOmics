import { runEngine, runPythonScript } from './engine_client.ts';
import { ensemblGeneBySymbol, myGeneBySymbol, uniProtByGene, vepByRsId } from './external_db.ts';

/**
 * Typed registry of the REAL analysis tools the agent can call. Each entry maps
 * a stable tool name to an actual engine command. There are no simulated tools
 * here — invoking one runs genuine computation in synomics_engine.py.
 */
export interface ToolParam {
  type: 'string' | 'number' | 'array' | 'object' | 'boolean';
  description: string;
  required?: boolean;
}

export interface ToolSpec {
  name: string;
  category: string;
  description: string;
  /** For engine-backed tools: the synomics_engine.py command to run. */
  engineCommand?: string;
  /** For JS-native tools (e.g. external DB clients): a real async handler. */
  handler?: (input: any) => Promise<any>;
  parameters: Record<string, ToolParam>;
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    name: 'ingest_file',
    category: 'Data ingestion',
    description: 'Parse an uploaded FASTA/FASTQ/VCF/CSV/TSV file into structured records with summary stats and routing suggestions.',
    engineCommand: 'ingest_file',
    parameters: {
      filename: { type: 'string', description: 'Original file name (used for format detection).' },
      content: { type: 'string', description: 'Raw file text content.', required: true },
    },
  },
  {
    name: 'align_sequences',
    category: 'Sequence analysis',
    description: 'Pairwise sequence alignment (Needleman–Wunsch or Smith–Waterman) with BLOSUM62 scoring.',
    engineCommand: 'align_sequences',
    parameters: {
      seq1: { type: 'string', description: 'First sequence.', required: true },
      seq2: { type: 'string', description: 'Second sequence.', required: true },
      method: { type: 'string', description: "'needleman_wunsch' (global) or 'smith_waterman' (local)." },
      seq_type: { type: 'string', description: "'protein' or 'nucleotide'." },
    },
  },
  {
    name: 'phylogenetic_tree',
    category: 'Sequence analysis',
    description: 'Build a phylogenetic tree from >=3 sequences (Jukes–Cantor distance + neighbor-joining, Newick output).',
    engineCommand: 'phylogenetic_tree',
    parameters: {
      taxa: { type: 'object', description: 'Map of taxon name -> sequence.', required: true },
      method: { type: 'string', description: "Tree method (default 'neighbor_joining')." },
    },
  },
  {
    name: 'differential_expression',
    category: 'Transcriptomics',
    description: 'Differential expression (log2FC + Welch t-test on log2(count+1) + Benjamini–Hochberg FDR) for a two-group design.',
    engineCommand: 'deseq2',
    parameters: {
      counts: { type: 'object', description: 'Map of sample -> array of counts (one value per gene, gene order shared).', required: true },
      conditions: { type: 'array', description: 'Group label per sample, aligned to counts keys.', required: true },
    },
  },
  {
    name: 'pathway_enrichment',
    category: 'Functional genomics',
    description: 'Hypergeometric gene-set enrichment against provided ontology terms.',
    engineCommand: 'syngo_enrichment',
    parameters: {
      genes: { type: 'array', description: 'Input gene symbols.', required: true },
      terms: { type: 'array', description: 'Ontology terms (id, name, genes[]). Optional; a default set is used if omitted.' },
    },
  },
  {
    name: 'single_cell',
    category: 'Single-cell',
    description: 'Single-cell pipeline: log-CPM, HVG selection and Welch t-test cluster markers.',
    engineCommand: 'scanpy_singlecell',
    parameters: {
      rawMatrix: { type: 'array', description: 'Genes x cells expression matrix.', required: true },
      geneNames: { type: 'array', description: 'Gene names (rows).' },
      cellTypes: { type: 'array', description: 'Cell type / cluster label per cell.' },
    },
  },
  {
    name: 'gwas',
    category: 'Genomics & genetics',
    description: 'GWAS summary-statistics analysis: -log10(P), genomic inflation λ_GC, lead loci.',
    engineCommand: 'gwas',
    parameters: {
      summaryStats: { type: 'array', description: 'Array of {rsid, chr, pos, pvalue}.', required: true },
      trait: { type: 'string', description: 'Trait / phenotype name.' },
      sigThreshold: { type: 'number', description: 'Genome-wide significance threshold (default 5e-8).' },
    },
  },
  {
    name: 'microbiome',
    category: 'Microbiome',
    description: 'Microbiome diversity: Shannon/Simpson/Chao1/Pielou, Bray–Curtis dissimilarity, PCoA ordination.',
    engineCommand: 'microbiome',
    parameters: {
      samples: { type: 'array', description: 'Array of {sampleId, group, abundances{taxon:count}}.', required: true },
      method: { type: 'string', description: "Beta-diversity metric (default 'bray_curtis')." },
    },
  },
  {
    name: 'mass_spec',
    category: 'Proteomics',
    description: 'In-silico tryptic digest and b/y ion MS2 fragmentation of a protein sequence.',
    engineCommand: 'msms_fragment',
    parameters: {
      proteinSequence: { type: 'string', description: 'Protein sequence to digest and fragment.', required: true },
    },
  },
  {
    name: 'ramachandran_contact',
    category: 'Structural biology',
    description: 'Ramachandran phi/psi dihedral analysis and residue contact map from PDB text.',
    engineCommand: 'ramachandran_contact',
    parameters: {
      pdbText: { type: 'string', description: 'PDB file text.' },
      pdb_id: { type: 'string', description: 'PDB accession (alternative to pdbText).' },
    },
  },
  {
    name: 'mutagenesis_ddg',
    category: 'Structural biology',
    description: 'Physics-based in-silico ΔΔG for a point mutation (VdW / electrostatics / solvation / entropy).',
    engineCommand: 'mutagenesis_ddg',
    parameters: {
      gene: { type: 'string', description: 'Gene / protein symbol.' },
      wildtype: { type: 'string', description: 'Wild-type residue (1-letter).' },
      position: { type: 'number', description: 'Residue position.' },
      mutant: { type: 'string', description: 'Mutant residue (1-letter).' },
    },
  },
  {
    name: 'network_topology',
    category: 'Systems biology',
    description: 'Network topology metrics (degree, centrality, components) for an interaction graph.',
    engineCommand: 'network_topology',
    parameters: {
      nodes: { type: 'array', description: 'Node identifiers.', required: true },
      edges: { type: 'array', description: 'Array of [source, target] pairs.', required: true },
    },
  },
  {
    name: 'markov_clustering',
    category: 'Systems biology',
    description: 'Markov clustering (MCL) of an interaction graph into modules.',
    engineCommand: 'markov_clustering',
    parameters: {
      nodes: { type: 'array', description: 'Node identifiers.', required: true },
      edges: { type: 'array', description: 'Array of [source, target] pairs.', required: true },
      inflation: { type: 'number', description: 'MCL inflation parameter (default 2.0).' },
    },
  },
  {
    name: 'kaplan_meier',
    category: 'Clinical / survival',
    description: 'Kaplan–Meier survival estimate with exact chi-square(1) log-rank test.',
    engineCommand: 'kaplan_meier',
    parameters: {
      gene: { type: 'string', description: 'Gene used to stratify.' },
      strata: { type: 'string', description: "Stratification (default 'expression_quantile')." },
    },
  },
  {
    name: 'ode_simulate',
    category: 'Systems biology',
    description: 'Biophysical ODE simulation (RK4) of conductance dynamics.',
    engineCommand: 'ode_simulate',
    parameters: {
      gene: { type: 'string', description: 'Gene / channel.' },
      mode: { type: 'string', description: 'Perturbation mode (e.g. Knockout).' },
      duration_ms: { type: 'number', description: 'Simulation duration in ms.' },
    },
  },
  {
    name: 'pathway_logic',
    category: 'Verifiable AI / neuro-symbolic',
    description: 'Deterministically evaluate pathway activation with a boolean logic solver (AND/OR/NOT over gene up/down states). Returns SATISFIABLE/UNSATISFIABLE + a formal proof trace. No LLM guessing.',
    engineCommand: 'pathway_logic',
    parameters: {
      foldChanges: { type: 'object', description: 'Map of gene -> fold-change (states derived by threshold).' },
      geneStates: { type: 'object', description: "Alternative: explicit map of gene -> 'up'|'down'|'neutral'." },
      threshold: { type: 'number', description: 'Fold-change threshold for up/down (default 1.0).' },
      pathways: { type: 'array', description: 'Pathways: [{id, name, rule}] where rule is a boolean expression.', required: true },
    },
  },
  {
    name: 'circuit_verify',
    category: 'Verifiable AI / synthetic biology',
    description: 'Formally verify a synthetic genetic circuit: Gillespie SSA (exact CTMC) + Monte-Carlo temporal-property check (e.g. P(species reaches N by time T) >= p). Reports VERIFIED/VIOLATED with a Wilson CI. numpy.',
    handler: (i) => runPythonScript('server/circuit_verify.py', i),
    parameters: {
      reactions: { type: 'array', description: '[{reactants:{s:c}, products:{s:c}, rate}] mass-action reactions.', required: true },
      initialState: { type: 'object', description: 'Map species -> initial molecule count.', required: true },
      property: { type: 'object', description: '{species, comparator, threshold, byTime, targetProbability}.' },
      maxTime: { type: 'number', description: 'Simulation horizon.' },
      nRuns: { type: 'number', description: 'Monte-Carlo runs (default 2000).' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
    },
  },
  {
    name: 'adversarial_swarm',
    category: 'Verifiable AI / validation',
    description: 'Evolutionary falsification swarm: an ensemble of statistical models (Welch t, Mann-Whitney U, exact permutation). Only genes significant under EVERY model at strict FDR<0.01 survive; each is tagged with its swarm survival rate. Requires scipy.',
    handler: (i) => runPythonScript('server/swarm.py', i),
    parameters: {
      counts: { type: 'object', description: 'Map gene -> per-sample counts.', required: true },
      conditions: { type: 'array', description: 'Group label per sample (exactly two groups).', required: true },
      fdr: { type: 'number', description: 'FDR threshold (default 0.01).' },
      nResamples: { type: 'number', description: 'Monte-Carlo resamples if exact permutation is infeasible.' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
    },
  },
  {
    name: 'adversarial_ml',
    category: 'Verifiable AI / validation',
    description: 'ML adversary: a cross-validated classifier overfit test (sklearn permutation_test_score) plus a PCA-vs-covariate batch-confounder check. VALIDATED/INVALIDATED/INCONCLUSIVE + veto. Requires scikit-learn.',
    handler: (i) => runPythonScript('server/adversary.py', i),
    parameters: {
      counts: { type: 'object', description: 'Map gene -> per-sample counts.', required: true },
      conditions: { type: 'array', description: 'Group label per sample.', required: true },
      covariates: { type: 'object', description: 'Optional map covariateName -> per-sample values (e.g. batch) for confounder testing.' },
      nPermutations: { type: 'number', description: 'Permutations for the overfit test (default 1000).' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
    },
  },
  {
    name: 'accelerate_kernel',
    category: 'Performance / self-optimizing',
    description: 'Compile a slow numeric kernel to C via Cython at runtime, run it, and report the measured speedup vs pure Python. Correctness is asserted against the reference before any speedup is claimed. Requires Cython + a C compiler.',
    handler: (i) => runPythonScript('server/accelerate.py', i),
    parameters: {
      kernel: { type: 'string', description: "Kernel name (e.g. 'sum_sq_pairwise')." },
      n: { type: 'number', description: 'Problem size (default 2000).' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
      thresholdSeconds: { type: 'number', description: 'Slowness threshold to flag (default 60).' },
    },
  },
  {
    name: 'boolean_attractors',
    category: 'Verifiable AI / state-space',
    description: 'Exact Boolean-network attractor analysis: enumerate the state space to find fixed-point phenotypes and cyclic attractors with basin sizes, and how they shift under node perturbations (drug knockout/activation). Deterministic state-space simulation, not a fabricated digital twin.',
    engineCommand: 'boolean_attractors',
    parameters: {
      nodes: { type: 'array', description: 'Node names (<=20).' },
      rules: { type: 'object', description: 'Map node -> boolean update rule (AND/OR/NOT over {node} / {const}).', required: true },
      perturbations: { type: 'array', description: 'Optional: [{fix:{node:0|1}}] to recompute attractors under perturbation.' },
    },
  },
  {
    name: 'adversarial_validate',
    category: 'Verifiable AI / validation',
    description: 'Adversarially validate a two-group differential-expression hypothesis via a label-permutation null; returns a deterministic VALIDATED/INVALIDATED/INCONCLUSIVE verdict, confidence, and auto-veto. No LLM in the decision.',
    engineCommand: 'adversarial_validate',
    parameters: {
      counts: { type: 'object', description: 'Map of gene -> per-sample counts.', required: true },
      conditions: { type: 'array', description: 'Group label per sample.', required: true },
      nPermutations: { type: 'number', description: 'Permutations for the null (default 1000).' },
      fdrThreshold: { type: 'number', description: 'FDR cutoff for significance (default 0.05).' },
      seed: { type: 'number', description: 'Random seed for reproducibility (default 1337).' },
    },
  },
  {
    name: 'assay_quantify',
    category: 'Wet-lab automation / vision',
    description: 'Deterministic OpenCV quantification of a physical assay image (Otsu/threshold + contour intensity), no LLM eyeballing. Returns per-region area/centroid/mean-intensity. Requires opencv.',
    handler: (i) => runPythonScript('server/vision_assay.py', { ...i, task: 'quantify_image' }),
    parameters: {
      imageBase64: { type: 'string', description: 'Assay image (PNG/JPEG) as base64.', required: true },
      minArea: { type: 'number', description: 'Minimum contour area to report.' },
      threshold: { type: 'number', description: 'Fixed background threshold; Otsu if omitted.' },
    },
  },
  {
    name: 'bayesian_update',
    category: 'Verifiable AI / inference',
    description: 'Conjugate Bayesian posterior update (Beta-Binomial for proportions, Normal-Normal for continuous) that folds physical assay results into posterior probabilities. Requires numpy/scipy.',
    handler: (i) => runPythonScript('server/vision_assay.py', { ...i, task: 'bayesian_update' }),
    parameters: {
      model: { type: 'string', description: "'beta_binomial' or 'normal'.", required: true },
      prior: { type: 'object', description: 'Prior params ({alpha,beta} or {mean,var}).' },
      data: { type: 'object', description: 'Observed data ({successes,trials} or {values,obsVar}).', required: true },
    },
  },
  {
    name: 'molecule_descriptors',
    category: 'Drug discovery / cheminformatics',
    description: 'Compute REAL molecular descriptors from a SMILES via RDKit (MW, cLogP, TPSA, HBD/HBA, rotatable bonds, QED, Lipinski/Veber). Docking/binding affinity is NOT fabricated (needs a real docking engine). Requires rdkit.',
    handler: (i) => runPythonScript('server/drug_descriptors.py', i),
    parameters: {
      smiles: { type: 'string', description: 'Ligand SMILES string.', required: true },
      name: { type: 'string', description: 'Optional compound name.' },
    },
  },
  {
    name: 'robotic_protocol',
    category: 'Wet-lab automation',
    description: 'Generate an Opentrons (apiLevel 2) liquid-handling protocol from a transfer plan AFTER deterministically verifying physical constraints (volume<=pipette capacity with auto-split, unique deck slots within capacity). Emits no protocol if the plan is physically invalid.',
    handler: (i) => runPythonScript('server/robotics.py', i),
    parameters: {
      pipette: { type: 'object', description: '{model, maxVolume, minVolume}.', required: true },
      labware: { type: 'array', description: '[{name, slot}] deck placements.' },
      transfers: { type: 'array', description: '[{source, dest, volume}] liquid transfers.', required: true },
      deckSlots: { type: 'number', description: 'Available deck slots (default 11 for OT-2).' },
    },
  },
  {
    name: 'provenance_manifest',
    category: 'Reporting / provenance',
    description: 'Build a cryptographic provenance manifest (SHA-256 of inputs, scripts, outputs + a manifest hash) so results are tied to the exact bytes that produced them. Pure stdlib.',
    handler: (i) => runPythonScript('server/provenance.py', i),
    parameters: {
      inputs: { type: 'object', description: 'Map name -> input value.' },
      scripts: { type: 'array', description: 'List of script file paths to hash.' },
      outputs: { type: 'object', description: 'Map name -> output value.' },
      sessionId: { type: 'string', description: 'Optional session id.' },
    },
  },
  {
    name: 'generate_report',
    category: 'Reporting',
    description: 'Render a 6-section publication-grade report (Title/Summary/Introduction/Methods/Results/Interpretations) to HTML + DOCX from REAL provided content. Renders only what is passed; missing sections marked "not provided". Requires jinja2/python-docx.',
    handler: (i) => runPythonScript('server/report_generator.py', i),
    parameters: {
      title: { type: 'string', description: 'Report title.', required: true },
      summary: { type: 'string', description: 'Executive summary.' },
      introduction: { type: 'string', description: 'Biological context / hypothesis.' },
      methods: { type: 'string', description: 'Exact tools, params, tests.' },
      results: { type: 'string', description: 'Objective findings (real, computed).' },
      interpretations: { type: 'string', description: 'Significance, limitations, next steps.' },
      tables: { type: 'array', description: 'Optional [{title, columns, rows}] of real results.' },
      formats: { type: 'array', description: "Subset of ['html','docx'] (default both)." },
    },
  },
  {
    name: 'edge_extraction',
    category: 'Verifiable AI / neuro-symbolic',
    description: 'Tier-1 grounding: partial-correlation (sparse inverse covariance, GraphicalLassoCV) edge extraction that separates direct from indirect associations. Not a neural network. Requires scikit-learn.',
    handler: (i) => runPythonScript('server/neuro_symbolic.py', { ...i, task: 'edge_extraction' }),
    parameters: {
      data: { type: 'array', description: 'Matrix rows=samples, cols=variables (samples > variables).', required: true },
      variables: { type: 'array', description: 'Variable names (optional).' },
      threshold: { type: 'number', description: 'Absolute partial-correlation edge threshold (default 0.1).' },
    },
  },
  {
    name: 'multiomic_consistency',
    category: 'Verifiable AI / neuro-symbolic',
    description: 'Reconcile multi-omic layers with Z3: flag LOGICAL_CONFLICT where layers contradict (e.g. transcript up but protein down) and HALT pathway activation for affected genes. Requires z3-solver.',
    handler: (i) => runPythonScript('server/neuro_symbolic.py', { ...i, task: 'multiomic_consistency' }),
    parameters: {
      layers: { type: 'object', description: 'Map layerName -> {gene: foldChange|state} for >=2 omics layers.', required: true },
      threshold: { type: 'number', description: 'Fold-change threshold for up/down (default 1.0).' },
      pathways: { type: 'array', description: 'Optional pathways [{id,name,rule}] evaluated on consistent genes only.' },
    },
  },
  {
    name: 'pathway_logic_z3',
    category: 'Verifiable AI / neuro-symbolic',
    description: 'Tier-2 formal verification: decide pathway activation with the Z3 SMT solver and emit a satisfying model. UNSAT means not activated and cannot be overridden. Requires z3-solver.',
    handler: (i) => runPythonScript('server/neuro_symbolic.py', { ...i, task: 'z3_pathway' }),
    parameters: {
      foldChanges: { type: 'object', description: 'Map gene -> fold-change (states derived by threshold).' },
      geneStates: { type: 'object', description: "Alternative: map gene -> 'up'|'down'|'neutral'." },
      threshold: { type: 'number', description: 'Fold-change threshold (default 1.0).' },
      pathways: { type: 'array', description: 'Pathways [{id, name, rule}].', required: true },
    },
  },
  {
    name: 'pde_residual',
    category: 'Verifiable AI / physics',
    description: 'Physics-validity gate for spatiotemporal fields: compute the finite-difference reaction-diffusion PDE residual (du/dt - D u_xx - f(u)); reject as PHYSICALLY_INVALID if the max residual exceeds the threshold. numpy.',
    handler: (i) => runPythonScript('server/pde_validate.py', i),
    parameters: {
      u: { type: 'array', description: '2-D field [n_t, n_x].', required: true },
      D: { type: 'number', description: 'Diffusion coefficient.' },
      dx: { type: 'number', description: 'Spatial step.' },
      dt: { type: 'number', description: 'Time step.' },
      reaction: { type: 'object', description: "{type:'none'|'linear'|'logistic', rate, carryingCapacity}." },
      threshold: { type: 'number', description: 'Residual acceptance threshold (default 1e-4).' },
    },
  },
  {
    name: 'mml_select',
    category: 'Verifiable AI / model selection',
    description: 'Minimum Message Length (MML) model selection: choose the model minimizing model complexity + encoded residual, so extra parameters are only kept when they genuinely shorten the data encoding. numpy.',
    handler: (i) => runPythonScript('server/mml.py', i),
    parameters: {
      x: { type: 'array', description: 'Predictor values (polynomial-order mode).' },
      y: { type: 'array', description: 'Response values (polynomial-order mode).' },
      maxDegree: { type: 'number', description: 'Max polynomial degree to consider.' },
      candidates: { type: 'array', description: 'Generic mode: [{name, paramsCount, negLogLik, n}].' },
    },
  },
  {
    name: 'causal_discovery',
    category: 'Verifiable AI / causal inference',
    description: 'Infer a directed causal graph (not just correlation) from linear non-Gaussian data via DirectLiNGAM, with bootstrap-stability edge gating. Requires numpy; returns honest "unavailable" if absent.',
    handler: (i) => runPythonScript('server/causal_discovery.py', i),
    parameters: {
      data: { type: 'array', description: 'Matrix rows=samples, cols=variables.' },
      series: { type: 'object', description: 'Alternative: map variable -> values.' },
      variables: { type: 'array', description: 'Variable names (optional).' },
      nBootstrap: { type: 'number', description: 'Bootstrap resamples for stability (default 200).' },
      stabilityThreshold: { type: 'number', description: 'Keep edges seen in >= this fraction of bootstraps (default 0.9).' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
    },
  },
  {
    name: 'tensor_compress',
    category: 'Verifiable AI / compression',
    description: 'Tensor-Train (MPS) compression of a high-dimensional array with measured, reported truncation error and an honest "approximate" flag. A compression utility — not a cell simulator. Requires numpy+tensorly.',
    handler: (i) => runPythonScript('server/tensor_compression.py', i),
    parameters: {
      tensor: { type: 'array', description: 'Nested-list tensor (>=2 dims).', required: true },
      rank: { type: 'number', description: 'TT internal rank (optional; adaptively chosen if omitted).' },
      maxRelError: { type: 'number', description: 'Target relative reconstruction error (default 1e-4).' },
    },
  },
  // --- Real external-database grounding (live public APIs; honest errors) ---
  {
    name: 'db_ensembl_gene',
    category: 'External database (grounding)',
    description: 'Look up real gene coordinates, biotype and assembly from the Ensembl REST API by gene symbol.',
    handler: (i) => ensemblGeneBySymbol(i.symbol, i.species || 'homo_sapiens'),
    parameters: {
      symbol: { type: 'string', description: 'Gene symbol (e.g. TP53, BRCA2).', required: true },
      species: { type: 'string', description: "Ensembl species (default 'homo_sapiens')." },
    },
  },
  {
    name: 'db_gene_annotation',
    category: 'External database (grounding)',
    description: 'Fetch real gene annotation (Entrez ID, name, Ensembl gene, summary) from MyGene.info by symbol.',
    handler: (i) => myGeneBySymbol(i.symbol, i.species || 'human'),
    parameters: {
      symbol: { type: 'string', description: 'Gene symbol.', required: true },
      species: { type: 'string', description: "Species (default 'human')." },
    },
  },
  {
    name: 'db_protein_uniprot',
    category: 'External database (grounding)',
    description: 'Fetch the real canonical UniProt protein entry (accession, name, length) for a gene symbol + organism.',
    handler: (i) => uniProtByGene(i.symbol, i.organismId || 9606),
    parameters: {
      symbol: { type: 'string', description: 'Gene symbol.', required: true },
      organismId: { type: 'number', description: 'NCBI taxon id (default 9606 = human).' },
    },
  },
  {
    name: 'db_variant_vep',
    category: 'External database (grounding)',
    description: 'Real variant effect prediction (consequence, SIFT/PolyPhen) from the Ensembl VEP API by dbSNP rsID.',
    handler: (i) => vepByRsId(i.rsid, i.species || 'human'),
    parameters: {
      rsid: { type: 'string', description: 'dbSNP rsID (e.g. rs56116432).', required: true },
      species: { type: 'string', description: "Species (default 'human')." },
    },
  },
  // --- iDiscover: monumental frontier engines (all code-grounded, honest fallbacks) ---
  {
    name: 'cellular_reversion',
    category: 'iDiscover / Optimal Transport',
    description: 'iDiscover "Biological Git": compute the minimum-energy Optimal-Transport plan reverting a diseased single-cell distribution to a healthy reference. Returns the exact Wasserstein distance and the top per-gene perturbations (the "revert commits") from the transport coupling. Exact EMD via POT when available, else numpy Sinkhorn (flagged approximate); strict error if it fails to converge. Requires numpy.',
    handler: (i) => runPythonScript('server/optimal_transport.py', i, 180000),
    parameters: {
      sourceMatrix: { type: 'array', description: 'Diseased cells x genes (rows = cells).', required: true },
      targetMatrix: { type: 'array', description: 'Healthy reference cells x genes (same gene columns).', required: true },
      genes: { type: 'array', description: 'Gene names (length = number of columns).' },
      topK: { type: 'number', description: 'Number of perturbation commits to report (default 5).' },
      reg: { type: 'number', description: 'Sinkhorn entropic regularization (fallback only; default 0.05).' },
    },
  },
  {
    name: 'federated_zkp',
    category: 'iDiscover / privacy-preserving federation',
    description: 'iDiscover federated biomarker discovery: each site runs a REAL stratified log-rank survival test on its own private records; only additive (O-E, V) sufficient statistics leave the site — never raw rows. The aggregate is secured with REAL Pedersen commitments (homomorphic) + Schnorr/Fiat–Shamir zero-knowledge proofs of knowledge, so contributions are hidden and tamper-evident. Pure stdlib. Scope: not a general zk-SNARK over arbitrary predicates (no proving backend bundled) — stated honestly.',
    handler: (i) => runPythonScript('server/federated_zkp.py', i, 120000),
    parameters: {
      sites: { type: 'array', description: 'List of >=2 sites, each { name, durations[], events[0/1], groups[0/1] }.', required: true },
      alpha: { type: 'number', description: 'Significance threshold to report (default 0.01).' },
      scale: { type: 'number', description: 'Fixed-point scale for (O-E) integer commitments (default 1e6).' },
    },
  },
  {
    name: 'hyper_causal_discovery',
    category: 'iDiscover / hypergraph causal discovery',
    description: 'iDiscover Hyper-NOTEARS: discover a Directed Acyclic Hypergraph of multi-way (joint) causes from data (finds e.g. [A,B]->C that pairwise methods miss), OR verify a proposed weighted adjacency for causal loops. Acyclicity is enforced/certified by the exact tr(exp(W∘W))-d gate; a detected loop is rejected with a strict error — no heuristic DAG. Requires numpy + scipy.',
    handler: (i) => runPythonScript('server/hyper_causal.py', i, 180000),
    parameters: {
      data: { type: 'array', description: 'Discover mode: matrix rows=samples, cols=nodes/genes.' },
      series: { type: 'object', description: 'Discover mode alternative: map node -> values.' },
      adjacency: { type: 'array', description: 'Verify mode: square d×d weighted directed adjacency (W[i][j] = edge i->j).' },
      variables: { type: 'array', description: 'Node names (optional).' },
      maxOrder: { type: 'number', description: 'Max hyperedge tail size (default 2 = pairs).' },
      epsilon: { type: 'number', description: 'Acyclicity tolerance (default 1e-5).' },
      edgeThreshold: { type: 'number', description: '|strength| to report a discovered hyperedge (default 0.3).' },
    },
  },
  {
    name: 'gflownet_sample',
    category: 'iDiscover / generative chemistry',
    description: 'iDiscover GFlowNet: sample a diverse set of drug-like molecules proportionally to reward (Trajectory-Balance), not a single optimum. Tabular numpy GFlowNet; every returned molecule is RDKit-valid with a REAL computed QED reward — invalid samples are discarded, nothing fabricated. A deep neural GFlowNet (torch/GPU) is not claimed. Requires numpy + rdkit.',
    handler: (i) => runPythonScript('server/gflownet.py', i, 300000),
    parameters: {
      objective: { type: 'string', description: "Reward property to maximize (currently 'qed')." },
      maxLength: { type: 'number', description: 'Max fragments per molecule (default 4).' },
      beta: { type: 'number', description: 'Reward exponent R^beta to sharpen the target distribution (default 4).' },
      iterations: { type: 'number', description: 'Trajectory-Balance training steps (default 1500).' },
      nSamples: { type: 'number', description: 'Molecules to sample from the trained policy (default 200).' },
      topK: { type: 'number', description: 'Top candidates to return (default 10).' },
      seed: { type: 'number', description: 'Random seed (default 1337).' },
    },
  },
  // --- Module B depth: advanced expression analyses (real, CI-gated) ---
  {
    name: 'nb_differential_expression',
    category: 'Expression / differential analysis',
    description: 'Negative-binomial GLM differential expression (DESeq2-style count model with per-gene dispersion + Wald test + BH FDR) — more rigorous than a t-test. Requires numpy + statsmodels.',
    handler: (i) => runPythonScript('server/expression_advanced.py', { ...i, task: 'nb_de' }),
    parameters: {
      counts: { type: 'object', description: 'gene -> [integer counts per sample].', required: true },
      conditions: { type: 'array', description: 'Per-sample condition labels (exactly two groups).', required: true },
    },
  },
  {
    name: 'gsea',
    category: 'Expression / enrichment',
    description: 'Gene-set enrichment analysis (GSEA prerank) on a ranked gene list vs supplied gene sets → ES/NES/p/FDR per set. Requires gseapy.',
    handler: (i) => runPythonScript('server/expression_advanced.py', { ...i, task: 'gsea' }, 120000),
    parameters: {
      rnk: { type: 'object', description: 'gene -> ranking score.', required: true },
      geneSets: { type: 'object', description: 'set name -> [genes].', required: true },
      permutations: { type: 'number', description: 'Permutations (default 200).' },
    },
  },
  {
    name: 'batch_correct',
    category: 'Expression / preprocessing',
    description: 'Linear batch-effect removal (limma removeBatchEffect-style OLS): subtracts batch-indicator contributions while retaining biology. Requires numpy.',
    handler: (i) => runPythonScript('server/expression_advanced.py', { ...i, task: 'batch_correct' }),
    parameters: {
      matrix: { type: 'array', description: 'samples x features matrix.', required: true },
      batch: { type: 'array', description: 'per-sample batch labels.', required: true },
    },
  },
  {
    name: 'pca',
    category: 'Expression / dimensionality reduction',
    description: 'Principal component analysis with explained-variance ratios and sample scores. Requires numpy + scikit-learn.',
    handler: (i) => runPythonScript('server/expression_advanced.py', { ...i, task: 'pca' }),
    parameters: {
      matrix: { type: 'array', description: 'samples x features matrix.', required: true },
      nComponents: { type: 'number', description: 'Components to keep (default min(n,p,10)).' },
    },
  },
];

const BY_NAME = new Map(TOOL_REGISTRY.map((t) => [t.name, t]));
// Also allow calling tools by their raw engine command for flexibility.
const BY_COMMAND = new Map(TOOL_REGISTRY.map((t) => [t.engineCommand, t]));

export function getTool(name: string): ToolSpec | undefined {
  return BY_NAME.get(name) || BY_COMMAND.get(name);
}

export interface ToolInvocation {
  tool: string;
  ok: boolean;
  result?: any;
  error?: string;
}

/** Invoke a registry tool with real computation. Unknown tools return an honest error, never a crash. */
export async function invokeTool(name: string, input: any): Promise<ToolInvocation> {
  const spec = getTool(name);
  if (!spec) {
    return { tool: name, ok: false, error: `Unknown tool '${name}'. Known tools: ${TOOL_REGISTRY.map((t) => t.name).join(', ')}.` };
  }
  const missing = Object.entries(spec.parameters)
    .filter(([, p]) => p.required)
    .map(([k]) => k)
    .filter((k) => input?.[k] === undefined || input?.[k] === null);
  if (missing.length) {
    return { tool: spec.name, ok: false, error: `Missing required parameter(s): ${missing.join(', ')}.` };
  }
  try {
    // JS-native tools (external DB clients) run their handler; engine tools spawn Python.
    if (spec.handler) {
      const result = await spec.handler(input);
      // External DB results carry an explicit status; an unavailable/not_found
      // upstream is an honest tool failure, not a crash.
      if (result && typeof result === 'object' && 'status' in result && result.status !== 'success') {
        return { tool: spec.name, ok: false, error: String(result.error || result.status), result };
      }
      return { tool: spec.name, ok: true, result };
    }
    if (!spec.engineCommand) {
      return { tool: spec.name, ok: false, error: `Tool '${spec.name}' has no engine command or handler.` };
    }
    const result = await runEngine(spec.engineCommand, input);
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      return { tool: spec.name, ok: false, error: String(result.error), result };
    }
    return { tool: spec.name, ok: true, result };
  } catch (err: any) {
    return { tool: spec.name, ok: false, error: err?.message || String(err) };
  }
}

/** Tool schemas in a shape suitable for LLM function-calling / planning prompts. */
export function toolSchemasForLLM() {
  return TOOL_REGISTRY.map((t) => ({
    name: t.name,
    category: t.category,
    description: t.description,
    parameters: t.parameters,
  }));
}
