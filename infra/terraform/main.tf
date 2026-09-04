# ==============================================================================
# SynOmics Enterprise - Root Terraform Configuration (Production GCP Foundation)
# Multi-Omics, Biocompute, GKE Autopilot, VPC SC, CMEK KMS, and Cloud Armor
# ==============================================================================

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.30.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }

  backend "gcs" {
    bucket = "synomics-tfstate-prod"
    prefix = "terraform/state/production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ------------------------------------------------------------------------------
# Module 1A: Networking & Enterprise Security Moat (VPC, Cloud Armor, NAT, PSC)
# ------------------------------------------------------------------------------
module "networking" {
  source = "./modules/networking"

  project_id               = var.project_id
  region                   = var.region
  vpc_name                 = "synomics-enterprise-vpc"
  gke_subnet_cidr          = var.gke_subnet_cidr
  gke_pods_cidr            = var.gke_pods_cidr
  gke_services_cidr        = var.gke_services_cidr
  filestore_reserved_cidr  = var.filestore_reserved_cidr
  cloud_run_connector_cidr = var.cloud_run_connector_cidr
  allowed_ip_whitelist     = var.allowed_ip_whitelist
}

# ------------------------------------------------------------------------------
# Module 1B: Security & Cloud KMS CMEK Keys (Data-at-Rest & In-Flight Protection)
# ------------------------------------------------------------------------------
module "security_kms" {
  source = "./modules/security_kms"

  project_id          = var.project_id
  region              = var.region
  keyring_name        = "synomics-cmek-keyring"
  gcs_service_account = module.storage_data.gcs_service_account
  bq_service_account  = module.storage_data.bigquery_service_account
}

# ------------------------------------------------------------------------------
# Module 1C: Compute Infrastructure - GKE Autopilot & Heterogeneous Node Pools
# ------------------------------------------------------------------------------
module "gke_cluster" {
  source = "./modules/gke_cluster"

  project_id             = var.project_id
  region                 = var.region
  cluster_name           = "synomics-biocompute-cluster"
  network_id             = module.networking.vpc_id
  subnet_id              = module.networking.gke_subnet_id
  pods_ip_range_name     = module.networking.gke_pods_range_name
  services_ip_range_name = module.networking.gke_services_range_name
  master_ipv4_cidr_block = var.gke_master_cidr
  kms_key_id             = module.security_kms.gke_secrets_key_id

  # Node Pool Sizing and Hardware Acceleration Taints
  enable_autopilot       = var.enable_gke_autopilot
  cpu_spot_node_count    = var.cpu_spot_node_count
  highmem_node_count     = var.highmem_node_count
  gpu_a100_node_count    = var.gpu_a100_node_count
  gpu_l4_node_count      = var.gpu_l4_node_count
}

# ------------------------------------------------------------------------------
# Module 1D: Storage & Multi-Omics Data Tiering (GCS, Filestore NFS, BigQuery)
# ------------------------------------------------------------------------------
module "storage_data" {
  source = "./modules/storage_data"

  project_id               = var.project_id
  region                   = var.region
  environment              = var.environment
  network_id               = module.networking.vpc_id
  filestore_reserved_range = module.networking.filestore_reserved_range
  gcs_cmek_key_id          = module.security_kms.gcs_key_id
  bq_cmek_key_id           = module.security_kms.bigquery_key_id
}

# ------------------------------------------------------------------------------
# Module 1E: Cloud Run Serverless API Dispatcher & IAM Orchestration
# ------------------------------------------------------------------------------
module "cloud_run" {
  source = "./modules/cloud_run"

  project_id                 = var.project_id
  region                     = var.region
  service_name               = "synomics-api-dispatcher"
  image_url                  = var.api_dispatcher_image_url
  vpc_connector_id           = module.networking.vpc_connector_id
  cloud_armor_security_policy = module.networking.cloud_armor_policy_id
  gke_internal_grpc_endpoint = module.gke_cluster.internal_grpc_service_ip
  bigquery_dataset_id        = module.storage_data.bigquery_dataset_id
  filestore_mount_ip         = module.storage_data.filestore_ip
  gemini_api_secret_id       = module.security_kms.gemini_api_secret_id
}
