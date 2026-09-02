import React, { useState } from 'react';
import { 
  Network, 
  Play, 
  CheckCircle2, 
  Clock, 
  Code2, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Layers, 
  ArrowRight,
  Terminal,
  Cpu,
  FileCode,
  Box
} from 'lucide-react';

interface DagWorkflowStudioProps {
  onRunQuery?: (q: string) => void;
}

interface WorkflowNode {
  id: string;
  name: string;
  category: 'qc' | 'alignment' | 'quantification' | 'structural' | 'enrichment';
  container: string;
  status: 'completed' | 'running' | 'queued' | 'idle';
  threads: number;
  outputArtifact: string;
  description: string;
}

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: 'node-1',
    name: 'FASTQ Quality Trimming (fastp)',
    category: 'qc',
    container: 'quay.io/biocontainers/fastp:0.23.4',
    status: 'completed',
    threads: 8,
    outputArtifact: 'trimmed_reads_1.fq.gz',
    description: 'Auto-detects Illumina NovaSeq adapters, polyG/polyX tails, and filters low-Q bases.'
  },
  {
    id: 'node-2',
    name: 'Splice-Aware Alignment (STAR 2.7)',
    category: 'alignment',
    container: 'quay.io/biocontainers/star:2.7.10b',
    status: 'completed',
    threads: 16,
    outputArtifact: 'aligned.sorted.bam',
    description: 'Aligns paired-end reads to human GRCh38.p13 primary assembly with GENCODE v44 annotations.'
  },
  {
    id: 'node-3',
    name: 'DESeq2 Negative Binomial Wald Test',
    category: 'quantification',
    container: 'bioconductor/bioconductor_docker:3.18',
    status: 'completed',
    threads: 4,
    outputArtifact: 'differential_expression.csv',
    description: 'Applies median-of-ratios size-factor normalization and parametric dispersion shrinkage.'
  },
  {
    id: 'node-4',
    name: 'GSEA Pathway & Gene Ontology Overlap',
    category: 'enrichment',
    container: 'bioconductor/clusterprofiler:latest',
    status: 'running',
    threads: 4,
    outputArtifact: 'pathway_enrichment.json',
    description: 'Calculates overrepresentation p-values and normalized enrichment scores across MSigDB Hallmarks, KEGG, and Reactome.'
  },
  {
    id: 'node-5',
    name: 'Rosetta-Grade In-Silico Mutagenesis (ΔΔG)',
    category: 'structural',
    container: 'rosettacommons/rosetta:latest',
    status: 'queued',
    threads: 16,
    outputArtifact: 'mutational_ddg_energy.json',
    description: 'Computes free energy changes (kcal/mol) for ClinVar and COSMIC missense variants.'
  }
];

