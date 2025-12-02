#!/bin/bash

# Security Scanning and Vulnerability Assessment Script
# Performs comprehensive security scans on the BIL system

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

# Create reports directory
REPORTS_DIR="$PROJECT_ROOT/security-reports/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORTS_DIR"

# Dependency vulnerability scanning
scan_dependencies() {
    log_info "Scanning dependencies for vulnerabilities..."
    
    cd "$PROJECT_ROOT"
    
    # npm audit
    log_info "Running npm audit..."
    npm audit --json > "$REPORTS_DIR/npm-audit.json" 2>/dev/null || true
    npm audit > "$REPORTS_DIR/npm-audit.txt" 2>/dev/null || true
    
    # Snyk scan (if available)
    if command -v snyk >/dev/null 2>&1; then
        log_info "Running Snyk scan..."
        snyk test --json > "$REPORTS_DIR/snyk-test.json" 2>/dev/null || true
        snyk test > "$REPORTS_DIR/snyk-test.txt" 2>/dev/null || true
    else
        log_warning "Snyk not installed. Install with: npm install -g snyk"
    fi
    
    # Check for known vulnerable packages
    log_info "Checking for known vulnerable packages..."
    cat > "$REPORTS_DIR/vulnerable-packages-check.sh" << 'EOF'
#!/bin/bash
echo "Checking for commonly vulnerable packages..."

# Check package.json files for vulnerable packages
find . -name "package.json" -not -path "./node_modules/*" | while read -r file; do
    echo "Checking $file..."
    
    # Known vulnerable packages to check for
    vulnerable_packages=(
        "lodash@4.17.20"
        "minimist@1.2.5"
        "yargs-parser@18.1.3"
        "node-fetch@2.6.6"
        "axios@0.21.1"
    )
    
    for package in "${vulnerable_packages[@]}"; do
        if grep -q "$package" "$file"; then
            echo "WARNING: Found potentially vulnerable package $package in $file"
        fi
    done
done
EOF
    
    chmod +x "$REPORTS_DIR/vulnerable-packages-check.sh"
    bash "$REPORTS_DIR/vulnerable-packages-check.sh" > "$REPORTS_DIR/vulnerable-packages.txt"
    
    log_success "Dependency scan completed"
}

# Container image vulnerability scanning
scan_container_images() {
    log_info "Scanning container images for vulnerabilities..."
    
    local image_name="bil/backend:latest"
    
    # Trivy scan
    if command -v trivy >/dev/null 2>&1; then
        log_info "Running Trivy container scan..."
        trivy image --format json --output "$REPORTS_DIR/trivy-image-scan.json" "$image_name" 2>/dev/null || true
        trivy image --format table --output "$REPORTS_DIR/trivy-image-scan.txt" "$image_name" 2>/dev/null || true
    else
        log_warning "Trivy not installed. Install from: https://aquasecurity.github.io/trivy/"
    fi
    
    # Docker Scout (if available)
    if command -v docker >/dev/null 2>&1 && docker scout version >/dev/null 2>&1; then
        log_info "Running Docker Scout scan..."
        docker scout cves "$image_name" --format json > "$REPORTS_DIR/docker-scout.json" 2>/dev/null || true
        docker scout cves "$image_name" > "$REPORTS_DIR/docker-scout.txt" 2>/dev/null || true
    else
        log_warning "Docker Scout not available"
    fi
    
    log_success "Container image scan completed"
}

