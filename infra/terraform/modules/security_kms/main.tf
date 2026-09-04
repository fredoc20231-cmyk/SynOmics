# ==============================================================================
# Module: Security & Cloud KMS CMEK Keys (Data-at-Rest & In-Flight Protection)
# ==============================================================================

variable "project_id" { type = string }
variable "region" { type = string }
variable "keyring_name" { type = string }
variable "gcs_service_account" { type = string }
variable "bq_service_account" { type = string }

# 1. Cloud KMS KeyRing
resource "google_kms_key_ring" "synomics_keyring" {
  name     = var.keyring_name
  project  = var.project_id
  location = var.region
}

# 2. CMEK Crypto Key for Cloud Storage (FASTQ, BAM, AnnData, PDBs)
resource "google_kms_crypto_key" "gcs_key" {
  name            = "synomics-gcs-storage-key"
  key_ring        = google_kms_key_ring.synomics_keyring.id
  rotation_period = "2592000s" # 30 Days automatic cryptographic rotation

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "HSM" # Hardware Security Module for HIPAA / SOC2
  }

  lifecycle {
    prevent_destroy = true
  }
}

# 3. CMEK Crypto Key for BigQuery (Metadata, Variant Calls, Multi-Omics Factor Loadings)
resource "google_kms_crypto_key" "bq_key" {
  name            = "synomics-bq-data-key"
  key_ring        = google_kms_key_ring.synomics_keyring.id
  rotation_period = "2592000s"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "HSM"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# 4. CMEK Crypto Key for GKE Application-Layer Secrets Encryption
resource "google_kms_crypto_key" "gke_secrets_key" {
  name            = "synomics-gke-secrets-key"
  key_ring        = google_kms_key_ring.synomics_keyring.id
  rotation_period = "2592000s"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
}

# 5. Secret Manager for Vertex AI / Gemini API Credentials
resource "google_secret_manager_secret" "gemini_api_secret" {
  secret_id = "synomics-gemini-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

# 6. IAM Grants for Google Managed Service Accounts to use KMS Keys
resource "google_kms_crypto_key_iam_member" "gcs_kms_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.gcs_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${var.gcs_service_account}"
}

resource "google_kms_crypto_key_iam_member" "bq_kms_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.bq_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${var.bq_service_account}"
}

# Outputs
output "gcs_key_id" { value = google_kms_crypto_key.gcs_key.id }
output "bigquery_key_id" { value = google_kms_crypto_key.bq_key.id }
output "gke_secrets_key_id" { value = google_kms_crypto_key.gke_secrets_key.id }
output "gemini_api_secret_id" { value = google_secret_manager_secret.gemini_api_secret.id }
