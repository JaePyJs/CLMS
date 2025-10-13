# Terraform outputs for CLMS production deployment

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.clms_vpc.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.clms_vpc.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.clms_alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.clms_alb.zone_id
}

output "alb_security_group_id" {
  description = "Security group ID of the ALB"
  value       = aws_security_group.alb.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.clms.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.clms.arn
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS instances"
  value       = aws_security_group.ecs.id
}

output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.clms_mysql.endpoint
}

output "rds_instance_hosted_zone_id" {
  description = "RDS instance hosted zone ID"
  value       = aws_db_instance.clms_mysql.hosted_zone_id
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.clms_mysql.port
}

output "rds_instance_status" {
  description = "RDS instance status"
  value       = aws_db_instance.clms_mysql.status
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.clms_redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.clms_redis.port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = random_password.redis_password.result
  sensitive   = true
}

output "ecr_repository_url_backend" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_url_frontend" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backup_bucket_name" {
  description = "S3 bucket name for backups"
  value       = aws_s3_bucket.backups.id
}

output "backup_bucket_arn" {
  description = "S3 bucket ARN for backups"
  value       = aws_s3_bucket.backups.arn
}

output "logs_bucket_name" {
  description = "S3 bucket name for logs"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "S3 bucket ARN for logs"
  value       = aws_s3_bucket.logs.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.clms.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.clms.arn
}

output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "redis_credentials_secret_arn" {
  description = "ARN of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "ssl_certificate_arn" {
  description = "ARN of the SSL certificate"
  value       = aws_acm_certificate.clms.arn
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = var.create_route53_zone ? aws_route53_zone.clms[0].zone_id : null
}

output "route53_zone_name" {
  description = "Route53 hosted zone name"
  value       = var.create_route53_zone ? aws_route53_zone.clms[0].name : null
}

output "nat_gateway_id" {
  description = "NAT Gateway ID"
  value       = aws_nat_gateway.clms_nat.id
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.clms_igw.id
}

# Output configuration values for application deployment
output "app_config" {
  description = "Application configuration values"
  value = {
    database = {
      host     = aws_db_instance.clms_mysql.address
      port     = aws_db_instance.clms_mysql.port
      database = aws_db_instance.clms_mysql.db_name
      username = var.db_username
      secret_arn = aws_secretsmanager_secret.db_credentials.arn
    }
    redis = {
      host     = aws_elasticache_replication_group.clms_redis.primary_endpoint_address
      port     = aws_elasticache_replication_group.clms_redis.port
      secret_arn = aws_secretsmanager_secret.redis_credentials.arn
    }
    alb = {
      dns_name = aws_lb.clms_alb.dns_name
      zone_id  = aws_lb.clms_alb.zone_id
    }
    storage = {
      backup_bucket = aws_s3_bucket.backups.id
      logs_bucket   = aws_s3_bucket.logs.id
    }
    ssl = {
      certificate_arn = aws_acm_certificate.clms.arn
    }
  }
  sensitive = true
}