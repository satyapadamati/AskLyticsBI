resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
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

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name = "${var.environment}-igw"
  }
}

resource "aws_subnet" "public-sub-a" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.publicsubnet_a_cidr
  availability_zone       = var.availability_zone_a
  map_public_ip_on_launch = false
  tags = {
    Name = "${var.environment}-public-subnet-a"
  }
}

resource "aws_subnet" "public-sub-b" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.publicsubnet_b_cidr
  availability_zone       = var.availability_zone_b
  map_public_ip_on_launch = false
  tags = {
    Name = "${var.environment}-public-subnet-b"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name = "${var.environment}-public-route-table"
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public_sub_a" {
  subnet_id      = aws_subnet.public-sub-a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_sub_b" {
  subnet_id      = aws_subnet.public-sub-b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "${var.environment}-nat-eip"
  }
}

# Single NAT for dev; add one per AZ for production HA
resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public-sub-a.id
  tags = {
    Name = "${var.environment}-nat"
  }
  depends_on = [aws_internet_gateway.this]
}

# Separate aws_route so the existing private route table is updated, not replaced
resource "aws_route" "private_nat" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags = {
    Name = "${var.environment}-s3-gateway-endpoint"
  }
}
