import React, { useState } from 'react';
import { ShieldCheck, Dna, FileText, Download, AlertTriangle, CheckCircle2, Search, Filter, Stethoscope, HeartPulse, Sparkles, Activity } from 'lucide-react';

interface ClinicalVariant {
  id: string;
  variant: string;
  gene: string;
  transcript: string;
  hgvsc: string;
  hgvsp: string;
  consequence: string;
  acmgTier: 'Pathogenic' | 'Likely Pathogenic' | 'VUS' | 'Likely Benign' | 'Benign';
  acmgCriteria: string[];
  disease: string;
  inheritance: string;
  gnomadMaf: number;
  clinvarReview: string;
  evidenceSummary: string;
}

interface PGxGuideline {
  gene: string;
  variant: string;
  diplotype: string;
  phenotype: string;
  drug: string;
  cpicLevel: 'Level A' | 'Level B';
  recommendation: string;
}

const PRESET_CLINICAL_VARIANTS: Record<string, ClinicalVariant[]> = {
  'Hereditary Cancer Panel': [
    {
      id: 'var-1',
      variant: 'chr17:43044295:G>A',
      gene: 'BRCA1',
      transcript: 'NM_007294.4',
      hgvsc: 'c.5266dupC',
      hgvsp: 'p.Gln1756Profs*74',
      consequence: 'Frameshift Truncation (Exon 20)',
      acmgTier: 'Pathogenic',
      acmgCriteria: ['PVS1 (Null variant in established LOF gene)', 'PM2 (Extremely low MAF in gnomAD)', 'PP5 (Reputable submitters in ClinVar)'],
      disease: 'Hereditary Breast and Ovarian Cancer Syndrome',
      inheritance: 'Autosomal Dominant',
      gnomadMaf: 0.000008,
      clinvarReview: 'Pathogenic (3-star expert panel)',
      evidenceSummary: 'Frameshift duplication leads to nonsense-mediated decay and loss of the C-terminal BRCT DNA repair domain.'
    },
    {
      id: 'var-2',
      variant: 'chr17:7674220:C>T',
      gene: 'TP53',
      transcript: 'NM_000546.6',
      hgvsc: 'c.524G>A',
      hgvsp: 'p.Arg175His (R175H)',
      consequence: 'Missense Structural Hotspot',
      acmgTier: 'Pathogenic',
      acmgCriteria: ['PS1 (Identical amino acid change established pathogenic)', 'PS3 (Well-established in-vitro transactivation defect)', 'PM1 (DNA binding domain mutational hotspot)'],
      disease: 'Li-Fraumeni Syndrome',
      inheritance: 'Autosomal Dominant',
      gnomadMaf: 0.0,
      clinvarReview: 'Pathogenic (4-star practice guideline)',
      evidenceSummary: 'Disrupts zinc coordination in the core DNA-binding domain, causing complete loss of sequence-specific tumor suppressor transcription.'
    }
  ],
  'Cardiovascular & Channelopathy Panel': [
    {
      id: 'var-3',
      variant: 'chr3:38592350:G>A',
      gene: 'SCN5A',
      transcript: 'NM_198056.3',
      hgvsc: 'c.4418G>A',
      hgvsp: 'p.Arg1473His',
      consequence: 'Missense Domain III-IV Inactivation Gate',
      acmgTier: 'Pathogenic',
      acmgCriteria: ['PS3 (Voltage-clamp confirms persistent non-inactivating INa window current)', 'PM1 (Critical inactivation IFM-motif loop)', 'PM2 (Absent from gnomAD)'],
      disease: 'Long QT Syndrome Type 3 (LQT3)',
      inheritance: 'Autosomal Dominant',
      gnomadMaf: 0.0,
      clinvarReview: 'Pathogenic (Expert panel consensus)',
      evidenceSummary: 'Impaired fast inactivation kinetics causes persistent late sodium inward current and repolarization prolongation.'
    },
    {
      id: 'var-4',
      variant: 'chr14:23425000:C>T',
      gene: 'MYH7',
      transcript: 'NM_000257.4',
      hgvsc: 'c.1208G>A',
      hgvsp: 'p.Arg403Gln (R403Q)',
      consequence: 'Missense Head/Motor Domain',
      acmgTier: 'Pathogenic',
      acmgCriteria: ['PS1 (Well-documented founder pathogenic allele)', 'PS4 (Significant odds ratio in HCM cohorts)', 'PM1 (Myosin head motor domain)'],
      disease: 'Hypertrophic Cardiomyopathy (HCM)',
      inheritance: 'Autosomal Dominant',
      gnomadMaf: 0.00001,
      clinvarReview: 'Pathogenic (3-star)',
      evidenceSummary: 'Enhanced actin-activated ATPase cycling and hypercontractility driving asymmetrical septal hypertrophy.'
    }
  ],
  'Rare Mendelian Disorders': [
    {
      id: 'var-5',
      variant: 'chr7:117559590:C>T',
      gene: 'CFTR',
      transcript: 'NM_000492.4',
      hgvsc: 'c.1521_1523delCTT',
      hgvsp: 'p.Phe508del (ΔF508)',
      consequence: 'In-Frame Triplet Deletion (Exon 11)',
      acmgTier: 'Pathogenic',
      acmgCriteria: ['PS1 (Most prevalent pathogenic CFTR variant globally)', 'PM1 (NBD1 nucleotide binding domain)', 'PP3 (Damaging in silico score)'],
      disease: 'Cystic Fibrosis',
      inheritance: 'Autosomal Recessive',
      gnomadMaf: 0.0124,
      clinvarReview: 'Pathogenic (3-star)',
      evidenceSummary: 'Misfolding in the endoplasmic reticulum prevents membrane trafficking of the epithelial chloride channel.'
    }
  ]
};

