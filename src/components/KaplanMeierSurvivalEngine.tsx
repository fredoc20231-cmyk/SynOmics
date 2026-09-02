import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingDown, 
  ShieldAlert, 
  Sparkles, 
  BarChart2, 
  Filter, 
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { SynapticProtein } from '../types';

interface KaplanMeierSurvivalEngineProps {
  proteins: SynapticProtein[];
}

export const KaplanMeierSurvivalEngine: React.FC<KaplanMeierSurvivalEngineProps> = ({
  proteins
}) => {
  const [selectedGene, setSelectedGene] = useState(proteins[0]?.geneSymbol || 'TP53');
  const [strata, setStrata] = useState('expression_quantile');
  const [isLoading, setIsLoading] = useState(false);
  const [survivalData, setSurvivalData] = useState<any>(null);

  const fetchSurvivalData = async (gene = selectedGene, st = strata) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/kaplan-meier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene, strata: st })
      });
      const data = await res.json();
      if (data.result) {
        setSurvivalData(data.result);
      }
    } catch (err) {
      console.error('Failed to fetch Kaplan-Meier survival data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurvivalData(selectedGene, strata);
  }, [selectedGene, strata]);

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-sm">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              cBioPortal-Grade Kaplan-Meier Survival & Cohort Stratification
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Log-Rank (Mantel-Cox) Statistical Test
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Computes non-parametric cumulative survival functions S(t) across multi-omics expression quartiles and pathogenic loss-of-function variants. Includes exact Chi-Square tests, Hazard Ratios (HR), and 95% confidence intervals.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Locus</label>
            <select
              value={selectedGene}
              onChange={(e) => setSelectedGene(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {proteins.map(p => (
                <option key={p.id} value={p.geneSymbol}>{p.geneSymbol} ({p.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Stratification Method</label>
            <select
              value={strata}
              onChange={(e) => setStrata(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="expression_quantile">Expression Upper/Lower Quartile</option>
              <option value="pathogenic_variant">ClinVar LoF Missense Variant</option>
              <option value="cnv_deletion">Copy Number Deletion (CNV)</option>
            </select>
          </div>
        </div>
      </div>

      {survivalData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kaplan-Meier Survival Curve Visualization (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#131A29] p-6 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Survival Probability Over 60 Months (Total Cohort n={survivalData.cohortSize})
              </h3>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-3 h-1 bg-emerald-500 rounded-full"></span>
                  <span>{survivalData.highGroup?.label} (n={survivalData.highGroup?.n})</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-3 h-1 bg-rose-500 rounded-full"></span>
                  <span>{survivalData.lowGroup?.label} (n={survivalData.lowGroup?.n})</span>
                </span>
              </div>
            </div>

            {/* SVG Survival Step Plot */}
            <div className="relative h-64 w-full bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="0" x2="500" y2="0" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="500" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="0" y1="200" x2="500" y2="200" stroke="#cbd5e1" strokeWidth="2" />

                {/* High Expression Line (Emerald) */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  points={survivalData.highGroup?.curve?.map((pt: any) => {
                    const x = (pt.month / 60) * 500;
                    const y = 200 - (pt.survivalRate / 100) * 200;
                    return `${x},${y}`;
                  }).join(' ')}
                />

                {/* Low Expression Line (Rose) */}
                <polyline
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  points={survivalData.lowGroup?.curve?.map((pt: any) => {
                    const x = (pt.month / 60) * 500;
                    const y = 200 - (pt.survivalRate / 100) * 200;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              </svg>

              {/* X-axis Month Labels */}
              <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>0 mo</span>
                <span>12 mo</span>
                <span>24 mo</span>
                <span>36 mo</span>
                <span>48 mo</span>
                <span>60 mo</span>
              </div>
            </div>

            {/* At-Risk Cohort Table */}
            <div className="overflow-x-auto text-[11px] font-mono">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-1.5 px-2">Cohort Track</th>
                    <th className="py-1.5 px-2">0m</th>
                    <th className="py-1.5 px-2">12m</th>
                    <th className="py-1.5 px-2">24m</th>
                    <th className="py-1.5 px-2">36m</th>
                    <th className="py-1.5 px-2">48m</th>
                    <th className="py-1.5 px-2">60m</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-emerald-600 dark:text-emerald-400">High / WT Group</td>
                    {survivalData.highGroup?.curve?.filter((_: any, i: number) => i % 2 === 0).map((pt: any, i: number) => (
                      <td key={i} className="py-1.5 px-2">{pt.atRisk}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-rose-600 dark:text-rose-400">Low / LoF Group</td>
                    {survivalData.lowGroup?.curve?.filter((_: any, i: number) => i % 2 === 0).map((pt: any, i: number) => (
                      <td key={i} className="py-1.5 px-2">{pt.atRisk}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Log-Rank Test Statistics & Hazard Ratios (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
                Log-Rank Statistical Metrics
              </h4>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Log-Rank Chi-Square (χ²)</span>
                  <span className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                    {survivalData.logRankStatistics?.chiSquare}
                  </span>
                  <span className="text-[10px] text-slate-400">1 Degree of Freedom</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Log-Rank p-Value</span>
                  <span className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                    {survivalData.logRankStatistics?.pValue}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{survivalData.logRankStatistics?.significance}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Hazard Ratio (HR)</span>
                  <span className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {survivalData.logRankStatistics?.hazardRatio}x
                  </span>
                  <span className="text-[10px] text-slate-400">95% CI: {survivalData.logRankStatistics?.confidenceInterval95}</span>
                </div>
              </div>
            </div>

            {/* Median Survival Time Comparison */}
            <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-3">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">Median Event-Free Time</h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">Wildtype / High</span>
                  <span className="text-base font-mono font-bold text-emerald-800 dark:text-emerald-200 mt-1 block">
                    {survivalData.highGroup?.medianSurvivalMonths} mo
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">LoF / Low</span>
                  <span className="text-base font-mono font-bold text-rose-800 dark:text-rose-200 mt-1 block">
                    {survivalData.lowGroup?.medianSurvivalMonths} mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
