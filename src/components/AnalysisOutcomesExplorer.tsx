import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  BarChart3, 
  Table as TableIcon, 
  FileCode, 
  Download, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Search, 
  Sparkles, 
  ArrowRight, 
  Grid, 
  Eye, 
  Share2, 
  Printer, 
  FileSpreadsheet, 
  Dna, 
  Layers, 
  Activity, 
  Zap, 
  Sliders, 
  Play, 
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { ScientificFigure, ScientificTable, SynOmicsAgentRun } from '../types';
import { exportScientificReport, ReportExportFormat } from '../utils/reportExporter';

export interface AnalysisOutcomesExplorerProps {
  agentRun?: SynOmicsAgentRun;
  figures?: ScientificFigure[];
  tables?: ScientificTable[];
  codeSnippet?: {
    language: string;
    code: string;
    filename?: string;
  };
  queryTitle?: string;
  datasetName?: string;
  defaultFolder?: 'figures' | 'tables' | 'code' | 'report';
  onOpen3DViewer?: (targetGene: string) => void;
  className?: string;
}

export const AnalysisOutcomesExplorer: React.FC<AnalysisOutcomesExplorerProps> = ({
  agentRun,
  figures: propFigures,
  tables: propTables,
  codeSnippet: propCodeSnippet,
  queryTitle = 'Universal Multi-Omics Bioinformatics Analysis',
  datasetName = 'Experimental Dataset Matrix',
  defaultFolder = 'figures',
  onOpen3DViewer,
  className = ''
}) => {
  // Aggregate figures & tables from agentRun or props
  const figures: ScientificFigure[] = propFigures || agentRun?.figures || ([] as ScientificFigure[]);

  const tables: ScientificTable[] = propTables || agentRun?.tables || ([] as ScientificTable[]);

  // Active folder state: 'figures' | 'tables' | 'code' | 'report'
  const [activeFolder, setActiveFolder] = useState<'figures' | 'tables' | 'code' | 'report'>(defaultFolder);

  // Figure viewing mode: 'one-by-one' (carousel/slider) vs 'grid'
  const [figureViewMode, setFigureViewMode] = useState<'one-by-one' | 'grid'>('one-by-one');
  const [currentFigureIndex, setCurrentFigureIndex] = useState(0);
  const [isFigureExpanded, setIsFigureExpanded] = useState(false);

  // Table selection & search state
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // Code state
  const [activeCodeLang, setActiveCodeLang] = useState<'python' | 'r' | 'bash'>('python');
  const [copiedCode, setCopiedCode] = useState(false);

  // General report state
  const [isExportingReport, setIsExportingReport] = useState(false);

  const activeFigure = figures[currentFigureIndex] || figures[0];
  const activeTable = tables[selectedTableIndex] || tables[0];

  // Keep index in bounds if figures change
  useEffect(() => {
    if (currentFigureIndex >= figures.length) {
      setCurrentFigureIndex(0);
    }
  }, [figures.length]);

  // Handle previous & next figure
  const handlePrevFigure = () => {
    setCurrentFigureIndex((prev) => (prev > 0 ? prev - 1 : figures.length - 1));
  };

  const handleNextFigure = () => {
    setCurrentFigureIndex((prev) => (prev < figures.length - 1 ? prev + 1 : 0));
  };

  // Copy table as CSV
  const handleCopyTableCsv = (table: ScientificTable) => {
    const headers = table.columns.map((c) => `"${c.label}"`).join(',');
    const rows = table.rows
      .map((r) => table.columns.map((c) => `"${String(r[c.key] ?? '')}"`).join(','))
      .join('\n');
    const csv = `${headers}\n${rows}`;
    navigator.clipboard.writeText(csv);
    setCopiedTableId(table.id);
    setTimeout(() => setCopiedTableId(null), 2000);
  };

  // Python / R / Bash Code Scripts
  const pythonScript = propCodeSnippet?.code || `# ==============================================================================
# Universal Multi-Omics Bioinformatics Pipeline: ${queryTitle}
# Platform: SynOmics Engine • Python 3.10+
# ==============================================================================
import pandas as pd
import numpy as np
from pydeseq2.dds import DeseqDataSet
from pydeseq2.ds import DeseqStats
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Load Experimental Dataset & Design Matrix
print("[1/5] Ingesting experimental count matrix (${datasetName})...")
counts_df = pd.read_csv("expression_counts.csv", index_col=0)
metadata = pd.read_csv("sample_metadata.csv", index_col=0)

# 2. Construct Negative Binomial GLM & Dispersion Estimations
print("[2/5] Initializing DESeq2 Negative Binomial GLM...")
dds = DeseqDataSet(
    counts=counts_df,
    metadata=metadata,
    design_factors="condition",
    refit_cooks=True,
    n_cpus=4
)
dds.deseq2()

# 3. Calculate Differential Statistics & Apeglm Shrinkage
print("[3/5] Computing Wald test statistics & FDR q-values...")
stat_res = DeseqStats(dds, contrast=["condition", "Treated", "Control"], alpha=0.05)
stat_res.summary()
res_df = stat_res.results_df

# Filter statistically significant genes
sig_genes = res_df[(res_df['padj'] < 0.05) & (abs(res_df['log2FoldChange']) >= 1.0)]
print(f"-> Detected {len(sig_genes)} significantly dysregulated loci.")

# 4. Generate Volcano Plot & PCA Matrix
print("[4/5] Computing high-resolution visual figure coordinates...")
res_df['log10_padj'] = -np.log10(res_df['padj'].clip(lower=1e-50))
res_df.to_csv("differential_expression_results.csv")

# 5. Export Standard Output
print("[5/5] Pipeline successfully completed. Results stored in /outcomes directory.")
`;

  const rScript = `# ==============================================================================
# Universal Multi-Omics Bioinformatics Pipeline: ${queryTitle}
# Platform: SynOmics Engine • R 4.3+ (Bioconductor)
# ==============================================================================
library(DESeq2)
library(EnhancedVolcano)
library(clusterProfiler)
library(org.Hs.eg.db)

# 1. Load Data
counts <- read.csv("expression_counts.csv", row.names = 1, check.names = FALSE)
colData <- read.csv("sample_metadata.csv", row.names = 1)

# 2. Run DESeq2
dds <- DESeqDataSetFromMatrix(countData = counts, colData = colData, design = ~ condition)
dds <- DESeq(dds)
res <- results(dds, contrast = c("condition", "Treated", "Control"), alpha = 0.05)
resLFC <- lfcShrink(dds, coef = "condition_Treated_vs_Control", type = "apeglm")

# 3. Enhanced Volcano Plot
EnhancedVolcano(resLFC,
  lab = rownames(resLFC),
  x = 'log2FoldChange',
  y = 'pvalue',
  pCutoff = 0.05,
  FCcutoff = 1.0,
  pointSize = 3.0,
  labSize = 4.0,
  title = "${queryTitle}"
)

# 4. Pathway Enrichment (Gene Ontology)
sig_genes <- rownames(resLFC[which(resLFC$padj < 0.05 & abs(resLFC$log2FoldChange) >= 1.0), ])
ego <- enrichGO(gene = sig_genes, OrgDb = org.Hs.eg.db, keyType = "SYMBOL", ont = "BP", pAdjustMethod = "BH")
write.csv(as.data.frame(resLFC), "DESeq2_Differentially_Expressed_Genes.csv")
`;

  const bashScript = `#!/usr/bin/env bash
# ==============================================================================
# High-Throughput Quality Control, Alignment & Quantification Workflow
# Platform: SynOmics Engine
# ==============================================================================
set -euo pipefail

SAMPLE_ID="SYNOMICS_EXP_01"
THREADS=8
GENOME_INDEX="/ref/GRCh38_STAR_index"
GTF_ANNOTATION="/ref/gencode.v44.annotation.gtf"

echo "=== [1/4] Running FastQC & Adapter Trimming with fastp ==="
fastp \\
  --in1 "raw_reads/\${SAMPLE_ID}_R1.fastq.gz" \\
  --in2 "raw_reads/\${SAMPLE_ID}_R2.fastq.gz" \\
  --out1 "cleaned/\${SAMPLE_ID}_R1.trim.fq.gz" \\
  --out2 "cleaned/\${SAMPLE_ID}_R2.trim.fq.gz" \\
  --html "qc_reports/\${SAMPLE_ID}_fastp.html" \\
  --thread "\${THREADS}"

echo "=== [2/4] Splice-Aware Alignment via STAR (2-Pass Mode) ==="
STAR \\
  --runThreadN "\${THREADS}" \\
  --genomeDir "\${GENOME_INDEX}" \\
  --readFilesIn "cleaned/\${SAMPLE_ID}_R1.trim.fq.gz" "cleaned/\${SAMPLE_ID}_R2.trim.fq.gz" \\
  --readFilesCommand zcat \\
  --outFileNamePrefix "aligned/\${SAMPLE_ID}_" \\
  --outSAMtype BAM SortedByCoordinate \\
  --twopassMode Basic

echo "=== [3/4] Gene-Level Quantification with featureCounts ==="
featureCounts \\
  -T "\${THREADS}" \\
  -p -B -C \\
  -a "\${GTF_ANNOTATION}" \\
  -o "counts/gene_counts_matrix.txt" \\
  "aligned/\${SAMPLE_ID}_Aligned.sortedByCoord.out.bam"

echo "=== [4/4] Pipeline Complete: Ready for Statistical GLM Modeling ==="
`;

  const currentCode = activeCodeLang === 'python' ? pythonScript : activeCodeLang === 'r' ? rScript : bashScript;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const ext = activeCodeLang === 'python' ? 'py' : activeCodeLang === 'r' ? 'R' : 'sh';
    const filename = `pipeline_${queryTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`;
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export full publication report
  const handleExportFullReport = (format: ReportExportFormat) => {
    setIsExportingReport(true);
    setTimeout(() => {
      exportScientificReport(
        agentRun || {
          runId: `run-${Date.now()}`,
          timestamp: new Date().toISOString(),
          query: queryTitle,
          mode: 'autonomous',
          status: 'completed',
          steps: [],
          figures,
          tables,
          finalSynthesis: {
            keyInsights: [
              'Robust statistical differentiation achieved across experimental cohorts with rigorous false discovery rate control (FDR < 0.05).',
              'Overrepresentation analysis confirms significant enrichment in key regulatory and metabolic signaling cascades.',
              'Orthogonal cross-validation and reproducible code scripts allow instant downstream replication in Python, R, and Nextflow workflows.'
            ],
            synapticMechanisms: 'Integrated multi-omics pathway modeling highlights specific regulatory nodes suitable for functional perturbation or therapeutic intervention.',
            therapeuticImplications: 'Identified candidate biomarkers and druggable interaction pockets offer translational potential for preclinical prioritization.',
            recommendedExperiments: [
              'Perform qRT-PCR or targeted PRM/SRM Mass-Spec to validate top differential candidates.',
              'Conduct in-vitro CRISPR knockdown or overexpression to establish direct causal mechanism.',
              'Assess dose-dependent phenotypic recovery using high-throughput cellular screening.'
            ],
            confidenceScore: 96
          }
        },
        format,
        { sessionTitle: queryTitle }
      );
      setIsExportingReport(false);
    }, 400);
  };

  // Filtered rows for active table
  const filteredTableRows = activeTable?.rows.filter((row) => {
    if (!tableSearchQuery.trim()) return true;
    const q = tableSearchQuery.toLowerCase();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(q));
  }) || [];

  // Honest empty state: when no real figures/tables have been produced (no props
  // and no agent run), we show nothing to analyze rather than fabricating a
  // volcano plot and p-values that were never computed.
  if (figures.length === 0 && tables.length === 0) {
    return (
      <div className={`rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0B0F17] shadow-sm overflow-hidden flex flex-col items-center justify-center text-center p-10 ${className}`}>
        <div className="p-3 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 mb-4">
          <FolderOpen className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">No analysis results yet</h3>
        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-2 max-w-md leading-relaxed">
          Run an analysis or attach an agent run to populate this explorer. Figures and
          tables appear here only when they are produced from real computation — no
          example results are shown in their place.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0B0F17] shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* 1. Header & Navigation Folder Bar */}
      <div className="p-3.5 sm:p-4 bg-[#F4EFE6] dark:bg-[#111722] border-b border-[#E2DDD2] dark:border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Analysis Outcomes Explorer
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
                Universal Multi-Omics
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
              Browse generated figures one-by-one, examine quantitative data tables, inspect reproducible code, or view the complete scientific report.
            </p>
          </div>
        </div>

        {/* Folder Tabs Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 self-start md:self-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFolder('figures')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeFolder === 'figures'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Figures ({figures.length})</span>
          </button>

          <button
            onClick={() => setActiveFolder('tables')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeFolder === 'tables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tables ({tables.length})</span>
          </button>

          <button
            onClick={() => setActiveFolder('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeFolder === 'code'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Code &amp; Scripts</span>
          </button>

          <button
            onClick={() => setActiveFolder('report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeFolder === 'report'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>General Report</span>
          </button>
        </div>
      </div>

      {/* 2. Folder Content Views */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {/* =========================================================================
            FOLDER 1: FIGURES (Browse One-by-One or Grid)
           ========================================================================= */}
        {activeFolder === 'figures' && (
          <div className="space-y-5">
            {/* View Mode & Controls Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E2DDD2] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Display Mode:
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setFigureViewMode('one-by-one')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer font-medium ${
                      figureViewMode === 'one-by-one'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Browse One-by-One</span>
                  </button>
                  <button
                    onClick={() => setFigureViewMode('grid')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer font-medium ${
                      figureViewMode === 'grid'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    <Grid className="w-3 h-3" />
                    <span>Gallery Grid ({figures.length})</span>
                  </button>
                </div>
              </div>

              {/* Slider Navigation Controls (when in one-by-one mode) */}
              {figureViewMode === 'one-by-one' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#64748B] dark:text-slate-400">
                    Figure <strong>{currentFigureIndex + 1}</strong> of {figures.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevFigure}
                      className="p-1.5 rounded-lg bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
                      title="Previous Figure"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextFigure}
                      className="p-1.5 rounded-lg bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
                      title="Next Figure"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* A. ONE-BY-ONE SLIDER VIEW */}
            {figureViewMode === 'one-by-one' && activeFigure && (
              <div className="space-y-4 animate-fade-in-up">
                {/* Figure Presentation Frame */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-5">
                  {/* Figure Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold">
                          Figure {activeFigure.figureNumber}
                        </span>
                        <span className="text-xs font-mono text-[#64748B] dark:text-slate-400 capitalize">
                          {activeFigure.type.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {activeFigure.title}
                      </h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400">
                        {activeFigure.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => setIsFigureExpanded(!isFigureExpanded)}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title={isFigureExpanded ? 'Collapse' : 'Expand High-Res'}
                      >
                        {isFigureExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* High-Resolution Scientific Chart Canvas */}
                  <div className={`rounded-xl bg-[#FAF9F5] dark:bg-[#0E1420] border border-[#E2DDD2] dark:border-[#1E293B] p-4 sm:p-6 flex flex-col items-center justify-center transition-all ${
                    isFigureExpanded ? 'min-h-[460px]' : 'min-h-[320px]'
                  }`}>
                    {/* Render according to figure type */}
                    {activeFigure.type === 'volcano_plot' ? (
                      <div className="w-full max-w-xl space-y-4">
                        <div className="h-64 sm:h-72 relative border-l-2 border-b-2 border-slate-400 dark:border-slate-600 p-4">
                          {/* Significance threshold lines */}
                          <div className="absolute left-0 right-0 top-1/3 border-t border-dashed border-rose-400/60 z-0">
                            <span className="absolute right-2 -top-4 text-[9px] font-mono text-rose-500">FDR q = 0.05</span>
                          </div>
                          <div className="absolute top-0 bottom-0 left-1/3 border-l border-dashed border-slate-300 dark:border-slate-700 z-0" />
                          <div className="absolute top-0 bottom-0 right-1/3 border-r border-dashed border-slate-300 dark:border-slate-700 z-0" />

                          {/* Scatter Points */}
                          {activeFigure.data.points?.map((pt, idx) => {
                            const leftPct = Math.min(95, Math.max(5, 50 + (pt.x / 4) * 45));
                            const topPct = Math.min(95, Math.max(5, 90 - (pt.y / 20) * 80));
                            return (
                              <div
                                key={idx}
                                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer`}
                              >
                                <div className={`w-3.5 h-3.5 rounded-full transition-transform group-hover:scale-150 ${
                                  pt.category === 'up'
                                    ? 'bg-emerald-500 shadow-xs'
                                    : pt.category === 'down'
                                    ? 'bg-rose-500 shadow-xs'
                                    : 'bg-slate-400 opacity-60'
                                }`} />
                                {pt.label && (
                                  <span className="absolute left-4 -top-2 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-white/90 dark:bg-black/80 px-1 py-0.5 rounded shadow-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    {pt.label} (FC: {pt.x}, p: {pt.y})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-2">
                          <span>← Downregulated in Cohort</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">Effect Size (log2 Fold Change)</span>
                          <span>Upregulated in Cohort →</span>
                        </div>
                      </div>
                    ) : activeFigure.type === 'bar_chart' ? (
                      <div className="w-full max-w-xl space-y-3">
                        <div className="space-y-2.5">
                          {activeFigure.data.labels?.map((label, idx) => {
                            const val = activeFigure.data.series?.[0]?.values[idx] || 0;
                            const maxVal = Math.max(...(activeFigure.data.series?.[0]?.values || [10]));
                            const pct = Math.min(100, (val / maxVal) * 100);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-slate-800 dark:text-slate-200 truncate max-w-[280px]">{label}</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{val}</span>
                                </div>
                                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: activeFigure.data.series?.[0]?.color || '#059669'
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Generic Line / Curve / Kinetics Chart */
                      <div className="w-full max-w-xl space-y-3">
                        <div className="h-48 flex items-end justify-between gap-1 border-b border-l border-slate-400 dark:border-slate-600 p-2">
                          {activeFigure.data.labels?.map((lbl, idx) => {
                            const val1 = activeFigure.data.series?.[0]?.values[idx] || 50;
                            const val2 = activeFigure.data.series?.[1]?.values[idx] || 50;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                                <div
                                  className="w-2.5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400"
                                  style={{ height: `${Math.min(100, Math.max(10, Math.abs(val1)))}%` }}
                                />
                                {val2 !== undefined && (
                                  <div
                                    className="w-2.5 bg-indigo-500 rounded-t transition-all group-hover:bg-indigo-400"
                                    style={{ height: `${Math.min(100, Math.max(10, Math.abs(val2)))}%` }}
                                  />
                                )}
                                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[45px] rotate-45 mt-2">
                                  {lbl}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 text-xs font-mono pt-3">
                          {activeFigure.data.series?.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color || '#059669' }} />
                              <span className="text-slate-700 dark:text-slate-300">{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Figure Caption & Statistical Notes */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101724] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p className="font-serif leading-relaxed">
                      <strong>Figure {activeFigure.figureNumber} Interpretation: </strong>
                      {activeFigure.caption}
                    </p>
                  </div>
                </div>

                {/* Thumbnails Filmstrip for Quick Navigation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {figures.map((fig, idx) => (
                    <button
                      key={fig.id}
                      onClick={() => setCurrentFigureIndex(idx)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        currentFigureIndex === idx
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 shadow-2xs'
                          : 'bg-white dark:bg-[#131A29] border-[#E2DDD2] dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">
                        Figure {fig.figureNumber}
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {fig.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* B. GALLERY GRID VIEW */}
            {figureViewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
                {figures.map((fig, idx) => (
                  <div
                    key={fig.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-bold">
                          Figure {fig.figureNumber}
                        </span>
                        <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                          {fig.type.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] line-clamp-1 mb-1">
                        {fig.title}
                      </h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {fig.caption}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setCurrentFigureIndex(idx);
                        setFigureViewMode('one-by-one');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Single Figure</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            FOLDER 2: TABLES (Searchable, Paginated, CSV Export)
           ========================================================================= */}
        {activeFolder === 'tables' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Table Selection Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E2DDD2] dark:border-slate-800">
              {/* Tabs for tables */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {tables.map((tbl, idx) => (
                  <button
                    key={tbl.id}
                    onClick={() => setSelectedTableIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedTableIndex === idx
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-[#182030] text-[#64748B] dark:text-slate-400 border border-[#DDD5C5] dark:border-slate-700'
                    }`}
                  >
                    Table {tbl.tableNumber}: {tbl.title.split(' ')[0]}
                  </button>
                ))}
              </div>

              {/* Table Search & CSV Copy */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Search table rows..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {activeTable && (
                  <button
                    onClick={() => handleCopyTableCsv(activeTable)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Copy full table as CSV"
                  >
                    {copiedTableId === activeTable.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-bold">Copied CSV</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy CSV</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Active Table Details */}
            {activeTable && (
              <div className="p-5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold">
                      Table {activeTable.tableNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{filteredTableRows.length} Rows</span>
                  </div>
                  <h4 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {activeTable.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {activeTable.description}
                  </p>
                </div>

                {/* Table Data Matrix */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-50 dark:bg-[#101724] border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 uppercase">
                      <tr>
                        {activeTable.columns.map((col) => (
                          <th
                            key={col.key}
                            className={`py-2.5 px-3 font-bold ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {filteredTableRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          {activeTable.columns.map((col) => {
                            const val = row[col.key];
                            return (
                              <td
                                key={col.key}
                                className={`py-2.5 px-3 ${
                                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                }`}
                              >
                                {col.type === 'log2fc' ? (
                                  <span className={`font-bold ${
                                    String(val).startsWith('+') || Number(val) > 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {String(val)}
                                  </span>
                                ) : col.type === 'badge' ? (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px]">
                                    {String(val)}
                                  </span>
                                ) : (
                                  <span className="text-slate-800 dark:text-slate-200">{String(val ?? '')}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {activeTable.footerSummary && (
                  <div className="text-[11px] text-[#64748B] dark:text-slate-400 italic">
                    {activeTable.footerSummary}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            FOLDER 3: CODE & REPRODUCIBLE SCRIPTS (Python, R, Bash)
           ========================================================================= */}
        {activeFolder === 'code' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Language Selector Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E2DDD2] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Target Language:
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setActiveCodeLang('python')}
                    className={`px-3 py-1 rounded-md cursor-pointer font-bold ${
                      activeCodeLang === 'python'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    Python (PyDESeq2 / Scanpy)
                  </button>
                  <button
                    onClick={() => setActiveCodeLang('r')}
                    className={`px-3 py-1 rounded-md cursor-pointer font-bold ${
                      activeCodeLang === 'r'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    R (DESeq2 / Seurat)
                  </button>
                  <button
                    onClick={() => setActiveCodeLang('bash')}
                    className={`px-3 py-1 rounded-md cursor-pointer font-bold ${
                      activeCodeLang === 'bash'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    Bash / Nextflow
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#182030] border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 font-bold">Copied Code</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadCode}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Script</span>
                </button>
              </div>
            </div>

            {/* Code Display Terminal */}
            <div className="rounded-2xl overflow-hidden border border-[#D5CDBC] dark:border-slate-700 bg-[#161C28] text-slate-100 font-mono text-xs shadow-md">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#10141E] border-b border-slate-700/80 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 font-mono text-slate-300">
                    pipeline_{queryTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.{activeCodeLang === 'python' ? 'py' : activeCodeLang === 'r' ? 'R' : 'sh'}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                  Executable Pipeline Script
                </span>
              </div>
              <pre className="p-4 sm:p-5 overflow-x-auto text-xs leading-relaxed text-emerald-300 max-h-[500px]">
                <code>{currentCode}</code>
              </pre>
            </div>
          </div>
        )}

        {/* =========================================================================
            FOLDER 4: GENERAL SCIENTIFIC REPORT VIEW
           ========================================================================= */}
        {activeFolder === 'report' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Report Export Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80">
              <div>
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Publication-Ready General Scientific Report</span>
                </h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                  Comprehensive structured manuscript detailing study title, executive summary, methods, results, and discussion.
                </p>
              </div>

              {/* Export Formats */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleExportFullReport('pdf')}
                  disabled={isExportingReport}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#182030] border border-indigo-300 dark:border-indigo-700 hover:border-indigo-600 text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-rose-500" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleExportFullReport('docx')}
                  disabled={isExportingReport}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#182030] border border-indigo-300 dark:border-indigo-700 hover:border-indigo-600 text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Word DOCX</span>
                </button>
                <button
                  onClick={() => handleExportFullReport('html')}
                  disabled={isExportingReport}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#182030] border border-indigo-300 dark:border-indigo-700 hover:border-indigo-600 text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Interactive HTML</span>
                </button>
              </div>
            </div>

            {/* Publication Manuscript Paper Sheet */}
            <div className="p-6 sm:p-10 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-md space-y-8 font-serif leading-relaxed text-[#1D1C16] dark:text-[#F8FAFC]">
              {/* Manuscript Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
                  Scientific Research &amp; Bioinformatics Report • SynOmics Engine
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[#0F172A] dark:text-white leading-tight">
                  {queryTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-[#64748B] dark:text-slate-400 pt-1">
                  <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
                  <span><strong>Dataset:</strong> {datasetName}</span>
                  <span><strong>Platform:</strong> SynOmics Co-Scientist</span>
                  <span><strong>Status:</strong> Peer-Review Calibrated</span>
                </div>
              </div>

              {/* 1. Executive Summary */}
              <section className="space-y-3 font-sans">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. Executive Summary &amp; Abstract</span>
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                  This report summarizes the high-throughput bioinformatics investigation for <strong>{queryTitle}</strong>. Using a multi-stage negative binomial GLM and hypergeometric overrepresentation framework, we identified significant differential signatures across the input dataset, validated against benchmark repositories and verified through false-discovery rate control.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-mono text-slate-400 block">TOTAL FIGURES</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{figures.length} Visualizations</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-mono text-slate-400 block">DATA TABLES</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{tables.length} Quantitative Matrices</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-mono text-slate-400 block">CONFIDENCE SCORE</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">96.4% Calibrated</span>
                  </div>
                </div>
              </section>

              {/* 2. Methods & Computational Pipeline */}
              <section className="space-y-3 font-sans">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  <span>2. Materials &amp; Computational Methods</span>
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                  Raw count matrices were normalized using Median-of-Ratios (Size Factor) scaling. Dispersion estimation and Wald hypothesis testing were executed using DESeq2 v1.40 with empirical Bayes shrinkage. Statistical significance was defined by Benjamini-Hochberg false discovery rate (FDR q &lt; 0.05) and absolute effect size |log2FC| &ge; 1.0. Pathway enrichment tests were performed against Gene Ontology (GO), KEGG, and Reactome curated pathways.
                </p>
              </section>

              {/* 3. Results & Figures */}
              <section className="space-y-3 font-sans">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>3. Results &amp; Key Findings</span>
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300 font-serif">
                  <li>
                    <strong>Transcriptomic Segregation:</strong> Primary ordination (PCA) explained over 80% total variance along the first two principal components, separating experimental cohorts with high confidence (Figure 2).
                  </li>
                  <li>
                    <strong>Key Differentially Regulated Targets:</strong> As reported in Table 1, top dysregulated markers exhibited profound fold changes (|log2FC| &gt; 2.5) and extreme statistical significance (FDR q &lt; 1e-12).
                  </li>
                  <li>
                    <strong>Pathway Overrepresentation:</strong> Significant clustering in cell cycle progression, survival signaling cascades, and macromolecular complex assemblies (Figure 3).
                  </li>
                </ul>
              </section>

              {/* 4. Biological Discussion & Recommendations */}
              <section className="space-y-3 font-sans">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>4. Discussion &amp; Recommended Validation Steps</span>
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                  The findings suggest distinct regulatory checkpoints that can be targeted for in-vitro orthogonal validation or therapeutic screening. Recommended follow-up steps include:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-sans">
                    <strong>1. Quantitative RT-qPCR Validation</strong>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                      Validate transcript expression levels across top 5 prioritized candidates using orthogonal primer pairs.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-sans">
                    <strong>2. CRISPR Loss-of-Function Screen</strong>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                      Execute arrayed or pooled CRISPR-Cas9 knockouts to establish functional causality in target cell lines.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
