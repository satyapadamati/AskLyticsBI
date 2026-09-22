resource "aws_vpc" "this" {
    cidr_block = var.vpc_cidr
    enable_dns_support   = true
    enable_dns_hostnames = true
    tags = {
      Name = "${var.environment}-vpc"
    }
}
resource "aws_subnet" "private-sub-a" {
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.privatesubnet_a_cidr
  availability_zone = var.availability_zone_a
  tags = {
    Name = "${var.environment}-private-subnet-a"
  }
}
resource "aws_subnet" "private-sub-b" {
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.privatesubnet_b_cidr
  availability_zone = var.availability_zone_b
  tags = {
    Name = "${var.environment}-private-subnet-b"
  }
}
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name = "${var.environment}-private-route-table"
  }
}
resource "aws_route_table_association" "private_sub_a" {
  subnet_id      = aws_subnet.private-sub-a.id
  route_table_id = aws_route_table.private.id
}
resource "aws_route_table_association" "private_sub_b" {
  subnet_id      = aws_subnet.private-sub-b.id
  route_table_id = aws_route_table.private.id
} 