# Infrastructure security scanning
scan_infrastructure() {
    log_info "Scanning infrastructure for security issues..."
    
    # Kubernetes security scanning with kube-bench
    if command -v kube-bench >/dev/null 2>&1; then
        log_info "Running kube-bench security scan..."
        kube-bench --json > "$REPORTS_DIR/kube-bench.json" 2>/dev/null || true
        kube-bench > "$REPORTS_DIR/kube-bench.txt" 2>/dev/null || true
    else
        log_warning "kube-bench not installed"
    fi
    
    # Kubernetes configuration scanning with kube-score
    if command -v kube-score >/dev/null 2>&1; then
        log_info "Running kube-score analysis..."
        find "$PROJECT_ROOT/infrastructure/k8s" -name "*.yaml" | while read -r file; do
            filename=$(basename "$file" .yaml)
            kube-score score "$file" > "$REPORTS_DIR/kube-score-$filename.txt" 2>/dev/null || true
        done
    else
        log_warning "kube-score not installed"
    fi
    
    # Check for hardcoded secrets
    log_info "Scanning for hardcoded secrets..."
    if command -v gitleaks >/dev/null 2>&1; then
        gitleaks detect --source "$PROJECT_ROOT" --report-format json --report-path "$REPORTS_DIR/gitleaks.json" 2>/dev/null || true
        gitleaks detect --source "$PROJECT_ROOT" --report-format csv --report-path "$REPORTS_DIR/gitleaks.csv" 2>/dev/null || true
    else
        # Manual secret scanning
        log_info "Running manual secret scan..."
        grep -r -i -n \
            -e "password\s*=" \
            -e "secret\s*=" \
            -e "api_key\s*=" \
            -e "private_key" \
            -e "access_token" \
            --include="*.js" \
            --include="*.ts" \
            --include="*.json" \
            --include="*.yaml" \
            --include="*.yml" \
            --exclude-dir=node_modules \
            --exclude-dir=.git \
            "$PROJECT_ROOT" > "$REPORTS_DIR/manual-secret-scan.txt" 2>/dev/null || true
    fi
    
    log_success "Infrastructure scan completed"
}

# Network security scanning
scan_network() {
    log_info "Scanning network security..."
    
    local target_host
    if [[ "$ENVIRONMENT" == "production" ]]; then
        target_host="api.bil.com"
    else
        target_host="staging-api.bil.com"
    fi
    
    # SSL/TLS configuration check
    log_info "Checking SSL/TLS configuration..."
    if command -v testssl.sh >/dev/null 2>&1; then
        testssl.sh --jsonfile "$REPORTS_DIR/testssl.json" "$target_host" > "$REPORTS_DIR/testssl.txt" 2>/dev/null || true
    else
        # Basic SSL check
        echo "SSL Certificate Information for $target_host:" > "$REPORTS_DIR/ssl-basic-check.txt"
        echo | openssl s_client -servername "$target_host" -connect "$target_host:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer >> "$REPORTS_DIR/ssl-basic-check.txt" 2>/dev/null || true
    fi
    
    # Port scanning (basic)
    log_info "Running basic port scan..."
    if command -v nmap >/dev/null 2>&1; then
        nmap -sV -O "$target_host" > "$REPORTS_DIR/nmap-scan.txt" 2>/dev/null || true
    else
        # Basic connectivity check
        for port in 80 443 22 3000; do
            if timeout 5 bash -c "</dev/tcp/$target_host/$port" 2>/dev/null; then
                echo "Port $port: Open" >> "$REPORTS_DIR/basic-port-scan.txt"
            else
                echo "Port $port: Closed/Filtered" >> "$REPORTS_DIR/basic-port-scan.txt"
            fi
        done
    fi
    
    log_success "Network scan completed"
}

