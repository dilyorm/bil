#!/bin/bash

# BIL Production Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

log_info "Starting deployment to $ENVIRONMENT environment"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed. Aborting."; exit 1; }
    command -v aws >/dev/null 2>&1 || { log_error "AWS CLI is required but not installed. Aborting."; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed. Aborting."; exit 1; }
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker image
build_and_push() {
    log_info "Building and pushing Docker image..."
    
    local image_tag="bil/backend:$(git rev-parse --short HEAD)"
    local registry_image="ghcr.io/bil-org/bil-core-system/backend:$(git rev-parse --short HEAD)"
    
    # Build image
    docker build -t "$image_tag" -f packages/backend/Dockerfile .
    
    # Tag for registry
    docker tag "$image_tag" "$registry_image"
    
    # Push to registry
    docker push "$registry_image"
    
    echo "$registry_image" > /tmp/bil_image_tag
    log_success "Image built and pushed: $registry_image"
}

# Update Kubernetes configuration
update_k8s_config() {
    log_info "Updating Kubernetes configuration..."
    
    local cluster_name="bil-$ENVIRONMENT"
    local namespace="bil-$ENVIRONMENT"
    local image_tag=$(cat /tmp/bil_image_tag)
    
    # Update kubeconfig
    aws eks update-kubeconfig --region us-west-2 --name "$cluster_name"
    
    # Create temporary manifests directory
    local temp_dir="/tmp/bil-k8s-$ENVIRONMENT"
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    # Copy and update manifests
    cp -r "$PROJECT_ROOT/infrastructure/k8s/"* "$temp_dir/"
    
    # Update namespace
    sed -i "s/bil-production/$namespace/g" "$temp_dir"/*.yaml
    
    # Update image tag
    sed -i "s|bil/backend:latest|$image_tag|g" "$temp_dir/bil-api.yaml"
    
    # Update environment-specific configurations
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        # Reduce replicas for staging
        sed -i "s/replicas: 3/replicas: 1/g" "$temp_dir/bil-api.yaml"
        sed -i "s/minReplicas: 3/minReplicas: 1/g" "$temp_dir/bil-api.yaml"
        sed -i "s/maxReplicas: 10/maxReplicas: 3/g" "$temp_dir/bil-api.yaml"
    fi
    
    echo "$temp_dir" > /tmp/bil_k8s_dir
    log_success "Kubernetes configuration updated"
}

# Deploy to Kubernetes
deploy_to_k8s() {
    log_info "Deploying to Kubernetes..."
    
    local temp_dir=$(cat /tmp/bil_k8s_dir)
    local namespace="bil-$ENVIRONMENT"
    
    # Apply manifests in order
    kubectl apply -f "$temp_dir/namespace.yaml"
    kubectl apply -f "$temp_dir/configmap.yaml"
    
    # Wait for namespace to be ready
    kubectl wait --for=condition=Ready namespace/"$namespace" --timeout=60s
    
    # Deploy infrastructure components
    kubectl apply -f "$temp_dir/postgres.yaml"
    kubectl apply -f "$temp_dir/redis.yaml"
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=Ready pod -l app=postgres -n "$namespace" --timeout=300s
    kubectl wait --for=condition=Ready pod -l app=redis -n "$namespace" --timeout=300s
    
    # Deploy application
    kubectl apply -f "$temp_dir/bil-api.yaml"
    
    # Wait for deployment to complete
    log_info "Waiting for application deployment to complete..."
    kubectl rollout status deployment/bil-api -n "$namespace" --timeout=600s
    
    # Apply ingress (if production)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        kubectl apply -f "$temp_dir/ingress.yaml"
    fi
    
    log_success "Deployment completed successfully"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    local namespace="bil-$ENVIRONMENT"
    local max_attempts=30
    local attempt=1
    
    # Wait for pods to be ready
    kubectl wait --for=condition=Ready pod -l app=bil-api -n "$namespace" --timeout=300s
    
    # Get service endpoint
    local service_type=$(kubectl get service bil-api-service -n "$namespace" -o jsonpath='{.spec.type}')
    local endpoint
    
    if [[ "$service_type" == "LoadBalancer" ]]; then
        # Wait for load balancer to be ready
        log_info "Waiting for load balancer to be ready..."
        while [[ $attempt -le $max_attempts ]]; do
            endpoint=$(kubectl get service bil-api-service -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
            if [[ -n "$endpoint" ]]; then
                break
            fi
            log_info "Attempt $attempt/$max_attempts: Waiting for load balancer..."
            sleep 10
            ((attempt++))
        done
        
        if [[ -z "$endpoint" ]]; then
            log_error "Load balancer endpoint not available after $max_attempts attempts"
            exit 1
        fi
        
        endpoint="http://$endpoint"
    else
        # Use port-forward for ClusterIP
        log_info "Using port-forward for health checks..."
        kubectl port-forward service/bil-api-service 8080:80 -n "$namespace" &
        local port_forward_pid=$!
        sleep 5
        endpoint="http://localhost:8080"
    fi
    
    # Run health checks
    log_info "Testing endpoint: $endpoint"
    
    # Basic health check
    if curl -f "$endpoint/health" >/dev/null 2>&1; then
        log_success "✓ Basic health check passed"
    else
        log_error "✗ Basic health check failed"
        [[ -n "$port_forward_pid" ]] && kill $port_forward_pid 2>/dev/null || true
        exit 1
    fi
    
    # Database health check
    if curl -f "$endpoint/health/db" >/dev/null 2>&1; then
        log_success "✓ Database health check passed"
    else
        log_error "✗ Database health check failed"
        [[ -n "$port_forward_pid" ]] && kill $port_forward_pid 2>/dev/null || true
        exit 1
    fi
    
    # Redis health check
    if curl -f "$endpoint/health/redis" >/dev/null 2>&1; then
        log_success "✓ Redis health check passed"
    else
        log_error "✗ Redis health check failed"
        [[ -n "$port_forward_pid" ]] && kill $port_forward_pid 2>/dev/null || true
        exit 1
    fi
    
    # Clean up port-forward if used
    [[ -n "$port_forward_pid" ]] && kill $port_forward_pid 2>/dev/null || true
    
    log_success "All health checks passed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/bil_image_tag /tmp/bil_k8s_dir
    rm -rf /tmp/bil-k8s-*
}

# Main deployment flow
main() {
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Confirm production deployment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "You are about to deploy to PRODUCTION environment!"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Run deployment steps
    check_prerequisites
    build_and_push
    update_k8s_config
    deploy_to_k8s
    run_health_checks
    
    log_success "🎉 Deployment to $ENVIRONMENT completed successfully!"
    
    # Show useful information
    log_info "Useful commands:"
    log_info "  View pods: kubectl get pods -n bil-$ENVIRONMENT"
    log_info "  View logs: kubectl logs -f deployment/bil-api -n bil-$ENVIRONMENT"
    log_info "  View services: kubectl get services -n bil-$ENVIRONMENT"
}

# Run main function
main "$@"