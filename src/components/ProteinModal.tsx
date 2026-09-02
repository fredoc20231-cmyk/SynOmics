import React from 'react';
import { SynapticProtein } from '../types';
import { X, ExternalLink, Activity, ShieldAlert, Pill, Sparkles, Layers, Bookmark } from 'lucide-react';

interface ProteinModalProps {
  protein: SynapticProtein | null;
  onClose: () => void;
  onQueryWithProtein?: (geneSymbol: string) => void;
}

export const ProteinModal: React.FC<ProteinModalProps> = ({
  protein,
  onClose,
  onQueryWithProtein
}) => {
  if (!protein) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Banner */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-mono font-bold text-xl shadow-inner">
              {protein.geneSymbol.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white font-mono">{protein.geneSymbol}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                  {protein.compartment.replace(/_/g, ' ')}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  UniProt: {protein.uniprotId}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium mt-0.5">{protein.name}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {protein.molecularWeightKDa} kDa • ~{protein.estimatedCopyNumberPerSynapse} copies / spine • Complex: {protein.complex}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Primary Function & Location */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Molecular Function & Subcellular Localization
            </h4>
            <p className="text-slate-200 leading-relaxed">{protein.primaryFunction}</p>
            <p className="text-xs text-indigo-300/90 mt-2 font-mono bg-indigo-950/30 p-2 rounded border border-indigo-900/30">
              Localization: {protein.subcellularLocation}
            </p>
          </div>

          {/* Key Interactors */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Key Synaptic Binding Partners & Interactors
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {protein.keyInteractors.map(partner => (
                <span
                  key={partner}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700/60 font-mono text-xs hover:border-indigo-500/50 transition-colors cursor-pointer"
                  onClick={() => onQueryWithProtein && onQueryWithProtein(`Analyze synaptic interaction between ${protein.geneSymbol} and ${partner}`)}
                >
                  {partner}
                </span>
              ))}
            </div>
          </div>

          {/* Disease Associations & Synaptopathy */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Synaptopathy & Human Disease Links
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {protein.associatedDiseases.map((d, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-amber-300 uppercase tracking-wide">
                      {d.disease.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Score: {(d.evidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="inline-block text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded mb-1.5">
                    {d.associationType}
                  </span>
                  <p className="text-xs text-slate-300 leading-snug">{d.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Single Cell Expression Distribution */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Neuronal & Glial Cell Type Expression (TPM)
            </h4>
            <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {protein.expressionByCellType.map(exp => {
                const maxTpm = Math.max(...protein.expressionByCellType.map(e => e.tpm), 1);
                const widthPct = (exp.tpm / maxTpm) * 100;
                return (
                  <div key={exp.cellType} className="flex items-center text-xs">
                    <span className="w-36 font-mono text-slate-400 truncate">{exp.cellType.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden mx-3">
                      <div
                        className={`h-full rounded-full transition-all ${
                          exp.cellType.includes('Pyramidal') || exp.cellType.includes('Cortical') ? 'bg-indigo-500' :
                          exp.cellType.includes('GABAergic') || exp.cellType.includes('Interneuron') ? 'bg-cyan-500' :
                          exp.cellType.includes('Astrocyte') ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.max(widthPct, 2)}%` }}
                      />
                    </div>
                    <span className="w-16 font-mono text-right text-slate-200 font-semibold">{exp.tpm.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Post-Translational Modifications (PTMs) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Post-Translational Modifications (PTMs) & Functional Switches
            </h4>
            <div className="space-y-2">
              {protein.postTranslationalModifications.map((ptm, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono font-semibold whitespace-nowrap border border-violet-500/20">
                    {ptm.type} @ {ptm.site}
                  </span>
                  <p className="text-slate-300 leading-relaxed">{ptm.regulatoryRole}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Druggability & Therapeutics */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-pink-400" /> Druggability & Small Molecule Modulators
            </h4>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                protein.druggability.therapeuticStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                protein.druggability.therapeuticStatus === 'Clinical Trials' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' :
                'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              }`}>
                Status: {protein.druggability.therapeuticStatus}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Druggable Target: {protein.druggability.isDruggable ? 'Yes' : 'Complex Scaffold'}
              </span>
            </div>
            {protein.druggability.knownModulators.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {protein.druggability.knownModulators.map((mod, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-mono border border-slate-700">
                    {mod}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No approved direct small molecule modulators currently cataloged. Consider antisense oligonucleotides (ASOs) or PROTAC degrader approaches.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <a
            href={`https://www.uniprot.org/uniprotkb/${protein.uniprotId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View on UniProtKB
          </a>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (onQueryWithProtein) {
                  onQueryWithProtein(`Execute SynOmics autonomous investigation for ${protein.geneSymbol} in synaptic plasticity and disease`);
                  onClose();
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Launch SynOmics Co-Scientist Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
