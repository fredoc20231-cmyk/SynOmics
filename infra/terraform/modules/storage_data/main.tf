# ==============================================================================
# Module: Storage & Multi-Omics Data Tiering (GCS, Filestore NFS, BigQuery)
# ==============================================================================

variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "network_id" { type = string }
variable "filestore_reserved_range" { type = string }
variable "gcs_cmek_key_id" { type = string }
variable "bq_cmek_key_id" { type = string }

# 1. Cloud Storage: Active Multi-Omics Runs Bucket (Standard Tier with CMEK)
resource "google_storage_bucket" "active_runs_bucket" {
  name                        = "synomics-active-runs-${var.project_id}"
  project                     = var.project_id
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  encryption {
    default_kms_key_name = var.gcs_cmek_key_id
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30 # Transition completed run outputs to Nearline after 30 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90 # Transition to Coldline after 90 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
}

# 2. Cloud Storage: Raw Omics & Genomic Archive Bucket (Coldline / Archive Tier)
resource "google_storage_bucket" "cold_archive_bucket" {
  name                        = "synomics-cold-archive-${var.project_id}"
  project                     = var.project_id
  location                    = var.region
  storage_class               = "COLDLINE"
  uniform_bucket_level_access = true

  encryption {
    default_kms_key_name = var.gcs_cmek_key_id
  }

  lifecycle_rule {
    condition {
      age = 365 # Transition massive FASTQ/BAM archives to Archive storage tier
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }
}

# 3. Google Cloud Filestore Enterprise NFS (Shared High-Throughput Scratch Space)
resource "google_filestore_instance" "scratch_nfs" {
  name     = "synomics-scratch-nfs"
  project  = var.project_id
  location = var.region
  tier     = "ENTERPRISE" # High-availability NFS with 2,500 MB/s burst bandwidth

  file_shares {
    capacity_gb = 1024 # 1 TB shared POSIX scratch volume
    name        = "scratch_volume"
  }

  networks {
    network           = var.network_id
    modes             = ["MODE_IPV4"]
    reserved_ip_range = var.filestore_reserved_range
  }
}

# 4. BigQuery: Clinical Variant & Precision Oncology Dataset
resource "google_bigquery_dataset" "clinical_variants" {
  dataset_id                  = "synomics_clinical_variants"
  project                     = var.project_id
  location                    = var.region
  description                 = "ClinVar, CPIC, and Oncomine structured genomic variants & actionability tables"
  default_table_expiration_ms = null # Permanent retention

  default_encryption_configuration {
    kms_key_name = var.bq_cmek_key_id
  }
}

# 5. BigQuery: Multi-Omics Factor Loadings & Single-Cell Summaries Dataset
resource "google_bigquery_dataset" "multiomics_factors" {
  dataset_id                  = "synomics_multiomics_factors"
  project                     = var.project_id
  location                    = var.region
  description                 = "MOFA+ latent matrices, DESeq2 differential statistics, and spatial Moran's I results"
  default_table_expiration_ms = null

  default_encryption_configuration {
    kms_key_name = var.bq_cmek_key_id
  }
}

# Google Service Accounts for Cloud Storage and BigQuery (for CMEK IAM Binding)
data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id
}

data "google_bigquery_default_service_account" "bq_account" {
  project = var.project_id
}

# Outputs
output "active_bucket_name" { value = google_storage_bucket.active_runs_bucket.name }
output "archive_bucket_name" { value = google_storage_bucket.cold_archive_bucket.name }
output "filestore_ip" { value = google_filestore_instance.scratch_nfs.networks[0].ip_addresses[0] }
output "bigquery_dataset_id" { value = google_bigquery_dataset.clinical_variants.dataset_id }
output "gcs_service_account" { value = data.google_storage_project_service_account.gcs_account.email_address }
output "bigquery_service_account" { value = data.google_bigquery_default_service_account.bq_account.email }
