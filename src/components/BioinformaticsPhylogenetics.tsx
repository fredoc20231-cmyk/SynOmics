import React, { useState, useEffect } from 'react';
import { GitBranch, Play, RefreshCw, Sparkles, Copy, Check, Info } from 'lucide-react';

export const BioinformaticsPhylogenetics: React.FC = () => {
  const [method, setMethod] = useState<'neighbor_joining' | 'upgma'>('neighbor_joining');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [treeData, setTreeData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const [taxa, setTaxa] = useState<Record<string, string>>({
    'Human_DLG4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Chimpanzee_DLG4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Mouse_Dlg4': 'MDCLCIVTTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTDTLEAPGYEL',
    'Zebrafish_dlg4': 'MDCLCVITTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNTESLEAPGYEL',
    'Drosophila_dlg1': 'MDHLFTATTKKYRYQDEDTPPLEHSPAHLPNQANSPPVIVNSETLEAPGYEL'
  });

  const runPhylogeneticAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/synomics/phylogenetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxa,
          method
        })
      });
      const data = await res.json();
      if (data.result) {
        setTreeData(data.result);
      }
    } catch (err) {
      console.error('Phylogenetics calculation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runPhylogeneticAnalysis();
  }, [method]);

  const handleCopyNewick = () => {
    if (!treeData?.newick) return;
    navigator.clipboard.writeText(treeData.newick);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render tree hierarchy recursively
  const renderTreeNode = (node: any, depth = 0): React.ReactNode => {
    if (!node) return null;
    const isLeaf = !node.children || node.children.length === 0;

    return (
      <div key={node.name} className="flex flex-col ml-4 border-l-2 border-amber-300 dark:border-amber-800 pl-3 my-1.5">
        <div className="flex items-center gap-2">
          {isLeaf ? (
            <div className="flex items-center gap-2 bg-white dark:bg-[#131A29] px-2.5 py-1 rounded-lg border border-[#E2DDD2] dark:border-[#1E293B] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-slate-100">{node.name}</span>
              <span className="text-[10px] text-[#64748B] font-mono">dist: {node.branchLength || '0.000'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>Node (height: {node.height})</span>
            </div>
          )}
        </div>

        {node.children && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div id="phylogenetics-studio" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Phylogenetic & Evolutionary Tree Reconstruction Studio
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Exact Jukes-Cantor distance matrix with Neighbor-Joining (NJ) and UPGMA hierarchical tree reconstruction.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMethod('neighbor_joining')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                method === 'neighbor_joining'
                  ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 text-amber-800 dark:text-amber-300'
                  : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
              }`}
            >
              Neighbor-Joining (NJ)
            </button>
            <button
              onClick={() => setMethod('upgma')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                method === 'upgma'
                  ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 text-amber-800 dark:text-amber-300'
                  : 'bg-[#FAF9F5] dark:bg-[#0B0F17] border-[#D5CDBC] dark:border-[#1E293B] text-[#64748B]'
              }`}
            >
              UPGMA Hierarchical
            </button>
          </div>
        </div>
      </div>

      {/* Taxa Inputs & Tree Reconstruction View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Taxa Sequences List */}
        <div className="bg-white dark:bg-[#131A29] p-4 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Multi-Species Homologs ({Object.keys(taxa).length} Taxa)
          </h4>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {Object.entries(taxa).map(([name, seq]) => (
              <div key={name} className="p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#E2DDD2] dark:border-[#1E293B] space-y-1">
                <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-slate-100 block">{name}</span>
                <p className="font-mono text-[10px] text-[#64748B] dark:text-slate-400 break-all">{seq}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: Reconstructed Dendrogram & Newick Format */}
        <div className="lg:col-span-2 space-y-4">
          {treeData && (
            <div className="bg-white dark:bg-[#131A29] p-5 rounded-2xl border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2DDD2] dark:border-[#1E293B] pb-3">
                <div>
                  <h4 className="font-serif-brand text-sm font-bold text-[#0F172A] dark:text-slate-100">
                    Phylogenetic Tree Topology ({treeData.method})
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Evolutionary branch lengths calculated via Jukes-Cantor sequence divergence.
                  </p>
                </div>

                <button
                  onClick={handleCopyNewick}
                  className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#0B0F17] border border-[#D5CDBC] dark:border-[#1E293B] text-xs text-[#334155] dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                  {copied ? 'Copied' : 'Copy Newick'}
                </button>
              </div>

              {/* Tree Container */}
              <div className="p-4 bg-[#FAF9F5] dark:bg-[#0B0F17] rounded-xl border border-[#E2DDD2] dark:border-[#1E293B]">
                {renderTreeNode(treeData.treeHierarchy)}
              </div>

              {/* Newick String Box */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Standard Newick Tree String:</span>
                <pre className="p-3 bg-[#0F172A] text-amber-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                  {treeData.newick}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
