variable "vpc_cidr" {
  description = "CIDR block for the VPC in the development environment."
  type        = string
}
variable "environment" {
  description = "The environment for which resources are being provisioned."
  type = string
  
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