import React, { useState } from 'react';
import { Dna, Filter, Download, Activity, Search, BarChart2, Upload, Play, Loader2, Info } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell, LineChart, Line } from 'recharts';

interface GWASVariant {
  rsid: string;
  chr: string;
  chrNum: number;
  pos: number;
  gene: string;
  pvalue: number;
  logP: number;
  beta: number | null;
  se: number | null;
  significant: boolean;
}

interface GWASResult {
  status: string;
  trait?: string;
  variantsAnalyzed?: number;
  genomicInflationLambda?: number | null;
  significantHits?: number;
  leadLoci?: GWASVariant[];
  manhattanPoints?: GWASVariant[];
  qqPoints?: { expected: number; observed: number }[];
  message?: string;
}

// Parse a CSV/TSV of summary statistics into the payload the backend expects.
// Recognised columns (case-insensitive): rsid/snp, chr/chrom, pos/bp, gene,
// pvalue/p, beta, se. Only p-value is strictly required.
function parseSummaryStats(text: string): Record<string, any>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(delim).map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex(h => names.includes(h));
  const iRs = idx(['rsid', 'snp', 'variant', 'id']);
  const iChr = idx(['chr', 'chrom', 'chromosome']);
  const iPos = idx(['pos', 'bp', 'position']);
  const iGene = idx(['gene', 'nearest_gene']);
  const iP = idx(['pvalue', 'p', 'p_value', 'pval']);
  const iBeta = idx(['beta', 'effect']);
  const iSe = idx(['se', 'stderr', 'standard_error']);
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(delim);
    if (iP < 0 || !c[iP]) continue;
    rows.push({
      rsid: iRs >= 0 ? c[iRs]?.trim() : `row${i}`,
      chr: iChr >= 0 ? c[iChr]?.trim() : '',
      pos: iPos >= 0 ? c[iPos]?.trim() : '',
      gene: iGene >= 0 ? c[iGene]?.trim() : '',
      pvalue: c[iP]?.trim(),
      beta: iBeta >= 0 ? c[iBeta]?.trim() : '',
      se: iSe >= 0 ? c[iSe]?.trim() : ''
    });
  }
  return rows;
}

