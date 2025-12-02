terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }

  backend "s3" {
    bucket = "bil-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC
resource "aws_vpc" "bil_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "bil-production-vpc"
    Environment = "production"
    Project     = "bil"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "bil_igw" {
  vpc_id = aws_vpc.bil_vpc.id

  tags = {
    Name        = "bil-production-igw"
    Environment = "production"
    Project     = "bil"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.bil_vpc.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "bil-production-public-${count.index + 1}"
    Environment = "production"
    Project     = "bil"
    Type        = "public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.bil_vpc.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "bil-production-private-${count.index + 1}"
    Environment = "production"
    Project     = "bil"
    Type        = "private"
  }
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = length(aws_subnet.public)

  domain = "vpc"
  depends_on = [aws_internet_gateway.bil_igw]

  tags = {
    Name        = "bil-production-nat-eip-${count.index + 1}"
    Environment = "production"
    Project     = "bil"
  }
}

resource "aws_nat_gateway" "bil_nat" {
  count = length(aws_subnet.public)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "bil-production-nat-${count.index + 1}"
    Environment = "production"
    Project     = "bil"
  }

  depends_on = [aws_internet_gateway.bil_igw]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.bil_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.bil_igw.id
  }

  tags = {
    Name        = "bil-production-public-rt"
    Environment = "production"
    Project     = "bil"
  }
}

resource "aws_route_table" "private" {
  count = length(aws_nat_gateway.bil_nat)

  vpc_id = aws_vpc.bil_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.bil_nat[count.index].id
  }

  tags = {
    Name        = "bil-production-private-rt-${count.index + 1}"
    Environment = "production"
    Project     = "bil"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "eks_cluster" {
  name_prefix = "bil-eks-cluster-"
  vpc_id      = aws_vpc.bil_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bil-production-eks-cluster-sg"
    Environment = "production"
    Project     = "bil"
  }
}

resource "aws_security_group" "eks_nodes" {
  name_prefix = "bil-eks-nodes-"
  vpc_id      = aws_vpc.bil_vpc.id

  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  ingress {
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bil-production-eks-nodes-sg"
    Environment = "production"
    Project     = "bil"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name_prefix = "bil-rds-"
  vpc_id      = aws_vpc.bil_vpc.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "bil-production-rds-sg"
    Environment = "production"
    Project     = "bil"
  }
}

# ElastiCache Security Group
resource "aws_security_group" "elasticache" {
  name_prefix = "bil-elasticache-"
  vpc_id      = aws_vpc.bil_vpc.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  tags = {
    Name        = "bil-production-elasticache-sg"
    Environment = "production"
    Project     = "bil"
  }
}