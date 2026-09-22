# Configure the remote state backend for the development environment here.
terraform {
  backend "s3" {
    bucket = "asklyticsbi-terraform-state-2026"
    key    = "environments/dev/terraform.tfstate"
    region = "us-east-1"
  }
}