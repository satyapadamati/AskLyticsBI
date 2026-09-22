variable "environment" {
  description = "The environment for which the ECS resources are being provisioned."
  type        = string
}

variable "ecr_repository_url" {
  description = "The URL of the ECR repository for the ECS backend container."
  type = string
}

variable "aws_region" {
  description = "The AWS region in which the ECS resources are being provisioned."
  type = string
}
variable "subnet_ids" {
  description = "The list of subnet IDs for the ECS tasks."
  type        = list(string)
}

variable "security_group_id" {
  description = "The security group ID for the ECS tasks."
  type        = string
}
variable "target_group_arn" {
  description = "The ARN of the target group for the ECS backend service."
  type        = string
}
variable "container_image" {
  description = "The container image for the ECS backend service."
  type        = string
}