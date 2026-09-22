output "cluster_id" {
  description = "The ID of the ECS cluster."
  value       = aws_ecs_cluster.this.id
}
output "cluster_name" {
  description = "The name of the ECS cluster."
  value       = aws_ecs_cluster.this.name
}
output "execution_role_arn" {
  description = "The ARN of the ECS execution role."
  value       = aws_iam_role.ecs_execution.arn
}

output "log_group_name" {
  description = "The name of the CloudWatch log group for the ECS backend."
  value       = aws_cloudwatch_log_group.ecs.name
}
output "task_definition_arn" {
  description = "The ARN of the ECS backend task definition."
  value       = aws_ecs_task_definition.backend.arn
}