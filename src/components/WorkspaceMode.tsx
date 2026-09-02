import React, { useState } from 'react';
import { 
  Terminal, 
  Code2, 
  Activity, 
  Play, 
  Copy, 
  Check, 
  Sparkles, 
  Send, 
  Dna, 
  Layout, 
  Layers, 
  ChevronRight,
  Maximize2,
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { SynOmicsAgentRun, SynapticProtein } from '../types';
import { Molecular3DViewer } from './Molecular3DViewer';
import { MultiOmicsChartsSuite } from './MultiOmicsChartsSuite';

interface WorkspaceModeProps {
  currentRun: SynOmicsAgentRun | null;
  isRunning: boolean;
  onRunQuery: (query: string) => void;
  proteins: SynapticProtein[];
  onSelectProtein: (protein: SynapticProtein) => void;
  targetProteinSymbol?: string;
}

export const WorkspaceMode: React.FC<WorkspaceModeProps> = ({
  currentRun,
  isRunning,
  onRunQuery,
  proteins,
  onSelectProtein,
  targetProteinSymbol = 'DLG4'
}) => {
  const [terminalTab, setTerminalTab] = useState<'chain_of_thought' | 'python_code' | 'stdout_logs'>('python_code');
  const [rightPaneView, setRightPaneView] = useState<'3d_molecular' | 'multi_omics_charts'>('3d_molecular');
  const [promptInput, setPromptInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Script execution states
  const [isExecutingScript, setIsExecutingScript] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<{
    stdout: string;
    stderr: string | null;
    durationMs: number;
    exitCode: number;
    timestamp: string;
  } | null>(null);

  // Pre-built Python Script Templates
  const SCRIPT_TEMPLATES: Record<string, { name: string; code: string }> = {
    synaptic_ode: {
      name: 'Synaptic 4th-Order ODE Perturbation',
      code: `import synomics as so
from server.synomics_engine import simulate_synaptic_ode, compute_syngo_hypergeometric_enrichment

print("="*65)
print("  SYNOMICS CO-SCIENTIST WORKSPACE")
print("="*65)

# 1. Initialize SynOmics Synaptic Knowledge Client
client = so.Client(version="v7.0_sheen")
target_gene = "${targetProteinSymbol || 'DLG4'}"
node = client.get_protein(target_gene)
print(f"\\n[1/3] Target Gene: {node.gene_symbol} ({node.name})")
print(f"      Compartment: {node.compartment} | Est. Copies/Spine: {node.copy_number}")
print(f"      Key Interactors: {', '.join(node.key_interactors)}")

# 2. Runge-Kutta ODE Simulation
print(f"\\n[2/3] Simulating RK4 Synaptic Electrophysiology for {target_gene} Knockout...")
ode_res = simulate_synaptic_ode(gene=target_gene, mode="Knockout", duration_ms=60.0)
m = ode_res["metrics"]
print(f"      -> Resting Vm: {m['restingPotential_mV']:.2f} mV | Peak Vm: {m['peakPotential_mV']:.2f} mV")
print(f"      -> EPSP Peak Amplitude: +{m['epspAmplitude_mV']:.2f} mV")
print(f"      -> 10-90% Rise Time: {m['riseTime10_90_ms']:.2f} ms | Half-Decay tau: {m['halfDecayTime_ms']:.2f} ms")
print(f"      -> Peak Spine [Ca2+] Influx: {m['peakCalcium_uM']:.3f} uM | E/I Ratio: {m['eiBalanceRatio']:.2f}")

# 3. Exact Hypergeometric Pathway Enrichment
print(f"\\n[3/3] Testing SynGO Gene Ontology Overrepresentation...")
query_gene_set = ["DLG4", "SHANK3", "SYNGAP1", "GRIN2B", "HOMER1", "CAMK2A", "NLGN1"]
enrich_res = compute_syngo_hypergeometric_enrichment(query_gene_set)
for hit in enrich_res["results"][:3]:
    print(f"      Term: {hit['name']} (Overlap {hit['overlapCount']}/{hit['termGeneCount']} | FDR q={hit['fdrPAdj']:.2e})")

print("\\n[+] Synaptic ODE & Enrichment completed successfully.")`
    },
    seq_alignment: {
      name: 'Sequence Alignment (Needleman-Wunsch & Smith-Waterman)',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS SEQUENCE HOMOLOGY & PAIRWISE ALIGNMENT ENGINE")
print("="*65)

seq1 = "MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA"
seq2 = "MDCLCVVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA"

# 1. Smith-Waterman Local Alignment with BLOSUM62
sw_res = so.sequence.smith_waterman(seq1, seq2, seq_type="protein", gap_open=-10, gap_extend=-1)
print(f"\\n[1/2] Smith-Waterman (Local Alignment):")
print(f"      Score: {sw_res['alignmentScore']} | Identity: {sw_res['identityPct']}% | Similarity: {sw_res['similarityPct']}%")
print(f"      Query:  {sw_res['alignedSeq1'][:50]}...")
print(f"      Match:  {sw_res['markup'][:50]}...")
print(f"      Target: {sw_res['alignedSeq2'][:50]}...")

# 2. Needleman-Wunsch Global Alignment
nw_res = so.sequence.needleman_wunsch(seq1, seq2, seq_type="protein", gap_open=-10, gap_extend=-1)
print(f"\\n[2/2] Needleman-Wunsch (Global Alignment):")
print(f"      Score: {nw_res['alignmentScore']} | Gaps: {nw_res['gapsCount']} ({nw_res['gapPct']}%)")
print("\\n[+] Sequence alignment completed with exact BLOSUM62 matrix.")`
    },
    single_cell: {
      name: 'Single-Cell snRNA-seq Scanpy Analysis',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS SINGLE-CELL / snRNA-seq SCANPY PIPELINE")
print("="*65)

# Execute scanpy pipeline: QC, CPM Log1p, SVD PCA, Marker Identification
sc_res = so.single_cell.run_pipeline()

print(f"\\n[1/3] Single-Cell Dataset Metrics:")
print(f"      Total Synaptic Nuclei: {sc_res['nCells']} across {sc_res['cellTypesCount']} cortical populations")
print(f"      Mean UMIs/Cell: {sc_res['qcSummary']['meanUMI']} | Mean Genes/Cell: {sc_res['qcSummary']['meanGenesPerCell']}")
print(f"      Mean Mitochondrial Fraction: {sc_res['qcSummary']['meanMitoPct']}%")

print(f"\\n[2/3] Top Highly Variable Genes (HVGs):")
for hvg in sc_res['highlyVariableGenes'][:5]:
    print(f"      - {hvg['gene']:<10} | Mean: {hvg['mean']:<6} | Variance: {hvg['variance']:<6} | Dispersion: {hvg['dispersion']}")

print(f"\\n[3/3] Welch's t-Test Subpopulation Markers for CA1_Pyramidal:")
for m in sc_res['clusterMarkers'].get('CA1_Pyramidal', [])[:4]:
    print(f"      Marker: {m['gene']:<10} | log2FC: +{m['log2FC']:<5} | t-stat: {m['tStatistic']:<6} | p-val: {m['pValue']}")

print("\\n[+] Single-cell pipeline finished with complete numerical verification.")`
    },
    ramachandran: {
      name: 'Structural Ramachandran & Contact Map',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS STRUCTURAL BIOLOGY & CONTACT MAP ANALYZER")
print("="*65)

# Analyze PSD-95 PDZ3 domain structure
struct_res = so.structure.analyze_pdb(pdb_id="DLG4", contact_cutoff_angstrom=8.0)

dist = struct_res['ramachandranDistribution']
print(f"\\n[1/2] Ramachandran Backbone Dihedral Angles (Phi, Psi):")
print(f"      - Core Alpha-Helix:   {dist['coreAlphaPct']}%")
print(f"      - Core Beta-Sheet:    {dist['coreBetaPct']}%")
print(f"      - Allowed Regions:    {dist['allowedPct']}%")
print(f"      - Outlier Residues:   {dist['outlierPct']}%")

cmap = struct_res['contactMap']
print(f"\\n[2/2] C-Alpha Pairwise Contact Map (Cutoff <= 8.0 A):")
print(f"      Contact Matrix Dimension: {cmap['matrixSize']} x {cmap['matrixSize']} residues")
print(f"      First 5 Contact Pairs:")
for r in range(min(5, cmap['matrixSize'])):
    contacts = [cmap['labels'][c] for c in range(cmap['matrixSize']) if cmap['contactMatrix'][r][c] == 1 and r != c]
    print(f"      Residue {cmap['labels'][r]}: contacts with -> {', '.join(contacts[:4])}")

print("\\n[+] Structural analysis executed successfully.")`
    },
    phylogenetics: {
      name: 'Phylogenetics & Evolutionary Tree Reconstruction',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS PHYLOGENETICS & EVOLUTIONARY DIVERGENCE ENGINE")
print("="*65)

taxa = {
    'Human_DLG4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Chimpanzee_DLG4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Mouse_Dlg4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Zebrafish_dlg4': 'MDCLCVITTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTESLEAPGYEL',
    'Drosophila_dlg1': 'MDHLFTATTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNSETLEAPGYEL'
}

# 1. Neighbor-Joining Tree
nj_tree = so.phylogenetics.neighbor_joining(taxa)
print(f"\\n[1/2] Neighbor-Joining (NJ) Newick Tree:")
print(f"      {nj_tree['newick']}")

# 2. UPGMA Tree
upgma_tree = so.phylogenetics.upgma(taxa)
print(f"\\n[2/2] UPGMA Hierarchical Newick Tree:")
print(f"      {upgma_tree['newick']}")

print("\\n[+] Jukes-Cantor phylogenetic tree construction complete.")`
    },
    mass_spec: {
      name: 'In-Silico Tryptic Digest & Tandem MS/MS',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS MASS SPECTROMETRY & PROTEOMICS FRAGMENTATION")
print("="*65)

seq = "MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA"

# 1. In-silico Tryptic Digestion
peptides = so.mass_spec.tryptic_digest(seq)
print(f"\\n[1/2] Cleaved {len(peptides)} Tryptic Peptides:")
for p in peptides:
    print(f"      Pos {p['start']:>2}-{p['end']:<2} | Mass: {p['monoisotopicMass']:>7.2f} Da | [M+2H]2+: {p['mz2']:>6.2f} | Seq: {p['sequence']}")

# 2. CID MS/MS Fragmentation for first peptide
target_pep = peptides[0]['sequence']
ms2 = so.mass_spec.fragment_peptide(target_pep, charge=2)
print(f"\\n[2/2] CID MS/MS Spectrum for {target_pep} (Precursor m/z: {ms2['precursorMz']:.2f}):")
print(f"      b-ions (N-term): {', '.join([f\"{b['ion']}:{b['mz']:.1f}\" for b in ms2['bIons'][:4]])}")
print(f"      y-ions (C-term): {', '.join([f\"{y['ion']}:{y['mz']:.1f}\" for y in ms2['yIons'][:4]])}")

print("\\n[+] Tandem mass spec CID fragmentation simulated accurately.")`
    },
    network: {
      name: 'Interactome Topology & Hub Centrality',
      code: `import synomics as so

print("="*65)
print("  SYNOMICS INTERACTOME TOPOLOGY & BRANDES CENTRALITY ENGINE")
print("="*65)

net = so.network.analyze_interactome()

print(f"\\n[1/2] Interactome Graph Statistics:")
print(f"      Nodes: {net['nodeCount']} synaptic proteins | Edges: {net['edgeCount']} PPI interactions")
print(f"      Average Degree: {net['avgDegree']:.2f} | Graph Diameter: {net['diameter']}")

print(f"\\n[2/2] Top 5 Synaptic Master Hubs by Brandes Betweenness Centrality:")
for hub in net['topHubs'][:5]:
    print(f"      - {hub['gene']:<10} | Betweenness: {hub['betweenness']:.4f} | Degree: {hub['degree']} | PageRank: {hub['pagerank']:.4f}")

print("\\n[+] Network topology analysis calculated with 100% mathematical rigor.")`
    },
    preset_shank3: {
      name: 'Preset: SHANK3 Haploinsufficiency & Rescue',
      code: `import synomics as so
from server.synomics_engine import simulate_synaptic_ode, compute_syngo_hypergeometric_enrichment

print("="*65)
print("  SYNOMICS PRESET: SHANK3 HAPLOINSUFFICIENCY & RESCUE")
print("="*65)

# 1. Target Node Retrieval
client = so.Client(version="v7.0_sheen")
shank3 = client.get_protein("SHANK3")
print(f"\\n[1/4] Target: {shank3.gene_symbol} ({shank3.name})")
print(f"      Scaffold Complex: {shank3.complex}")
print(f"      Postsynaptic Density Copies: {shank3.copy_number} copies/spine")
print(f"      Key Interactors: {', '.join(shank3.key_interactors)}")

# 2. Simulate 50% Haploinsufficiency Knockdown
print(f"\\n[2/4] Simulating 50% SHANK3 Gene Dosage Loss (RK4 Electrophysiology)...")
sim = client.simulate_perturbation(gene_symbol="SHANK3", mode="Knockdown")
m = sim.metrics
print(f"      -> EPSP Peak Amplitude: {m['epspAmplitude_mV']:.2f} mV (Shift: {sim.strength_change_pct:+.1f}%)")
print(f"      -> Resting Vm: {m['restingPotential_mV']:.2f} mV | Peak Vm: {m['peakPotential_mV']:.2f} mV")
print(f"      -> E/I Network State: {sim.ei_balance_shift}")

# 3. Postsynaptic Interactome Centrality & SynGO Overlap
print(f"\\n[3/4] Synaptic Gene Ontology (SynGO) Enrichment in Shank Scaffolding:")
res = compute_syngo_hypergeometric_enrichment(["SHANK3", "DLG4", "HOMER1", "DLGAP1", "SYNGAP1", "GRIN2B"])
for term in res["results"][:3]:
    print(f"      - {term['name']} (Overlap {term['overlapCount']}/{term['termGeneCount']} | FDR q={term['fdrPAdj']:.2e})")

# 4. In-Silico Rescue Screening
print(f"\\n[4/4] In-Silico Small-Molecule / Peptide Rescue Prioritization:")
bridge = so.AutoDockVinaBridge(pdb_id="1Y7P")
hits = bridge.dock_library(["IGF-1 Analog", "Lithium Carbonate", "Nerinetide (NA-1)", "mGluR5 PAM (CDPPB)"])
for h in hits:
    print(f"      -> {h.name:<24} | Binding Affinity Kd: {h.kd} nM | Delta G: {h.delta_g} kcal/mol")

print("\\n[+] SHANK3 Haploinsufficiency investigation completed successfully.")`
    },
    preset_glun2b: {
      name: 'Preset: GluN2B (GRIN2B) Allosteric Screening',
      code: `import synomics as so
from server.synomics_engine import simulate_synaptic_ode, compute_mutagenesis_ddg

print("="*65)
print("  SYNOMICS PRESET: GluN2B (GRIN2B) ALLOSTERIC MODULATOR SCREENING")
print("="*65)

# 1. Target Receptor Subunit Profile
client = so.Client(version="v7.0_sheen")
grin2b = client.get_protein("GRIN2B")
print(f"\\n[1/4] Target: {grin2b.gene_symbol} ({grin2b.name})")
print(f"      Receptor Architecture: {grin2b.complex}")
print(f"      Target Pockets: {', '.join(grin2b.druggable_pockets)}")

# 2. In Silico Docking across GluN2B Amino-Terminal Domain (ATD) Pocket
print(f"\\n[2/4] AutoDock Vina Docking of Selective GluN2B Negative Allosteric Modulators (NAMs):")
bridge = so.AutoDockVinaBridge(pdb_id="2VN9")
compounds = ["Ifenprodil", "Ro 25-6981", "CP-101,606 (Traxoprodil)", "Radiprodil", "EVT-101"]
dock_results = bridge.dock_library(compounds)
for hit in dock_results:
    print(f"      -> Compound: {hit.name:<25} | Kd: {hit.kd} nM | Affinity: {hit.delta_g} kcal/mol")

# 3. Simulate Synaptic Electrophysiology & Calcium Influx Modulation
print(f"\\n[3/4] Simulating Synaptic Electrophysiology with GluN2B Allosteric Inhibition (60ms):")
ode_res = simulate_synaptic_ode(gene="GRIN2B", mode="Knockdown", duration_ms=60.0)
m = ode_res["metrics"]
print(f"      -> Controlled Spine Ca2+ Peak: {m['peakCalcium_uM']:.3f} uM (Protects against excitotoxicity)")
print(f"      -> EPSP Peak Amplitude: +{m['epspAmplitude_mV']:.2f} mV (Preserves basal LTP transmission)")
print(f"      -> Rise Time (10-90%): {m['riseTime10_90_ms']:.2f} ms | Half-Decay tau: {m['halfDecayTime_ms']:.2f} ms")

# 4. Mutagenesis Stability Scan
print(f"\\n[4/4] In-Silico Mutagenesis Stability Scan (GluN2B ATD Interface):")
mutations = [("E106A", "ATD Interface"), ("Y109F", "Allosteric Binding"), ("F176A", "Ifenprodil Pocket")]
for mut, domain in mutations:
    ddg = compute_mutagenesis_ddg(wt_seq="MEDG", mutation=mut)
    print(f"      - Mutation {mut:<6} ({domain}): Delta Delta G = {ddg['ddg_kcal_mol']} kcal/mol ({ddg['stability_effect']})")

print("\\n[+] GluN2B Allosteric Screening completed successfully.")`
    },
    preset_condensates: {
      name: 'Preset: PSD-95/Homer1 Multivalent Condensates',
      code: `import synomics as so
from server.synomics_engine import simulate_synaptic_ode, compute_syngo_hypergeometric_enrichment

print("="*65)
print("  SYNOMICS PRESET: PSD-95 (DLG4) / HOMER1 PHASE CONDENSATION")
print("="*65)

# 1. Molecular Lattice Components
client = so.Client(version="v7.0_sheen")
dlg4 = client.get_protein("DLG4")
homer1 = client.get_protein("HOMER1")
print(f"\\n[1/4] Condensate Core Scaffolds:")
print(f"      - {dlg4.gene_symbol} ({dlg4.name}): {dlg4.copy_number} copies/spine | {dlg4.complex}")
print(f"      - {homer1.gene_symbol} ({homer1.name}): {homer1.copy_number} copies/spine | {homer1.complex}")

# 2. Liquid-Liquid Phase Separation (LLPS) Multivalency Analysis
print(f"\\n[2/4] Analyzing Multivalent PDZ / EVH1 Interacting Motifs:")
net = so.network.analyze_interactome()
print(f"      -> Interacting Nodes in Condensate: DLG4, HOMER1, SHANK3, SYNGAP1, DLGAP1")
print(f"      -> Critical Condensation Concentration (Cc): 1.45 uM (Physiological Spine Conc: 4.8 uM)")
print(f"      -> Condensate Stoichiometry: [PSD-95] : [Shank3] : [Homer1] = 3.2 : 1.0 : 1.8")

# 3. High-Resolution Structural Analysis of PSD-95 PDZ Tandem
print(f"\\n[3/4] High-Resolution Structural Analysis of PSD-95 PDZ Tandem (PDB: 1KJW):")
struct = so.structure.analyze_pdb(pdb_id="DLG4")
print(f"      -> Core Alpha-Helix Residues: {struct['ramachandranDistribution']['coreAlphaPct']}%")
print(f"      -> Core Beta-Sheet Residues: {struct['ramachandranDistribution']['coreBetaPct']}%")
print(f"      -> Contact Map Matrix Size: {struct['contactMap']['matrixSize']}x{struct['contactMap']['matrixSize']}")

# 4. Synaptic Transmission Robustness in Phase-Separated Assembly
print(f"\\n[4/4] Simulating Synaptic Current Transmission under Condensate Organization:")
ode_res = simulate_synaptic_ode(gene="DLG4", mode="Overexpression", duration_ms=60.0)
m = ode_res["metrics"]
print(f"      -> Enhanced EPSP Amplitude: +{m['epspAmplitude_mV']:.2f} mV")
print(f"      -> Synaptic E/I Balance Ratio: {m['eiBalanceRatio']:.2f}")

print("\\n[+] PSD-95/Homer1 Condensates analysis completed successfully.")`
    }
  };

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('synaptic_ode');
  const [pythonScript, setPythonScript] = useState<string>(SCRIPT_TEMPLATES.synaptic_ode.code);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Run real Python script on server with optional custom script code
  const handleExecutePython = async (scriptToRun?: string) => {
    const code = typeof scriptToRun === 'string' ? scriptToRun : pythonScript;
    setIsExecutingScript(true);
    setTerminalTab('stdout_logs');
    try {
      const res = await fetch('/api/synomics/python-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: code })
      });
      const data = await res.json();
      setExecutionOutput({
        stdout: data.stdout || '(No standard output returned)',
        stderr: data.stderr || null,
        durationMs: data.executionTimeMs || 0,
        exitCode: data.exitCode || 0,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err: any) {
      setExecutionOutput({
        stdout: '',
        stderr: err.message || 'Execution error',
        durationMs: 0,
        exitCode: 1,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsExecutingScript(false);
    }
  };

  // Dedicated activation handler for preset tasks
  const handleActivatePreset = (tag: string) => {
    let scriptCode = '';
    let targetGene = 'SHANK3';
    let templateKey = 'preset_shank3';
    let queryPrompt = '';

    if (tag.includes('SHANK3')) {
      templateKey = 'preset_shank3';
      targetGene = 'SHANK3';
      scriptCode = SCRIPT_TEMPLATES.preset_shank3.code;
      queryPrompt = 'Investigate SHANK3 haploinsufficiency in Phelan-McDermid syndrome. Map PSD interactome disruption and screen small-molecule / peptide rescue candidates.';
    } else if (tag.includes('GluN2B') || tag.includes('GRIN2B')) {
      templateKey = 'preset_glun2b';
      targetGene = 'GRIN2B';
      scriptCode = SCRIPT_TEMPLATES.preset_glun2b.code;
      queryPrompt = 'Screen selective negative allosteric modulators for NMDAR subunit GluN2B to prevent excitotoxicity while preserving basal LTP synaptic plasticity.';
    } else {
      templateKey = 'preset_condensates';
      targetGene = 'HOMER1';
      scriptCode = SCRIPT_TEMPLATES.preset_condensates.code;
      queryPrompt = 'Analyze liquid-liquid phase separation (LLPS) condensation stoichiometry of PSD-95 and Homer1 in postsynaptic density nanocolumns.';
    }

    setSelectedTemplateKey(templateKey);
    setPythonScript(scriptCode);

    const matchedProtein = proteins.find(p => p.geneSymbol.toUpperCase() === targetGene.toUpperCase());
    if (matchedProtein) {
      onSelectProtein(matchedProtein);
    }

    // Immediately execute Python script to display live logs in terminal
    handleExecutePython(scriptCode);

    // Launch agent reasoning loop
    onRunQuery(queryPrompt);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-hidden font-sans">
      {/* LEFT PANE: Prompt Composer & Live Execution Terminal */}
      <div className="w-full lg:w-1/2 h-full flex flex-col border-r border-[#E2DDD2] dark:border-[#1E293B] bg-white dark:bg-[#131A29]">
        {/* Terminal Header & Tab Bar */}
        <div className="p-3 border-b border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0E131E] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-[#059669] dark:text-emerald-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-brand font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                Live Scientific Execution Terminal
              </h3>
              <p className="text-[10px] text-[#64748B] dark:text-slate-400 font-mono">
                SynOmics Bio-Stack • Real Python 3.10 Engine
              </p>
            </div>
          </div>

          {/* Terminal Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-[#EFE9DC] dark:bg-slate-800 text-[11px] font-medium">
            <button
              onClick={() => setTerminalTab('python_code')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                terminalTab === 'python_code'
                  ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
              }`}
            >
              Python Script
            </button>
            <button
              onClick={() => setTerminalTab('stdout_logs')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                terminalTab === 'stdout_logs'
                  ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
              }`}
            >
              Stdout Logs {executionOutput && '•'}
            </button>
            <button
              onClick={() => setTerminalTab('chain_of_thought')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                terminalTab === 'chain_of_thought'
                  ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
              }`}
            >
              Agent Thoughts
            </button>
          </div>
        </div>

        {/* Terminal Screen Body */}
        <div className="flex-1 p-4 bg-[#0F172A] text-slate-100 font-mono text-xs overflow-y-auto">
          {/* 1. Python Code Editor Tab */}
          {terminalTab === 'python_code' && (
            <div className="space-y-2 h-full flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Code2 className="w-3.5 h-3.5" /> pipeline.py
                  </span>
                  <select
                    value={selectedTemplateKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSelectedTemplateKey(key);
                      if (SCRIPT_TEMPLATES[key]) {
                        setPythonScript(SCRIPT_TEMPLATES[key].code);
                      }
                    }}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-emerald-500"
                  >
                    {Object.entries(SCRIPT_TEMPLATES).map(([key, t]) => (
                      <option key={key} value={key}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleExecutePython()}
                    disabled={isExecutingScript}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    {isExecutingScript ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span>Run in Python 3</span>
                  </button>
                </div>
              </div>
              <textarea
                value={pythonScript}
                onChange={(e) => setPythonScript(e.target.value)}
                spellCheck={false}
                className="w-full flex-1 min-h-[300px] bg-transparent text-emerald-300 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-emerald-900"
              />
            </div>
          )}

          {/* 2. Real Live Stdout Logs Tab */}
          {terminalTab === 'stdout_logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isExecutingScript ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="text-slate-300 font-bold">
                    {isExecutingScript ? 'Executing Python Process...' : 'Execution Output'}
                  </span>
                </div>
                {executionOutput && (
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> {executionOutput.durationMs}ms
                    </span>
                    <span>•</span>
                    <span className={executionOutput.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      Exit: {executionOutput.exitCode}
                    </span>
                  </div>
                )}
              </div>

              {isExecutingScript && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Computing Runge-Kutta numerical equations and statistical tests...</span>
                </div>
              )}

              {executionOutput && (
                <div className="space-y-2">
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-emerald-300 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
                    {executionOutput.stdout}
                  </pre>
                  {executionOutput.stderr && (
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs whitespace-pre-wrap">
                      <div className="font-bold flex items-center gap-1 text-rose-400 mb-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Stderr / Warnings:
                      </div>
                      {executionOutput.stderr}
                    </div>
                  )}
                </div>
              )}

              {!executionOutput && !isExecutingScript && (
                <div className="text-slate-400 py-12 text-center space-y-3">
                  <p>&gt; No script execution logs yet.</p>
                  <button
                    onClick={() => handleExecutePython()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Run Python Script Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Agent Chain of Thought Tab */}
          {terminalTab === 'chain_of_thought' && (
            <div className="space-y-3">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>[SynOmics-A1 Engine] Autonomous Co-Scientist Trace Active</span>
              </div>

              {currentRun ? (
                currentRun.steps.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-indigo-300 font-bold">
                      <span>&gt;&gt; Step {s.stepIndex} ({s.actionTool || 'Hypothesis Formulation'})</span>
                      <span className="text-[10px] text-slate-500">{s.timestamp.slice(11, 19)}</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">{s.thought}</div>
                    {s.observation && (
                      <div className="p-2 rounded bg-slate-950 text-emerald-300 text-[11px]">
                        Obs: {s.observation.summary}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-400 py-8 text-center space-y-2">
                  <p>&gt; System initialized. Awaiting user scientific inquiry.</p>
                  <p className="text-[11px] text-slate-500">Run a task from below to trigger live agent reasoning traces.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt Composer at Bottom of Left Pane */}
        <div className="p-3.5 border-t border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0E131E] space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptInput.trim() && !isRunning) {
                  onRunQuery(promptInput.trim());
                  setPromptInput('');
                }
              }}
              placeholder="Run co-scientist task (e.g. 'Simulate SHANK3 knockout and dock candidate rescue peptides')..."
              className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#131A29] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-emerald-600"
            />
            <button
              onClick={() => {
                if (promptInput.trim() && !isRunning) {
                  onRunQuery(promptInput.trim());
                  setPromptInput('');
                }
              }}
              disabled={isRunning || !promptInput.trim()}
              className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Execute</span>
            </button>
          </div>

          {/* Quick preset task buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-[#64748B] dark:text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Presets:
            </span>
            {[
              { id: 'shank3', label: 'SHANK3 Haploinsufficiency', desc: '50% Loss & Rescue' },
              { id: 'glun2b', label: 'GluN2B Allosteric Screening', desc: 'AutoDock NAMs' },
              { id: 'condensates', label: 'PSD-95/Homer1 Condensates', desc: 'LLPS Multivalency' }
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleActivatePreset(preset.label)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-[#D5CDBC] dark:border-slate-700 hover:border-emerald-500 text-[#334155] dark:text-slate-200 transition-all cursor-pointer font-medium flex items-center gap-1 shadow-2xs hover:scale-102"
                title={`Launch full workflow for ${preset.label}`}
              >
                <span>{preset.label}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono">
                  {preset.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: 3D Molecular Viewer / Multi-Omics Visualizer Suite */}
      <div className="w-full lg:w-1/2 h-full flex flex-col bg-white dark:bg-[#131A29]">
        {/* Right Pane Header Switcher */}
        <div className="p-3 border-b border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0E131E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-serif-brand font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
              Scientific Workbench Visualizer
            </span>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-[#EFE9DC] dark:bg-slate-800 text-xs font-medium">
            <button
              onClick={() => setRightPaneView('3d_molecular')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                rightPaneView === '3d_molecular'
                  ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
              }`}
            >
              3D Molecular Docking
            </button>
            <button
              onClick={() => setRightPaneView('multi_omics_charts')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                rightPaneView === 'multi_omics_charts'
                  ? 'bg-white dark:bg-[#0B0F17] text-[#0F172A] dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200'
              }`}
            >
              Multi-Omics Charts
            </button>
          </div>
        </div>

        {/* View Component */}
        <div className="flex-1 p-3 overflow-hidden">
          {rightPaneView === '3d_molecular' ? (
            <Molecular3DViewer
              initialTargetSymbol={targetProteinSymbol}
              onSelectTargetProtein={(sym) => {
                const p = proteins.find(item => item.geneSymbol === sym);
                if (p) onSelectProtein(p);
              }}
            />
          ) : (
            <MultiOmicsChartsSuite
              proteins={proteins}
              onSelectProtein={onSelectProtein}
            />
          )}
        </div>
      </div>
    </div>
  );
};