export const GWASVariantPrioritizer: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [trait, setTrait] = useState('User GWAS Trait');
  const [result, setResult] = useState<GWASResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [pipFilter, setPipFilter] = useState(0); // -log10(P) minimum
  const [searchFilter, setSearchFilter] = useState('');

  const runAnalysis = async () => {
    const summaryStats = parseSummaryStats(rawInput);
    if (summaryStats.length === 0) {
      setError('No parseable rows. Provide a CSV/TSV with a header including at least a p-value column (pvalue/p), ideally rsid, chr, pos, gene.');
      return;
    }
    setError(null);
    setIsRunning(true);
    try {
      const res = await fetch('/api/synomics/gwas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trait, summaryStats })
      });
      const data = await res.json();
      const r: GWASResult = data.result || data;
      setResult(r);
      if (r.leadLoci && r.leadLoci.length > 0) setSelectedGene(r.leadLoci[0].gene || r.leadLoci[0].rsid);
    } catch (err: any) {
      setError(`Analysis failed: ${err?.message || 'server error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setRawInput(await f.text());
  };

  const loci = result?.manhattanPoints || [];
  const qq = result?.qqPoints || [];
  const lambdaGC = result?.genomicInflationLambda ?? null;
  const maxLogP = loci.reduce((m, v) => Math.max(m, v.logP), 8);

  const filteredVariants = (result?.leadLoci || []).filter(v => {
    if (v.logP < pipFilter) return false;
    if (searchFilter && !(v.gene || '').toLowerCase().includes(searchFilter.toLowerCase())
        && !(v.rsid || '').toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });
  const selectedVariant = (result?.leadLoci || []).find(v => v.gene === selectedGene || v.rsid === selectedGene) || null;

  return (
    <div className="space-y-6">
      {/* Header + input */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            GWAS Summary-Statistics Analysis
          </span>
          {lambdaGC !== null && <span className="text-xs text-slate-400 font-mono">λ_GC = {lambdaGC}</span>}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Dna className="w-5 h-5 text-emerald-500" /> GWAS Variant Prioritizer &amp; Functional Annotation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Computes real −log10(P), genomic inflation (λ_GC) from the median chi-square, a Manhattan plot,
          a Q–Q inflation assessment, and genome-wide-significant lead loci from your summary statistics.
        </p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"Paste summary statistics (CSV or TSV) with a header, e.g.:\nrsid,chr,pos,gene,pvalue,beta,se\nrs7903146,10,114758349,TCF7L2,1.1e-45,0.38,0.025"}
              className="w-full h-32 px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={trait}
              onChange={(e) => setTrait(e.target.value)}
              placeholder="Trait name"
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <label className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
              <Upload className="w-3.5 h-3.5" /> Upload .csv / .tsv
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />
            </label>
            <button
              onClick={runAnalysis}
              disabled={isRunning}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              {isRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing…</> : <><Play className="w-3.5 h-3.5" /> Run GWAS Analysis</>}
            </button>
            {result && (result.leadLoci?.length ?? 0) > 0 && (
              <button
                onClick={() => {
                  const csv = `rsID,Chromosome,Position,Gene,P_Value,-log10P,Beta,SE\n` +
                    (result.leadLoci || []).map(v => `${v.rsid},${v.chr},${v.pos},${v.gene},${v.pvalue},${v.logP},${v.beta ?? ''},${v.se ?? ''}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `synomics_gwas_lead_loci_${Date.now()}.csv`; a.click();
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Lead Loci
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {/* Empty state (no fabricated data) */}
      {!result && (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
          <Info className="w-6 h-6 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No analysis run yet. Provide summary statistics above and click <b>Run GWAS Analysis</b> — results are computed from your data, nothing is pre-populated.</p>
        </div>
      )}

      {result?.status === 'no_input' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">{result.message}</div>
      )}

      {result && (result.manhattanPoints?.length ?? 0) > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Manhattan */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-emerald-500" /> Manhattan Plot ({result.variantsAnalyzed} variants)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Green points pass genome-wide significance (p &lt; 5×10⁻⁸).</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <XAxis type="number" dataKey="chrNum" name="Chromosome" domain={[0, 25]} stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `chr${v}`} />
                    <YAxis type="number" dataKey="logP" name="-log10(P)" domain={[0, Math.ceil(maxLogP + 1)]} stroke="#94a3b8" fontSize={11} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d: any = payload[0].payload;
                      return (
                        <div className="p-2.5 bg-slate-950 text-white rounded-lg text-xs shadow-xl border border-slate-800">
                          <div className="font-bold text-emerald-400">{d.gene ? `${d.gene} (${d.rsid})` : `${d.chr}:${d.pos}`}</div>
                          <div>-log10(P): {d.logP}</div>
                          {d.significant && <div className="text-emerald-300 font-semibold mt-1">✓ Genome-Wide Significant</div>}
                        </div>
                      );
                    }} />
                    <Scatter data={loci} onClick={(pt: any) => { if (pt?.gene || pt?.rsid) setSelectedGene(pt.gene || pt.rsid); }}>
                      {loci.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.significant ? '#10b981' : (entry.chrNum % 2 === 0 ? '#38bdf8' : '#64748b')} r={entry.significant ? 6 : 2.5} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* QQ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-emerald-500" /> Q–Q Inflation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">λ_GC = {lambdaGC ?? 'n/a'}</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={qq} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <XAxis dataKey="expected" name="Expected" stroke="#94a3b8" fontSize={11} />
                    <YAxis dataKey="observed" name="Observed" stroke="#94a3b8" fontSize={11} />
                    <Tooltip content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d: any = payload[0].payload;
                      return <div className="p-2 bg-slate-950 text-white rounded text-xs"><div>Expected: {d.expected}</div><div>Observed: {d.observed}</div></div>;
                    }} />
                    <Line type="monotone" dataKey="observed" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: '#10b981' }} />
                    <Line type="monotone" dataKey="expected" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lead loci table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-500" /> Genome-Wide Significant Lead Loci ({result.significantHits})
              </h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input type="text" placeholder="Filter gene or rsID..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none" />
              </div>
            </div>
            {filteredVariants.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No genome-wide-significant loci in this dataset (p &lt; 5×10⁻⁸).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Gene</th><th className="py-2.5 px-3">rsID</th><th className="py-2.5 px-3">Locus</th>
                      <th className="py-2.5 px-3">P-Value</th><th className="py-2.5 px-3">-log10P</th><th className="py-2.5 px-3">Beta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {filteredVariants.map((v) => (
                      <tr key={v.rsid + v.pos} onClick={() => setSelectedGene(v.gene || v.rsid)}
                        className={`cursor-pointer transition-colors ${selectedGene === (v.gene || v.rsid) ? 'bg-emerald-500/10 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">{v.gene || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{v.rsid}</td>
                        <td className="py-2.5 px-3 text-slate-500">{v.chr}:{v.pos ? Math.round(v.pos / 1000000) + 'Mb' : '—'}</td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{v.pvalue.toExponential(1)}</td>
                        <td className="py-2.5 px-3">{v.logP}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{v.beta ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedVariant && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300">
                <b className="text-slate-900 dark:text-white">{selectedVariant.gene || selectedVariant.rsid}</b> — {selectedVariant.chr}:{selectedVariant.pos.toLocaleString()} • p = {selectedVariant.pvalue.toExponential(2)}
                {selectedVariant.beta !== null && <> • β = {selectedVariant.beta} {selectedVariant.se !== null && <>(SE {selectedVariant.se})</>}</>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
