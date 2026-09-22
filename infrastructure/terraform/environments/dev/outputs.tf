output "aws_region" {
  description = "AWS region configured for the development environment."
  value       = var.aws_region
}
output "vpc_id" {
  description = "The ID of the VPC created for the development environment."
  value       = module.vpc.aws_vpc_id
}