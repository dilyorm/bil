# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "bil_redis" {
  name       = "${var.cluster_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.cluster_name}-redis-subnet-group"
    Environment = var.environment
    Project     = var.project
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "bil_redis" {
  family = "redis7.x"
  name   = "${var.cluster_name}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name        = "${var.cluster_name}-redis-params"
    Environment = var.environment
    Project     = var.project
  }
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "bil_redis" {
  replication_group_id       = "${var.cluster_name}-redis"
  description                = "Redis cluster for BIL production"

  # Engine
  engine               = "redis"
  engine_version       = "7.0"
  node_type           = var.redis_node_type
  port                = 6379

  # Cluster Configuration
  num_cache_clusters = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.bil_redis.name

  # Network
  subnet_group_name  = aws_elasticache_subnet_group.bil_redis.name
  security_group_ids = [aws_security_group.elasticache.id]

  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth_token.result
  kms_key_id               = aws_kms_key.elasticache.arn

  # Backup
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format      = "text"
    log_type        = "slow-log"
  }

  tags = {
    Name        = "${var.cluster_name}-redis"
    Environment = var.environment
    Project     = var.project
  }
}

# Random auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

# Store Redis auth token in AWS Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name = "${var.cluster_name}/redis/auth-token"
  description = "Redis auth token for BIL production"

  tags = {
    Name        = "${var.cluster_name}-redis-auth-token"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
    endpoint   = aws_elasticache_replication_group.bil_redis.primary_endpoint_address
    port       = aws_elasticache_replication_group.bil_redis.port
  })
}

# KMS Key for ElastiCache encryption
resource "aws_kms_key" "elasticache" {
  description             = "ElastiCache encryption key"
  deletion_window_in_days = 7

  tags = {
    Name        = "${var.cluster_name}-elasticache-encryption-key"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_kms_alias" "elasticache" {
  name          = "alias/${var.cluster_name}-elasticache-encryption-key"
  target_key_id = aws_kms_key.elasticache.key_id
}

# CloudWatch Log Group for Redis slow logs
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/${var.cluster_name}/redis/slow-log"
  retention_in_days = 7

  tags = {
    Name        = "${var.cluster_name}-redis-slow-logs"
    Environment = var.environment
    Project     = var.project
  }
}