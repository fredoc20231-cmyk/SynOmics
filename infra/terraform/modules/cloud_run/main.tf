# ==============================================================================
# Module: Cloud Run Serverless API Dispatcher & IAM Orchestration
# ==============================================================================

variable "project_id" { type = string }
variable "region" { type = string }
variable "service_name" { type = string }
variable "image_url" { type = string }
variable "vpc_connector_id" { type = string }
variable "cloud_armor_security_policy" { type = string }
variable "gke_internal_grpc_endpoint" { type = string }
variable "bigquery_dataset_id" { type = string }
variable "filestore_mount_ip" { type = string }
variable "gemini_api_secret_id" { type = string }

# 1. Cloud Run Service Account
resource "google_service_account" "cloud_run_sa" {
  account_id   = "synomics-api-dispatcher-sa"
  display_name = "SynOmics API Dispatcher Cloud Run Service Account"
  project      = var.project_id
}

# 2. IAM Permissions for Cloud Run Service Account
resource "google_project_iam_member" "cr_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cr_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cr_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# 3. Cloud Run v2 Service
resource "google_cloud_run_v2_service" "api_dispatcher" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" # Protected behind Cloud Armor WAF Load Balancer

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 1
      max_instance_count = 50
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.image_url

      resources {
        limits = {
          cpu    = "4000m"
          memory = "8Gi"
        }
        cpu_idle = true # Scale-to-zero / CPU allocation during requests only
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GKE_GRPC_WORKER_ENDPOINT"
        value = var.gke_internal_grpc_endpoint
      }
      env {
        name  = "BIGQUERY_DATASET"
        value = var.bigquery_dataset_id
      }
      env {
        name  = "FILESTORE_NFS_IP"
        value = var.filestore_mount_ip
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.gemini_api_secret_id
            version = "latest"
          }
        }
      }

      ports {
        container_port = 3000
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }
    }
  }
}

# 4. Public Access IAM Policy (Managed through Cloud Armor WAF on Load Balancer)
resource "google_cloud_run_service_iam_member" "public_invoker" {
  location = google_cloud_run_v2_service.api_dispatcher.location
  project  = google_cloud_run_v2_service.api_dispatcher.project
  service  = google_cloud_run_v2_service.api_dispatcher.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" { value = google_cloud_run_v2_service.api_dispatcher.uri }
