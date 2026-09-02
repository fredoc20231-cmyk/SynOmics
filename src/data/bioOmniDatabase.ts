import { BiologicalEntity, GOOntologyNode, BioOmniToolDeclaration, BioProtocol } from '../types';

export const BIOLOGICAL_ENTITIES: BiologicalEntity[] = [
  // Oncology
  {
    id: 'ENT-TP53',
    geneSymbol: 'TP53',
    name: 'Cellular Tumor Antigen p53',
    uniprotId: 'P04637',
    ensemblId: 'ENSG00000141510',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Chromatin, Cytoplasm',
    biologicalDomain: 'oncology',
    organism: 'human',
    molecularWeightKDa: 53.0,
    primaryFunction: 'Guardian of the genome; master tumor suppressor transcription factor mediating cell cycle arrest, DNA repair, senescence, and apoptosis.',
    pathways: ['p53 Signaling Pathway', 'Apoptosis', 'Cell Cycle Checkpoints', 'DNA Damage Response', 'Ferroptosis Regulation'],
    keyInteractors: ['MDM2', 'EP300', 'ATM', 'CHEK2', 'CDKN1A', 'BAX', 'PUMA'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Oncogenic Driver',
        evidenceScore: 0.99,
        description: 'Somatic missense mutations in the DNA-binding domain (R175, R248, R273) occur in >50% of human malignancies, causing loss of function and dominant-negative oncogenic gain-of-function.'
      },
      {
        disease: 'rare_genetic_disorder',
        associationType: 'De Novo Mutation',
        evidenceScore: 0.98,
        description: 'Germline mutations cause Li-Fraumeni syndrome, a severe autosomal dominant cancer predisposition syndrome.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 45.2, zScore: 1.1 },
      { cellType: 'Fibroblast', tpm: 38.6, zScore: 0.8 },
      { cellType: 'T_Cell', tpm: 29.4, zScore: 0.4 },
      { cellType: 'Hepatocyte', tpm: 32.1, zScore: 0.6 }
    ],
    goAnnotations: [
      { goId: 'GO:0006915', term: 'apoptotic process', domain: 'Biological Process' },
      { goId: 'GO:0007049', term: 'cell cycle arrest', domain: 'Biological Process' },
      { goId: 'GO:0006281', term: 'DNA repair', domain: 'Biological Process' },
      { goId: 'GO:0003677', term: 'DNA binding', domain: 'Molecular Function' },
      { goId: 'GO:0005634', term: 'nucleus', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['APR-246 (Eprenetapopt)', 'Nutlin-3a', 'Idasanutlin', 'PC14586'],
      therapeuticStatus: 'Clinical Trials'
    },
    differentialAbundanceInOncologyLog2FC: -2.8
  },
  {
    id: 'ENT-KRAS',
    geneSymbol: 'KRAS',
    name: 'Kirsten Rat Sarcoma Viral Oncogene Homolog',
    uniprotId: 'P01116',
    ensemblId: 'ENSG00000133703',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Inner leaflet of plasma membrane',
    biologicalDomain: 'oncology',
    organism: 'human',
    molecularWeightKDa: 21.6,
    primaryFunction: 'Membrane-bound small GTPase acting as a molecular switch for MAPK/ERK and PI3K/AKT proliferative signaling cascaded.',
    pathways: ['MAPK/ERK Cascade', 'PI3K-Akt Signaling', 'Ras Signaling', 'Pancreatic Cancer Signaling', 'Colorectal Carcinogenesis'],
    keyInteractors: ['BRAF', 'RAF1', 'PIK3CA', 'SOS1', 'NF1', 'RALA', 'GRB2'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Oncogenic Driver',
        evidenceScore: 0.99,
        description: 'Activating codon 12/13/61 mutations (G12D, G12V, G12C) drive pancreatic ductal adenocarcinoma (90%), colorectal cancer (45%), and non-small cell lung cancer (30%).'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 68.4, zScore: 1.8 },
      { cellType: 'Hepatocyte', tpm: 42.1, zScore: 0.9 },
      { cellType: 'Endothelial_Cell', tpm: 35.8, zScore: 0.6 }
    ],
    goAnnotations: [
      { goId: 'GO:0007165', term: 'signal transduction', domain: 'Biological Process' },
      { goId: 'GO:0003924', term: 'GTPase activity', domain: 'Molecular Function' },
      { goId: 'GO:0005886', term: 'plasma membrane', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Sotorasib (AMG-510)', 'Adagrasib (MRTX849)', 'MRTX1133', 'BI-2852'],
      therapeuticStatus: 'Approved'
    },
    differentialAbundanceInOncologyLog2FC: 3.4
  },
  {
    id: 'ENT-EGFR',
    geneSymbol: 'EGFR',
    name: 'Epidermal Growth Factor Receptor',
    uniprotId: 'P00533',
    ensemblId: 'ENSG00000146648',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Cell membrane, Endosome',
    biologicalDomain: 'oncology',
    organism: 'human',
    molecularWeightKDa: 134.3,
    primaryFunction: 'Transmembrane receptor tyrosine kinase binding EGF and TGF-alpha to trigger cell proliferation, survival, and motility.',
    pathways: ['EGFR Tyrosine Kinase Pathway', 'ErbB Signaling', 'MAPK Pathway', 'PI3K/Akt Pathway'],
    keyInteractors: ['GRB2', 'SHC1', 'SOS1', 'CBL', 'STAT3', 'SRC', 'PIK3R1'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Oncogenic Driver',
        evidenceScore: 0.99,
        description: 'Exon 19 in-frame deletions and L858R point mutations drive non-small cell lung adenocarcinoma, conferring sensitivity to tyrosine kinase inhibitors.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 88.5, zScore: 2.2 },
      { cellType: 'Endothelial_Cell', tpm: 24.1, zScore: 0.4 }
    ],
    goAnnotations: [
      { goId: 'GO:0007169', term: 'transmembrane receptor protein tyrosine kinase signaling pathway', domain: 'Biological Process' },
      { goId: 'GO:0004714', term: 'transmembrane receptor protein tyrosine kinase activity', domain: 'Molecular Function' },
      { goId: 'GO:0005886', term: 'plasma membrane', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Osimertinib', 'Gefitinib', 'Erlotinib', 'Cetuximab', 'Panitumumab'],
      therapeuticStatus: 'Approved'
    },
    differentialAbundanceInOncologyLog2FC: 3.8
  },
  {
    id: 'ENT-BRCA1',
    geneSymbol: 'BRCA1',
    name: 'Breast Cancer Type 1 Susceptibility Protein',
    uniprotId: 'P38398',
    ensemblId: 'ENSG00000012048',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Chromatin, Centrosome',
    biologicalDomain: 'oncology',
    organism: 'human',
    molecularWeightKDa: 207.7,
    primaryFunction: 'E3 ubiquitin-protein ligase coordinating homologous recombination DNA double-strand break repair with BARD1.',
    pathways: ['Homologous Recombination', 'DNA Double-Strand Break Repair', 'Fanconi Anemia Pathway', 'Cell Cycle G2/M Checkpoint'],
    keyInteractors: ['BARD1', 'PALB2', 'BRCA2', 'RAD51', 'BAP1', 'TOPBP1', 'CHEK2'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'De Novo Mutation',
        evidenceScore: 0.99,
        description: 'Germline loss-of-function variants confer high lifetime risk for hereditary breast and ovarian cancer (HBOC).'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 22.4, zScore: 0.8 },
      { cellType: 'T_Cell', tpm: 18.2, zScore: 0.6 }
    ],
    goAnnotations: [
      { goId: 'GO:0006281', term: 'DNA repair', domain: 'Biological Process' },
      { goId: 'GO:0000724', term: 'double-strand break repair via homologous recombination', domain: 'Biological Process' },
      { goId: 'GO:0016874', term: 'ligase activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Olaparib (PARP synthetic lethality)', 'Talazoparib', 'Rucaparib', 'Niraparib'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-MYC',
    geneSymbol: 'MYC',
    name: 'MYC Proto-Oncogene, bHLH Transcription Factor',
    uniprotId: 'P01106',
    ensemblId: 'ENSG00000136997',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Nucleoplasm',
    biologicalDomain: 'oncology',
    organism: 'human',
    molecularWeightKDa: 48.8,
    primaryFunction: 'Master basic helix-loop-helix transcription factor heterodimerizing with MAX to amplify global transcription and metabolic rewiring.',
    pathways: ['Transcriptional Amplification', 'Ribosome Biogenesis', 'Glycolysis Regulation', 'Burkitt Lymphoma Pathogenesis'],
    keyInteractors: ['MAX', 'TRRAP', 'EP300', 'FBXW7', 'SKP2', 'CDK9'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Oncogenic Driver',
        evidenceScore: 0.99,
        description: 'Gene amplification and chromosomal translocations (t(8;14)) drive Burkitt lymphoma, medulloblastoma, and breast cancer.'
      }
    ],
    expressionByCellType: [
      { cellType: 'T_Cell', tpm: 94.2, zScore: 2.1 },
      { cellType: 'Epithelial_Cell', tpm: 64.5, zScore: 1.4 }
    ],
    goAnnotations: [
      { goId: 'GO:0006355', term: 'regulation of transcription, DNA-templated', domain: 'Biological Process' },
      { goId: 'GO:0003700', term: 'DNA-binding transcription factor activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Omomyc (MYC dominant-negative)', 'JQ1 (BET bromodomain inhibitor)', 'ARV-771'],
      therapeuticStatus: 'Clinical Trials'
    }
  },

  // Epitranscriptomics
  {
    id: 'ENT-METTL3',
    geneSymbol: 'METTL3',
    name: 'N6-Adenosine-Methyltransferase Catalytic Subunit',
    uniprotId: 'Q86U44',
    ensemblId: 'ENSG00000165819',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Nuclear Speckles',
    biologicalDomain: 'transcriptomics',
    organism: 'human',
    molecularWeightKDa: 64.5,
    primaryFunction: 'Catalytic core of the m6A methyltransferase writer complex; transfers methyl groups from SAM to adenosine in DRACH motifs on mRNA and lncRNA.',
    pathways: ['RNA Methylation (m6A)', 'Epitranscriptomic Gene Regulation', 'mRNA Decay & Splicing', 'Hematopoietic Stem Cell Differentiation'],
    keyInteractors: ['METTL14', 'WTAP', 'KIAA1429', 'RBM15', 'ZC3H13', 'YTHDF2'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Altered Expression',
        evidenceScore: 0.92,
        description: 'Overexpression sustains leukemogenesis in acute myeloid leukemia (AML) and promotes therapy resistance in glioblastoma.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Hematopoietic_Stem_Cell', tpm: 52.4, zScore: 1.8 },
      { cellType: 'T_Cell', tpm: 38.6, zScore: 1.0 },
      { cellType: 'Epithelial_Cell', tpm: 31.2, zScore: 0.7 }
    ],
    goAnnotations: [
      { goId: 'GO:0016556', term: 'mRNA methylation', domain: 'Biological Process' },
      { goId: 'GO:0008173', term: 'RNA methyltransferase activity', domain: 'Molecular Function' },
      { goId: 'GO:0016607', term: 'nuclear speck', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['STM2457 (selective METTL3 inhibitor)', 'STC-15 (oral clinical derivative)'],
      therapeuticStatus: 'Clinical Trials'
    },
    epitranscriptomicRole: 'm6A Writer'
  },
  {
    id: 'ENT-FTO',
    geneSymbol: 'FTO',
    name: 'Fat Mass and Obesity-Associated Protein (m6A/m6Am Demethylase)',
    uniprotId: 'Q9C0B1',
    ensemblId: 'ENSG00000140718',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Nucleoplasm',
    biologicalDomain: 'metabolomics',
    organism: 'human',
    molecularWeightKDa: 58.3,
    primaryFunction: 'Fe(II)- and 2-oxoglutarate-dependent oxygenase demethylating N6-methyladenosine (m6A) and N6,2-O-dimethyladenosine (m6Am) to regulate energy homeostasis.',
    pathways: ['RNA Demethylation', 'Adipogenesis Regulation', 'Energy Metabolism', 'Dopaminergic Neurotransmission'],
    keyInteractors: ['ALKBH5', 'YTHDF2', 'CEBPA', 'STAT3'],
    associatedDiseases: [
      {
        disease: 'type2_diabetes',
        associationType: 'GWAS Significant Locus',
        evidenceScore: 0.99,
        description: 'Intronic SNP rs9939609 is the strongest polygenic GWAS risk locus for human obesity, metabolic syndrome, and secondary T2D.'
      },
      {
        disease: 'cancer',
        associationType: 'Altered Expression',
        evidenceScore: 0.88,
        description: 'FTO upregulation suppresses immune checkpoint surveillance in melanoma and AML.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Adipocyte', tpm: 64.2, zScore: 2.1 },
      { cellType: 'Hepatocyte', tpm: 41.5, zScore: 1.1 }
    ],
    goAnnotations: [
      { goId: 'GO:0070989', term: 'oxidative RNA demethylation', domain: 'Biological Process' },
      { goId: 'GO:0006091', term: 'generation of precursor metabolites and energy', domain: 'Biological Process' },
      { goId: 'GO:0016705', term: 'oxidoreductase activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['FB23-2', 'Dac51', 'Entacapone', 'Meclofenamic Acid'],
      therapeuticStatus: 'Preclinical'
    },
    epitranscriptomicRole: 'm6A Eraser'
  },

  // Immunology
  {
    id: 'ENT-PDCD1',
    geneSymbol: 'PDCD1',
    name: 'Programmed Cell Death Protein 1 (PD-1)',
    uniprotId: 'Q15116',
    ensemblId: 'ENSG00000188389',
    compartment: 'plasma_membrane',
    subcellularLocation: 'T cell plasma membrane',
    biologicalDomain: 'immunology',
    organism: 'human',
    molecularWeightKDa: 31.6,
    primaryFunction: 'Inhibitory immune checkpoint receptor on activated T cells; engages CD274 (PD-L1) to recruit SHP-2 phosphatase and attenuate TCR signaling.',
    pathways: ['T Cell Receptor Signaling', 'Immune Checkpoint Blockade', 'Cancer Immunotherapy', 'Autoimmune Self-Tolerance'],
    keyInteractors: ['CD274 (PD-L1)', 'PDCD1LG2 (PD-L2)', 'PTPN11 (SHP-2)', 'LCK', 'ZAP70'],
    associatedDiseases: [
      {
        disease: 'cancer',
        associationType: 'Immune Checkpoint',
        evidenceScore: 0.99,
        description: 'Tumor expression of PD-L1 exhausts tumor-infiltrating lymphocytes; antibody checkpoint blockade restores durable anti-tumor immunity.'
      },
      {
        disease: 'inflammatory_bowel_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.85,
        description: 'Dysregulation leads to break of peripheral tolerance and autoimmune colonic inflammation.'
      }
    ],
    expressionByCellType: [
      { cellType: 'T_Cell', tpm: 84.1, zScore: 3.2 },
      { cellType: 'Macrophage', tpm: 12.4, zScore: 0.5 }
    ],
    goAnnotations: [
      { goId: 'GO:0050863', term: 'regulation of T cell activation', domain: 'Biological Process' },
      { goId: 'GO:0006954', term: 'inflammatory response', domain: 'Biological Process' },
      { goId: 'GO:0005886', term: 'plasma membrane', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Pembrolizumab', 'Nivolumab', 'Cemiplimab', 'Dostarlimab'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-TNF',
    geneSymbol: 'TNF',
    name: 'Tumor Necrosis Factor Alpha',
    uniprotId: 'P01375',
    ensemblId: 'ENSG00000232810',
    compartment: 'extracellular',
    subcellularLocation: 'Secreted cytokine, Type II transmembrane protein',
    biologicalDomain: 'immunology',
    organism: 'human',
    molecularWeightKDa: 25.6,
    primaryFunction: 'Pro-inflammatory master cytokine secreted by macrophages and T cells to drive systemic inflammation, acute phase response, and necroptosis.',
    pathways: ['TNF Signaling Pathway', 'NF-kappa B Activation', 'Apoptosis & Necroptosis', 'Rheumatoid Arthritis Pathogenesis'],
    keyInteractors: ['TNFRSF1A (TNFR1)', 'TNFRSF1B (TNFR2)', 'TRADD', 'TRAF2', 'RIPK1', 'RIPK3'],
    associatedDiseases: [
      {
        disease: 'inflammatory_bowel_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.98,
        description: 'Mucosal hypersecretion drives mucosal ulceration and barrier breakdown in Crohn disease and ulcerative colitis.'
      },
      {
        disease: 'cardiovascular_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.86,
        description: 'Chronic vascular endothelial activation accelerates atherosclerotic plaque destabilization.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Macrophage', tpm: 112.5, zScore: 3.4 },
      { cellType: 'T_Cell', tpm: 48.2, zScore: 1.5 },
      { cellType: 'Endothelial_Cell', tpm: 8.4, zScore: 0.2 }
    ],
    goAnnotations: [
      { goId: 'GO:0006954', term: 'inflammatory response', domain: 'Biological Process' },
      { goId: 'GO:0005125', term: 'cytokine activity', domain: 'Molecular Function' },
      { goId: 'GO:0005576', term: 'extracellular region', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Infliximab', 'Adalimumab', 'Etanercept', 'Golimumab', 'Certolizumab pegol'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-IL6',
    geneSymbol: 'IL6',
    name: 'Interleukin 6',
    uniprotId: 'P05231',
    ensemblId: 'ENSG00000136244',
    compartment: 'extracellular',
    subcellularLocation: 'Secreted cytokine',
    biologicalDomain: 'immunology',
    organism: 'human',
    molecularWeightKDa: 23.7,
    primaryFunction: 'Pleiotropic cytokine that signals through IL6R/gp130 complexes to induce acute-phase proteins and differentiate naive T cells into Th17 cells.',
    pathways: ['JAK-STAT Signaling', 'IL-6 Signaling', 'Acute-Phase Response', 'Cytokine Release Syndrome'],
    keyInteractors: ['IL6R', 'IL6ST (gp130)', 'JAK1', 'JAK2', 'STAT3', 'SOCS3'],
    associatedDiseases: [
      {
        disease: 'infectious_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.95,
        description: 'Hyper-elevation triggers cytokine release syndrome (CRS) in severe SARS-CoV-2 and CAR-T cell immunotherapy.'
      },
      {
        disease: 'inflammatory_bowel_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.91,
        description: 'Drives pathogenic chronic inflammatory bowel pathology.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Macrophage', tpm: 76.4, zScore: 2.8 },
      { cellType: 'Fibroblast', tpm: 54.1, zScore: 1.9 },
      { cellType: 'Endothelial_Cell', tpm: 22.8, zScore: 0.9 }
    ],
    goAnnotations: [
      { goId: 'GO:0006954', term: 'inflammatory response', domain: 'Biological Process' },
      { goId: 'GO:0005125', term: 'cytokine activity', domain: 'Molecular Function' },
      { goId: 'GO:0005576', term: 'extracellular region', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Tocilizumab (anti-IL6R)', 'Sarilumab', 'Siltuximab'],
      therapeuticStatus: 'Approved'
    }
  },

  // Metabolism & Endocrinology
  {
    id: 'ENT-PPARG',
    geneSymbol: 'PPARG',
    name: 'Peroxisome Proliferator-Activated Receptor Gamma',
    uniprotId: 'P37231',
    ensemblId: 'ENSG00000132170',
    compartment: 'nucleus',
    subcellularLocation: 'Nucleus, Heterodimer with RXRA',
    biologicalDomain: 'metabolomics',
    organism: 'human',
    molecularWeightKDa: 57.6,
    primaryFunction: 'Nuclear hormone receptor and master transcriptional regulator of adipocyte differentiation, lipid storage, and insulin sensitivity.',
    pathways: ['PPAR Signaling Pathway', 'Adipogenesis', 'Fatty Acid Metabolism', 'Insulin Sensitivity Regulation'],
    keyInteractors: ['RXRA', 'NCOA1', 'NCOR1', 'MED1', 'FABP4', 'ADIPOQ'],
    associatedDiseases: [
      {
        disease: 'type2_diabetes',
        associationType: 'GWAS Significant Locus',
        evidenceScore: 0.98,
        description: 'Pro12Ala polymorphism (rs1801282) modulates insulin sensitivity; ligand activation restores peripheral glucose uptake.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Adipocyte', tpm: 128.4, zScore: 3.6 },
      { cellType: 'Macrophage', tpm: 32.1, zScore: 1.1 },
      { cellType: 'Hepatocyte', tpm: 14.8, zScore: 0.4 }
    ],
    goAnnotations: [
      { goId: 'GO:0008152', term: 'metabolic process', domain: 'Biological Process' },
      { goId: 'GO:0006629', term: 'lipid metabolic process', domain: 'Biological Process' },
      { goId: 'GO:0003700', term: 'DNA-binding transcription factor activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Pioglitazone', 'Rosiglitazone', 'Lobeglitazone', 'Telmisartan'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-INSR',
    geneSymbol: 'INSR',
    name: 'Insulin Receptor',
    uniprotId: 'P06213',
    ensemblId: 'ENSG00000171105',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Plasma membrane tetramer (alpha2-beta2)',
    biologicalDomain: 'metabolomics',
    organism: 'human',
    molecularWeightKDa: 156.3,
    primaryFunction: 'Receptor tyrosine kinase that upon insulin binding autophosphorylates and recruits IRS1/2 to stimulate GLUT4 translocation and glycogen synthesis.',
    pathways: ['Insulin Signaling Pathway', 'Glucose Homeostasis', 'PI3K/Akt Cascade', 'Glycogen Synthesis'],
    keyInteractors: ['IRS1', 'IRS2', 'PIK3R1', 'PTPN1 (PTP1B)', 'GRB2', 'SLC2A4 (GLUT4)'],
    associatedDiseases: [
      {
        disease: 'type2_diabetes',
        associationType: 'Altered Expression',
        evidenceScore: 0.96,
        description: 'Serine hyperphosphorylation by inflammatory kinases drives severe peripheral insulin resistance in metabolic syndrome.'
      },
      {
        disease: 'rare_genetic_disorder',
        associationType: 'Rare CNV',
        evidenceScore: 0.95,
        description: 'Homozygous loss causes Donohue syndrome (leprechaunism) and Rabson-Mendenhall syndrome.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Hepatocyte', tpm: 72.4, zScore: 2.1 },
      { cellType: 'Adipocyte', tpm: 68.9, zScore: 1.9 },
      { cellType: 'Endothelial_Cell', tpm: 34.2, zScore: 0.8 }
    ],
    goAnnotations: [
      { goId: 'GO:0006006', term: 'glucose metabolic process', domain: 'Biological Process' },
      { goId: 'GO:0004714', term: 'transmembrane receptor protein tyrosine kinase activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Recombinant Human Insulin', 'Insulin Glargine', 'Insulin Lispro'],
      therapeuticStatus: 'Approved'
    }
  },

  // Cardiovascular
  {
    id: 'ENT-PCSK9',
    geneSymbol: 'PCSK9',
    name: 'Proprotein Convertase Subtilisin/Kexin Type 9',
    uniprotId: 'Q8NBP7',
    ensemblId: 'ENSG00000169174',
    compartment: 'extracellular',
    subcellularLocation: 'Secreted subtilase enzyme, Endoplasmic reticulum',
    biologicalDomain: 'metabolomics',
    organism: 'human',
    molecularWeightKDa: 74.3,
    primaryFunction: 'Secreted protease that binds the extracellular domain of the low-density lipoprotein receptor (LDLR) to divert it to lysosomal degradation.',
    pathways: ['Cholesterol Homeostasis', 'Lipoprotein Clearance', 'Atherosclerosis Pathogenesis'],
    keyInteractors: ['LDLR', 'VLDLR', 'LRP1', 'APOB'],
    associatedDiseases: [
      {
        disease: 'cardiovascular_disease',
        associationType: 'GWAS Significant Locus',
        evidenceScore: 0.99,
        description: 'Gain-of-function variants (e.g. D374Y) cause severe autosomal dominant hypercholesterolemia; loss-of-function variants confer lifelong coronary heart disease protection.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Hepatocyte', tpm: 142.1, zScore: 3.8 },
      { cellType: 'Epithelial_Cell', tpm: 12.3, zScore: 0.3 }
    ],
    goAnnotations: [
      { goId: 'GO:0006695', term: 'cholesterol biosynthetic process', domain: 'Biological Process' },
      { goId: 'GO:0004252', term: 'serine-type endopeptidase activity', domain: 'Molecular Function' },
      { goId: 'GO:0005576', term: 'extracellular region', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Evolocumab', 'Alirocumab', 'Inclisiran (siRNA)', 'MK-0616 (oral macrocyclic peptide)'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-ACE2',
    geneSymbol: 'ACE2',
    name: 'Angiotensin-Converting Enzyme 2',
    uniprotId: 'Q9BYF1',
    ensemblId: 'ENSG00000130234',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Apical plasma membrane of enterocytes and alveolar pneumocytes',
    biologicalDomain: 'cell_biology',
    organism: 'human',
    molecularWeightKDa: 92.5,
    primaryFunction: 'Zinc metalloprotease that cleaves Angiotensin II into cardioprotective Angiotensin (1-7); functions as functional receptor for SARS-CoV and SARS-CoV-2 spike glycoprotein.',
    pathways: ['Renin-Angiotensin-Aldosterone System (RAAS)', 'Viral Entry & Infection', 'Cardiovascular Protection'],
    keyInteractors: ['AGT', 'SARS-CoV-2 Spike', 'TMPRSS2', 'ADAM17', 'SLC6A19'],
    associatedDiseases: [
      {
        disease: 'infectious_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.99,
        description: 'Direct binding pocket for SARS-CoV-2 spike receptor-binding domain mediating cellular entry.'
      },
      {
        disease: 'cardiovascular_disease',
        associationType: 'Altered Expression',
        evidenceScore: 0.91,
        description: 'Loss of ACE2 enzymatic activity exacerbates hypertension, cardiac hypertrophy, and renal fibrosis.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 96.5, zScore: 2.9 },
      { cellType: 'Endothelial_Cell', tpm: 28.4, zScore: 0.8 }
    ],
    goAnnotations: [
      { goId: 'GO:0008217', term: 'regulation of blood pressure', domain: 'Biological Process' },
      { goId: 'GO:0004180', term: 'carboxypeptidase activity', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Recombinant Human Soluble ACE2 (APN01)', 'MLN-4760'],
      therapeuticStatus: 'Clinical Trials'
    }
  },

  // Rare Genetic Disorders
  {
    id: 'ENT-CFTR',
    geneSymbol: 'CFTR',
    name: 'Cystic Fibrosis Transmembrane Conductance Regulator',
    uniprotId: 'P13569',
    ensemblId: 'ENSG00000001626',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Apical plasma membrane of secretory epithelia',
    biologicalDomain: 'genomics',
    organism: 'human',
    molecularWeightKDa: 168.1,
    primaryFunction: 'ATP-binding cassette (ABC) transporter-class ion channel conducting chloride and thiocyanate ions across epithelial cell membranes.',
    pathways: ['Chloride Transmembrane Transport', 'Mucociliary Clearance', 'Airway Epithelial Homeostasis'],
    keyInteractors: ['SLC26A4', 'NHERF1 (SLC9A3R1)', 'EZR', 'HSP90AA1', 'HSPA8'],
    associatedDiseases: [
      {
        disease: 'rare_genetic_disorder',
        associationType: 'De Novo Mutation',
        evidenceScore: 0.99,
        description: 'Autosomal recessive loss-of-function variants (e.g. F508del in >70% of alleles) cause Cystic Fibrosis with thick viscous mucus, bronchiectasis, and pancreatic exocrine insufficiency.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Epithelial_Cell', tpm: 82.3, zScore: 2.7 },
      { cellType: 'Fibroblast', tpm: 6.2, zScore: 0.1 }
    ],
    goAnnotations: [
      { goId: 'GO:0006821', term: 'chloride transport', domain: 'Biological Process' },
      { goId: 'GO:0005254', term: 'chloride channel activity', domain: 'Molecular Function' },
      { goId: 'GO:0005886', term: 'plasma membrane', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Trikafta (Elexacaftor/Tezacaftor/Ivacaftor)', 'Kalydeco (Ivacaftor)', 'Symkevi'],
      therapeuticStatus: 'Approved'
    }
  },
  {
    id: 'ENT-DMD',
    geneSymbol: 'DMD',
    name: 'Dystrophin',
    uniprotId: 'P11532',
    ensemblId: 'ENSG00000198947',
    compartment: 'plasma_membrane',
    subcellularLocation: 'Sarcolemma inner face, Costamere',
    biologicalDomain: 'genomics',
    organism: 'human',
    molecularWeightKDa: 427.0,
    primaryFunction: 'Massive rod-shaped cytoskeletal protein connecting intracellular F-actin to the extracellular matrix via the dystrophin-associated glycoprotein complex (DAGC).',
    pathways: ['Sarcolemma Mechanical Stability', 'Costamere Assembly', 'Muscle Contraction'],
    keyInteractors: ['DAG1 (Dystroglycan)', 'SGCA', 'SGCB', 'SGCG', 'SGCD', 'ACTA1', 'NOS1', 'SNTA1'],
    associatedDiseases: [
      {
        disease: 'rare_genetic_disorder',
        associationType: 'Rare CNV',
        evidenceScore: 0.99,
        description: 'X-linked frame-shifting deletions cause Duchenne Muscular Dystrophy (DMD); in-frame deletions cause milder Becker Muscular Dystrophy (BMD).'
      }
    ],
    expressionByCellType: [
      { cellType: 'Skeletal_Myocyte', tpm: 148.6, zScore: 3.9 },
      { cellType: 'Cardiomyocyte', tpm: 92.4, zScore: 2.8 }
    ],
    goAnnotations: [
      { goId: 'GO:0006936', term: 'muscle contraction', domain: 'Biological Process' },
      { goId: 'GO:0003779', term: 'actin binding', domain: 'Molecular Function' },
      { goId: 'GO:0005886', term: 'plasma membrane', domain: 'Cellular Component' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['Eteplirsen (Exon 51 skipping PMO)', 'Golodirsen', 'Casimersen', 'Delandistrogene moxeparvovec (AAV Gene Therapy)'],
      therapeuticStatus: 'Approved'
    }
  },

  // Neuroscience & Neurodegeneration (one domain among many)
  {
    id: 'ENT-MAPT',
    geneSymbol: 'MAPT',
    name: 'Microtubule-Associated Protein Tau',
    uniprotId: 'P10636',
    ensemblId: 'ENSG00000186868',
    compartment: 'cytoplasm',
    subcellularLocation: 'Neuronal axons, Microtubules',
    biologicalDomain: 'neuroscience',
    organism: 'human',
    molecularWeightKDa: 45.8,
    primaryFunction: 'Promotes microtubule assembly and stability in axonal compartments; regulated by dynamic phosphorylation.',
    pathways: ['Microtubule Dynamics', 'Axonal Transport', 'Tauopathy Aggregation'],
    keyInteractors: ['TUBB', 'TUBA1A', 'GSK3B', 'CDK5', 'MARK2', 'PIN1'],
    associatedDiseases: [
      {
        disease: 'alzheimers_disease',
        associationType: 'Post-translational Defect',
        evidenceScore: 0.98,
        description: 'Hyperphosphorylation at Thr217/Thr181 causes detachment from microtubules and aggregation into paired helical neurofibrillary tangles.'
      },
      {
        disease: 'rare_genetic_disorder',
        associationType: 'De Novo Mutation',
        evidenceScore: 0.96,
        description: 'P301L and R406W mutations cause frontotemporal dementia with parkinsonism linked to chromosome 17 (FTDP-17).'
      }
    ],
    expressionByCellType: [
      { cellType: 'Cortical_Neuron', tpm: 184.2, zScore: 4.1 },
      { cellType: 'Oligodendrocyte', tpm: 18.5, zScore: 0.5 }
    ],
    goAnnotations: [
      { goId: 'GO:0007018', term: 'microtubule-based movement', domain: 'Biological Process' },
      { goId: 'GO:0008017', term: 'microtubule binding', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['BIIB080 (Tau ASO)', 'LMTX (Hydromethylthionine)', 'Gosuranemab'],
      therapeuticStatus: 'Clinical Trials'
    }
  },
  {
    id: 'ENT-APOE',
    geneSymbol: 'APOE',
    name: 'Apolipoprotein E',
    uniprotId: 'P02649',
    ensemblId: 'ENSG00000130203',
    compartment: 'extracellular',
    subcellularLocation: 'Secreted lipoprotein particle',
    biologicalDomain: 'neuroscience',
    organism: 'human',
    molecularWeightKDa: 36.2,
    primaryFunction: 'Core protein component of chylomicrons, VLDL, and HDL; mediates lipid and cholesterol transport and amyloid-beta clearance via LDLR and LRP1.',
    pathways: ['Lipid Transport', 'Amyloid-Beta Clearance', 'Lipoprotein Metabolism'],
    keyInteractors: ['LDLR', 'LRP1', 'TREM2', 'APP', 'ABCA1'],
    associatedDiseases: [
      {
        disease: 'alzheimers_disease',
        associationType: 'GWAS Significant Locus',
        evidenceScore: 0.99,
        description: 'The epsilon-4 allele (Cys112Arg) is the major genetic risk factor for late-onset sporadic Alzheimer disease, increasing risk 3-12 fold.'
      },
      {
        disease: 'cardiovascular_disease',
        associationType: 'GWAS Significant Locus',
        evidenceScore: 0.94,
        description: 'Modulates plasma LDL cholesterol and atherosclerotic cardiovascular risk.'
      }
    ],
    expressionByCellType: [
      { cellType: 'Hepatocyte', tpm: 210.4, zScore: 4.2 },
      { cellType: 'Astrocyte', tpm: 165.8, zScore: 3.7 },
      { cellType: 'Microglia', tpm: 84.1, zScore: 2.1 }
    ],
    goAnnotations: [
      { goId: 'GO:0006869', term: 'lipid transport', domain: 'Biological Process' },
      { goId: 'GO:0008289', term: 'lipid binding', domain: 'Molecular Function' }
    ],
    druggability: {
      isDruggable: true,
      knownModulators: ['APOE4 Structural Correctors', 'Anti-ApoE4 Antibodies'],
      therapeuticStatus: 'Preclinical'
    }
  }
];

export const GO_ONTOLOGY_TREE: GOOntologyNode[] = [
  { id: 'GO:0008150', label: 'Biological Process', domain: 'BP', geneCount: 18450, genes: ['TP53', 'KRAS', 'EGFR', 'BRCA1', 'MYC', 'METTL3', 'FTO', 'PDCD1', 'TNF', 'IL6', 'PPARG', 'PCSK9', 'CFTR'], pValEnrichment: 1e-50 },
  { id: 'GO:0006915', label: 'Apoptotic process', domain: 'BP', geneCount: 840, parent: 'GO:0008150', genes: ['TP53', 'BAX', 'BCL2', 'TNF', 'MYC', 'CASP3'], pValEnrichment: 2.4e-32 },
  { id: 'GO:0007049', label: 'Cell cycle', domain: 'BP', geneCount: 1420, parent: 'GO:0008150', genes: ['TP53', 'CDKN1A', 'RB1', 'CDK4', 'CCND1', 'MYC'], pValEnrichment: 8.6e-28 },
  { id: 'GO:0006281', label: 'DNA repair', domain: 'BP', geneCount: 650, parent: 'GO:0008150', genes: ['BRCA1', 'BRCA2', 'TP53', 'ATM', 'PARP1', 'RAD51'], pValEnrichment: 1.2e-29 },
  { id: 'GO:0006954', label: 'Inflammatory response', domain: 'BP', geneCount: 1100, parent: 'GO:0008150', genes: ['TNF', 'IL6', 'IL1B', 'NFKB1', 'CXCL8', 'TLR4'], pValEnrichment: 4.8e-34 },
  { id: 'GO:0050863', label: 'Regulation of T cell activation', domain: 'BP', geneCount: 420, parent: 'GO:0008150', genes: ['PDCD1', 'CD274', 'CTLA4', 'CD28', 'LCK', 'ZAP70'], pValEnrichment: 3.1e-25 },
  { id: 'GO:0007165', label: 'Signal transduction', domain: 'BP', geneCount: 3200, parent: 'GO:0008150', genes: ['KRAS', 'EGFR', 'BRAF', 'PIK3CA', 'AKT1', 'MAPK1'], pValEnrichment: 1.8e-40 },
  { id: 'GO:0016556', label: 'mRNA methylation', domain: 'BP', geneCount: 180, parent: 'GO:0008150', genes: ['METTL3', 'METTL14', 'WTAP', 'FTO', 'ALKBH5', 'YTHDF2'], pValEnrichment: 5.4e-22 },
  { id: 'GO:0006629', label: 'Lipid metabolic process', domain: 'BP', geneCount: 1250, parent: 'GO:0008150', genes: ['PPARG', 'PCSK9', 'APOE', 'LDLR', 'FASN', 'SREBF1'], pValEnrichment: 6.2e-27 },
  { id: 'GO:0006821', label: 'Chloride transport', domain: 'BP', geneCount: 210, parent: 'GO:0008150', genes: ['CFTR', 'SLC26A4', 'CLCN1', 'CLCN2', 'GABRA1'], pValEnrichment: 9.1e-19 },

  { id: 'GO:0005575', label: 'Cellular Component', domain: 'CC', geneCount: 19200, genes: ['TP53', 'KRAS', 'EGFR', 'BRCA1', 'MYC', 'METTL3', 'PDCD1', 'TNF', 'PPARG', 'CFTR'], pValEnrichment: 1e-50 },
  { id: 'GO:0005634', label: 'Nucleus', domain: 'CC', geneCount: 5400, parent: 'GO:0005575', genes: ['TP53', 'BRCA1', 'MYC', 'METTL3', 'PPARG', 'RB1'], pValEnrichment: 4.2e-44 },
  { id: 'GO:0005886', label: 'Plasma membrane', domain: 'CC', geneCount: 4200, parent: 'GO:0005575', genes: ['EGFR', 'KRAS', 'PDCD1', 'INSR', 'CFTR', 'DMD', 'ACE2'], pValEnrichment: 7.8e-39 },
  { id: 'GO:0005576', label: 'Extracellular region', domain: 'CC', geneCount: 2800, parent: 'GO:0005575', genes: ['TNF', 'IL6', 'PCSK9', 'APOE', 'VEGFA', 'EGF'], pValEnrichment: 1.5e-35 },
  { id: 'GO:0005737', label: 'Cytoplasm', domain: 'CC', geneCount: 6800, parent: 'GO:0005575', genes: ['MAPT', 'GAPDH', 'ACTB', 'TUBB', 'MAPK1'], pValEnrichment: 3.3e-30 },

  { id: 'GO:0003674', label: 'Molecular Function', domain: 'MF', geneCount: 17800, genes: ['TP53', 'KRAS', 'EGFR', 'BRCA1', 'MYC', 'METTL3', 'PDCD1', 'TNF', 'PPARG', 'CFTR'], pValEnrichment: 1e-50 },
  { id: 'GO:0003700', label: 'DNA-binding transcription factor activity', domain: 'MF', geneCount: 1650, parent: 'GO:0003674', genes: ['TP53', 'MYC', 'PPARG', 'STAT3', 'NFKB1', 'HIF1A'], pValEnrichment: 8.9e-36 },
  { id: 'GO:0004714', label: 'Transmembrane receptor protein tyrosine kinase activity', domain: 'MF', geneCount: 220, parent: 'GO:0003674', genes: ['EGFR', 'INSR', 'ERBB2', 'MET', 'ALK', 'RET'], pValEnrichment: 2.1e-28 },
  { id: 'GO:0003924', label: 'GTPase activity', domain: 'MF', geneCount: 480, parent: 'GO:0003674', genes: ['KRAS', 'HRAS', 'NRAS', 'RHOA', 'RAC1', 'CDC42'], pValEnrichment: 4.5e-24 },
  { id: 'GO:0008173', label: 'RNA methyltransferase activity', domain: 'MF', geneCount: 140, parent: 'GO:0003674', genes: ['METTL3', 'METTL14', 'NSUN2', 'TRMT1', 'FTSJ1'], pValEnrichment: 7.2e-20 }
];

export const BIOTOOLS_REGISTRY: BioOmniToolDeclaration[] = [
  // Genomics
  {
    id: 'gwas_analysis',
    name: 'GWAS & Fine-Mapping Causal Variant Prioritization',
    category: 'Genomics & Genetics',
    description: 'Runs genome-wide association analysis, genomic inflation (lambda GC) assessment, fine-mapping (SuSiE / FINEMAP), and eQTL colocalization.',
    icon: 'dna',
    parameters: [
      { name: 'trait', type: 'string', description: 'Trait or disease phenotype (e.g., Type 2 Diabetes, Crohn Disease)', required: true },
      { name: 'population', type: 'string', description: 'Ancestry cohort (EUR, AFR, EAS, AMR, SAS)', required: false, default: 'EUR' },
      { name: 'pValThreshold', type: 'number', description: 'Genome-wide significance alpha', required: false, default: 5e-8 }
    ]
  },
  {
    id: 'variant_calling',
    name: 'GATK Germline & Somatic Variant Calling',
    category: 'Genomics & Genetics',
    description: 'HaplotypeCaller / Mutect2 pipeline for SNP, small InDel, and structural variant annotation against ClinVar and gnomAD.',
    icon: 'dna',
    parameters: [
      { name: 'referenceGenome', type: 'string', description: 'Reference build (GRCh38 or GRCm39)', required: false, default: 'GRCh38' }
    ]
  },

  // Transcriptomics
  {
    id: 'rnaseq_differential_expression',
    name: 'DESeq2 / EdgeR Differential Expression Analysis',
    category: 'Transcriptomics',
    description: 'Negative binomial generalized linear model for RNA-seq counts with Benjamini-Hochberg FDR correction and Volcano/PCA generation.',
    icon: 'activity',
    parameters: [
      { name: 'designFormula', type: 'string', description: 'Design formula (e.g. ~ batch + condition)', required: false, default: '~ condition' },
      { name: 'fdrThreshold', type: 'number', description: 'Adjusted p-value cutoff (alpha)', required: false, default: 0.05 },
      { name: 'minLog2FC', type: 'number', description: 'Minimum absolute log2 fold-change', required: false, default: 1.0 }
    ]
  },
  {
    id: 'direct_rna_m6a_profiling',
    name: 'Oxford Nanopore Direct RNA & Epitranscriptomic Modification Calling',
    category: 'Transcriptomics',
    description: 'Single-molecule basecalling of m6A, m5C, and pseudouridine (Ψ) stoichiometry at DRACH consensus sites without antibody bias.',
    icon: 'sparkles',
    parameters: [
      { name: 'modificationType', type: 'string', description: 'Target modification (m6A, m1A, m5C, Ψ)', required: false, default: 'm6A' }
    ]
  },

  // Single-Cell & Spatial
  {
    id: 'scrna_seq_clustering',
    name: 'Scanpy / Seurat Single-Cell Clustering & UMAP',
    category: 'Single-Cell & Spatial',
    description: 'Single-cell droplet QC, Leiden graph-based community detection, UMAP non-linear dimensional embedding, and marker gene ranking.',
    icon: 'compass',
    parameters: [
      { name: 'nNeighbors', type: 'number', description: 'k-nearest neighbors graph size', required: false, default: 15 },
      { name: 'resolution', type: 'number', description: 'Leiden clustering resolution parameter', required: false, default: 0.6 }
    ]
  },
  {
    id: 'spatial_deconvolution',
    name: 'Spatial Transcriptomics Deconvolution (Visium / MERFISH)',
    category: 'Single-Cell & Spatial',
    description: 'Cell2location / RCTD probabilistic deconvolution of multi-cellular spatial spots using single-cell reference atlases.',
    icon: 'map',
    parameters: [
      { name: 'platform', type: 'string', description: '10x Visium, Xenium, or MERFISH', required: false, default: '10x Visium' }
    ]
  },

  // Proteomics
  {
    id: 'proteomics_tmt_quant',
    name: 'TMT / DIA Quantitative Proteomics Engine',
    category: 'Proteomics & Mass Spec',
    description: 'MaxQuant / DIA-NN isobaric and label-free mass spectrometry quantification, peptide normalization, and phosphorylation site mapping.',
    icon: 'layers',
    parameters: [
      { name: 'fdrCutoff', type: 'number', description: 'Peptide-to-spectrum match FDR', required: false, default: 0.01 }
    ]
  },

  // Microbiome
  {
    id: 'microbiome_diversity',
    name: 'QIIME2 / MetaPhlAn Microbiome Metagenomics Suite',
    category: 'Microbiome & Metagenomics',
    description: '16S rRNA / shotgun metagenomic taxonomic profiling, alpha diversity (Shannon, Simpson, Chao1), beta diversity (PCoA Bray-Curtis), and LEfSe biomarkers.',
    icon: 'eye',
    parameters: [
      { name: 'metric', type: 'string', description: 'Diversity metric (bray_curtis, unweighted_unifrac)', required: false, default: 'bray_curtis' }
    ]
  },

  // Epigenomics
  {
    id: 'atac_seq_peak_calling',
    name: 'MACS3 ATAC-Seq / ChIP-Seq Chromatin Accessibility',
    category: 'Epigenomics & Chromatin',
    description: 'Transposase-accessible chromatin peak calling, transcription factor footprinting, and differential accessible region (DAR) discovery.',
    icon: 'sliders',
    parameters: [
      { name: 'genomeSize', type: 'string', description: 'Effective genome size (hs or mm)', required: false, default: 'hs' }
    ]
  },

  // Drug Discovery
  {
    id: 'drug_repurposing_lincs',
    name: 'LINCS L1000 Transcriptomic Signature Reversal & Drug Screening',
    category: 'Drug Discovery & Pharmacology',
    description: 'Queries 1.3M+ perturbation profiles from the Connectivity Map / LINCS L1000 to identify compounds that invert disease transcriptomic signatures.',
    icon: 'box',
    parameters: [
      { name: 'diseaseSignature', type: 'string', description: 'Target disease or upregulated/downregulated gene list', required: true }
    ]
  },
  {
    id: 'alphafold_docking',
    name: 'AlphaFold 3 Multimer & AutoDock Vina Molecular Docking',
    category: 'Structural Biology',
    description: 'Predicts high-resolution 3D protein-ligand and protein-protein complexes with pLDDT scoring, binding affinity (ΔG kcal/mol), and ADMET profile calculation.',
    icon: 'box',
    parameters: [
      { name: 'targetGene', type: 'string', description: 'Target gene symbol or PDB code (e.g. EGFR, KRAS, TP53, METTL3)', required: true },
      { name: 'ligandSmiles', type: 'string', description: 'Ligand SMILES or chemical name', required: false, default: 'Osimertinib' }
    ]
  },

  // Clinical Genomics
  {
    id: 'clinical_variant_acmg',
    name: 'ACMG/AMP Clinical Variant Pathogenicity Interpreter',
    category: 'Clinical Genomics',
    description: 'Evaluates germline and somatic variants against ACMG/AMP 2015 criteria (PVS1, PS1-4, PM1-6, PP1-5) and ClinVar for clinical reporting.',
    icon: 'activity',
    parameters: [
      { name: 'variantHgvs', type: 'string', description: 'HGVS nomenclature (e.g., TP53:c.743G>A)', required: true }
    ]
  }
];

export const PREBUILT_PROTOCOLS: BioProtocol[] = [
  {
    protocolId: 'PROT-RNASEQ-001',
    title: 'Illumina Stranded Total RNA-Seq with Ribo-Zero Gold Depletion',
    author: 'SynOmics Universal Protocols Consortium',
    category: 'Transcriptomics & RNA Biology',
    overview: 'High-yield preparation of strand-specific paired-end RNA sequencing libraries from degraded or total RNA across human, mouse, and plant samples.',
    estimatedTotalTime: '6.5 hours (hands-on: 2.5 hours)',
    equipment: ['Thermal Cycler', 'Magnetic Separation Stand', 'Qubit 4.0 Fluorometer', 'Agilent 4200 TapeStation'],
    reagentsRequired: [
      { name: 'Illumina Stranded Total RNA Prep with Ribo-Zero Plus', catalogRef: '20040529', concentration: '1 kit (96 rxns)' },
      { name: 'Agencourt AMPure XP Beads', catalogRef: 'A63881', concentration: '60 mL' },
      { name: 'SuperScript IV Reverse Transcriptase', catalogRef: '18090010', concentration: '200 U/uL' },
      { name: 'Qubit RNA HS Assay Kit', catalogRef: 'Q32852', concentration: '500 assays' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Total RNA Quality Control & Input Normalization',
        durationMinutes: 30,
        reagents: ['Qubit RNA HS Buffer', 'TapeStation RNA ScreenTape'],
        instructions: 'Quantify sample RNA concentration via Qubit fluorometry. Verify RNA Integrity Number (RIN >= 7.0 for intact, or DV200 > 50% for FFPE). Dilute 100-500 ng input into 10 uL nuclease-free water.',
        criticalQualityControls: 'Exclude samples with severe genomic DNA contamination or low yield < 20 ng.'
      },
      {
        stepNumber: 2,
        title: 'Ribosomal RNA Enzymatic Depletion',
        durationMinutes: 45,
        reagents: ['Ribo-Zero Plus Probe Mix', 'RNase H Enzyme'],
        instructions: 'Hybridize sequence-specific DNA probes against human/mouse cytoplasmic (18S, 28S, 5.8S, 5S) and mitochondrial (12S, 16S) rRNA at 68C for 10 min. Digest hybridized rRNA:probe duplexes with RNase H at 37C for 30 min.',
        criticalQualityControls: 'Confirm hybridization heating ramp is precisely 0.1C/sec.'
      },
      {
        stepNumber: 3,
        title: 'RNA Fragmentation and First-Strand cDNA Synthesis',
        durationMinutes: 50,
        reagents: ['Fragmentation Mix (EPH)', 'SuperScript IV RT', 'Actinomycin D'],
        instructions: 'Fragment depleted RNA at 94C for 8 minutes (targeting 200-300 bp insert size). Immediately chill on ice. Add reverse transcription master mix with Actinomycin D to prevent second-strand DNA-dependent synthesis.',
        criticalQualityControls: 'Avoid over-fragmentation for low-input samples.'
      },
      {
        stepNumber: 4,
        title: 'Second-Strand Synthesis with dUTP & Dual Index Ligation',
        durationMinutes: 90,
        reagents: ['Second Strand Marking Mix (dUTP)', 'Ligation Mix', 'UDI Adapters'],
        instructions: 'Incorporate dUTP during second-strand synthesis at 16C for 60 min. Perform A-tailing and ligate unique dual index (UDI) adapters. Clean with AMPure XP beads (0.8x ratio).',
        criticalQualityControls: 'Ensure complete removal of unligated adapter dimers by checking bead supernatant.'
      },
      {
        stepNumber: 5,
        title: 'PCR Amplification & Library Quality Validation',
        durationMinutes: 45,
        reagents: ['KAPA HiFi HotStart ReadyMix', 'D1000 ScreenTape'],
        instructions: 'Amplify library for 10-13 cycles depending on input mass (UDG enzyme digests dUTP second-strand to preserve transcript orientation). Verify final library peak at 280-350 bp.',
        criticalQualityControls: 'Final library yield must exceed 2 nM for Illumina NovaSeq 6000 or X-Plus flowcell loading.'
      }
    ],
    troubleshootingGuide: [
      {
        problem: 'High residual rRNA reads (> 10%)',
        possibleCause: 'Incomplete RNase H digestion or probe degradation',
        correctiveAction: 'Increase probe hybridization time by 5 min and verify enzyme storage at -20C.'
      },
      {
        problem: 'Adapter-dimer peak observed at ~120 bp',
        possibleCause: 'Insufficient bead purification washing',
        correctiveAction: 'Perform additional 0.8x AMPure XP bead cleanup.'
      }
    ]
  },
  {
    protocolId: 'PROT-SCRNA-002',
    title: '10x Genomics Chromium Single-Cell 3\' Gene Expression (v3.1 Dual Index)',
    author: 'SynOmics Universal Protocols Consortium',
    category: 'Single-Cell & Spatial Biology',
    overview: 'High-throughput microfluidic encapsulation of single cells for single-cell droplet RNA sequencing and cell typing across any tissue.',
    estimatedTotalTime: '8 hours',
    equipment: ['10x Chromium Controller / iX', 'Thermal Cycler with 0.2 mL block', 'Bioanalyzer 2100', 'Automated Cell Counter'],
    reagentsRequired: [
      { name: 'Chromium Next GEM Single Cell 3\' Kit v3.1', catalogRef: 'PN-1000268', concentration: '16 rxns' },
      { name: 'Single Cell 3\' Gel Beads v3.1', catalogRef: 'PN-1000120', concentration: '1 kit' },
      { name: 'Dual Index Kit TT Set A', catalogRef: 'PN-1000215', concentration: '96 rxns' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Single-Cell Suspension Preparation & Viability Assessment',
        durationMinutes: 45,
        reagents: ['0.04% BSA in PBS', 'Trypan Blue 0.4%'],
        instructions: 'Filter cell suspension through 40 um Flowmi strainer. Count cells using automated fluorescence counter. Ensure cell viability > 85% and minimal debris/clumping.',
        criticalQualityControls: 'Viability < 70% introduces severe ambient RNA contamination.'
      },
      {
        stepNumber: 2,
        title: 'GEM Generation and Barcoding on Chromium Controller',
        durationMinutes: 30,
        reagents: ['Next GEM Chip G', 'Partitioning Oil', 'Gel Beads'],
        instructions: 'Load master mix with 10,000 targeted cells, Gel Beads, and Partitioning Oil into Chip G. Run the Chromium Controller to produce uniform water-in-oil emulsions (GEMs).',
        criticalQualityControls: 'Inspect emulsion recovery for uniform milky appearance with no phase separation.'
      },
      {
        stepNumber: 3,
        title: 'Post-GEM-RT Cleanup and cDNA Amplification',
        durationMinutes: 120,
        reagents: ['Dynabeads MyOne SILANE', 'cDNA Primers', 'Amp Mix'],
        instructions: 'Break GEMs with recovery agent. Purify first-strand cDNA using SILANE magnetic beads. Perform 11-12 cycles of PCR amplification.',
        criticalQualityControls: 'Quantify cDNA yield via TapeStation High Sensitivity D5000 (expected 5-30 ng total cDNA).'
      }
    ],
    troubleshootingGuide: [
      {
        problem: 'Clogged microfluidic channel / Gem wetting failure',
        possibleCause: 'Cell aggregates or high particulate matter in sample',
        correctiveAction: 'Ensure double filtration with 30-40 um cell strainer before chip loading.'
      }
    ]
  },
  {
    protocolId: 'PROT-MS-003',
    title: 'TMTpro 16plex Isobaric Labeling for Quantitative Deep Proteomics',
    author: 'SynOmics Universal Protocols Consortium',
    category: 'Proteomics & Mass Spectrometry',
    overview: 'High-precision multiplexed protein quantification across 16 biological conditions or timepoints using Orbitrap LC-MS/MS.',
    estimatedTotalTime: '2 days',
    equipment: ['Thermo Orbitrap Eclipse / Exploris 480', 'EASY-nLC 1200', 'Vacuum Concentrator', 'Sonifier'],
    reagentsRequired: [
      { name: 'TMTpro 16plex Label Reagent Set', catalogRef: 'A44520', concentration: '1 set' },
      { name: 'Trypsin/Lys-C Protease Mix (MS Grade)', catalogRef: 'V5071', concentration: '100 ug' },
      { name: 'TEAB (Triethylammonium bicarbonate) 1M', catalogRef: 'T7408', concentration: '100 mL' }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Cell Lysis & Protein Extraction in 8M Urea',
        durationMinutes: 60,
        reagents: ['8M Urea in 50 mM TEAB pH 8.5', 'Halt Protease & Phosphatase Inhibitor'],
        instructions: 'Lyse cell pellet with urea buffer and probe sonicate at 20% amplitude for 3x 10s. Centrifuge at 16,000 g for 15 min at 4C. Quantify protein with BCA assay.',
        criticalQualityControls: 'Ensure complete urea solubilization without heating > 37C to prevent carbamylation.'
      },
      {
        stepNumber: 2,
        title: 'Reduction, Alkylation & Dual Digestion (Lys-C + Trypsin)',
        durationMinutes: 300,
        reagents: ['10 mM DTT', '30 mM Iodoacetamide (IAA)', 'Trypsin/Lys-C'],
        instructions: 'Reduce disulfide bonds with DTT at 56C for 30 min. Alkylate in dark with IAA at room temperature for 30 min. Dilute urea to < 1.5M with TEAB and digest with Lys-C (1:100) for 2h followed by Trypsin (1:50) overnight at 37C.',
        criticalQualityControls: 'Confirm digestion efficiency by MALDI-TOF or test LC-MS injection.'
      },
      {
        stepNumber: 3,
        title: 'TMTpro Isobaric Channel Labeling & Quenching',
        durationMinutes: 90,
        reagents: ['TMTpro Reagents dissolved in anhydrous ACN', '5% Hydroxylamine'],
        instructions: 'Add individual TMTpro channels to 50 ug peptide aliquots. Incubate 1 hour at room temp. Quench unreacted NHS esters with 5% hydroxylamine for 15 min. Pool all 16 channels 1:1 and desalt on C18 Sep-Pak.',
        criticalQualityControls: 'Check labeling efficiency (> 98% required) using quick test LC-MS.'
      }
    ],
    troubleshootingGuide: [
      {
        problem: 'Labeling efficiency below 95%',
        possibleCause: 'Residual primary amines in lysis buffer (Tris or ammonium bicarbonate)',
        correctiveAction: 'Strictly use TEAB or HEPES buffers during lysis and digestion steps.'
      }
    ]
  }
];

// Backward compatibility exports
export const SYNAPTIC_PROTEINS = BIOLOGICAL_ENTITIES;
export const SYNGO_ONTOLOGY_TREE = GO_ONTOLOGY_TREE;
export const SYNOMICS_TOOLS = BIOTOOLS_REGISTRY;
