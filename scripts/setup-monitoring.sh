#!/bin/bash

# BIL Monitoring Setup Script
# Sets up monitoring and alerting infrastructure

set -e

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

# Install monitoring stack
install_monitoring() {
    log_info "Installing monitoring stack..."
    
    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Prometheus
    log_info "Installing Prometheus..."
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=10Gi
    
    # Wait for Prometheus to be ready
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=300s
    
    log_success "Monitoring stack installed successfully"
}

# Configure alerting rules
configure_alerting() {
    log_info "Configuring alerting rules..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: bil-alerts
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: bil.rules
    rules:
    - alert: BILAPIDown
      expr: up{job="bil-api"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "BIL API is down"
        description: "BIL API has been down for more than 1 minute"
    
    - alert: BILHighResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="bil-api"}[5m])) > 2
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "BIL API high response time"
        description: "95th percentile response time is {{ \$value }}s"
    
    - alert: BILHighErrorRate
      expr: rate(http_requests_total{job="bil-api",status=~"5.."}[5m]) / rate(http_requests_total{job="bil-api"}[5m]) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "BIL API high error rate"
        description: "Error rate is {{ \$value | humanizePercentage }}"
    
    - alert: BILDatabaseConnectionsHigh
      expr: pg_stat_activity_count{job="postgres-exporter"} > 180
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High database connections"
        description: "Database has {{ \$value }} active connections"
    
    - alert: BILRedisMemoryHigh
      expr: redis_memory_used_bytes{job="redis-exporter"} / redis_memory_max_bytes{job="redis-exporter"} > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Redis memory usage high"
        description: "Redis memory usage is {{ \$value | humanizePercentage }}"
EOF
    
    log_success "Alerting rules configured"
}

# Setup Grafana dashboards
setup_dashboards() {
    log_info "Setting up Grafana dashboards..."
    
    # Create dashboard ConfigMap
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: bil-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  bil-dashboard.json: |
    {
      "dashboard": {
        "id": null,
        "title": "BIL System Overview",
        "tags": ["bil"],
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "API Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"bil-api\"}[5m]))",
                "legendFormat": "95th percentile"
              }
            ]
          },
          {
            "id": 2,
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{job=\"bil-api\"}[5m])",
                "legendFormat": "Requests/sec"
              }
            ]
          },
          {
            "id": 3,
            "title": "Error Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{job=\"bil-api\",status=~\"5..\"}[5m])",
                "legendFormat": "5xx errors/sec"
              }
            ]
          }
        ],
        "time": {
          "from": "now-1h",
          "to": "now"
        },
        "refresh": "30s"
      }
    }
EOF
    
    log_success "Grafana dashboards configured"
}

# Configure Slack notifications
configure_slack() {
    log_info "Configuring Slack notifications..."
    
    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_warning "SLACK_WEBHOOK_URL not set. Skipping Slack configuration."
        return
    fi
    
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-slack-webhook
  namespace: monitoring
stringData:
  url: "$SLACK_WEBHOOK_URL"
EOF
    
    # Update Alertmanager configuration
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-kube-prometheus-alertmanager
  namespace: monitoring
stringData:
  alertmanager.yml: |
    global:
      slack_api_url_file: /etc/alertmanager/secrets/alertmanager-slack-webhook/url
    
    route:
      group_by: ['alertname']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'web.hook'
    
    receivers:
    - name: 'web.hook'
      slack_configs:
      - channel: '#alerts'
        title: 'BIL Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'
        send_resolved: true
EOF
    
    # Restart Alertmanager to pick up new config
    kubectl rollout restart statefulset/alertmanager-kube-prometheus-alertmanager -n monitoring
    
    log_success "Slack notifications configured"
}

# Main setup function
main() {
    log_info "Setting up monitoring and alerting for BIL system..."
    
    # Check prerequisites
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed. Aborting."; exit 1; }
    command -v helm >/dev/null 2>&1 || { log_error "Helm is required but not installed. Aborting."; exit 1; }
    
    install_monitoring
    configure_alerting
    setup_dashboards
    configure_slack
    
    log_success "🎉 Monitoring setup completed successfully!"
    
    # Show access information
    log_info "Access information:"
    log_info "  Grafana: kubectl port-forward svc/kube-prometheus-grafana 3000:80 -n monitoring"
    log_info "  Prometheus: kubectl port-forward svc/kube-prometheus-prometheus 9090:9090 -n monitoring"
    log_info "  Alertmanager: kubectl port-forward svc/kube-prometheus-alertmanager 9093:9093 -n monitoring"
    log_info ""
    log_info "Default Grafana credentials: admin/prom-operator"
}

# Run main function
main "$@"