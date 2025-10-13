# Terraform variables for CLMS production deployment

variable "project_name" {
  description = "Name of the CLMS project"
  type        = string
  default     = "clms"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "owner_email" {
  description = "Email address of the resource owner"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "ssh_allowed_ips" {
  description = "List of IP addresses allowed for SSH access"
  type        = list(string)
  default     = []
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_size" {
  description = "RDS storage size in GB"
  type        = number
  default     = 100
}

variable "db_max_storage_size" {
  description = "Maximum RDS storage size in GB"
  type        = number
  default     = 1000
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "clms_admin"
}

variable "db_backup_retention_period" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

variable "db_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1

  validation {
    condition     = var.redis_num_nodes >= 1 && var.redis_num_nodes <= 6
    error_message = "Redis nodes must be between 1 and 6."
  }
}

variable "redis_snapshot_retention" {
  description = "Redis snapshot retention period in days"
  type        = number
  default     = 7
}

variable "redis_snapshot_window" {
  description = "Preferred snapshot window"
  type        = string
  default     = "05:00-07:00"
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 90
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 730, 1095, 1825, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "create_route53_zone" {
  description = "Whether to create a Route53 hosted zone"
  type        = bool
  default     = false
}

variable "ecs_instance_type" {
  description = "ECS instance type"
  type        = string
  default     = "t3.medium"
}

variable "ecs_min_size" {
  description = "Minimum number of ECS instances"
  type        = number
  default     = 2
}

variable "ecs_max_size" {
  description = "Maximum number of ECS instances"
  type        = number
  default     = 10
}

variable "ecs_desired_size" {
  description = "Desired number of ECS instances"
  type        = number
  default     = 2
}

variable "enable_monitoring" {
  description = "Whether to enable detailed monitoring"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_alarms" {
  description = "Whether to enable CloudWatch alarms"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = ""
}