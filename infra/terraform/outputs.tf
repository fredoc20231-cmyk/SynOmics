# ==============================================================================
# SynOmics Enterprise - Outputs
# ==============================================================================

output "vpc_id" {
  description = "The ID of the primary SynOmics VPC."
  value       = module.networking.vpc_id
}

output "gke_cluster_name" {
  description = "The name of the provisioned GKE biocompute cluster."
  value       = module.gke_cluster.cluster_name
}

output "gke_cluster_endpoint" {
  description = "The private internal control plane endpoint of the GKE cluster."
  value       = module.gke_cluster.cluster_endpoint
}

output "cloud_run_api_url" {
  description = "The public/Cloud Armor-protected URL of the SynOmics API Dispatcher."
  value       = module.cloud_run.service_url
}

output "gcs_active_bucket" {
  description = "Cloud Storage bucket for active multi-omics runs and intermediate artifacts."
  value       = module.storage_data.active_bucket_name
}

output "gcs_cold_archive_bucket" {
  description = "Cloud Storage bucket for archived FASTQ, BAM, and AnnData datasets."
  value       = module.storage_data.archive_bucket_name
}

output "filestore_nfs_ip" {
  description = "IP address of the Google Cloud Filestore NFS scratch volume."
  value       = module.storage_data.filestore_ip
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for structured multi-omics annotations and factor loadings."
  value       = module.storage_data.bigquery_dataset_id
}

output "cloud_armor_policy_id" {
  description = "Cloud Armor WAF / DDoS security policy ID."
  value       = module.networking.cloud_armor_policy_id
}
