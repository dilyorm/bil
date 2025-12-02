# RDS Subnet Group
resource "aws_db_subnet_group" "bil_db" {
  name       = "${var.cluster_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.cluster_name}-db-subnet-group"
    Environment = var.environment
    Project     = var.project
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "bil_db" {
  family = "postgres15"
  name   = "${var.cluster_name}-db-params"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name        = "${var.cluster_name}-db-params"
    Environment = var.environment
    Project     = var.project
  }
}

# RDS Primary Instance
resource "aws_db_instance" "bil_primary" {
  identifier = "${var.cluster_name}-primary"

  # Engine
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = var.db_instance_class

  # Storage
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  # Database
  db_name  = "bil_production"
  username = "bil_user"
  password = random_password.db_password.result

  # Network
  db_subnet_group_name   = aws_db_subnet_group.bil_db.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  port                   = 5432

  # Backup
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  delete_automated_backups = false

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  # Parameter Group
  parameter_group_name = aws_db_parameter_group.bil_db.name

  # Deletion Protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.cluster_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  tags = {
    Name        = "${var.cluster_name}-primary"
    Environment = var.environment
    Project     = var.project
  }
}

# RDS Read Replica
resource "aws_db_instance" "bil_replica" {
  identifier = "${var.cluster_name}-replica"

  # Replica Configuration
  replicate_source_db = aws_db_instance.bil_primary.identifier
  instance_class      = var.db_instance_class

  # Network
  publicly_accessible = false

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = {
    Name        = "${var.cluster_name}-replica"
    Environment = var.environment
    Project     = var.project
  }
}

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store database password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.cluster_name}/database/password"
  description = "Database password for BIL production"

  tags = {
    Name        = "${var.cluster_name}-db-password"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = aws_db_instance.bil_primary.username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.bil_primary.endpoint
    port     = aws_db_instance.bil_primary.port
    dbname   = aws_db_instance.bil_primary.db_name
  })
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "RDS encryption key"
  deletion_window_in_days = 7

  tags = {
    Name        = "${var.cluster_name}-rds-encryption-key"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.cluster_name}-rds-encryption-key"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.cluster_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.cluster_name}-rds-monitoring-role"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}