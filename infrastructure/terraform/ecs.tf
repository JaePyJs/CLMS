# ECS configuration for CLMS deployment

# Create ECS task execution role
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-ecs-task-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-execution-role-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for accessing secrets
resource "aws_iam_role_policy" "ecs_task_secrets_policy" {
  name = "${var.project_name}-ecs-task-secrets-policy-${var.environment}"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          aws_cloudwatch_log_group.clms.arn,
          "${aws_cloudwatch_log_group.clms.arn}:*"
        ]
      }
    ]
  })
}

# Create ECS task role for application
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role-${var.environment}"
  }
}

resource "aws_iam_role_policy" "ecs_task_application_policy" {
  name = "${var.project_name}-ecs-task-application-policy-${var.environment}"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*",
          aws_s3_bucket.logs.arn,
          "${aws_s3_bucket.logs.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.notification_email
          }
        }
      }
    ]
  })
}

# Backend task definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "${var.project_name}-backend-${var.environment}"
      image = "${aws_ecr_repository.backend.repository_url}:latest"

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = "3001"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.db_credentials.arn
        },
        {
          name      = "REDIS_PASSWORD"
          valueFrom = aws_secretsmanager_secret.redis_credentials.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.db_credentials.arn
        }
      ]

      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.clms.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backend"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval = 30
        timeout = 5
        retries = 3
        startPeriod = 60
      }

      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]

      mountPoints = [
        {
          sourceVolume  = "uploads"
          containerPath = "/app/uploads"
          readOnly      = false
        },
        {
          sourceVolume  = "generated"
          containerPath = "/app/generated"
          readOnly      = false
        }
      ]
    }
  ])

  volume = [
    {
      name = "uploads"
      efs_volume_configuration = {
        file_system_id = aws_efs_file_system.uploads.id
        root_directory = "/uploads"
      }
    },
    {
      name = "generated"
      efs_volume_configuration = {
        file_system_id = aws_efs_file_system.generated.id
        root_directory = "/generated"
      }
    }
  ]

  tags = {
    Name = "${var.project_name}-backend-task-${var.environment}"
  }
}

# Frontend task definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "${var.project_name}-frontend-${var.environment}"
      image = "${aws_ecr_repository.frontend.repository_url}:latest"

      environment = [
        {
          name  = "VITE_API_URL"
          value = "https://${var.domain_name}/api"
        },
        {
          name  = "VITE_WS_URL"
          value = "wss://${var.domain_name}/ws"
        }
      ]

      portMappings = [
        {
          containerPort = 80
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.clms.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "frontend"
        }
      }

      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:80/health || exit 1"]
        interval = 30
        timeout = 5
        retries = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-frontend-task-${var.environment}"
  }
}

# Backend service
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-${var.environment}"
  cluster         = aws_ecs_cluster.clms.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_size
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "${var.project_name}-backend-${var.environment}"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener.clms_https]

  tags = {
    Name = "${var.project_name}-backend-service-${var.environment}"
  }
}

# Frontend service
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend-${var.environment}"
  cluster         = aws_ecs_cluster.clms.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.ecs_desired_size
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "${var.project_name}-frontend-${var.environment}"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.clms_https]

  tags = {
    Name = "${var.project_name}-frontend-service-${var.environment}"
  }
}

# Auto Scaling for backend service
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.ecs_max_size
  min_capacity       = var.ecs_min_size
  resource_id        = "service/${aws_ecs_cluster.clms.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_scale_up" {
  name               = "${var.project_name}-backend-scale-up-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "backend_scale_up_memory" {
  name               = "${var.project_name}-backend-scale-up-memory-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling for frontend service
resource "aws_appautoscaling_target" "frontend" {
  max_capacity       = var.ecs_max_size
  min_capacity       = var.ecs_min_size
  resource_id        = "service/${aws_ecs_cluster.clms.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_scale_up" {
  name               = "${var.project_name}-frontend-scale-up-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Create EFS file systems for persistent storage
resource "aws_efs_file_system" "uploads" {
  creation_token = "${var.project_name}-uploads-${var.environment}"

  tags = {
    Name = "${var.project_name}-uploads-${var.environment}"
  }
}

resource "aws_efs_file_system" "generated" {
  creation_token = "${var.project_name}-generated-${var.environment}"

  tags = {
    Name = "${var.project_name}-generated-${var.environment}"
  }
}

# EFS mount targets
resource "aws_efs_mount_target" "uploads" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.uploads.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.ecs.id]
}

resource "aws_efs_mount_target" "generated" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.generated.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.ecs.id]
}