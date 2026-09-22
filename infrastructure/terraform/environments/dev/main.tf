terraform {
  required_version = ">= 1.5.0"
}
module "vpc" {
  source               = "../../modules/vpc"
  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  privatesubnet_a_cidr = var.privatesubnet_a_cidr
  privatesubnet_b_cidr = var.privatesubnet_b_cidr
  availability_zone_a  = var.availability_zone_a
  availability_zone_b  = var.availability_zone_b
}
module "security_groups" {
  source      = "../../modules/security-groups"
  vpc_id      = module.vpc.aws_vpc_id
  environment = var.environment
}
module "rds" {
  source = "../../modules/rds"

  environment = var.environment

  subnet_ids = [
    module.vpc.aws_private_subnet_a_id,
    module.vpc.aws_private_subnet_b_id
  ]

  security_group_ids = [module.security_groups.rds_security_group_id]

  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
  vpc_id      = module.vpc.aws_vpc_id
}

module "s3" {
  source           = "../../modules/s3"
  s3_bucket_name   = var.s3_bucket_name
  s3_bucket_region = var.s3_bucket_region
  environment      = var.environment
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  environment = var.environment

  bucket_id  = module.s3.s3_bucket_domain_name
  bucket_arn = module.s3.s3_bucket_arn
}


module "ecr" {
  source      = "../../modules/ecr"
  environment = var.environment
}

module "ecs" {
  source = "../../modules/ecs"

  environment = var.environment

  ecr_repository_url = module.ecr.backend_repository_url
  aws_region         = var.aws_region
  container_image    = var.container_image

  subnet_ids = [
    module.vpc.aws_private_subnet_a_id,
    module.vpc.aws_private_subnet_b_id
  ]

  security_group_id = module.security_groups.ecs_security_group_id
  target_group_arn  = module.alb.target_group_arn
}

module "alb" {
  source = "../../modules/alb"

  environment = var.environment

  vpc_id = module.vpc.aws_vpc_id

  subnet_ids = [
    module.vpc.aws_private_subnet_a_id,
    module.vpc.aws_private_subnet_b_id
  ]

  security_group_id = module.security_groups.alb_security_group_id
}