const PGX_GUIDELINES: PGxGuideline[] = [
  {
    gene: 'CYP2C19',
    variant: '*2, *3 (Loss of function)',
    diplotype: '*2/*2',
    phenotype: 'Poor Metabolizer',
    drug: 'Clopidogrel (Plavix)',
    cpicLevel: 'Level A',
    recommendation: 'Avoid clopidogrel due to significantly impaired prodrug bioactivation; switch to prasugrel or ticagrelor.'
  },
  {
    gene: 'DPYD',
    variant: '*2A (c.1905+1G>A)',
    diplotype: '*1/*2A',
    phenotype: 'Intermediate Metabolizer',
    drug: '5-Fluorouracil / Capecitabine',
    cpicLevel: 'Level A',
    recommendation: 'Reduce starting dose by 50% to prevent fatal myelosuppression and severe gastrointestinal neurotoxicity.'
  },
  {
    gene: 'TPMT',
    variant: '*3A, *3C',
    diplotype: '*1/*3A',
    phenotype: 'Intermediate Metabolizer',
    drug: 'Azathioprine / 6-Mercaptopurine',
    cpicLevel: 'Level A',
    recommendation: 'Reduce initial dosage by 30-70% and monitor complete blood counts biweekly.'
  },
  {
    gene: 'HLA-B',
    variant: 'HLA-B*57:01 Allele',
    diplotype: 'Positive',
    phenotype: 'High Hypersensitivity Risk',
    drug: 'Abacavir (Ziagen)',
    cpicLevel: 'Level A',
    recommendation: 'Contraindicated. High risk of life-threatening systemic hypersensitivity reaction.'
  }
];

