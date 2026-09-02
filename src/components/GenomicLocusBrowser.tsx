import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Dna, 
  ShieldAlert, 
  Sparkles,
  Info,
  ExternalLink,
  Activity,
  Maximize2
} from 'lucide-react';
import { SynapticProtein } from '../types';

interface GenomicLocusBrowserProps {
  proteins: SynapticProtein[];
  onSelectGene?: (gene: string) => void;
}

export const GenomicLocusBrowser: React.FC<GenomicLocusBrowserProps> = ({
  proteins,
  onSelectGene
}) => {
  const [selectedGene, setSelectedGene] = useState('TP53');
  const [isLoading, setIsLoading] = useState(false);
  const [locusData, setLocusData] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const fetchLocusData = async (gene = selectedGene) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/genomic-locus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene })
      });
      const data = await res.json();
      if (data.result) {
        setLocusData(data.result);
        if (data.result.locus?.clinvarVariants?.length > 0) {
          setSelectedVariant(data.result.locus.clinvarVariants[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch genomic locus data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocusData(selectedGene);
  }, [selectedGene]);

  const locus = locusData?.locus;
  const totalLength = locus ? (locus.end - locus.start) : 60000;

  return (
    <div className="h-full flex flex-col bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-y-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
              <Dna className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              UCSC / IGV Genomic Locus & Splicing Track Browser
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              GRCh38 / hg38 Coordinates
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Interactive multi-track browser displaying canonical & alternative transcript splicing architectures, ClinVar pathogenic single-nucleotide variants (SNVs), CADD intolerance scores, and human brain epigenetic peak signals (H3K27ac enhancers, ATAC-seq accessibility).
          </p>
        </div>

        {/* Gene Selector & Zoom Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Locus:</label>
            <select
              value={selectedGene}
              onChange={(e) => setSelectedGene(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TP53">TP53 (chr17p13.1)</option>
              <option value="EGFR">EGFR (chr7p11.2)</option>
              <option value="KRAS">KRAS (chr12p12.1)</option>
              <option value="BRCA1">BRCA1 (chr17q21.31)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 text-slate-600 dark:text-slate-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.25))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Visualization */}
      {locus && (
        <div className="bg-white dark:bg-[#131A29] p-6 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-sm space-y-6">
          {/* Coordinate Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100">{locus.chromosome}:{locus.start.toLocaleString()} - {locus.end.toLocaleString()}</span>
              <span className="text-slate-400">({(totalLength / 1000).toFixed(1)} kb span, Strand: {locus.strand})</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
              <span>Cytoband: <b>{locus.cytoband}</b></span>
              <span>Transcript: <b>{locus.canonicalTranscript}</b></span>
            </div>
          </div>

          {/* Track 1: Chromosome Ideogram & Scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{locus.start.toLocaleString()} bp</span>
              <span className="font-semibold text-slate-500 uppercase">Coordinate Scale (GRCh38)</span>
              <span>{locus.end.toLocaleString()} bp</span>
            </div>
            <div className="relative h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-md overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="absolute inset-y-0 left-0 right-0 flex justify-between px-2">
                {[0, 25, 50, 75, 100].map((tick) => (
                  <div key={tick} className="h-full w-px bg-slate-300 dark:bg-slate-700"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Track 2: Exon-Intron Splicing Model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Transcript Splicing Track ({locus.exons.length} Exons Annotated)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">CDS & UTRs</span>
            </div>

            <div className="relative h-12 w-full bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2 border border-slate-200 dark:border-slate-800 flex items-center">
              {/* Intron connecting line */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-300 dark:bg-emerald-900"></div>

              {/* Exon boxes */}
              <div className="relative w-full h-full flex items-center">
                {locus.exons.map((ex: any) => {
                  const leftPct = Math.max(0, Math.min(100, ((ex.start - locus.start) / totalLength) * 100));
                  const widthPct = Math.max(1.5, ((ex.end - ex.start) / totalLength) * 100);

                  return (
                    <div
                      key={ex.exon}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-sm border ${
                        ex.type.includes('UTR')
                          ? 'bg-emerald-200 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-800'
                          : 'bg-emerald-600 dark:bg-emerald-500 border-emerald-700 dark:border-emerald-400'
                      } flex items-center justify-center text-[9px] font-mono font-bold text-white shadow-xs cursor-pointer hover:scale-110 transition-transform`}
                      title={`Exon ${ex.exon}: ${ex.lengthBp} bp (${ex.type})`}
                    >
                      E{ex.exon}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Track 3: ClinVar Pathogenic SNVs Track */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>ClinVar Pathogenic & Likely Pathogenic Variants</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Click variant pin to inspect</span>
            </div>

            <div className="relative h-14 w-full bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2 border border-slate-200 dark:border-slate-800 flex items-center">
              <div className="relative w-full h-full flex items-center">
                {locus.clinvarVariants.map((v: any) => {
                  const leftPct = Math.max(0, Math.min(100, ((v.pos - locus.start) / totalLength) * 100));
                  const isSelected = selectedVariant?.id === v.id;

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      style={{ left: `${leftPct}%` }}
                      className={`absolute top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-mono font-bold shadow-xs transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 bg-rose-600 text-white z-10 scale-110'
                          : v.significance === 'Pathogenic'
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      <ShieldAlert className="w-2.5 h-2.5" />
                      <span>{v.hgvsp}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Track 4: Epigenetic Peak Signal Tracks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Epigenetic & Chromatin Accessibility Tracks (Human Prefrontal Cortex)</span>
              </div>
            </div>

            <div className="space-y-2">
              {locus.epigeneticPeaks.map((peak: any, idx: number) => {
                const leftPct = Math.max(0, Math.min(100, ((peak.start - locus.start) / totalLength) * 100));
                const widthPct = Math.max(2, ((peak.end - peak.start) / totalLength) * 100);

                return (
                  <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 w-64 shrink-0">{peak.track}</span>
                    <div className="relative flex-1 h-6 bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden flex items-center px-2">
                      <div
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        className="absolute h-4 rounded-md bg-amber-400/80 dark:bg-amber-500/80 border border-amber-500 flex items-center justify-center text-[9px] font-mono font-bold text-slate-900"
                      >
                        Signal {peak.signalStrength}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Variant Detail Inspector */}
          {selectedVariant && (
            <div className="mt-4 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-indigo-100 dark:border-indigo-900">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-900 dark:text-indigo-200">
                  <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>ClinVar Variant: {selectedVariant.hgvsp} ({selectedVariant.id})</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {selectedVariant.significance}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-slate-500 block font-semibold">Associated Condition:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedVariant.condition}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-semibold">Genomic Coordinate:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{locus.chromosome}:{selectedVariant.pos.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-semibold">CADD Deleteriousness Score:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{selectedVariant.cadd} (Top 0.1% deleterious)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
