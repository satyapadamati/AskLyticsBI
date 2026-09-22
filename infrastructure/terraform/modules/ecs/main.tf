resource "aws_ecs_cluster" "this" {
  name = "AskLyticsBI-${var.environment}"
  tags = {
    Environment = var.environment
  }
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}


resource "aws_iam_role" "ecs_execution" {
  name = "asklyticsbi-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "asklyticsbi-${var.environment}-ecs-execution-role"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/asklyticsbi-${var.environment}-backend"
  retention_in_days = 14

  tags = {
    Name        = "asklyticsbi-${var.environment}-backend-logs"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "asklyticsbi-${var.environment}-backend"
  requires_compatibilities = ["FARGATE"]

  network_mode = "awsvpc"

  cpu    = "1024"
  memory = "2048"

  execution_role_arn = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.ecr_repository_url
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backend"
        }
      }
    }
  ])

  tags = {
    Name        = "asklyticsbi-${var.environment}-backend-task"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "asklyticsbi-${var.environment}-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn

  desired_count = 1
  launch_type   = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "backend"
    container_port   = 8000
  }

  tags = {
    Name        = "asklyticsbi-${var.environment}-backend-service"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}