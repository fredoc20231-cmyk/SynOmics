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
