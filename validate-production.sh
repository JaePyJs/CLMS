#!/bin/bash
# ============================================================================
# CLMS Production Pre-Deployment Validation Script
# ============================================================================
# This script validates that all requirements are met before deployment
# Usage: bash validate-production.sh
# ============================================================================

set -e

echo "🔍 CLMS Production Readiness Validation"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check status
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# 1. Check Docker
echo "1. Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    check_pass "Docker installed: $DOCKER_VERSION"
else
    check_fail "Docker is not installed"
fi

# 2. Check Docker Compose
echo ""
echo "2. Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    check_pass "Docker Compose installed: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    check_pass "Docker Compose (plugin) installed: $COMPOSE_VERSION"
else
    check_fail "Docker Compose is not installed"
fi

# 3. Check .env.production file
echo ""
echo "3. Checking environment configuration..."
if [ -f ".env.production" ]; then
    check_pass ".env.production file exists"
    
    # Check for placeholder passwords
    if grep -q "change-me" .env.production; then
        check_fail "Placeholder passwords found in .env.production (contains 'change-me')"
    else
        check_pass "No placeholder passwords found"
    fi
    
    # Check for required variables
    required_vars=("MYSQL_ROOT_PASSWORD" "MYSQL_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET" "FRONTEND_URL" "PUBLIC_API_URL")
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .env.production; then
            check_pass "Required variable $var is set"
        else
            check_fail "Required variable $var is missing"
        fi
    done
    
    # Check JWT secret length
    JWT_SECRET=$(grep "^JWT_SECRET=" .env.production | cut -d'=' -f2)
    if [ ${#JWT_SECRET} -ge 32 ]; then
        check_pass "JWT_SECRET is sufficiently long (${#JWT_SECRET} characters)"
    else
        check_warn "JWT_SECRET is too short (${#JWT_SECRET} characters, recommended 64+)"
    fi
else
    check_fail ".env.production file does not exist"
fi

# 4. Check google-credentials.json
echo ""
echo "4. Checking Google credentials..."
if [ -f "google-credentials.json" ]; then
    check_pass "google-credentials.json file exists"
    
    # Check if it's valid JSON
    if jq empty google-credentials.json &> /dev/null; then
        check_pass "google-credentials.json is valid JSON"
    else
        check_warn "google-credentials.json may not be valid JSON"
    fi
    
    # Check file permissions
    PERMS=$(stat -c "%a" google-credentials.json 2>/dev/null || stat -f "%OLp" google-credentials.json)
    if [ "$PERMS" = "644" ] || [ "$PERMS" = "600" ]; then
        check_pass "google-credentials.json has secure permissions ($PERMS)"
    else
        check_warn "google-credentials.json permissions ($PERMS) - recommended: 644 or 600"
    fi
else
    check_fail "google-credentials.json file does not exist (required for Google Sheets integration)"
fi

# 5. Check docker-compose.prod.yml
echo ""
echo "5. Checking Docker Compose configuration..."
if [ -f "docker-compose.prod.yml" ]; then
    check_pass "docker-compose.prod.yml exists"
    
    # Validate YAML syntax
    if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
        check_pass "docker-compose.prod.yml is valid"
    else
        check_fail "docker-compose.prod.yml has syntax errors"
    fi
else
    check_fail "docker-compose.prod.yml does not exist"
fi

# 6. Check available ports
echo ""
echo "6. Checking port availability..."
PORTS=(3001 8080 3308 6379)
for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        check_warn "Port $port is already in use"
    else
        check_pass "Port $port is available"
    fi
done

# 7. Check disk space
echo ""
echo "7. Checking disk space..."
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -ge 20 ]; then
    check_pass "Sufficient disk space available (${AVAILABLE_SPACE}GB)"
else
    check_warn "Limited disk space (${AVAILABLE_SPACE}GB available, recommended 20GB+)"
fi

# 8. Check Backend Dockerfile
echo ""
echo "8. Checking Backend Dockerfile..."
if [ -f "Backend/Dockerfile" ]; then
    check_pass "Backend Dockerfile exists"
else
    check_fail "Backend Dockerfile does not exist"
fi

# 9. Check Frontend production Dockerfile
echo ""
echo "9. Checking Frontend Dockerfile..."
if [ -f "Frontend/Dockerfile.prod" ]; then
    check_pass "Frontend production Dockerfile exists"
else
    check_fail "Frontend/Dockerfile.prod does not exist"
fi

# Summary
echo ""
echo "========================================"
echo "📊 Validation Summary"
echo "========================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. docker-compose -f docker-compose.prod.yml up -d --build"
    echo "  2. docker-compose -f docker-compose.prod.yml logs -f backend"
    echo "  3. Visit http://192.168.0.126:8080"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  All critical checks passed with $WARNINGS warning(s).${NC}"
    echo "Review warnings above before proceeding."
    exit 0
else
    echo -e "${RED}❌ Validation failed with $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo "Please fix the errors above before deploying to production."
    exit 1
fi
