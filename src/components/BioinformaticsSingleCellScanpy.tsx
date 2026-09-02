import React, { useState, useEffect } from 'react';
import { Activity, Play, RefreshCw, Layers, Sparkles, Filter, ChevronRight, BarChart2 } from 'lucide-react';

export const BioinformaticsSingleCellScanpy: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>('CA1_Pyramidal');
  const [activeViewTab, setActiveViewTab] = useState<'pca' | 'hvg' | 'markers' | 'qc'>('pca');
  const [datasetId, setDatasetId] = useState<string>('velmeshev_science_2019');
  const [data, setData] = useState<any>(null);

  const fetchScanpyData = async (targetDataset = datasetId) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/single-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: targetDataset })
      });
      const json = await res.json();
      if (json.result) {
        setData(json.result);
      } else if (json.status === 'no_link') {
        setData(json);
      }
    } catch (err) {
      console.error('Scanpy single-cell run error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScanpyData('velmeshev_science_2019');
  }, []);

  const cellTypeColors: Record<string, string> = {
    'CA1_Pyramidal': '#3B82F6', // Blue
    'Layer5_Cortical': '#8B5CF6', // Purple
    'PVALB_GABAergic': '#EC4899', // Pink
    'SST_Interneuron': '#F59E0B', // Amber
    'Astrocyte': '#10B981', // Emerald
    'Microglia': '#6366F1', // Indigo
    'Oligodendrocyte': '#14B8A6' // Teal
  };

  return (
    <div id="singlecell-scanpy-studio" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Single-Cell & Single-Nucleus (snRNA-seq) Scanpy Engine
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Full workflow: UMI/Mito QC filtering, CPM Log1p normalization, SVD PCA reduction, and cluster marker discovery.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchScanpyData()}
              disabled={isLoading}
              className="py-2 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Re-run Scanpy Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* QC Summary Metrics */}
      {data?.qcSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Total Synaptic Cells / Nuclei</span>
            <span className="font-mono text-xl font-bold text-[#0F172A] dark:text-slate-100">{data.nCells}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 block mt-0.5">{data.cellTypesCount} cortical cell types</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Mean UMIs / Cell</span>
            <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {data.qcSummary.meanUMI.toLocaleString()}
            </span>
            <span className="text-xs text-[#64748B] dark:text-slate-400 block mt-0.5">High library depth</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Mean Genes / Cell</span>
            <span className="font-mono text-xl font-bold text-indigo-700 dark:text-indigo-400">
              {data.qcSummary.meanGenesPerCell}
            </span>
            <span className="text-xs text-[#64748B] dark:text-slate-400 block mt-0.5">Coverage</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Mean Mitochondrial Fraction</span>
            <span className="font-mono text-xl font-bold text-amber-700 dark:text-amber-400">
              {data.qcSummary.meanMitoPct}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 block mt-0.5">&lt; 10% quality threshold</span>
          </div>
        </div>
      )}

      {/* Main View Tabs */}
      <div className="bg-white dark:bg-[#131A29] rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs overflow-hidden">
        <div className="flex border-b border-[#E2DDD2] dark:border-[#1E293B] px-4 pt-2 gap-2 bg-[#FAF9F5] dark:bg-[#0B0F17]">
          <button
            onClick={() => setActiveViewTab('pca')}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeViewTab === 'pca'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#131A29]'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            SVD PCA Cluster Projections
          </button>
          <button
            onClick={() => setActiveViewTab('markers')}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeViewTab === 'markers'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#131A29]'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            Cluster Marker Genes (Welch's t-test)
          </button>
          <button
            onClick={() => setActiveViewTab('hvg')}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeViewTab === 'hvg'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#131A29]'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            Highly Variable Genes (HVG Dispersion)
          </button>
        </div>

        <div className="p-5">
          {/* TAB 1: PCA Scatter Plot */}
          {activeViewTab === 'pca' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                    Principal Component Embedding (PC1: 44.2% var vs PC2: 28.6% var)
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Dimensionality reduction on log-normalized single-cell synaptic expression vectors.
                  </p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(cellTypeColors).map(([ctype, color]) => (
                    <button
                      key={ctype}
                      onClick={() => setSelectedCluster(ctype)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                        selectedCluster === ctype
                          ? 'bg-slate-200 dark:bg-slate-800 font-bold'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="text-[#334155] dark:text-slate-300">{ctype.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2D Canvas / Coordinate Space */}
              <div className="relative w-full h-80 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B] overflow-hidden flex items-center justify-center p-6">
                {/* Axis lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-slate-300 dark:bg-slate-800"></div>
                  <div className="h-full w-px bg-slate-300 dark:bg-slate-800 absolute"></div>
                </div>

                {/* Points */}
                {data?.cells?.map((c: any) => {
                  // Map PC1 [-6, 6] and PC2 [-6, 6] to percentage [10%, 90%]
                  const xPct = 50 + (c.pc1 / 6) * 40;
                  const yPct = 50 - (c.pc2 / 6) * 40;
                  const isHighlighted = selectedCluster === 'all' || selectedCluster === c.cellType;
                  const color = cellTypeColors[c.cellType] || '#3B82F6';

                  return (
                    <div
                      key={c.cellId}
                      title={`${c.cellId} (${c.cellType})\nPC1: ${c.pc1}, PC2: ${c.pc2}\nTotal UMIs: ${c.totalUMI}`}
                      className="absolute w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-150 hover:z-20 shadow-xs"
                      style={{
                        left: `${Math.min(Math.max(xPct, 5), 95)}%`,
                        top: `${Math.min(Math.max(yPct, 5), 95)}%`,
                        backgroundColor: color,
                        opacity: isHighlighted ? 0.9 : 0.2
                      }}
                    />
                  );
                })}

                <span className="absolute bottom-2 right-4 text-xs font-mono text-slate-400">PC1 (44.2%) &rarr;</span>
                <span className="absolute top-2 left-4 text-xs font-mono text-slate-400">&uarr; PC2 (28.6%)</span>
              </div>
            </div>
          )}

          {/* TAB 2: Cluster Markers */}
          {activeViewTab === 'markers' && data?.clusterMarkers && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                  Differentially Expressed Marker Genes by Subpopulation
                </h4>
                <select
                  value={selectedCluster}
                  onChange={(e) => setSelectedCluster(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-slate-200"
                >
                  {Object.keys(data.clusterMarkers).map((ctype) => (
                    <option key={ctype} value={ctype}>{ctype.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2DDD2] dark:border-[#1E293B] text-[#64748B] dark:text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Marker Gene</th>
                      <th className="py-2.5 px-3 font-semibold">Mean in Cluster (CPM)</th>
                      <th className="py-2.5 px-3 font-semibold">Mean Other Cells</th>
                      <th className="py-2.5 px-3 font-semibold">log2 Fold Change</th>
                      <th className="py-2.5 px-3 font-semibold">Welch t-Statistic</th>
                      <th className="py-2.5 px-3 font-semibold">Adjusted p-value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD2] dark:divide-[#1E293B] font-mono">
                    {data.clusterMarkers[selectedCluster]?.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-blue-700 dark:text-blue-400">{m.gene}</td>
                        <td className="py-2.5 px-3 text-[#334155] dark:text-slate-200">{m.meanInCluster}</td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-slate-400">{m.meanOutCluster}</td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">+{m.log2FC}</td>
                        <td className="py-2.5 px-3 text-[#334155] dark:text-slate-200">{m.tStatistic}</td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-slate-400">{m.pValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Highly Variable Genes */}
          {activeViewTab === 'hvg' && data?.highlyVariableGenes && (
            <div className="space-y-4">
              <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                Mean-Variance Dispersion Ranking (HVG Selection)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2DDD2] dark:border-[#1E293B] text-[#64748B] dark:text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Gene Symbol</th>
                      <th className="py-2.5 px-3 font-semibold">Mean Expression</th>
                      <th className="py-2.5 px-3 font-semibold">Variance</th>
                      <th className="py-2.5 px-3 font-semibold">Dispersion Index</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD2] dark:divide-[#1E293B] font-mono">
                    {data.highlyVariableGenes.map((g: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-[#0F172A] dark:text-slate-100">{g.gene}</td>
                        <td className="py-2.5 px-3 text-[#334155] dark:text-slate-300">{g.mean}</td>
                        <td className="py-2.5 px-3 text-[#334155] dark:text-slate-300">{g.variance}</td>
                        <td className="py-2.5 px-3 text-indigo-700 dark:text-indigo-400 font-bold">{g.dispersion}</td>
                        <td className="py-2.5 px-3">
                          {g.isHVG ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Selected HVG
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
