"""
BioOmni Python SDK
Universal Biomedical AI Co-Scientist & Multi-Omics Analysis Toolkit
Covers: Genomics, Transcriptomics, Proteomics, Single-Cell, Spatial Omics, Microbiome,
GWAS Fine-Mapping, Clinical Genomics, AlphaFold Structural Modeling, and Drug Discovery.
"""

import os

try:
    from server.bioOmni_engine import (
        align_pairwise_sequences,
        annotate_variants,
        compute_kaplan_meier_survival,
        compute_ms2_fragmentation,
        compute_mutagenesis_ddg,
        compute_network_topology,
        compute_ramachandran_and_contact_map,
        construct_phylogenetic_tree,
        get_genomic_locus_tracks,
        in_silico_tryptic_digest,
        predict_drug_targets,
        run_differential_expression,
        run_gwas_analysis,
        run_markov_clustering,
        run_microbiome_diversity,
        run_pathway_enrichment,
        run_scanpy_singlecell_analysis,
        simulate_biophysical_ode,
    )
except ImportError:
    pass

class BiologicalEntityNode:
    def __init__(self, data):
        self.gene_symbol = data.get("geneSymbol", "")
        self.name = data.get("name", "")
        self.compartment = data.get("compartment", "")
        self.domain = data.get("biologicalDomain", "")
        self.organism = data.get("organism", "human")
        self.is_druggable = data.get("druggability", {}).get("isDruggable", False)
        self.therapeutic_status = data.get("druggability", {}).get("therapeuticStatus", "Undrugged")
        self.associated_diseases = data.get("associatedDiseases", [])
        self.pathways = data.get("pathways", [])
        self.key_interactors = data.get("keyInteractors", [])

    def __repr__(self):
        return f"<BiologicalEntity {self.gene_symbol} [{self.domain}] ({self.name})>"

class Client:
    """
    BioOmni Universal Bioinformatics Co-Scientist Client.
    """
    def __init__(self, api_key=None, base_url="http://localhost:3000"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.base_url = base_url

    def gwas_finemapping(self, trait="Type 2 Diabetes", population="EUR"):
        """Run statistical fine-mapping and eQTL colocalization."""
        return run_gwas_analysis(trait=trait, population=population)

    def microbiome_diversity(self, method="bray_curtis"):
        """Compute alpha and beta diversity for microbiome profiles."""
        return run_microbiome_diversity(method=method)

    def drug_repurposing(self, signature=None):
        """Identify candidate drugs via LINCS L1000 transcriptomic reversal."""
        return predict_drug_targets(gene_signature=signature)

    def clinical_variants(self, vcf_path=None, genome="GRCh38"):
        """Annotate variants with ACMG pathogenicity scoring."""
        return annotate_variants(genome=genome)

    def differential_expression(self, counts=None, conditions=None):
        """Run DESeq2 negative binomial differential expression."""
        return run_differential_expression(counts, conditions)

    def pathway_enrichment(self, genes, database="GO"):
        """Run hypergeometric pathway enrichment across universal GO/KEGG."""
        return run_pathway_enrichment(genes, database=database)

    def biophysical_ode(self, system="synaptic", gene="TP53", mode="Knockout", duration_ms=100.0):
        """Simulate ODE dynamics across synaptic, cardiac, cell cycle, immune, or metabolic systems."""
        return simulate_biophysical_ode(biological_system=system, gene=gene, mode=mode, duration_ms=duration_ms)

bo = Client()
so = bo  # backward compatibility alias
