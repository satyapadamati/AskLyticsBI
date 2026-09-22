# ============================================================
# ECS Security Group
# ============================================================

resource "aws_security_group" "ecs" {
  name        = "${var.environment}-ecs-sg"
  description = "Security group for ECS Fargate tasks"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-ecs-sg"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}


# ============================================================
# RDS Security Group
# ============================================================

resource "aws_security_group" "rds" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-rds-sg"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}


# ============================================================
# RDS Inbound Rule
# ECS → RDS PostgreSQL
# ============================================================

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ecs.id

  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  description = "Allow PostgreSQL access from ECS tasks"
}


# ============================================================
# ECS → RDS Outbound Rule
# ============================================================

resource "aws_vpc_security_group_egress_rule" "ecs_to_rds" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.rds.id

  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  description = "Allow ECS tasks to connect to PostgreSQL"
}

# ============================================================
# ALB Security Group
# ============================================================

resource "aws_security_group" "alb" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.environment}-alb-sg"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}


# ============================================================
# ALB → ECS
# ============================================================

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id

  from_port   = 8000
  to_port     = 8000
  ip_protocol = "tcp"

  description = "Allow ALB to reach FastAPI ECS tasks"
}


# ============================================================
# Internet → ALB HTTP
# ============================================================

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"

  description = "Allow HTTP traffic to ALB"
}


# ============================================================
# ALB Outbound
# ============================================================

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.ecs.id

  from_port   = 8000
  to_port     = 8000
  ip_protocol = "tcp"

  description = "Allow ALB to send traffic to ECS"
}