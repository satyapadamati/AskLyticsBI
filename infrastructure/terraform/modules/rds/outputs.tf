output "db_instance_id" {
  value = aws_db_instance.this.identifier
}

output "db_instance_endpoint" {
  value = aws_db_instance.this.endpoint
}
output "db_instance_port" {
  value = aws_db_instance.this.port
}