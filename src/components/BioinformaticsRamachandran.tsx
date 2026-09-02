import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, Sparkles, Filter, ChevronRight, Box } from 'lucide-react';

export const BioinformaticsRamachandran: React.FC = () => {
  const [selectedPdb, setSelectedPdb] = useState<string>('DLG4');
  const [contactCutoff, setContactCutoff] = useState<number>(8.0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ramachandran' | 'contact_map'>('ramachandran');

  const runStructureAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/ramachandran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdb_id: selectedPdb,
          cutoff: contactCutoff
        })
      });
      const data = await res.json();
      if (data.result) {
        setAnalysisData(data.result);
      } else if (data.status === 'no_link') {
        setAnalysisData(data);
      }
    } catch (err) {
      console.error('Ramachandran calculation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runStructureAnalysis();
  }, [selectedPdb, contactCutoff]);

  return (
    <div id="ramachandran-contact-studio" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Structural Ramachandran & Residue Contact Map Studio
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Exact backbone dihedral angle calculation ($\phi, \psi$) and $C_\alpha - C_\alpha$ Euclidean distance matrix.
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <select
              value={selectedPdb}
              onChange={(e) => setSelectedPdb(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-slate-200"
            >
              <option value="DLG4">PSD-95 (DLG4 PDZ3 - 1KJW)</option>
              <option value="SHANK3">SHANK3 (ANK Domain - 1Y7P)</option>
              <option value="CAMK2A">CaMKII-Alpha (Kinase Domain - 2VN9)</option>
            </select>

            <div className="flex items-center gap-1.5 bg-[#FAF9F5] dark:bg-[#0B0F17] px-2.5 py-1.5 rounded-lg border border-[#D5CDBC] dark:border-[#1E293B]">
              <span className="text-xs text-[#64748B] dark:text-slate-400">Cutoff:</span>
              <input
                type="number"
                step="0.5"
                min="4"
                max="14"
                value={contactCutoff}
                onChange={(e) => setContactCutoff(Number(e.target.value))}
                className="w-12 text-xs bg-transparent text-center font-bold text-[#0F172A] dark:text-slate-100"
              />
              <span className="text-xs text-[#64748B] dark:text-slate-400">&Aring;</span>
            </div>
          </div>
        </div>
      </div>

      {/* No Link Established Alert */}
      {analysisData?.status === 'no_link' && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
            <span>No Link Established: {analysisData.message}</span>
          </div>
          {analysisData.alternatives && (
            <div className="space-y-1 text-xs">
              <span className="font-semibold block">Available Alternatives:</span>
              <ul className="list-disc pl-5 space-y-0.5 font-mono">
                {analysisData.alternatives.map((alt: string, i: number) => (
                  <li key={i}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Metric Cards */}
      {analysisData?.ramachandranDistribution && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Core Alpha-Helix</span>
            <span className="font-mono text-xl font-bold text-indigo-700 dark:text-indigo-400">
              {analysisData.ramachandranDistribution.coreAlphaPct}%
            </span>
            <span className="text-xs text-[#64748B] dark:text-slate-400 block mt-0.5">Favored right-handed</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Core Beta-Sheet</span>
            <span className="font-mono text-xl font-bold text-blue-700 dark:text-blue-400">
              {analysisData.ramachandranDistribution.coreBetaPct}%
            </span>
            <span className="text-xs text-[#64748B] dark:text-slate-400 block mt-0.5">Extended conformations</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Allowed Conformations</span>
            <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {analysisData.ramachandranDistribution.allowedPct}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 block mt-0.5">Stereochemically valid</span>
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
            <span className="text-xs text-[#64748B] dark:text-slate-400 block">Outlier Residues</span>
            <span className="font-mono text-xl font-bold text-amber-700 dark:text-amber-400">
              {analysisData.ramachandranDistribution.outlierPct}%
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">Flexible loops / Glycine</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-[#131A29] rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs overflow-hidden">
        <div className="flex border-b border-[#E2DDD2] dark:border-[#1E293B] px-4 pt-2 gap-2 bg-[#FAF9F5] dark:bg-[#0B0F17]">
          <button
            onClick={() => setActiveTab('ramachandran')}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'ramachandran'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-[#131A29]'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            Ramachandran Plot ($\phi, \psi$ Quadrants)
          </button>
          <button
            onClick={() => setActiveTab('contact_map')}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'contact_map'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-[#131A29]'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            $C_\alpha - C_\alpha$ Contact Map Matrix
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'ramachandran' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                    Torsion Angle Distribution [-180&deg;, +180&deg;]
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Quadrant mapping computed from N, CA, C, O backbone Cartesian vectors.
                  </p>
                </div>
              </div>

              {/* Ramachandran 2D Plot Container */}
              <div className="relative w-full h-84 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B] overflow-hidden p-6 flex items-center justify-center">
                {/* Alpha Helix Favored Box */}
                <div
                  className="absolute rounded bg-indigo-100/40 dark:bg-indigo-950/30 border border-dashed border-indigo-300 dark:border-indigo-800"
                  style={{
                    left: '22%',
                    top: '55%',
                    width: '18%',
                    height: '18%'
                  }}
                >
                  <span className="text-[10px] text-indigo-500 font-bold p-1">&alpha;-Helix</span>
                </div>

                {/* Beta Sheet Favored Box */}
                <div
                  className="absolute rounded bg-blue-100/40 dark:bg-blue-950/30 border border-dashed border-blue-300 dark:border-blue-800"
                  style={{
                    left: '10%',
                    top: '12%',
                    width: '24%',
                    height: '24%'
                  }}
                >
                  <span className="text-[10px] text-blue-500 font-bold p-1">&beta;-Sheet</span>
                </div>

                {/* Axes */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-slate-300 dark:bg-slate-700"></div>
                  <div className="h-full w-px bg-slate-300 dark:bg-slate-700 absolute"></div>
                </div>

                {/* Residue Points */}
                {analysisData?.ramachandranPoints?.map((p: any, idx: number) => {
                  // Map Phi [-180, 180] to [0%, 100%]
                  // Map Psi [-180, 180] to [100%, 0%]
                  const xPct = ((p.phi + 180) / 360) * 100;
                  const yPct = ((180 - p.psi) / 360) * 100;
                  const isAlpha = p.region === 'Core Alpha-Helix';
                  const isBeta = p.region === 'Core Beta-Sheet';

                  return (
                    <div
                      key={idx}
                      title={`Residue ${p.resName}${p.resSeq} (${p.chain})\nPhi: ${p.phi}°\nPsi: ${p.psi}°\nRegion: ${p.region}`}
                      className={`absolute w-2.5 h-2.5 rounded-full cursor-pointer hover:scale-150 transition-transform ${
                        isAlpha ? 'bg-indigo-600' : isBeta ? 'bg-blue-600' : 'bg-emerald-500'
                      }`}
                      style={{
                        left: `${xPct}%`,
                        top: `${yPct}%`
                      }}
                    />
                  );
                })}

                <span className="absolute bottom-2 right-4 text-xs font-mono text-slate-400">Phi (&phi;) &rarr;</span>
                <span className="absolute top-2 left-4 text-xs font-mono text-slate-400">&uarr; Psi (&psi;)</span>
              </div>
            </div>
          )}

          {activeTab === 'contact_map' && analysisData?.contactMap && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                    Pairwise Distance Matrix & Inter-Residue Contacts (&le; {contactCutoff} &Aring;)
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Sampled {analysisData.contactMap.matrixSize} &times; {analysisData.contactMap.matrixSize} $C_\alpha$ backbone matrix.
                  </p>
                </div>
              </div>

              {/* Matrix Heatmap Grid */}
              <div className="overflow-x-auto p-4 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
                <div
                  className="grid gap-0.5 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${analysisData.contactMap.matrixSize}, minmax(8px, 1fr))`,
                    maxWidth: '480px'
                  }}
                >
                  {analysisData.contactMap.contactMatrix.map((row: number[], rIdx: number) =>
                    row.map((val: number, cIdx: number) => {
                      const dist = analysisData.contactMap.distanceMatrix[rIdx][cIdx];
                      const isContact = val === 1;
                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          title={`${analysisData.contactMap.labels[rIdx]} - ${analysisData.contactMap.labels[cIdx]}: ${dist} Å`}
                          className={`aspect-square rounded-2xs cursor-pointer hover:ring-1 hover:ring-purple-400 transition-all ${
                            isContact
                              ? rIdx === cIdx ? 'bg-purple-900 dark:bg-purple-400' : 'bg-purple-600 dark:bg-purple-500'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
