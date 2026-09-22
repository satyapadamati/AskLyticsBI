output "aws_vpc_id" {
  description = "The ID of the VPC created by this module."
  value       = aws_vpc.this.id
}
output "aws_private_subnet_a_id" {
  description = "The ID of the private subnet A created by this module."
  value       = aws_subnet.private-sub-a.id
}
output "aws_private_subnet_b_id" {
  description = "The ID of the private subnet B created by this module."
  value       = aws_subnet.private-sub-b.id
}
output "aws_private_route_table_id" {
  description = "The ID of the private route table created by this module."
  value       = aws_route_table.private.id
}