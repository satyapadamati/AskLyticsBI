output "backend_repository_url" {
  description = "The URL of the backend ECR repository."
  value       = aws_ecr_repository.backend.repository_url
}
output "backend_repository_arn" {
  description = "The ARN of the backend ECR repository."
  value       = aws_ecr_repository.backend.arn
}
