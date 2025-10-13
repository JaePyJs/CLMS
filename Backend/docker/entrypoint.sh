#!/bin/sh

set -e

# Function to wait for database
wait_for_db() {
    echo "Waiting for database..."

    # Extract database info from DATABASE_URL
    if [ -n "$DATABASE_URL" ]; then
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

        echo "Database connection: $DB_HOST:$DB_PORT, database: $DB_NAME"

        # Wait for database to be ready
        max_attempts=30
        attempt=1

        while [ $attempt -le $max_attempts ]; do
            if mysqladmin ping -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" --silent; then
                echo "Database is ready!"
                break
            fi

            echo "Attempt $attempt/$max_attempts: Database not ready, waiting..."
            sleep 2
            attempt=$((attempt + 1))
        done

        if [ $attempt -gt $max_attempts ]; then
            echo "ERROR: Database connection failed after $max_attempts attempts"
            exit 1
        fi
    fi
}

# Function to wait for Redis
wait_for_redis() {
    echo "Waiting for Redis..."

    if [ -n "$REDIS_HOST" ]; then
        max_attempts=30
        attempt=1

        while [ $attempt -le $max_attempts ]; do
            if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" ping > /dev/null 2>&1; then
                echo "Redis is ready!"
                break
            fi

            echo "Attempt $attempt/$max_attempts: Redis not ready, waiting..."
            sleep 2
            attempt=$((attempt + 1))
        done

        if [ $attempt -gt $max_attempts ]; then
            echo "ERROR: Redis connection failed after $max_attempts attempts"
            exit 1
        fi
    fi
}

# Function to run database migrations
run_migrations() {
    echo "Running database migrations..."

    # Check if we need to run migrations
    if [ "$NODE_ENV" = "production" ] && [ "$SKIP_MIGRATIONS" != "true" ]; then
        # Run Prisma migrations in production
        npx prisma migrate deploy || echo "Migration deploy failed or not needed"

        # Generate Prisma client
        npx prisma generate
    fi
}

# Function to setup application
setup_app() {
    echo "Setting up application..."

    # Create necessary directories
    mkdir -p logs uploads generated tmp

    # Set proper permissions
    chmod 755 logs uploads generated tmp

    # Create log files if they don't exist
    touch logs/app.log logs/error.log logs/access.log

    echo "Application setup completed!"
}

# Function to perform health check
health_check() {
    echo "Performing initial health check..."

    # Check if the application can start
    timeout 10s node dist/src/server.js --health-check || {
        echo "ERROR: Application health check failed"
        exit 1
    }

    echo "Health check passed!"
}

# Main execution
echo "Starting CLMS Backend..."
echo "Environment: $NODE_ENV"
echo "Node version: $(node --version)"

# Wait for dependencies
wait_for_db
wait_for_redis

# Setup application
setup_app

# Run migrations
run_migrations

# Perform health check
health_check

echo "Starting application server..."
exec node dist/src/server.js