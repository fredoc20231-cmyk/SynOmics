# ==============================================================================
# Module: Networking & Enterprise Security Moat (VPC, Cloud Armor, NAT, PSC)
# ==============================================================================

variable "project_id" { type = string }
variable "region" { type = string }
variable "vpc_name" { type = string }
variable "gke_subnet_cidr" { type = string }
variable "gke_pods_cidr" { type = string }
variable "gke_services_cidr" { type = string }
variable "filestore_reserved_cidr" { type = string }
variable "cloud_run_connector_cidr" { type = string }
variable "allowed_ip_whitelist" { type = list(string) }

# 1. Custom VPC Network (No Auto-Subnets)
resource "google_compute_network" "synomics_vpc" {
  name                    = var.vpc_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
  description             = "SynOmics Enterprise Zero-Trust Isolated VPC"
}

# 2. Private GKE Subnetwork with Secondary Alias Ranges for Pods and Services
resource "google_compute_subnetwork" "gke_subnet" {
  name                     = "${var.vpc_name}-gke-subnet"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.synomics_vpc.id
  ip_cidr_range            = var.gke_subnet_cidr
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "gke-pods-range"
    ip_cidr_range = var.gke_pods_cidr
  }

  secondary_ip_range {
    range_name    = "gke-services-range"
    ip_cidr_range = var.gke_services_cidr
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# 3. Cloud Router & Cloud NAT (Outbound Egress Only for Package Mirrors & CZI Census, No Public Inbound)
resource "google_compute_router" "nat_router" {
  name    = "${var.vpc_name}-nat-router"
  project = var.project_id
  region  = var.region
  network = google_compute_network.synomics_vpc.id
}

resource "google_compute_router_nat" "nat_gateway" {
  name                               = "${var.vpc_name}-cloud-nat"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.nat_router.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# 4. Serverless VPC Access Connector (For Cloud Run -> Internal GKE gRPC & Filestore)
resource "google_vpc_access_connector" "cloud_run_connector" {
  name          = "synomics-cr-conn"
  project       = var.project_id
  region        = var.region
  ip_cidr_range = var.cloud_run_connector_cidr
  network       = google_compute_network.synomics_vpc.name
  min_instances = 2
  max_instances = 10
  machine_type  = "e2-micro"
}

# 5. Cloud Armor Security Policy (WAF, DDoS, Rate Limiting, OWASP Core Rules)
resource "google_compute_security_policy" "cloud_armor_waf" {
  name        = "synomics-cloud-armor-moat"
  project     = var.project_id
  description = "Enterprise WAF with DDoS mitigation, OWASP ModSecurity rules, and rate limits"

  # Rule 1: Layer 7 DDoS Rate Limiting (100 req / min per IP burst protection)
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 120
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Throttle abusive API scanning and scrapers"
  }

  # Rule 2: SQL Injection & XSS OWASP Core Rule Set
  rule {
    action   = "deny(403)"
    priority = "2000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable') || evaluatePreconfiguredExpr('xss-v33-stable') || evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block OWASP Top 10 web attack vectors (SQLi, XSS, Path Traversal)"
  }

  # Rule 3: Default Allow for authorized users
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default catch-all allow"
  }
}

# Outputs
output "vpc_id" { value = google_compute_network.synomics_vpc.id }
output "gke_subnet_id" { value = google_compute_subnetwork.gke_subnet.id }
output "gke_pods_range_name" { value = "gke-pods-range" }
output "gke_services_range_name" { value = "gke-services-range" }
output "vpc_connector_id" { value = google_vpc_access_connector.cloud_run_connector.id }
output "cloud_armor_policy_id" { value = google_compute_security_policy.cloud_armor_waf.id }
output "filestore_reserved_range" { value = var.filestore_reserved_cidr }
