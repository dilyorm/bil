#!/bin/bash

# SSL/TLS Certificate Setup Script
# Sets up SSL certificates using Let's Encrypt and cert-manager

set -e

DOMAIN=${1:-api.bil.com}
EMAIL=${2:-admin@bil.com}
ENVIRONMENT=${3:-production}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Install cert-manager
install_cert_manager() {
    log_info "Installing cert-manager..."
    
    # Add cert-manager Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Create cert-manager namespace
    kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --version v1.13.0 \
        --set installCRDs=true \
        --set global.leaderElection.namespace=cert-manager
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=cert-manager -n cert-manager --timeout=300s
    
    log_success "cert-manager installed successfully"
}

# Create ClusterIssuer for Let's Encrypt
create_cluster_issuer() {
    log_info "Creating ClusterIssuer for Let's Encrypt..."
    
    local issuer_name="letsencrypt-${ENVIRONMENT}"
    local acme_server
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        acme_server="https://acme-v02.api.letsencrypt.org/directory"
    else
        acme_server="https://acme-staging-v02.api.letsencrypt.org/directory"
    fi
    
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: $issuer_name
spec:
  acme:
    server: $acme_server
    email: $EMAIL
    privateKeySecretRef:
      name: $issuer_name
    solvers:
    - http01:
        ingress:
          class: nginx
    - dns01:
        cloudflare:
          email: $EMAIL
          apiTokenSecretRef:
            name: cloudflare-api-token-secret
            key: api-token
EOF
    
    log_success "ClusterIssuer created: $issuer_name"
}

# Create certificate for domain
create_certificate() {
    log_info "Creating certificate for $DOMAIN..."
    
    local cert_name="bil-${ENVIRONMENT}-tls"
    local issuer_name="letsencrypt-${ENVIRONMENT}"
    local namespace="bil-${ENVIRONMENT}"
    
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: $cert_name
  namespace: $namespace
spec:
  secretName: $cert_name
  issuerRef:
    name: $issuer_name
    kind: ClusterIssuer
  dnsNames:
  - $DOMAIN
  - www.$DOMAIN
EOF
    
    # Wait for certificate to be ready
    log_info "Waiting for certificate to be issued..."
    kubectl wait --for=condition=Ready certificate/$cert_name -n $namespace --timeout=300s
    
    log_success "Certificate created and ready: $cert_name"
}

# Setup certificate monitoring
setup_cert_monitoring() {
    log_info "Setting up certificate monitoring..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: certificate-expiry
  namespace: cert-manager
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: certificate-expiry
    rules:
    - alert: CertificateExpiringSoon
      expr: certmanager_certificate_expiration_timestamp_seconds - time() < 7 * 24 * 3600
      for: 1h
      labels:
        severity: warning
      annotations:
        summary: "Certificate expiring soon"
        description: "Certificate {{ \$labels.name }} in namespace {{ \$labels.namespace }} expires in less than 7 days"
    
    - alert: CertificateExpired
      expr: certmanager_certificate_expiration_timestamp_seconds - time() <= 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Certificate expired"
        description: "Certificate {{ \$labels.name }} in namespace {{ \$labels.namespace }} has expired"
EOF
    
    log_success "Certificate monitoring configured"
}

# Generate self-signed certificates for development
generate_self_signed() {
    log_info "Generating self-signed certificates for development..."
    
    local cert_dir="$SCRIPT_DIR/../infrastructure/nginx/ssl"
    mkdir -p "$cert_dir"
    
    # Generate private key
    openssl genrsa -out "$cert_dir/server.key" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$cert_dir/server.key" -out "$cert_dir/server.csr" -subj "/C=US/ST=CA/L=San Francisco/O=BIL/CN=$DOMAIN"
    
    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$cert_dir/server.csr" -signkey "$cert_dir/server.key" -out "$cert_dir/server.crt"
    
    # Clean up CSR
    rm "$cert_dir/server.csr"
    
    log_success "Self-signed certificates generated in $cert_dir"
}

# Verify SSL configuration
verify_ssl() {
    log_info "Verifying SSL configuration..."
    
    # Check if domain is accessible
    if curl -k -s "https://$DOMAIN/health" >/dev/null; then
        log_success "✓ HTTPS endpoint is accessible"
    else
        log_warning "✗ HTTPS endpoint is not accessible"
    fi
    
    # Check certificate details
    log_info "Certificate details:"
    echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer
    
    # Check SSL Labs rating (if accessible)
    if command -v curl >/dev/null 2>&1; then
        log_info "SSL Labs rating (this may take a few minutes):"
        curl -s "https://api.ssllabs.com/api/v3/analyze?host=$DOMAIN&publish=off&startNew=on&all=done" | jq -r '.endpoints[0].grade // "Not available"'
    fi
}

# Main function
main() {
    log_info "Setting up SSL/TLS certificates for $DOMAIN..."
    
    # Check prerequisites
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed. Aborting."; exit 1; }
    command -v helm >/dev/null 2>&1 || { log_error "Helm is required but not installed. Aborting."; exit 1; }
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        generate_self_signed
    else
        install_cert_manager
        create_cluster_issuer
        create_certificate
        setup_cert_monitoring
        
        # Wait a bit for certificate to be issued
        sleep 30
        verify_ssl
    fi
    
    log_success "🔒 SSL/TLS setup completed successfully!"
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        log_info "Certificate management commands:"
        log_info "  Check certificate status: kubectl get certificate -n bil-$ENVIRONMENT"
        log_info "  Check certificate details: kubectl describe certificate bil-$ENVIRONMENT-tls -n bil-$ENVIRONMENT"
        log_info "  Force certificate renewal: kubectl delete certificate bil-$ENVIRONMENT-tls -n bil-$ENVIRONMENT"
    fi
}

# Run main function
main "$@"