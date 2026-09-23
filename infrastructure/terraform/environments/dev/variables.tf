variable "aws_region" {
  description = "AWS region for the development environment."
  type        = string
  default     = "us-east-1"
}
variable "vpc_cidr" {
  description = "CIDR block for the VPC in the development environment."
  type        = string
}
variable "environment" {
  description = "The environment for which resources are being provisioned"
  type        = string
}
variable "privatesubnet_a_cidr" {
  description = "CIDR block for the private subnet A in the development environment."
  type        = string
}
variable "privatesubnet_b_cidr" {
  description = "CIDR block for the private subnet B in the development environment."
  type        = string
}
variable "availability_zone_a" {
  description = "Availability zone for the private subnet A in the development environment."
  type        = string
}
variable "availability_zone_b" {
  description = "Availability zone for the private subnet B in the development environment."
  type        = string
}
variable "db_name" {
  description = "The name of the RDS database in the development environment."
  type        = string
}
variable "db_username" {
  description = "The username for the RDS database in the development environment."
  type        = string
}
variable "db_password" {
  description = "The password for the RDS database in the development environment."
  type        = string
}
variable "s3_bucket_name" {
  description = "The name of the S3 bucket in the development environment."
  type        = string
}
variable "s3_bucket_region" {
  description = "The region where the S3 bucket will be created in the development environment."
  type        = string
}
variable "container_image" {
  type        = string
  description = "The container image for the ECS backend service in the development environment."
}