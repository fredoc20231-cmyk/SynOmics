import { Molecular3DTarget } from '../types';

export const MOLECULAR_3D_TARGETS: Molecular3DTarget[] = [
  {
    id: 'egfr_kinase_domain',
    pdbId: '1M17',
    name: 'EGFR Kinase Domain & Gefitinib Complex',
    geneSymbol: 'EGFR',
    resolution: '2.60 Å',
    experimentalMethod: 'X-ray Crystallography',
    organism: 'Homo sapiens',
    chains: ['Chain A (EGFR Kinase)', 'Chain B (Ligand Complex)'],
    bindingPockets: [
      {
        id: 'pocket_egfr_atp',
        name: 'ATP-Binding Catalytic Cleft (C797 / L858 / T790)',
        druggabilityScore: 0.98,
        keyResidues: ['Leu718', 'Val726', 'Ala743', 'Met790', 'Cys797', 'Leu844', 'Leu858'],
        ligand: 'Osimertinib / Gefitinib / Erlotinib',
        affinityKd: '1.2 nM',
        deltaG: '-12.4 kcal/mol'
      },
      {
        id: 'pocket_egfr_allosteric_c',
        name: 'Allosteric C-Helix Pocket (EAI045 binding site)',
        druggabilityScore: 0.89,
        keyResidues: ['Thr790', 'Met766', 'Leu777', 'Phe856'],
        ligand: 'EAI045 (4th Gen Allosteric Inhibitor)',
        affinityKd: '18.5 nM',
        deltaG: '-10.6 kcal/mol'
      }
    ],
    description: 'Receptor tyrosine kinase oncogenic driver mutated in non-small cell lung cancer; primary target for covalent 3rd-generation TKIs.'
  },
  {
    id: 'kras_g12c_switch2',
    pdbId: '6OIM',
    name: 'KRAS(G12C) GDP-Bound Switch II Allosteric Pocket',
    geneSymbol: 'KRAS',
    resolution: '1.65 Å',
    experimentalMethod: 'X-ray Crystallography',
    organism: 'Homo sapiens',
    chains: ['Chain A (KRAS G12C Core)'],
    bindingPockets: [
      {
        id: 'pocket_switch2_c12',
        name: 'Switch-II Covalent Pocket (S-IIP Cys12)',
        druggabilityScore: 0.97,
        keyResidues: ['Cys12', 'Val9', 'Gly60', 'Glu62', 'His95', 'Tyr96', 'Gln99'],
        ligand: 'Sotorasib (AMG-510) / Adagrasib (MRTX849)',
        affinityKd: '4.8 nM',
        deltaG: '-11.5 kcal/mol'
      },
      {
        id: 'pocket_kras_pan_switch1',
        name: 'Switch-I/II Interface (Pan-KRAS BI-2852 Cleft)',
        druggabilityScore: 0.86,
        keyResidues: ['Tyr32', 'Asp57', 'Ala59', 'Glu63'],
        ligand: 'BI-2852 / Pan-KRAS PROTAC',
        affinityKd: '42.0 nM',
        deltaG: '-10.1 kcal/mol'
      }
    ],
    description: 'Small GTPase oncogene historically considered undruggable, now targeted via mutant Cys12 covalent engagement trapping KRAS in the inactive GDP state.'
  },
  {
    id: 'tp53_core_dna_binding',
    pdbId: '1TUP',
    name: 'p53 Core DNA-Binding Domain & Rescue Pockets',
    geneSymbol: 'TP53',
    resolution: '2.20 Å',
    experimentalMethod: 'X-ray Crystallography',
    organism: 'Homo sapiens',
    chains: ['Chain A (p53 Monomer)', 'Chain B (Consensus DNA Helix)'],
    bindingPockets: [
      {
        id: 'pocket_y220c_crevice',
        name: 'Y220C Mutation-Induced Surface Crevice',
        druggabilityScore: 0.92,
        keyResidues: ['Cys220', 'Leu145', 'Trp146', 'Val147', 'Pro222', 'Thr230'],
        ligand: 'PC14586 (Selective Y220C Reactivator)',
        affinityKd: '11.0 nM',
        deltaG: '-10.9 kcal/mol'
      },
      {
        id: 'pocket_p53_mdm2_trans',
        name: 'p53 N-Terminal MDM2-Binding Alpha Helix',
        druggabilityScore: 0.95,
        keyResidues: ['Phe19', 'Trp23', 'Leu26'],
        ligand: 'Nutlin-3a / Idasanutlin / Milademetan',
        affinityKd: '2.4 nM',
        deltaG: '-11.8 kcal/mol'
      }
    ],
    description: 'Tumor suppressor p53 DNA-binding domain; structurally stabilized by pharmacological chaperones that restore wild-type folding in oncogenic missense mutants.'
  },
  {
    id: 'mettl3_mettl14_sam_pocket',
    pdbId: '7ACD',
    name: 'METTL3/METTL14 SAM-Binding Catalytic Pocket',
    geneSymbol: 'METTL3',
    resolution: '1.90 Å',
    experimentalMethod: 'X-ray Crystallography',
    organism: 'Homo sapiens',
    chains: ['Chain A (METTL3 MTase)', 'Chain B (METTL14 MTase)'],
    bindingPockets: [
      {
        id: 'pocket_sam_catalytic',
        name: 'S-Adenosyl-L-Methionine (SAM) Methyl Transfer Cavity',
        druggabilityScore: 0.96,
        keyResidues: ['Asn549', 'Asp395', 'Ile378', 'Pro396', 'Arg536', 'His538'],
        ligand: 'STM2457 / STC-15',
        affinityKd: '16.9 nM',
        deltaG: '-10.6 kcal/mol'
      }
    ],
    description: 'Epitranscriptomic m6A methyltransferase writer catalytic core; target for anti-leukemic and cancer immunotherapy adjuvant therapies.'
  },
  {
    id: 'pcsk9_ldlr_binding_domain',
    pdbId: '2P4E',
    name: 'PCSK9 Catalytic Domain & LDLR EGF-A Interface',
    geneSymbol: 'PCSK9',
    resolution: '1.98 Å',
    experimentalMethod: 'X-ray Crystallography',
    organism: 'Homo sapiens',
    chains: ['Chain A (PCSK9 Prodomain + Catalytic)', 'Chain B (LDLR EGF-A)'],
    bindingPockets: [
      {
        id: 'pocket_ldlr_egf_interface',
        name: 'EGF-A Domain Interaction Groove (D374Y Hotspot)',
        druggabilityScore: 0.94,
        keyResidues: ['Asp374', 'Arg194', 'Phe379', 'Ser381', 'Ile369'],
        ligand: 'Evolocumab / MK-0616 Macrocycle',
        affinityKd: '0.8 nM',
        deltaG: '-12.8 kcal/mol'
      }
    ],
    description: 'Master regulator of plasma LDL cholesterol clearance; blocking PCSK9 binding to LDLR preserves receptor recycling and protects against cardiovascular events.'
  },
  {
    id: 'cftr_nbd_tmd_complex',
    pdbId: '6MSM',
    name: 'CFTR Cryo-EM Structure & Trikafta Modulator Pockets',
    geneSymbol: 'CFTR',
    resolution: '3.20 Å',
    experimentalMethod: 'Cryo-Electron Microscopy',
    organism: 'Homo sapiens',
    chains: ['Chain A (CFTR Full-length ABC Transporter)'],
    bindingPockets: [
      {
        id: 'pocket_ivacaftor_potentiator',
        name: 'Transmembrane Potentiator Cavity (Ivacaftor Pocket)',
        druggabilityScore: 0.95,
        keyResidues: ['Phe312', 'Phe931', 'Leu383', 'Ile307'],
        ligand: 'Ivacaftor (VX-770) / Elexacaftor (VX-445)',
        affinityKd: '5.2 nM',
        deltaG: '-11.4 kcal/mol'
      },
      {
        id: 'pocket_f508del_corrector',
        name: 'NBD1-TMD2 Interface Chaperone Site (Tezacaftor)',
        druggabilityScore: 0.91,
        keyResidues: ['Phe508', 'Arg1070', 'Ser511', 'Trp496'],
        ligand: 'Tezacaftor (VX-661)',
        affinityKd: '14.0 nM',
        deltaG: '-10.8 kcal/mol'
      }
    ],
    description: 'Epithelial chloride channel; pharmacological correctors and potentiators rescue folding and channel gating in cystic fibrosis patients with F508del.'
  }
];
