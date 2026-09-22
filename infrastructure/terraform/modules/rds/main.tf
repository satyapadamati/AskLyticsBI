resource "aws_db_subnet_group" "this" {
  name       = "${var.environment}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.environment}-db-subnet-group"
  }
}
resource "aws_db_instance" "this" {
  identifier         = "${var.environment}-db-instance"
  engine             = "postgres"
  engine_version     = "17.4"
  backup_retention_period = 7
  skip_final_snapshot     = true
  instance_class     = "db.t3.micro"
  allocated_storage  = 20
  max_allocated_storage = 50
  storage_type       = "gp3"
  storage_encrypted   = true
  port = 5432
  db_name            = var.db_name
  username           = var.db_username
  password           = var.db_password
  db_subnet_group_name = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible = false
  deletion_protection = false
  tags = {
    Name = "${var.environment}-db-instance"
  }
}