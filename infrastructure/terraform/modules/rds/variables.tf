variable "environment" {
  description = "The environment for which the RDS resources are being provisioned."
  type        = string
}
variable "vpc_id" {
  description = "The ID of the VPC in which the RDS resources will be provisioned."
  type        = string
}   
variable "subnet_ids" {
  description = "The IDs of the subnets in which the RDS resources will be provisioned."
  type        = list(string)
}   
variable "security_group_ids" {
  description = "The IDs of the security groups to associate with the RDS resources."
  type        = list(string)
}
variable "db_name" {
  description = "The name of the RDS database."
  type        = string
}
variable "db_username" {
  description = "The username for the RDS database."
  type        = string
}
variable "db_password" {
  description = "The password for the RDS database."
  type        = string
}