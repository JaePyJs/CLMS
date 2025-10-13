# Terraform configuration for CLMS production deployment
# This template provisions AWS infrastructure for a highly available, secure deployment

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CLMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner_email
    }
  }
}

# Create VPC
resource "aws_vpc" "clms_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc-${var.environment}"
  }
}

# Create Internet Gateway
resource "aws_internet_gateway" "clms_igw" {
  vpc_id = aws_vpc.clms_vpc.id

  tags = {
    Name = "${var.project_name}-igw-${var.environment}"
  }
}

# Create public subnets
resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.clms_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}-${var.environment}"
    Type = "Public"
  }
}

# Create private subnets
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.clms_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 1}-${var.environment}"
    Type = "Private"
  }
}

# Create database subnets
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.clms_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-database-subnet-${count.index + 1}-${var.environment}"
    Type = "Database"
  }
}

# Create Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-nat-eip-${var.environment}"
  }

  depends_on = [aws_internet_gateway.clms_igw]
}

# Create NAT Gateway
resource "aws_nat_gateway" "clms_nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-nat-${var.environment}"
  }

  depends_on = [aws_internet_gateway.clms_igw]
}

# Create route tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.clms_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.clms_igw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.clms_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.clms_nat.id
  }

  tags = {
    Name = "${var.project_name}-private-rt-${var.environment}"
  }
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.clms_vpc.id

  tags = {
    Name = "${var.project_name}-database-rt-${var.environment}"
  }
}

# Associate route tables with subnets
resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "database" {
  count          = length(aws_subnet.database)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Create security groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-${var.environment}"
  vpc_id      = aws_vpc.clms_vpc.id

  # HTTP access
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "ecs" {
  name_prefix = "${var.project_name}-ecs-${var.environment}"
  vpc_id      = aws_vpc.clms_vpc.id

  # HTTP from ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Backend API from ALB
  ingress {
    description     = "Backend API from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSH for maintenance
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_ips
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-${var.environment}"
  vpc_id      = aws_vpc.clms_vpc.id

  # MySQL from ECS
  ingress {
    description     = "MySQL from ECS"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  # MySQL for maintenance
  ingress {
    description = "MySQL for maintenance"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_ips
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-redis-${var.environment}"
  vpc_id      = aws_vpc.clms_vpc.id

  # Redis from ECS
  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redis-sg-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Create Application Load Balancer
resource "aws_lb" "clms_alb" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb-${var.environment}"
  }
}

# Create RDS subnet group
resource "aws_db_subnet_group" "clms" {
  name       = "${var.project_name}-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.database[*].id

  tags = {
    Name = "${var.project_name}-subnet-group-${var.environment}"
  }
}

# Create RDS instance
resource "aws_db_instance" "clms_mysql" {
  identifier = "${var.project_name}-mysql-${var.environment}"

  engine         = "mysql"
  engine_version = "8.0"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_storage_size
  max_allocated_storage = var.db_max_storage_size
  storage_type          = "gp2"
  storage_encrypted     = true

  db_name  = "clms_database"
  username = var.db_username
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.clms.name

  backup_retention_period = var.db_backup_retention_period
  backup_window          = var.db_backup_window
  maintenance_window     = var.db_maintenance_window

  skip_final_snapshot       = var.environment == "development" ? true : false
  final_snapshot_identifier = var.environment == "development" ? null : "${var.project_name}-mysql-${var.environment}-final"

  parameter_group_name = aws_db_parameter_group.clms.name

  tags = {
    Name = "${var.project_name}-mysql-${var.environment}"
  }

  depends_on = [aws_security_group.rds]
}

# Create RDS parameter group
resource "aws_db_parameter_group" "clms" {
  family = "mysql8.0"
  name   = "${var.project_name}-mysql-${var.environment}"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "innodb_buffer_pool_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  tags = {
    Name = "${var.project_name}-mysql-params-${var.environment}"
  }
}

# Create ElastiCache subnet group
resource "aws_elasticache_subnet_group" "clms" {
  name       = "${var.project_name}-cache-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-cache-subnet-${var.environment}"
  }
}

# Create ElastiCache Redis cluster
resource "aws_elasticache_subnet_group" "redis_subnet" {
  name       = "${var.project_name}-redis-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "clms_redis" {
  replication_group_id       = "${var.project_name}-redis-${var.environment}"
  description                = "CLMS Redis cluster"

  node_type                  = var.redis_node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"

  num_cache_clusters         = var.redis_num_nodes
  automatic_failover_enabled = var.redis_num_nodes > 1

  subnet_group_name          = aws_elasticache_subnet_group.redis_subnet.name
  security_group_ids         = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_password.result

  snapshot_retention_limit   = var.redis_snapshot_retention
  snapshot_window           = var.redis_snapshot_window

  tags = {
    Name = "${var.project_name}-redis-${var.environment}"
  }
}

# Create ECS cluster
resource "aws_ecs_cluster" "clms" {
  name = "${var.project_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster-${var.environment}"
  }
}

# Create ECR repositories
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend-${var.environment}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend-ecr-${var.environment}"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend-${var.environment}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-frontend-ecr-${var.environment}"
  }
}

# Create S3 bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-backups-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${var.project_name}-backups-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "backup_retention"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = var.backup_retention_days
    }
  }
}

# Create S3 bucket for logs
resource "aws_s3_bucket" "logs" {
  bucket = "${var.project_name}-logs-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${var.project_name}-logs-${var.environment}"
  }
}

# Create CloudWatch Log Group
resource "aws_cloudwatch_log_group" "clms" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-logs-${var.environment}"
  }
}

# Create random passwords
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 64
  special = false
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Store secrets in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/db-credentials-${var.environment}"

  tags = {
    Name = "${var.project_name}-db-credentials-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.clms_mysql.address
    port     = aws_db_instance.clms_mysql.port
    database = aws_db_instance.clms_mysql.db_name
  })
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "${var.project_name}/redis-credentials-${var.environment}"

  tags = {
    Name = "${var.project_name}-redis-credentials-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    password = random_password.redis_password.result
    host     = aws_elasticache_replication_group.clms_redis.primary_endpoint_address
    port     = aws_elasticache_replication_group.clms_redis.port
  })
}

# Create SSL certificate
resource "aws_acm_certificate" "clms" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  tags = {
    Name = "${var.project_name}-cert-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Create Route53 hosted zone (if using Route53)
resource "aws_route53_zone" "clms" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name

  tags = {
    Name = "${var.project_name}-zone-${var.environment}"
  }
}