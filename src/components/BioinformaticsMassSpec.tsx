import React, { useState, useEffect } from 'react';
import { Dna, RefreshCw, Sparkles, Filter, ChevronRight, BarChart2, Zap } from 'lucide-react';

export const BioinformaticsMassSpec: React.FC = () => {
  const [proteinSeq, setProteinSeq] = useState('MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA');
  const [selectedPeptide, setSelectedPeptide] = useState<string>('MDCLCIVTTK');
  const [charge, setCharge] = useState<number>(2);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [msData, setMsData] = useState<any>(null);

  const runMassSpecSimulation = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/mass-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proteinSequence: proteinSeq
        })
      });
      const data = await res.json();
      if (data.result) {
        setMsData(data.result);
        if (data.result.digestedPeptides?.length > 0) {
          setSelectedPeptide(data.result.digestedPeptides[0].sequence);
        }
      }
    } catch (err) {
      console.error('Mass spec simulation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runMassSpecSimulation();
  }, []);

  return (
    <div id="mass-spec-studio" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Proteomics & In-Silico Tandem Mass Spectrometry (MS/MS) Studio
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Trypsin proteolytic cleavage, exact monoisotopic peptide masses, and Collision-Induced Dissociation (CID) $b$/$y$ ion spectra.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runMassSpecSimulation}
              disabled={isLoading}
              className="py-2 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Digest & Fragment
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Peptides List & MS2 Spectrum */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Digested Peptides */}
        <div className="bg-white dark:bg-[#131A29] p-4 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Tryptic Digested Peptides ({msData?.digestedPeptides?.length || 0})
          </h4>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {msData?.digestedPeptides?.map((pep: any, idx: number) => (
              <div
                key={idx}
                onClick={() => setSelectedPeptide(pep.sequence)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedPeptide === pep.sequence
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 shadow-2xs'
                    : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#E2DDD2] dark:border-[#1E293B] hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                    Pos {pep.start}-{pep.end} ({pep.length} aa)
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{pep.monoisotopicMass} Da</span>
                </div>
                <p className="font-mono text-xs font-medium text-[#0F172A] dark:text-slate-200 mt-1 break-all">
                  {pep.sequence}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-[#64748B] dark:text-slate-400 font-mono">
                  <span>[M+2H]2+: {pep.mz2}</span>
                  <span>[M+3H]3+: {pep.mz3}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: MS2 CID Fragmentation Spectrum */}
        <div className="lg:col-span-2 space-y-4">
          {msData?.sampleMS2 && (
            <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2DDD2] dark:border-[#1E293B] pb-3">
                <div>
                  <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                    Tandem MS/MS (CID) Fragmentation Spectrum
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Peptide: <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{msData.sampleMS2.peptide}</span> (Precursor $m/z$: {msData.sampleMS2.precursorMz})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> b-ions (N-term)
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> y-ions (C-term)
                  </span>
                </div>
              </div>

              {/* Spectrum Chart Visualizer */}
              <div className="relative w-full h-72 bg-[#0F172A] rounded-xl border border-slate-800 p-4 flex items-end justify-between overflow-x-auto">
                {/* Horizontal baseline */}
                <div className="absolute bottom-6 left-4 right-4 h-px bg-slate-700"></div>

                {/* Mass peaks */}
                {msData.sampleMS2.spectrum.map((peak: any, idx: number) => {
                  const isB = peak.type === 'b';
                  const heightPct = (peak.intensity / 100) * 80;
                  return (
                    <div
                      key={idx}
                      title={`${peak.label} (m/z: ${peak.mz}, Int: ${peak.intensity}%)`}
                      className="group relative flex flex-col items-center mx-1 cursor-pointer"
                      style={{ height: '100%', justifyContent: 'flex-end', paddingBottom: '24px' }}
                    >
                      {/* Peak Bar */}
                      <div
                        className={`w-1 rounded-t transition-all group-hover:w-2 ${
                          isB ? 'bg-blue-400 group-hover:bg-blue-300' : 'bg-red-400 group-hover:bg-red-300'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      {/* Label */}
                      <span className={`text-[10px] font-mono font-bold mt-1 ${isB ? 'text-blue-400' : 'text-red-400'}`}>
                        {peak.label}
                      </span>
                      <span className="text-[8px] font-mono text-slate-500">
                        {Math.round(peak.mz)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Ion Table */}
              <div className="grid grid-cols-2 gap-4">
                {/* b-ions */}
                <div className="p-3 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
                  <h5 className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">b-Ion Series (N-Terminal)</h5>
                  <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                    {msData.sampleMS2.bIons.map((b: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[#334155] dark:text-slate-300 py-0.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-blue-600">{b.ion} ({b.subseq})</span>
                        <span>m/z: {b.mz}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* y-ions */}
                <div className="p-3 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
                  <h5 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">y-Ion Series (C-Terminal)</h5>
                  <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                    {msData.sampleMS2.yIons.map((y: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[#334155] dark:text-slate-300 py-0.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-red-600">{y.ion} ({y.subseq})</span>
                        <span>m/z: {y.mz}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
