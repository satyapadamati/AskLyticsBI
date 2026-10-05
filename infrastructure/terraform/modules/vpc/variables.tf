variable "vpc_cidr" {
  description = "CIDR block for the VPC in the development environment."
  type        = string
}
variable "environment" {
  description = "The environment for which resources are being provisioned."
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
variable "publicsubnet_a_cidr" {
  description = "CIDR block for the public subnet A (hosts the NAT Gateway)."
  type        = string
}
variable "publicsubnet_b_cidr" {
  description = "CIDR block for the public subnet B."
  type        = string
}
variable "aws_region" {
  description = "AWS region, used for the S3 gateway endpoint service name."
  type        = string
}