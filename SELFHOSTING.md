# EnvSync Self-Hosting Complete Guide

A comprehensive guide for deploying and managing EnvSync in a self-hosted environment. This guide covers infrastructure planning, installation, configuration, monitoring, and troubleshooting.

---

## Table of Contents

1.  [Infrastructure Requirements](#infrastructure-requirements)
2.  [Installation Guide](#installation-guide)
2.1 [Quick Install (One-Shot Script)](#quick-install-one-shot-script)
2.2 [Manuall Setup](#manuall-setup)
3.  [DNS Setup](#dns-setup)
4.  [Post-Deployment](#post-deployment)
5.  [Configuration](#configuration)
6.  [Troubleshooting](#troubleshooting)
---

## Infrastructure Requirements

### Server Specifications

#### Minimal Configuration (Development/Small Teams)

- CPU: 2 vCPU (minimum)
- RAM: 4 GB (minimum, 8 GB recommended)
- Storage: 50 GB SSD
- OS: Ubuntu 24.04 LTS

Use cases: Testing, small team deployments (< 50 users), development environments.

#### Recommended Configuration (Production/Medium Teams)

- CPU: 4 vCPU
- RAM: 16 GB
- Storage: 200 GB SSD
- OS: Ubuntu 24.04 LTS

Use cases: Production deployments (50-500 users), moderate analytics load.

#### High-Performance Configuration (Enterprise/Large Teams)

- CPU: 8+ vCPU
- RAM: 32 GB+
- Storage: 500 GB+ SSD (consider separate volumes for databases)
- OS: Ubuntu 24.04 LTS

Use cases: Production deployments (500+ users), heavy analytics, backup/disaster recovery infrastructure.

# Installation Guide

## Quick Install (One-Shot Script)

If you just want EnvSync running on a clean Ubuntu/Debian host with the fewest steps, use the bundled installer at `scripts/selfhost-install.sh`. It runs the full preflight -> setup -> DNS records -> bootstrap -> deploy flow end-to-end.

### Usage

From a cloned repo:

```bash
sudo bash scripts/selfhost-install.sh
```

Hosted one-liner (no clone required):

```bash
curl -fsSL https://envsync.cloud/install | sudo bash
```

### DNS import

After setup the script writes `/etc/envsync/dns-records.txt`, e.g.:

```
; EnvSync DNS records for example.com
; Generated 2026-04-17T09:00:00Z — import into your DNS provider.
$ORIGIN example.com.
$TTL 3600
@              IN  A  203.0.113.10    ; EnvSync
app            IN  A  203.0.113.10    ; EnvSync
api            IN  A  203.0.113.10    ; EnvSync
auth           IN  A  203.0.113.10    ; EnvSync
obs            IN  A  203.0.113.10    ; EnvSync
s3             IN  A  203.0.113.10    ; EnvSync
console.s3     IN  A  203.0.113.10    ; EnvSync
```

Import into Cloudflare via **Zone -> DNS -> Records -> Import and Export -> Import**. Route 53, NS1, and most other providers also accept BIND zone files.
Everything the installer does is the same set of commands documented below, just wrapped and made idempotent.

---

## Manuall Setup:

### Step 1: Launch and Prepare the Instance

Launch an instance with specifications matching your use case.

Update system and install packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip jq
```

### Step 2: Install Bun

Bun is the runtime required for the deploy-cli tool.
```bash
curl https://bun.sh/install | bash
```

### Step 3: Become Root

Most deployment steps require root access. Switch to root user:
```bash
sudo bash
source ~/.bashrc
```

Verify Bun is available:
```bash
bun --version
```

### Step 4: Clone the EnvSync Repository

```bash
git clone https://github.com/EnvSync-Cloud/envsync.git
cd envsync
```

### Step 5: Run Preinstall

The preinstall command validates your system and installs Docker + dependencies:
```bash
bunx @envsync-cloud/deploy-cli preinstall
```

This command will:

- Check system requirements
- Install Docker and Docker Compose
- Install Docker buildx
- Initialize Docker Swarm
- Prepare the `/opt/envsync` directory

You may see a warning about kernel upgrades; this is normal and can be addressed after deployment.

### Step 6: Storage Verification (Optional, but can save time and troubleshooting)

Before proceeding, verify you have sufficient disk space.
Check the root filesystem (/) has at least 30 GB free. If not, resize your EBS volume.
```bash
df -h
```

### Step 7: Run Setup

The setup command configures your deployment parameters:
```bash
bunx @envsync-cloud/deploy-cli setup
```

You will be prompted for the following information:

- **Root domain**: Your primary domain (e.g., `example.com`)
- **ACME email**: Email for Let's Encrypt certificate notifications
- **Release version**: Default is recommended; press Enter to accept
- **Keycloak admin user**: Default is `admin`; can customize
- **Keycloak admin password**: Auto-generated; save this securely
- **SMTP host**: Your mail provider's SMTP server (e.g., `smtp.resend.com`)
- **SMTP port**: Typically 587 or 465
- **SMTP secure**: Set to `true` for port 465, `false` for 587
- **SMTP user**: Your mail provider username
- **SMTP pass**: Your mail provider API key or password
- **SMTP from**: The sender email address (e.g., `noreply@example.com`)
- **ClickStack retention days**: How long to keep analytics data (default 30)
- **Expose auth.domain publicly**: Set to `true` for standard setup
- **Expose obs.domain publicly**: Set to `true` for file storage access
- **Enable mailpit**: Set to `false` for production; set to `true` to debug email locally

The setup command will output a JSON block with required DNS records:
```json
{
  "landing": "example.com",
  "app": "app.example.com",
  "api": "api.example.com",
  "auth": "auth.example.com",
  "obs": "obs.example.com",
  "mail": "mail.example.com",
  "s3": "s3.example.com",
  "s3Console": "console.s3.example.com"
}
```

Save this output for the DNS configuration step.

---

## DNS Setup

All 8 DNS records must point to your instance's public IP address. Set up A records with your DNS provider.

### Example for Route 53 (AWS)

For domain `example.com` with instance IP `12.34.56.78`:

1. Go to Route 53 > Hosted Zones > your domain
2. Create new record: `landing.example.com` > Type: A > Value: `12.34.56.78`
3. Create new record: `app.example.com` > Type: A > Value: `12.34.56.78`
4. Create new record: `api.example.com` > Type: A > Value: `12.34.56.78`
5. Create new record: `auth.example.com` > Type: A > Value: `12.34.56.78`
6. Create new record: `obs.example.com` > Type: A > Value: `12.34.56.78`
7. Create new record: `mail.example.com` > Type: A > Value: `12.34.56.78`
8. Create new record: `s3.example.com` > Type: A > Value: `12.34.56.78`
9. Create new record: `console.s3.example.com` > Type: A > Value: `12.34.56.78`

Set TTL to 300 seconds for faster propagation during initial setup, then increase to 3600 after confirmation.

---

## Post-Deployment

### Step 1: Run Bootstrap

The bootstrap command deploys the base infrastructure and databases:
```bash
bunx @envsync-cloud/deploy-cli bootstrap
```

This step will:

- Reset existing EnvSync deployments (confirm with `yes`)
- Clone the pinned repository version
- Build Docker images
- Deploy services to Docker Swarm
- Initialize databases
- Run database migrations

This process typically takes 5-15 minutes depending on instance size and network speed.
Expected completion message: Bootstrap process finishes without errors.

### Step 2: Run Deploy

The deploy command performs the final deployment:
```bash
bunx @envsync-cloud/deploy-cli deploy
```

This step will:

- Deploy application services (API, web app, landing page)
- Configure routing with Traefik
- Start all services
- Verify service health

### Step 3: Verify Deployment

Check that all services are running:
```bash
docker ps
```

You should see multiple containers in the `running` state.
Check Docker Swarm services:
```bash
docker service ls
```

All services should show `replicas 1/1` with no errors.

### Step 4: Access the Application

Once deployment is complete, access the services:

- **Landing Page**: `https://example.com`
- **Web Application**: `https://app.example.com`
- **API**: `https://api.example.com`
- **Admin Panel**: `https://auth.example.com/admin`
- **File Storage**: `https://s3.example.com` or `https://console.s3.example.com`

All HTTPS connections should work without certificate warnings (Let's Encrypt handles this automatically).

### Step 5: First-Time Setup

1. Create an admin user account in the web application
2. Configure authentication settings
3. Set up OAuth/OpenID Connect integrations if needed
4. Create teams or organizations
5. Invite users

---

## Monitoring and Maintenance

### Service Health Checks

Monitor service status regularly:

```bash
docker service ls
docker service ps <service_name>
```

Check Docker logs for specific services:

```bash
docker service logs envsync_api
docker service logs envsync_postgres
docker service logs envsync_traefik
```

### Log Management
EnvSync logs are stored in Docker's default logging driver. For long-term retention, configure Docker to use a centralized logging solution (e.g., ELK, Loki).

### SSL/TLS Certificate Management
Let's Encrypt certificates are automatically renewed by Traefik. Renewal attempts start 30 days before expiration.

To manually check certificate status:

```bash
docker exec envsync_traefik cat /letsencrypt/acme.json | jq '.acme[] | select(.domain.main=="your-domain.com")'
```

---

## Configuration

### Keycloak Configuration

Keycloak manages user authentication and authorization. Access it immediately after deployment:
**URL**: `https://auth.your-domain.com/admin`

**Default Credentials**:

- Username: `admin` (or your chosen username)
- Password: (displayed during setup)

Important first-time tasks:

1. Change the admin password
2. Configure email settings (SMTP)
3. Create realms if needed
4. Set up OpenID Connect integrations

### Application Configuration

Configuration is stored in `/etc/envsync/deploy.yaml` on the instance. To modify settings after deployment:

```bash
sudo nano /etc/envsync/deploy.yaml
```

Common modifications:

- SMTP settings
- Authentication provider details
- Feature flags
- Resource limits

After modifying, redeploy:

```bash
bunx @envsync-cloud/deploy-cli deploy
```

### Environment Variables

EnvSync uses environment variables for advanced configuration. These are typically injected at deployment time.

For custom configurations, edit `/opt/envsync/deploy/docker-stack.yaml` and redeploy.

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Insufficient Disk Space
**Symptom**: Deployment fails with "no space left on device" error.

**Solution**:
```bash
# Check available space
df -h

# Clean up unused Docker images and containers
docker system prune -a --volumes -f

# If still insufficient, resize the EBS volume (see Storage Verification section)
```

#### 2. DNS Not Resolving
**Symptom**: Accessing `app.example.com` shows "host not found" or connection refused.

**Diagnosis**:
```bash
nslookup app.example.com
dig app.example.com
```

**Solutions**:
- Wait 10-15 minutes for DNS propagation (TTL-dependent)
- Verify A records are created in your DNS provider console
- Confirm all A records point to the correct instance IP
- Check if the instance has a public IP assigned
- Flush your local DNS cache (OS-dependent)

#### 3. SSL/TLS Certificate Errors
**Symptom**: HTTPS connections show "certificate not trusted" or "certificate validation failed".

**Diagnosis**:
```bash
# Check Traefik logs
docker service logs envsync_traefik | grep -i certificate

# Check ACME challenge status
docker exec envsync_traefik cat /letsencrypt/acme.json | jq '.'
```

**Solutions**:
- Wait 5-10 minutes; Let's Encrypt validation can be slow
- Verify DNS is resolving correctly (required for ACME challenge)
- Check that port 80 and 443 are open to the internet
- Verify ACME email in setup configuration is correct
- Check firewall rules aren't blocking ACME validation traffic
- Restart Traefik: `docker service update --force envsync_traefik`

#### 4. Database Connection Failures
**Symptom**: Application shows database errors or services fail to start.

**Diagnosis**:
```bash
# Check PostgreSQL service
docker service ps envsync_postgres

# Check PostgreSQL logs
docker service logs envsync_postgres

# Verify database connectivity
docker run -it --network envsync_envsync postgres:latest psql -h postgres -U postgres -c "SELECT 1"
```

**Solutions**:
- Check that PostgreSQL service is running: `docker service ps envsync_postgres`
- Verify network connectivity between services (they should all be on `envsync_envsync` network)
- Check available disk space (databases need space to function)
- Review PostgreSQL logs for specific errors
- Restart the service: `docker service update envsync_postgres --force`

#### 5. Keycloak Not Accessible
**Symptom**: `https://auth.example.com` returns 502 or connection refused.

**Diagnosis**:
```bash
# Check Keycloak service status
docker service ps envsync_keycloak

# Check Keycloak logs
docker service logs envsync_keycloak

# Check if Keycloak database is ready
docker service ps envsync_keycloak_db
```

**Solutions**:
- Verify Keycloak database is running and healthy
- Wait 30-60 seconds after deployment; Keycloak takes time to initialize
- Check available memory; Keycloak requires at least 1 GB
- Review Keycloak logs for Java errors
- Increase Keycloak timeout in Traefik configuration if needed
- Restart Keycloak: `docker service update --force envsync_keycloak`

#### 6. API Service Failing to Start
**Symptom**: API service crashes immediately or stays in restarting state.

**Diagnosis**:
```bash
# Check API service status
docker service ps envsync_api

# Check API logs
docker service logs envsync_api

# Check available resources
docker stats
```

**Solutions**:
- Verify PostgreSQL and Redis are running
- Check available system memory (API needs 2-4 GB)
- Review API logs for configuration errors
- Verify SMTP configuration is correct
- Check that all required environment variables are set
- Restart the service: `docker service update --force envsync_api`

#### 7. Service Port Conflicts
**Symptom**: Deployment fails with "port already in use" error.

**Diagnosis**:
```bash
# Check for services using ports 80, 443, 2377
sudo netstat -tlnp | grep -E ":(80|443|2377)"
```

**Solutions**:
- Identify conflicting service
- Stop the conflicting service or change its port
- Ensure no other services are using ports 80, 443, or Docker Swarm ports
- Check firewall rules aren't blocking service ports

#### 8. Redis Connection Issues
**Symptom**: Application errors related to Redis; cache not working.

**Diagnosis**:
```bash
# Check Redis service
docker service ps envsync_redis

# Check Redis logs
docker service logs envsync_redis

# Test Redis connectivity
docker exec envsync_api redis-cli -h redis ping
```

**Solutions**:
- Verify Redis service is running
- Check network connectivity between services
- Verify Redis port (default 6379) isn't conflicting
- Check available memory for Redis
- Restart Redis: `docker service update --force envsync_redis`

---

## Support and Resources

- **Official Repository**: https://github.com/EnvSync-Cloud/envsync
- **Documentation**: Check the repository wiki and documentation
- **Issue Reporting**: GitHub Issues for bug reports
- **Community**: Discussions and community support via GitHub Discussions

---

## Version Information

- **Guide Version**: 1.0
- **EnvSync Version**: 0.7.6+
- **Ubuntu Version**: 24.04 LTS
- **Docker Version**: 29.1.3+
- **Bun Version**: 1.3.12+

Last Updated: April 2026