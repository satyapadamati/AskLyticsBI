resource "aws_lb" "backend" {
  name               = "asklyticsbi-${var.environment}-alb"
  internal           = true
  load_balancer_type = "application"

  security_groups = [var.security_group_id]
  subnets         = var.subnet_ids

  tags = {
    Name        = "asklyticsbi-${var.environment}-alb"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "asklyticsbi-${var.environment}-tg"
  port        = 8000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    port                = "8000"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name        = "asklyticsbi-${var.environment}-tg"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}