export const DagWorkflowStudio: React.FC<DagWorkflowStudioProps> = () => {
  const [nodes, setNodes] = useState<WorkflowNode[]>(DEFAULT_NODES);
  const [activeTab, setActiveTab] = useState<'visual_dag' | 'nextflow_code' | 'snakemake_code'>('visual_dag');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executionTelemetry, setExecutionTelemetry] = useState<any>(null);

  const handleExecuteDag = async () => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/synomics/dag-workflow-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          sampleInput: {
            readsPath: 's3://bio-data-vault/raw/*_{1,2}.fastq.gz',
            genomeRef: 'GRCh38.p13',
            outDir: 'results/multiomics_pipeline'
          }
        })
      });
      const data = await res.json();
      if (data.generatedScripts) {
        setExecutionTelemetry(data);
      }
    } catch (err) {
      console.error('DAG execution failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const nextflowCode = executionTelemetry?.generatedScripts?.nextflow || `#!/usr/bin/env nextflow
nextflow.enable.dsl = 2

params.reads = "data/raw/*_{1,2}.fastq.gz"
params.genome = "data/reference/GRCh38.p13.fa"
params.outdir = "results/multiomics_pipeline"

process FASTQC_TRIM {
    tag "$sample_id"
    publishDir "\${params.outdir}/qc", mode: 'copy'
    container 'quay.io/biocontainers/fastp:0.23.4--hadf994e_0'

    input:
    tuple val(sample_id), path(reads)

    output:
    tuple val(sample_id), path("\${sample_id}_trimmed_{1,2}.fq.gz"), emit: trimmed_reads

    script:
    """
    fastp -i \${reads[0]} -I \${reads[1]} \\
          -o \${sample_id}_trimmed_1.fq.gz -O \${sample_id}_trimmed_2.fq.gz
    """
}

process STAR_ALIGN_QUANT {
    tag "$sample_id"
    publishDir "\${params.outdir}/aligned", mode: 'copy'
    container 'quay.io/biocontainers/star:2.7.10b--h9ee0642_0'

    input:
    tuple val(sample_id), path(reads)
    path(genome_dir)

    output:
    tuple val(sample_id), path("\${sample_id}.bam"), emit: bam
    path("\${sample_id}ReadsPerGene.out.tab"), emit: counts

    script:
    """
    STAR --genomeDir \${genome_dir} \\
         --readFilesIn \${reads[0]} \${reads[1]} \\
         --readFilesCommand zcat \\
         --outSAMtype BAM SortedByCoordinate \\
         --quantMode GeneCounts
    """
}

workflow {
    read_pairs_ch = Channel.fromFilePairs(params.reads)
    FASTQC_TRIM(read_pairs_ch)
    STAR_ALIGN_QUANT(FASTQC_TRIM.out.trimmed_reads, file(params.genome))
}`;

  const snakemakeCode = executionTelemetry?.generatedScripts?.snakemake || `"""
Universal Multi-Omics Snakemake High-Performance Computing (HPC) Workflow
"""
rule all:
    input:
        "results/multiomics_pipeline/differential_expression/deseq2_results.csv",
        "results/multiomics_pipeline/structural_energetics/mutational_ddg_scores.json"

rule fastp_qc:
    input:
        r1="data/raw/{sample}_1.fastq.gz",
        r2="data/raw/{sample}_2.fastq.gz"
    output:
        r1="data/trimmed/{sample}_1.fq.gz",
        r2="data/trimmed/{sample}_2.fq.gz"
    threads: 8
    shell:
        "fastp -i {input.r1} -I {input.r2} -o {output.r1} -O {output.r2}"
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-sm">
              <Network className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Galaxy / Nextflow Visual DAG Scientific Workflow Studio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Nextflow DSL2 & Snakemake Compiler
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Visually chain raw sequencing data to QC, splice-aware alignment, differential expression, and structural in-silico mutagenesis. Generates production-ready, containerized pipeline code for cloud HPC clusters (AWS Batch, GCP Life Sciences, SLURM).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecuteDag}
            disabled={isExecuting}
            className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Executing DAG Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Compile & Execute DAG</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('visual_dag')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'visual_dag'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Interactive DAG Flowchart</span>
        </button>

        <button
          onClick={() => setActiveTab('nextflow_code')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'nextflow_code'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Nextflow DSL2 (.nf)</span>
        </button>

        <button
          onClick={() => setActiveTab('snakemake_code')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'snakemake_code'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Snakemake (.smk)</span>
        </button>
      </div>

      {/* View: Visual DAG Flowchart */}
      {activeTab === 'visual_dag' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className="bg-white dark:bg-[#131A29] p-4 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col justify-between space-y-3 relative group hover:border-sky-500 transition-all"
              >
                {/* Step Marker */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Step 0{index + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    node.status === 'completed'
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : node.status === 'running'
                      ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {node.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {node.status === 'running' && <Clock className="w-2.5 h-2.5" />}
                    <span className="capitalize">{node.status}</span>
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug">{node.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-3">{node.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono space-y-1">
                  <div className="text-slate-400 truncate">Image: {node.container}</div>
                  <div className="text-sky-600 dark:text-sky-400 font-bold truncate">Out: {node.outputArtifact}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline Telemetry Card */}
          <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-sky-600" />
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">HPC Compute Profile</h4>
                <p className="text-xs text-slate-500">Estimated runtime: 18m 42s across 16 CPUs • Multi-Threaded Slurm/AWS Batch compatible</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-mono font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Containers: Docker / Singularity
              </span>
            </div>
          </div>
        </div>
      )}

      {/* View: Nextflow Code */}
      {activeTab === 'nextflow_code' && (
        <div className="bg-[#0D1117] p-5 rounded-2xl border border-slate-800 shadow-md relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-xs font-mono font-bold text-slate-400">main.nf (Nextflow DSL2)</span>
            <button
              onClick={() => copyToClipboard(nextflowCode)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Nextflow Script'}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[480px]">
            {nextflowCode}
          </pre>
        </div>
      )}

      {/* View: Snakemake Code */}
      {activeTab === 'snakemake_code' && (
        <div className="bg-[#0D1117] p-5 rounded-2xl border border-slate-800 shadow-md relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-xs font-mono font-bold text-slate-400">Snakefile (Snakemake 7.32)</span>
            <button
              onClick={() => copyToClipboard(snakemakeCode)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Snakemake File'}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-sky-400 overflow-x-auto leading-relaxed max-h-[480px]">
            {snakemakeCode}
          </pre>
        </div>
      )}
    </div>
  );
};
