# CLMS Production Network Security Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Comprehensive Library Management System (CLMS) with production-grade network security configurations on the 192.168.1.0/24 subnet.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Network Architecture](#network-architecture)
3. [Security Configuration](#security-configuration)
4. [Deployment Steps](#deployment-steps)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Security Checklist](#security-checklist)

## System Requirements

### Hardware Requirements
- **CPU**: 4+ cores (minimum 2 cores)
- **RAM**: 8GB+ (minimum 4GB)
- **Storage**: 100GB+ SSD (minimum 50GB)
- **Network**: Gigabit Ethernet connection to 192.168.1.0/24 subnet

### Software Requirements
- **Operating System**: Ubuntu 20.04+ LTS or CentOS 8+
- **Docker**: 20.10+ with Docker Compose
- **Kernel**: 5.4+ (for WireGuard support)
- **Ports**: Must be able to bind to ports 80, 443, 3000, 3001, 3308, 6379

### Network Requirements
- **Primary Network**: 192.168.1.0/24
- **Gateway**: 192.168.1.1
- **DNS**: 192.168.1.1, 8.8.8.8
- **Static IP**: Recommended (e.g., 192.168.1.100)

## Network Architecture

### Security Zones

```
Internet (Blocked by Default)
         ↓
    [Firewall Rules]
         ↓
┌─────────────────────────────────────┐
│         192.168.1.0/24             │
│                                     │
│  ┌─────────────┐ ┌─────────────────┐ │
│  │   CLMS      │ │   Admin/VPN     │ │
│  │   Stack     │ │   Access        │ │
│  │             │ │                 │ │
│  │ Nginx (80)  │ │ VPN (51820)     │ │
│  │ Nginx (443) │ │ SSH (22)        │ │
│  │ Frontend    │ │ Monitoring      │ │
│  │ Backend     │ │                 │ │
│  │ MySQL       │ │                 │ │
│  │ Redis       │ │                 │ │
│  └─────────────┘ └─────────────────┘ │
└─────────────────────────────────────┘
```

### Network Segmentation

1. **Frontend Network** (172.21.0.0/24)
   - Nginx reverse proxy
   - Frontend application
   - External-facing services

2. **Backend Network** (172.22.0.0/24)
   - Backend API
   - Database connections
   - Internal services

3. **Monitoring Network** (172.23.0.0/24)
   - Prometheus
   - Grafana
   - Alerting systems

4. **VPN Network** (10.8.0.0/24)
   - Remote administrative access
   - Secure connections

## Security Configuration

### Firewall Rules

#### Allowed Traffic (192.168.1.0/24 only)
- **HTTP (80)**: Nginx redirect to HTTPS
- **HTTPS (443)**: Secure web access
- **Frontend (3000)**: Direct access (optional)
- **Backend API (3001)**: API access
- **MySQL (3308)**: Database access
- **Redis (6379)**: Cache access
- **VPN (51820)**: WireGuard VPN
- **SSH (22)**: Administrative access

#### Blocked Traffic
- All external traffic (non-192.168.1.0/24)
- All unnecessary ports
- Direct database access from external networks

### SSL/TLS Configuration

#### Certificate Management
- **Development**: Self-signed certificates
- **Production**: Let's Encrypt certificates (if domain available)
- **Automatic Renewal**: Daily checks with alerts
- **Cipher Suites**: Modern TLS 1.2/1.3 only
- **HSTS**: HTTP Strict Transport Security enabled

#### Security Headers
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: Strict policy
- **Strict-Transport-Security**: max-age=31536000

### Rate Limiting

#### Nginx Rate Limits
- **Global**: 100 requests/minute
- **API**: 50 requests/minute
- **Login**: 5 requests/minute
- **Upload**: 2 requests/minute
- **Static Files**: 200 requests/minute

#### Connection Limits
- **Per IP**: 20 concurrent connections
- **API**: Additional strict limits
- **Login**: Burst protection

## Deployment Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Reboot to apply changes
sudo reboot
```

### 2. Network Configuration

```bash
# Set static IP (example for Ubuntu)
sudo nano /etc/netplan/01-netcfg.yaml

# Content:
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [192.168.1.1, 8.8.8.8]

# Apply configuration
sudo netplan apply
```

### 3. Firewall Configuration

```bash
# Make firewall script executable
chmod +x infrastructure/firewall-setup.sh

# Run firewall configuration
sudo bash infrastructure/firewall-setup.sh

# Verify firewall status
sudo ufw status verbose
```

### 4. SSL/TLS Configuration

```bash
# Make SSL script executable
chmod +x infrastructure/ssl-setup.sh

# Install SSL certificates
sudo bash infrastructure/ssl-setup.sh install

# Test SSL configuration
sudo bash infrastructure/ssl-setup.sh test
```

### 5. VPN Configuration (Optional)

```bash
# Make VPN script executable
chmod +x infrastructure/vpn-setup.sh

# Install and configure VPN
sudo bash infrastructure/vpn-setup.sh install

# Add VPN client
sudo bash infrastructure/vpn-setup.sh add-client admin admin@clms.local

# Test VPN configuration
sudo bash infrastructure/vpn-setup.sh test
```

### 6. Application Deployment

```bash
# Set up environment variables
cp .env.production.example .env.production
nano .env.production

# Deploy with security configuration
docker-compose -f docker-compose.security.yml up -d

# Check container status
docker-compose -f docker-compose.security.yml ps
```

### 7. Monitoring Setup

```bash
# Create monitoring directories
mkdir -p /opt/clms/monitoring/{prometheus,grafana,alerts}

# Deploy monitoring stack
docker-compose -f docker-compose.security.yml up -d prometheus grafana

# Access Grafana (http://localhost:3002)
# Default credentials: admin/changeme
```

## Monitoring and Maintenance

### Daily Tasks
- [ ] Check system logs: `journalctl -u docker --since "1 day ago"`
- [ ] Review firewall logs: `sudo tail -f /var/log/ufw.log`
- [ ] Monitor SSL certificates: `/usr/local/bin/ssl-monitor.sh`
- [ ] Check VPN status: `systemctl status wg-quick@wg0`

### Weekly Tasks
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Review monitoring alerts: Grafana dashboard
- [ ] Check disk space: `df -h`
- [ ] Backup configuration: `sudo bash infrastructure/vpn-setup.sh backup`

### Monthly Tasks
- [ ] Security audit review
- [ ] Performance tuning review
- [ ] Certificate expiry check
- [ ] Update documentation

### Automated Monitoring

#### System Metrics (Prometheus)
- CPU, memory, disk usage
- Network traffic and connections
- Container health and performance
- SSL certificate expiry
- VPN connection status

#### Security Monitoring
- Failed login attempts
- Unusual access patterns
- Firewall block events
- SSL/TLS security issues
- Container security alerts

#### Alert Configuration
- **Critical**: Service down, security breach
- **Warning**: High resource usage, certificate expiry
- **Info**: Configuration changes, maintenance events

## Troubleshooting

### Common Issues

#### Firewall Problems
```bash
# Check firewall status
sudo ufw status verbose

# Reset firewall rules
sudo ufw --force reset

# Reconfigure firewall
sudo bash infrastructure/firewall-setup.sh
```

#### SSL Certificate Issues
```bash
# Check certificate status
openssl x509 -in /etc/nginx/ssl/clms.crt -noout -dates

# Test SSL configuration
sudo nginx -t

# Renew certificates
sudo bash infrastructure/ssl-setup.sh renew
```

#### Docker Container Issues
```bash
# Check container logs
docker-compose -f docker-compose.security.yml logs

# Restart services
docker-compose -f docker-compose.security.yml restart

# Check resource usage
docker stats
```

#### VPN Connection Issues
```bash
# Check VPN status
systemctl status wg-quick@wg0

# Show VPN configuration
wg show wg0

# Restart VPN service
systemctl restart wg-quick@wg0
```

### Performance Issues

#### High Memory Usage
```bash
# Check memory usage
free -h
docker stats

# Optimize MySQL configuration
nano docker/mysql/conf.d/my.cnf
```

#### High CPU Usage
```bash
# Check CPU usage
top
htop

# Identify problematic processes
ps aux --sort=-%cpu | head
```

#### Network Issues
```bash
# Check network connections
netstat -tulpn

# Test connectivity
ping 192.168.1.1
curl -I http://localhost:443
```

## Security Checklist

### Pre-Deployment Checklist
- [ ] Static IP configured
- [ ] Firewall rules applied
- [ ] SSL certificates installed
- [ ] Strong passwords configured
- [ ] VPN access configured (if needed)
- [ ] Backup procedures tested
- [ ] Monitoring systems active

### Post-Deployment Checklist
- [ ] All services running correctly
- [ ] External access blocked
- [ ] Internal access working
- [ ] SSL/TLS functioning
- [ ] Monitoring alerts configured
- [ ] Log rotation configured
- [ ] Security headers verified

### Ongoing Security Checklist
- [ ] Regular security updates applied
- [ ] Certificate expiry monitored
- [ ] Access logs reviewed
- [ ] Firewall rules audited
- [ ] VPN access reviewed
- [ ] Backup integrity verified
- [ ] Incident response plan tested

## Emergency Procedures

### Security Incident Response

1. **Immediate Response**
   - Block suspicious IP addresses
   - Enable enhanced logging
   - Notify security team
   - Preserve evidence

2. **Investigation**
   - Review system logs
   - Analyze security alerts
   - Identify affected systems
   - Determine impact scope

3. **Recovery**
   - Patch vulnerabilities
   - Reset compromised credentials
   - Restore from clean backups
   - Implement additional security measures

### System Recovery

1. **Service Recovery**
   ```bash
   # Restart all services
   docker-compose -f docker-compose.security.yml restart

   # Check service status
   docker-compose -f docker-compose.security.yml ps
   ```

2. **Data Recovery**
   ```bash
   # Restore from backup
   sudo bash infrastructure/backup-restore.sh restore latest
   ```

3. **Configuration Recovery**
   ```bash
   # Restore firewall configuration
   sudo bash infrastructure/firewall-setup.sh

   # Restore SSL certificates
   sudo bash infrastructure/ssl-setup.sh install
   ```

## Contact Information

- **Network Administrator**: [Admin Contact]
- **Security Team**: [Security Contact]
- **Emergency Contact**: [Emergency Contact]
- **Vendor Support**: [Vendor Information]

## Documentation References

- [Network Security Audit](network-security-audit.md)
- [Firewall Configuration](firewall-setup.sh)
- [SSL/TLS Setup](ssl-setup.sh)
- [VPN Configuration](vpn-setup.sh)
- [Monitoring Configuration](../monitoring/)

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: [Review Date]
**Approved By**: [Approver Name]
**Classification**: Internal Use Only