# Application security scanning
scan_application() {
    log_info "Scanning application for security issues..."
    
    # Static code analysis with ESLint security plugin
    log_info "Running ESLint security analysis..."
    cd "$PROJECT_ROOT"
    npx eslint --ext .js,.ts --format json --output-file "$REPORTS_DIR/eslint-security.json" . 2>/dev/null || true
    npx eslint --ext .js,.ts . > "$REPORTS_DIR/eslint-security.txt" 2>/dev/null || true
    
    # Check for common security issues
    log_info "Checking for common security issues..."
    cat > "$REPORTS_DIR/security-issues-check.sh" << 'EOF'
#!/bin/bash
echo "Checking for common security issues..."

# Check for eval() usage
echo "=== Checking for eval() usage ===" >> security-issues.txt
grep -r -n "eval(" --include="*.js" --include="*.ts" . >> security-issues.txt 2>/dev/null || echo "No eval() usage found" >> security-issues.txt

# Check for innerHTML usage
echo "=== Checking for innerHTML usage ===" >> security-issues.txt
grep -r -n "innerHTML" --include="*.js" --include="*.ts" . >> security-issues.txt 2>/dev/null || echo "No innerHTML usage found" >> security-issues.txt

# Check for document.write usage
echo "=== Checking for document.write usage ===" >> security-issues.txt
grep -r -n "document.write" --include="*.js" --include="*.ts" . >> security-issues.txt 2>/dev/null || echo "No document.write usage found" >> security-issues.txt

# Check for SQL query construction
echo "=== Checking for potential SQL injection ===" >> security-issues.txt
grep -r -n -i "select.*from\|insert.*into\|update.*set\|delete.*from" --include="*.js" --include="*.ts" . >> security-issues.txt 2>/dev/null || echo "No SQL queries found" >> security-issues.txt

# Check for hardcoded URLs
echo "=== Checking for hardcoded URLs ===" >> security-issues.txt
grep -r -n "http://\|https://" --include="*.js" --include="*.ts" --exclude-dir=node_modules . >> security-issues.txt 2>/dev/null || echo "No hardcoded URLs found" >> security-issues.txt
EOF
    
    chmod +x "$REPORTS_DIR/security-issues-check.sh"
    cd "$REPORTS_DIR"
    bash security-issues-check.sh
    
    log_success "Application scan completed"
}

# Generate security report
generate_report() {
    log_info "Generating security report..."
    
    cat > "$REPORTS_DIR/security-report.md" << EOF
# BIL Security Scan Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Scan Duration:** $(date -d @$(($(date +%s) - start_time)) -u +%H:%M:%S)

## Summary

This report contains the results of a comprehensive security scan of the BIL system.

## Scans Performed

- [x] Dependency Vulnerability Scan
- [x] Container Image Scan
- [x] Infrastructure Security Scan
- [x] Network Security Scan
- [x] Application Security Scan

## Files Generated

$(ls -la "$REPORTS_DIR" | grep -v "^d" | awk '{print "- " $9}')

## Recommendations

### High Priority
- Review and fix any CRITICAL vulnerabilities found in dependency scans
- Address any hardcoded secrets or credentials
- Ensure all SSL/TLS configurations are secure

### Medium Priority
- Update vulnerable dependencies to latest secure versions
- Review and fix any HIGH severity vulnerabilities
- Implement additional security headers if missing

### Low Priority
- Address any MEDIUM/LOW severity vulnerabilities
- Review code for security best practices
- Consider implementing additional monitoring

## Next Steps

1. Review all generated report files
2. Prioritize fixes based on severity
3. Create tickets for remediation work
4. Schedule regular security scans
5. Update security policies and procedures

---
*This report was generated automatically by the BIL security scanning tool.*
EOF
    
    log_success "Security report generated: $REPORTS_DIR/security-report.md"
}

# Main function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting comprehensive security scan for $ENVIRONMENT environment..."
    log_info "Reports will be saved to: $REPORTS_DIR"
    
    # Run all scans
    scan_dependencies
    scan_container_images
    scan_infrastructure
    scan_network
    scan_application
    generate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "🔒 Security scan completed in ${duration}s"
    log_info "Review the reports in: $REPORTS_DIR"
    log_info "Start with: cat $REPORTS_DIR/security-report.md"
    
    # Check for critical issues
    if [[ -f "$REPORTS_DIR/npm-audit.json" ]]; then
        local critical_count=$(jq -r '.metadata.vulnerabilities.critical // 0' "$REPORTS_DIR/npm-audit.json" 2>/dev/null || echo "0")
        local high_count=$(jq -r '.metadata.vulnerabilities.high // 0' "$REPORTS_DIR/npm-audit.json" 2>/dev/null || echo "0")
        
        if [[ "$critical_count" -gt 0 || "$high_count" -gt 0 ]]; then
            log_error "⚠️  Found $critical_count critical and $high_count high severity vulnerabilities!"
            log_error "Please review and fix these issues immediately."
            exit 1
        fi
    fi
}

# Run main function
main "$@"