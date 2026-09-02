import React, { useState } from 'react';
import { AlignLeft, Play, RefreshCw, Copy, Check, Info, Sparkles, FileText, ChevronRight } from 'lucide-react';

export const BioinformaticsSequenceAlignment: React.FC = () => {
  const [seq1, setSeq1] = useState('MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA');
  const [seq2, setSeq2] = useState('MDCLCVVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA');
  const [method, setMethod] = useState<'smith_waterman' | 'needleman_wunsch'>('smith_waterman');
  const [seqType, setSeqType] = useState<'protein' | 'dna'>('protein');
  const [gapOpen, setGapOpen] = useState(-10);
  const [gapExtend, setGapExtend] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [alignmentResult, setAlignmentResult] = useState<{
    method: string;
    alignmentScore: number;
    alignedSeq1: string;
    alignedSeq2: string;
    markup: string;
    alignmentLength: number;
    identicalMatches: number;
    identityPct: number;
    similarityPct: number;
    gapsCount: number;
    gapPct: number;
    matrixPreview?: number[][];
  } | null>({
    method: 'smith_waterman',
    alignmentScore: 428,
    alignedSeq1: 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA',
    alignedSeq2: 'MDCLCVVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA',
    markup:      '|||||:||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||',
    alignmentLength: 80,
    identicalMatches: 79,
    identityPct: 98.75,
    similarityPct: 100.0,
    gapsCount: 0,
    gapPct: 0.0
  });

  const handleRunAlignment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/align-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seq1,
          seq2,
          method,
          seq_type: seqType,
          gap_open: gapOpen,
          gap_extend: gapExtend
        })
      });
      const data = await res.json();
      if (data.result) {
        setAlignmentResult(data.result);
      }
    } catch (err) {
      console.error('Alignment failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!alignmentResult) return;
    const text = `>Seq1 (Query)\n${alignmentResult.alignedSeq1}\n>Match\n${alignmentResult.markup}\n>Seq2 (Target)\n${alignmentResult.alignedSeq2}\nScore: ${alignmentResult.alignmentScore} | Identity: ${alignmentResult.identityPct}%`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presetPairs = [
    {
      name: 'Human vs Mouse PSD-95 (DLG4 PDZ1)',
      type: 'protein' as const,
      s1: 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA',
      s2: 'MDCLCVVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYELQVNGTEGEMEYEEITLERGNSGLGFSIA'
    },
    {
      name: 'SHANK3 ANK Repeat vs SHANK1 Homolog',
      type: 'protein' as const,
      s1: 'MASLQALLDTVRRRLPGSRTLVELLRAAGADPNAADRRGRTPLHLAARAGHPDVVELLVAHGADVNARDGWGWTALHS',
      s2: 'MASLQALLDAVRRRLPGSRALVELLRAAGADPNAADRRGRTPLHLAARAGHPEVVELLVAHGADVNARDGWGWTALHS'
    },
    {
      name: 'GRIN2B Exon 3 Wildtype vs De Novo Missense',
      type: 'dna' as const,
      s1: 'ATGAAGCCCAGCGCGGAGTGCTGCGTTTCCCTCAGGCTGCTGCTGCTGCTGCCCCTGCTGTGGCTACTGCTGCTG',
      s2: 'ATGAAGCCCAGCGCGGAGTGCTGCGTTTCCCTCAGGCTGCTGCTGCTGCTGCCCCTGCTGTGGCTACTGCTGTTG'
    }
  ];

  return (
    <div id="sequence-alignment-studio" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                <AlignLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Pairwise Sequence Alignment & Homology Studio
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Exact dynamic programming engine: Smith-Waterman (local) and Needleman-Wunsch (global) with BLOSUM62 affine scoring.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Presets:</span>
            {presetPairs.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSeq1(p.s1);
                  setSeq2(p.s2);
                  setSeqType(p.type);
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[#334155] dark:text-slate-300 border border-[#D5CDBC] dark:border-[#1E293B] transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Input Sequences */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#131A29] p-4 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Sequence 1 (Query / Wildtype) • {seq1.length} chars
              </label>
            </div>
            <textarea
              value={seq1}
              onChange={(e) => setSeq1(e.target.value.toUpperCase())}
              rows={3}
              placeholder="Enter FASTA or raw sequence (e.g. MDCLCIVTTK...)"
              className="w-full font-mono text-xs p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-indigo-600 tracking-wider"
            />
          </div>

          <div className="bg-white dark:bg-[#131A29] p-4 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Sequence 2 (Target / Homolog / Variant) • {seq2.length} chars
              </label>
            </div>
            <textarea
              value={seq2}
              onChange={(e) => setSeq2(e.target.value.toUpperCase())}
              rows={3}
              placeholder="Enter FASTA or raw sequence..."
              className="w-full font-mono text-xs p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-indigo-600 tracking-wider"
            />
          </div>
        </div>

        {/* Right 1 Col: Algorithm Parameters */}
        <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Alignment Parameters
            </h4>

            {/* Algorithm Choice */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#334155] dark:text-slate-300 font-medium">Algorithm</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('smith_waterman')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    method === 'smith_waterman'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
                  }`}
                >
                  Smith-Waterman (Local)
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('needleman_wunsch')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    method === 'needleman_wunsch'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
                  }`}
                >
                  Needleman-Wunsch (Global)
                </button>
              </div>
            </div>

            {/* Sequence Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#334155] dark:text-slate-300 font-medium">Sequence Type & Matrix</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSeqType('protein')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    seqType === 'protein'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
                  }`}
                >
                  Protein (BLOSUM62)
                </button>
                <button
                  type="button"
                  onClick={() => setSeqType('dna')}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    seqType === 'dna'
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
                  }`}
                >
                  Nucleotide (DNA / RNA)
                </button>
              </div>
            </div>

            {/* Gap penalties */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-[#64748B] dark:text-slate-400 block mb-1">Gap Open (d)</label>
                <input
                  type="number"
                  value={gapOpen}
                  onChange={(e) => setGapOpen(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-[#0F172A] dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748B] dark:text-slate-400 block mb-1">Gap Extend (e)</label>
                <input
                  type="number"
                  value={gapExtend}
                  onChange={(e) => setGapExtend(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-[#0F172A] dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleRunAlignment}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Computing Dynamic Matrix...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Execute Alignment
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alignment Results Display */}
      {alignmentResult && (
        <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2DDD2] dark:border-[#1E293B] pb-4">
            <div>
              <h4 className="font-serif-brand text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Alignment Statistics & Traceback
              </h4>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Method: {alignmentResult.method === 'smith_waterman' ? 'Smith-Waterman (Local Alignment)' : 'Needleman-Wunsch (Global Alignment)'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#334155] dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                {copied ? 'Copied' : 'Copy FASTA'}
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B]">
              <span className="text-xs text-[#64748B] dark:text-slate-400 block">Alignment Score</span>
              <span className="font-mono text-lg font-bold text-indigo-700 dark:text-indigo-400">
                {alignmentResult.alignmentScore}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B]">
              <span className="text-xs text-[#64748B] dark:text-slate-400 block">Sequence Identity</span>
              <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {alignmentResult.identityPct}%
              </span>
              <span className="text-xs text-[#64748B] block">
                ({alignmentResult.identicalMatches}/{alignmentResult.alignmentLength} matches)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B]">
              <span className="text-xs text-[#64748B] dark:text-slate-400 block">Positive Similarity</span>
              <span className="font-mono text-lg font-bold text-blue-700 dark:text-blue-400">
                {alignmentResult.similarityPct}%
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B]">
              <span className="text-xs text-[#64748B] dark:text-slate-400 block">Gaps Inserted</span>
              <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
                {alignmentResult.gapsCount} ({alignmentResult.gapPct}%)
              </span>
            </div>
          </div>

          {/* Traceback Visualizer Box */}
          <div className="p-4 rounded-xl bg-[#0F172A] text-slate-100 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800 space-y-1">
            <div className="flex items-center text-slate-400 text-xs pb-1 select-none border-b border-slate-800 mb-2">
              <span className="w-16">Position</span>
              <span>Alignment Traceback View</span>
            </div>
            <div className="whitespace-pre flex">
              <span className="w-16 text-blue-400 font-semibold select-none">Query: </span>
              <span className="tracking-widest text-slate-200">{alignmentResult.alignedSeq1}</span>
            </div>
            <div className="whitespace-pre flex">
              <span className="w-16 text-slate-500 select-none">Match: </span>
              <span className="tracking-widest text-emerald-400 font-bold">{alignmentResult.markup}</span>
            </div>
            <div className="whitespace-pre flex">
              <span className="w-16 text-emerald-400 font-semibold select-none">Target:</span>
              <span className="tracking-widest text-slate-200">{alignmentResult.alignedSeq2}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
