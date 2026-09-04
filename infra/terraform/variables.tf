# ==============================================================================
# SynOmics Enterprise - Input Variables
# ==============================================================================

variable "project_id" {
  description = "The GCP project ID to deploy SynOmics infrastructure into."
  type        = string
}

variable "region" {
  description = "The default GCP region (e.g. us-central1, us-west1)."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment tier (production, staging, development)."
  type        = string
  default     = "production"
}

# ------------------------------------------------------------------------------
# Networking CIDRs
# ------------------------------------------------------------------------------
variable "gke_subnet_cidr" {
  description = "CIDR range for the private GKE subnet."
  type        = string
  default     = "10.100.0.0/20"
}

variable "gke_pods_cidr" {
  description = "Secondary CIDR range for Kubernetes Pods."
  type        = string
  default     = "10.101.0.0/16"
}

variable "gke_services_cidr" {
  description = "Secondary CIDR range for Kubernetes ClusterIP Services."
  type        = string
  default     = "10.102.0.0/20"
}

variable "gke_master_cidr" {
  description = "CIDR block for the GKE control plane private endpoint."
  type        = string
  default     = "172.16.0.0/28"
}

variable "filestore_reserved_cidr" {
  description = "Reserved CIDR range for Google Cloud Filestore NFS scratch space."
  type        = string
  default     = "10.200.0.0/29"
}

variable "cloud_run_connector_cidr" {
  description = "CIDR for the Serverless VPC Access Connector."
  type        = string
  default     = "10.8.0.0/28"
}

variable "allowed_ip_whitelist" {
  description = "List of CIDR blocks permitted to reach the API gateway through Cloud Armor."
  type        = list(string)
  default     = ["0.0.0.0/0"] # Can be restricted to enterprise VPN CIDRs
}

# ------------------------------------------------------------------------------
# Compute Sizing & GKE Autopilot
# ------------------------------------------------------------------------------
variable "enable_gke_autopilot" {
  description = "Set to true for fully-managed GKE Autopilot; false for custom taints/tolerations Standard node pools."
  type        = bool
  default     = false # Default to custom hardware-tainted node pools for precision bioinformatics
}

variable "cpu_spot_node_count" {
  description = "Max node count for Spot/Preemptible CPU-optimized N2 workers (BWA, GATK, FASTQ)."
  type        = number
  default     = 20
}

variable "highmem_node_count" {
  description = "Max node count for High-Memory N2D workers (AnnData, Spatial, MOFA+)."
  type        = number
  default     = 10
}

variable "gpu_a100_node_count" {
  description = "Max node count for NVIDIA A100 (80GB) GPU nodes (ESMFold, AlphaFold2, Molecular Dynamics)."
  type        = number
  default     = 4
}

variable "gpu_l4_node_count" {
  description = "Max node count for cost-efficient NVIDIA L4 (24GB) GPU nodes (De Novo Drug Design, Vina)."
  type        = number
  default     = 8
}

variable "api_dispatcher_image_url" {
  description = "Container image URL for the SynOmics API Dispatcher on Cloud Run."
  type        = string
  default     = "gcr.io/synomics-prod/api-dispatcher:v2.4.0"
}
