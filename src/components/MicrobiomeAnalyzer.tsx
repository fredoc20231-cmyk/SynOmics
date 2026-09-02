import React, { useState } from 'react';
import { Activity, Download, Search, Upload, Play, Loader2, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ScatterChart, Scatter, Cell, Legend } from 'recharts';

interface AlphaRow { sampleId: string; group: string; shannon: number; simpson: number; observed: number; chao1: number; pielou: number; }
interface PcoaPoint { sampleId: string; group: string; pcoa1: number; pcoa2: number; shannon: number; }
interface MicrobiomeResult {
  status: string;
  message?: string;
  sampleCount?: number;
  taxaCount?: number;
  alphaDiversity?: AlphaRow[];
  betaDiversity?: { distanceMetric: string; pcoaPoints: PcoaPoint[] };
  differentiallyAbundantTaxa?: Record<string, any>[];
}

// Parse a sample x taxa abundance table (CSV/TSV). First column = sampleId,
// second column = group (optional), remaining columns = taxon counts.
function parseAbundanceTable(text: string): Record<string, any>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(delim).map(h => h.trim());
  const lower = header.map(h => h.toLowerCase());
  const hasGroup = lower[1] === 'group';
  const taxaStart = hasGroup ? 2 : 1;
  const taxa = header.slice(taxaStart);
  const samples: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(delim);
    const abundances: Record<string, number> = {};
    taxa.forEach((t, ti) => {
      const val = parseFloat(c[taxaStart + ti]);
      if (!isNaN(val)) abundances[t] = val;
    });
    samples.push({ sampleId: c[0]?.trim() || `S${i}`, group: hasGroup ? (c[1]?.trim() || 'all') : 'all', abundances });
  }
  return samples;
}

const GROUP_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6'];

export const MicrobiomeAnalyzer: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [result, setResult] = useState<MicrobiomeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const run = async () => {
    const samples = parseAbundanceTable(rawInput);
    if (samples.length === 0) {
      setError('No parseable samples. Provide a CSV/TSV: first column sampleId, optional "group" column, then one column per taxon with counts.');
      return;
    }
    setError(null);
    setIsRunning(true);
    try {
      const res = await fetch('/api/synomics/microbiome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples })
      });
      const data = await res.json();
      setResult(data.result || data);
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

  const groups = Array.from(new Set((result?.alphaDiversity || []).map(a => a.group)));
  const groupColor = (g: string) => GROUP_COLORS[groups.indexOf(g) % GROUP_COLORS.length];
  const diffTaxa = (result?.differentiallyAbundantTaxa || []).filter(t =>
    !search || String(t.taxon).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" /> Microbiome / Metagenomics Diversity Analyzer
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
          Computes real alpha diversity (Shannon, Simpson, Chao1, Pielou), Bray–Curtis beta diversity with
          PCoA ordination, and differential taxon abundance between groups — from your abundance table.
        </p>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)}
              placeholder={"Paste an abundance table (CSV/TSV):\nsampleId,group,Faecalibacterium,Bacteroides,Escherichia\nH1,Healthy,50,30,2\nD1,Disease,5,20,60"}
              className="w-full h-32 px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
              <Upload className="w-3.5 h-3.5" /> Upload .csv / .tsv
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />
            </label>
            <button onClick={run} disabled={isRunning}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center justify-center gap-1.5 shadow-sm">
              {isRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing…</> : <><Play className="w-3.5 h-3.5" /> Run Diversity Analysis</>}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {!result && (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
          <Info className="w-6 h-6 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No analysis run yet. Provide an abundance table and click <b>Run Diversity Analysis</b> — all metrics are computed from your data.</p>
        </div>
      )}

      {result?.status === 'no_input' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">{result.message}</div>
      )}

      {result && (result.alphaDiversity?.length ?? 0) > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alpha diversity (Shannon per sample) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Alpha Diversity — Shannon Index ({result.sampleCount} samples, {result.taxaCount} taxa)</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.alphaDiversity} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <XAxis dataKey="sampleId" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d: any = payload[0].payload;
                      return <div className="p-2 bg-slate-950 text-white rounded text-xs">
                        <div className="font-bold">{d.sampleId} ({d.group})</div>
                        <div>Shannon: {d.shannon}</div><div>Simpson: {d.simpson}</div>
                        <div>Chao1: {d.chao1}</div><div>Pielou: {d.pielou}</div>
                      </div>;
                    }} />
                    <Bar dataKey="shannon">
                      {(result.alphaDiversity || []).map((a, i) => <Cell key={i} fill={groupColor(a.group)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Beta diversity PCoA */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Beta Diversity — PCoA (Bray–Curtis)</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <XAxis type="number" dataKey="pcoa1" name="PCoA1" stroke="#94a3b8" fontSize={11} />
                    <YAxis type="number" dataKey="pcoa2" name="PCoA2" stroke="#94a3b8" fontSize={11} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d: any = payload[0].payload;
                      return <div className="p-2 bg-slate-950 text-white rounded text-xs"><div className="font-bold">{d.sampleId}</div><div>{d.group}</div></div>;
                    }} />
                    <Legend />
                    {groups.map((g) => (
                      <Scatter key={g} name={g} data={(result.betaDiversity?.pcoaPoints || []).filter(p => p.group === g)} fill={groupColor(g)} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Differential taxa */}
          {diffTaxa.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Differentially Abundant Taxa (log2 fold change between groups)</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Filter taxon..." value={search} onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none" />
                  </div>
                  <button onClick={() => {
                    const keys = Object.keys(diffTaxa[0]);
                    const csv = keys.join(',') + '\n' + diffTaxa.map(r => keys.map(k => r[k]).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `synomics_microbiome_diff_taxa_${Date.now()}.csv`; a.click();
                  }} className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                      {Object.keys(diffTaxa[0]).map(k => <th key={k} className="py-2.5 px-3">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {diffTaxa.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {Object.keys(diffTaxa[0]).map(k => (
                          <td key={k} className={`py-2.5 px-3 ${k === 'log2FC' ? (r[k] > 0 ? 'text-rose-500' : 'text-emerald-500') + ' font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                            {k === 'taxon' ? <span className="font-sans font-semibold text-slate-900 dark:text-white">{r[k]}</span> : r[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
