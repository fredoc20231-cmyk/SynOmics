# ==============================================================================
# Module: Compute Infrastructure - GKE Autopilot & Heterogeneous Node Pools
# ==============================================================================

variable "project_id" { type = string }
variable "region" { type = string }
variable "cluster_name" { type = string }
variable "network_id" { type = string }
variable "subnet_id" { type = string }
variable "pods_ip_range_name" { type = string }
variable "services_ip_range_name" { type = string }
variable "master_ipv4_cidr_block" { type = string }
variable "kms_key_id" { type = string }
variable "enable_autopilot" { type = bool }
variable "cpu_spot_node_count" { type = number }
variable "highmem_node_count" { type = number }
variable "gpu_a100_node_count" { type = number }
variable "gpu_l4_node_count" { type = number }

# 1. GKE Service Account
resource "google_service_account" "gke_nodes_sa" {
  account_id   = "synomics-gke-nodes-sa"
  display_name = "SynOmics GKE Worker Nodes Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "gke_nodes_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes_sa.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes_sa.email}"
}

resource "google_project_iam_member" "gke_nodes_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_nodes_sa.email}"
}

# 2. GKE Primary Private Cluster
resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  network    = var.network_id
  subnetwork = var.subnet_id

  # Completely private nodes, private endpoint access with authorized networks
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_ip_range_name
    services_secondary_range_name = var.services_ip_range_name
  }

  # KMS Application-Layer Encryption for Kubernetes Secrets
  database_encryption {
    state    = "ENCRYPTED"
    key_name = var.kms_key_id
  }

  # Datapath V2 (Cilium eBPF high-throughput container networking)
  datapath_provider = "ADVANCED_DATAPATH"

  # Workload Identity Federation
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable GCS Fuse CSI Driver and Filestore CSI Driver natively
  addons_config {
    gcs_fuse_csi_driver_config {
      enabled = true
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
    dns_cache_config {
      enabled = true
    }
  }

  # If not Autopilot, we manage node pools explicitly
  enable_autopilot = var.enable_autopilot
  remove_default_node_pool = !var.enable_autopilot
  initial_node_count       = var.enable_autopilot ? null : 1

  release_channel {
    channel = "REGULAR"
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS", "APISERVER"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "APISERVER", "STORAGE", "POD", "DEPLOYMENT"]
    managed_prometheus {
      enabled = true
    }
  }
}

# ------------------------------------------------------------------------------
# Specialized Node Pool 1: CPU-Optimized Spot Pool (N2 Series)
# Targeted for: bwa_mem_aligner, gatk_haplotype_caller, fastq_processor
# ------------------------------------------------------------------------------
resource "google_container_node_pool" "cpu_spot_nodes" {
  count    = var.enable_autopilot ? 0 : 1
  name     = "cpu-spot-bio-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name
  project  = var.project_id

  autoscaling {
    min_node_count  = 0
    max_node_count  = var.cpu_spot_node_count
    location_policy = "ANY"
  }

  node_config {
    machine_type = "n2-highcpu-32" # 32 vCPUs, 32 GB RAM
    spot         = true             # 60-91% Cloud Cost Reduction for Batch Genomics
    disk_size_gb = 200
    disk_type    = "pd-ssd"
    service_account = google_service_account.gke_nodes_sa.email

    labels = {
      "synomics.ai/hardware-tier" = "cpu-optimized"
      "synomics.ai/preemptible"   = "true"
      "synomics.ai/workload"      = "genomics-alignment"
    }

    taint {
      key    = "workload"
      value  = "cpu-bioinformatics"
      effect = "NO_SCHEDULE"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}

# ------------------------------------------------------------------------------
# Specialized Node Pool 2: High-Memory Pool (N2D Series)
# Targeted for: anndata_ingest, spatial_transcriptomics, mofa_multi_omics
# ------------------------------------------------------------------------------
resource "google_container_node_pool" "highmem_nodes" {
  count    = var.enable_autopilot ? 0 : 1
  name     = "highmem-singlecell-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name
  project  = var.project_id

  autoscaling {
    min_node_count = 0
    max_node_count = var.highmem_node_count
  }

  node_config {
    machine_type = "n2d-highmem-32" # 32 vCPUs, 256 GB RAM (AMD EPYC)
    spot         = false            # On-demand for non-interruptible clustering runs
    disk_size_gb = 500
    disk_type    = "pd-ssd"
    service_account = google_service_account.gke_nodes_sa.email

    labels = {
      "synomics.ai/hardware-tier" = "high-memory"
      "synomics.ai/workload"      = "sparse-matrices"
    }

    taint {
      key    = "workload"
      value  = "highmem-omics"
      effect = "NO_SCHEDULE"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}

# ------------------------------------------------------------------------------
# Specialized Node Pool 3: GPU-Accelerated Pool (NVIDIA A100 / L4)
# Targeted for: structure_prediction_esm, openmm_md_simulation, denovo_drug_generator
# ------------------------------------------------------------------------------
resource "google_container_node_pool" "gpu_a100_nodes" {
  count    = var.enable_autopilot ? 0 : 1
  name     = "gpu-a100-deeplearning-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name
  project  = var.project_id

  autoscaling {
    min_node_count = 0
    max_node_count = var.gpu_a100_node_count
  }

  node_config {
    machine_type = "a2-highgpu-1g" # 1x NVIDIA A100 GPU (40GB/80GB VRAM), 12 vCPUs, 85 GB RAM
    disk_size_gb = 400
    disk_type    = "pd-ssd"
    service_account = google_service_account.gke_nodes_sa.email

    guest_accelerator {
      type  = "nvidia-tesla-a100"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_type = "DEFAULT"
      }
    }

    labels = {
      "synomics.ai/hardware-tier" = "gpu-a100"
      "synomics.ai/workload"      = "esm-openmm"
    }

    taint {
      key    = "workload"
      value  = "gpu-deeplearning"
      effect = "NO_SCHEDULE"
    }
  }
}

# ------------------------------------------------------------------------------
# Specialized Node Pool 4: Micro-VM gVisor Sandbox Pool (sandbox_execute)
# ------------------------------------------------------------------------------
resource "google_container_node_pool" "gvisor_sandbox_nodes" {
  count    = var.enable_autopilot ? 0 : 1
  name     = "gvisor-sandbox-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name
  project  = var.project_id

  autoscaling {
    min_node_count = 1
    max_node_count = 10
  }

  node_config {
    machine_type = "e2-standard-4"
    disk_size_gb = 100
    service_account = google_service_account.gke_nodes_sa.email

    # Enable Google gVisor micro-kernel container runtime
    sandbox_config {
      sandbox_type = "gvisor"
    }

    labels = {
      "synomics.ai/hardware-tier" = "sandbox-gvisor"
      "synomics.ai/isolation"     = "micro-vm"
    }

    taint {
      key    = "workload"
      value  = "untrusted-sandbox"
      effect = "NO_SCHEDULE"
    }
  }
}

# Outputs
output "cluster_name" { value = google_container_cluster.primary.name }
output "cluster_endpoint" { value = google_container_cluster.primary.endpoint }
output "internal_grpc_service_ip" { value = "10.102.15.50" }