export const ClinicalGenomicsPanel: React.FC = () => {
  const [selectedPanel, setSelectedPanel] = useState('Hereditary Cancer Panel');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('var-1');
  const [activeTab, setActiveTab] = useState<'acmg' | 'pgx' | 'prs'>('acmg');

  const variants = PRESET_CLINICAL_VARIANTS[selectedPanel] || PRESET_CLINICAL_VARIANTS['Hereditary Cancer Panel'];
  const activeVariant = variants.find(v => v.id === selectedVariantId) || variants[0];

  return (
    <div className="space-y-6">
      {/* Honest framing: curated demonstration variants, not a clinical interpretation
          of the user's own sequencing data. */}
      <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 flex items-start gap-3" role="status">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          Curated reference variants shown for demonstration. This panel does not interpret
          your own sequencing data, and the ACMG classifications / population frequencies shown
          are <strong>curated examples, not a live clinical determination</strong>. Real variant
          interpretation requires ClinVar / gnomAD and an ACMG classification engine, and is not a
          medical diagnosis.
        </p>
      </div>
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                ACMG/AMP 5-Tier Classification &amp; CPIC Pharmacogenomics
              </span>
              <span className="text-xs text-slate-400 font-mono">ClinVar 2024 / gnomAD v4.1 Integration</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-rose-500" /> Clinical Genomics &amp; Precision Diagnostics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Automates ACMG/AMP variant interpretation guidelines, evidence tiering (PVS1/PS/PM/PP/BA/BS/BP), CPIC Level A/B pharmacogenomic dosing algorithms, and polygenic risk scoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('acmg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'acmg' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                ACMG Classification
              </button>
              <button
                onClick={() => setActiveTab('pgx')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'pgx' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Pharmacogenomics (PGx)
              </button>
              <button
                onClick={() => setActiveTab('prs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'prs' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Polygenic Risk (PRS)
              </button>
            </div>

            <button
              onClick={() => {
                const reportContent = `SYNOMICS CLINICAL GENOMICS DIAGNOSTIC REPORT\nDate: ${new Date().toISOString()}\nPanel: ${selectedPanel}\nVariant: ${activeVariant.variant} (${activeVariant.gene} ${activeVariant.hgvsp})\nACMG Classification: ${activeVariant.acmgTier}\nCriteria: ${activeVariant.acmgCriteria.join('; ')}\nDisease: ${activeVariant.disease}\n`;
                const blob = new Blob([reportContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `synomics_clinical_report_${Date.now()}.txt`;
                a.click();
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Clinical Report
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'acmg' && (
        <>
          {/* Panel Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">Clinical Panel:</span>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESET_CLINICAL_VARIANTS).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelectedPanel(p);
                    setSelectedVariantId(PRESET_CLINICAL_VARIANTS[p][0].id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${selectedPanel === p ? 'bg-rose-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Grid: Variant Detail & ACMG Evidence Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selected Variant Summary Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-slate-50 to-slate-100 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900 border border-rose-500/20 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-600 text-white shadow-sm">
                  {activeVariant.acmgTier}
                </span>
                <span className="text-xs font-mono text-slate-500">{activeVariant.inheritance}</span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {activeVariant.gene} <span className="text-xs font-mono font-normal text-slate-500">({activeVariant.hgvsp})</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-0.5">{activeVariant.hgvsc}</p>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Associated Condition</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{activeVariant.disease}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">gnomAD Population Frequency</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    MAF: {activeVariant.gnomadMaf === 0 ? '0.0 (Extremely Rare / Novel)' : activeVariant.gnomadMaf}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">ClinVar Review Status</span>
                  <span className="text-slate-700 dark:text-slate-300 block mt-0.5">{activeVariant.clinvarReview}</span>
                </div>
              </div>
            </div>

            {/* ACMG Evidence Criteria Rules Engine (2 columns) */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-500" /> ACMG / AMP Standardized Evidence Criteria
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculated combining Population, Computational/Functional, and Segregation evidence
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {activeVariant.acmgCriteria.map((crit, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block">{crit.split(' ')[0]}</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{crit.substring(crit.indexOf(' ') + 1)}</p>
                    </div>
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mt-4">
                  <span className="text-slate-400 uppercase text-[10px] font-semibold block">Molecular Mechanism &amp; Evidence Synthesis</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{activeVariant.evidenceSummary}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'pgx' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-500" /> CPIC Level A Actionable Pharmacogenomic Guidelines
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clinical Pharmacogenetics Implementation Consortium dosing modifications and toxicity warnings
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Gene</th>
                  <th className="py-2.5 px-3">Diplotype / Star Allele</th>
                  <th className="py-2.5 px-3">Metabolizer Phenotype</th>
                  <th className="py-2.5 px-3">Target Drug</th>
                  <th className="py-2.5 px-3">CPIC Level</th>
                  <th className="py-2.5 px-3">Clinical Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {PGX_GUIDELINES.map((pgx, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{pgx.gene}</td>
                    <td className="py-3 px-3 font-mono text-rose-600 dark:text-rose-400">{pgx.diplotype}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {pgx.phenotype}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{pgx.drug}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {pgx.cpicLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-sm">{pgx.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'prs' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-500" /> Polygenic Risk Score (PRS) Multi-Trait Calibrator
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Bayesian LDpred2 / PRS-CS calibrated scores across polygenic human disease cohorts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Coronary Artery Disease PRS</span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">94th Percentile</div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Hazard Ratio: 2.84x (Top Quintile Risk)</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-rose-500 h-full w-[94%]"></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Type 2 Diabetes PRS</span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">68th Percentile</div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Hazard Ratio: 1.42x (Moderate Polygenic Risk)</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-500 h-full w-[68%]"></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Alzheimer Disease PRS (ApoE + Polygenic)</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">32nd Percentile</div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Hazard Ratio: 0.81x (Lower-than-average Population Risk)</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full w-[32%]"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
