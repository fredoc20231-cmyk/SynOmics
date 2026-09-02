import React from 'react';
import { X, ShieldCheck, Award, FileText, ExternalLink, Cpu } from 'lucide-react';

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in-up">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#12161F] border border-[#E2DDD2] dark:border-[#1E293B] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0E131E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-brand text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Universal Multi-Omics Platform • Legal Notice
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Autonomous Bioinformatics &amp; Multi-Omics Intelligence System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E7E0D2]/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm text-[#334155] dark:text-slate-300 leading-relaxed font-sans">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs flex items-start gap-2.5">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Principal Developer &amp; Scientific Lead:</span> Dr. Ahmed Fadiel, in collaboration with Computational Multi-Omics &amp; Systems Bioinformatics Group.
            </div>
          </div>

          <section className="space-y-1.5">
            <h4 className="font-serif-brand text-base font-semibold text-[#0F172A] dark:text-slate-100">
              1. Intellectual Property &amp; Copyright Notice
            </h4>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              © 2026. All rights reserved. Computational multi-omics intelligence and universal bioinformatics systems. No part of the autonomous co-scientist engine algorithms, multi-omics ontology schemas, or predictive heuristics may be redistributed without express authorization.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-serif-brand text-base font-semibold text-[#0F172A] dark:text-slate-100">
              2. Scientific Research &amp; Non-Clinical Disclaimer
            </h4>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              This platform is designed strictly for scientific research, in-silico hypothesis generation, molecular modeling, epitranscriptomics analysis, and bioinformatics discovery. It is <strong>not</strong> an FDA/EMA approved medical diagnostic tool, nor does it constitute certified medical advice for clinical diagnosis or prescription of therapeutics in humans.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-serif-brand text-base font-semibold text-[#0F172A] dark:text-slate-100">
              3. Data Attribution &amp; Integrated Open Repositories
            </h4>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              The platform integrates open scientific ontologies and data standards including <strong>Gene Ontology Consortium (GO)</strong>, <strong>UniProt Knowledgebase</strong>, <strong>RCSB Protein Data Bank (PDB)</strong>, <strong>GWAS Catalog (NHGRI-EBI)</strong>, <strong>Human Cell Atlas scRNA-seq</strong>, and <strong>Direct RNA Epitranscriptomics Repositories</strong>.
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-serif-brand text-base font-semibold text-[#0F172A] dark:text-slate-100">
              4. AI Reasoning &amp; Gemini 3.7 Flash Integration
            </h4>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Co-scientist reasoning and protocol drafting are augmented by Google Gemini 3.7 Flash with server-side proxy safety filters and strict provenance cross-referencing. Experimental validation in wet-lab models is mandatory prior to clinical translational application.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E2DDD2] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#0E131E]">
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Universal Multi-Omics Platform, 2026.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-medium shadow-xs transition-colors"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
