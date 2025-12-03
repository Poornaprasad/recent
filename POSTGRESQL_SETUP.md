# PostgreSQL Setup Guide

This application uses **PostgreSQL 14+** as its database. This guide covers installation, common issues, and troubleshooting.

## Quick Start

```bash
# 1. Start PostgreSQL service
brew services start postgresql@14

# 2. Create database
createdb invoice_management

# 3. Initialize database
npm run db:init

# 4. Push schema
npm run db:push
```

---

## Installation

### macOS (Homebrew)

```bash
# Install PostgreSQL 14
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
psql --version
# Should show: psql (PostgreSQL) 14.x
```

### Ubuntu/Debian

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL 14
sudo apt update
sudo apt install postgresql-14 postgresql-contrib-14

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
psql --version
```

### Windows

1. Download installer from [PostgreSQL official site](https://www.postgresql.org/download/windows/)
2. Run installer and follow wizard
3. Remember the password you set for `postgres` user
4. Add PostgreSQL bin directory to PATH

---

## Common Issues & Fixes

### Issue 1: "Bootstrap failed: 5: Input/output error"

**Error Message:**
```
Bootstrap failed: 5: Input/output error
Try re-running the command as root for richer errors.
Error: Failure while executing; /bin/launchctl bootstrap gui/501 /Users/.../homebrew.mxcl.postgresql@14.plist exited with 5.
```

**Causes:**
- Corrupted launchd plist file
- PostgreSQL already running
- File permission issues
- Conflicting PostgreSQL versions

**Solutions:**

#### Solution 1: Stop and restart PostgreSQL
```bash
# Stop PostgreSQL
brew services stop postgresql@14

# Check if still running
ps aux | grep postgres

# Kill any remaining processes (if found)
pkill -9 postgres

# Remove PID file if exists
rm -f /usr/local/var/postgresql@14/postmaster.pid
# OR (for M1/M2 Macs)
rm -f /opt/homebrew/var/postgresql@14/postmaster.pid

# Start again
brew services start postgresql@14
```

#### Solution 2: Fix launchd plist
```bash
# Unload service
brew services stop postgresql@14
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.postgresql@14.plist

# Remove plist
rm ~/Library/LaunchAgents/homebrew.mxcl.postgresql@14.plist

# Reinstall service
brew services start postgresql@14
```

#### Solution 3: Reinstall PostgreSQL
```bash
# Stop service
brew services stop postgresql@14

# Uninstall
brew uninstall postgresql@14

# Clean up data (CAUTION: This deletes all data!)
rm -rf /usr/local/var/postgresql@14
# OR (for M1/M2 Macs)
rm -rf /opt/homebrew/var/postgresql@14

# Reinstall
brew install postgresql@14

# Start service
brew services start postgresql@14
```

#### Solution 4: Check permissions
```bash
# Check data directory ownership
ls -la /usr/local/var/postgresql@14
# OR (for M1/M2 Macs)
ls -la /opt/homebrew/var/postgresql@14

# Fix ownership if needed
sudo chown -R $(whoami) /usr/local/var/postgresql@14
# OR (for M1/M2 Macs)
sudo chown -R $(whoami) /opt/homebrew/var/postgresql@14
```

#### Solution 5: Start PostgreSQL manually
```bash
# Start PostgreSQL in foreground to see errors
postgres -D /usr/local/var/postgresql@14
# OR (for M1/M2 Macs)
postgres -D /opt/homebrew/var/postgresql@14

# If successful, stop with Ctrl+C and start as service
brew services start postgresql@14
```

### Issue 2: "This module cannot be imported from a Client Component"

**Error Message:**
```
Error: This module cannot be imported from a Client Component module.
It should only be used from a Server Component.
at Object.<anonymous> (/path/to/node_modules/server-only/index.js:1:7)
```

**Cause:** The `db:init` script was importing `server-only` module

**Solution:** ✅ **Already fixed!** We created `src/lib/db/script.ts` without `server-only` import.

### Issue 3: Connection refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql
# Should show "started"

# If not running, start it
brew services start postgresql@14

# Verify it's listening on port 5432
lsof -i :5432
# Should show postgres process

# Test connection
psql -U postgres -d postgres
# Should connect successfully
```

### Issue 4: Database does not exist

**Error:**
```
Error: database "invoice_management" does not exist
```

**Solution:**
```bash
# Create database
createdb invoice_management

# Or using psql
psql -U postgres
CREATE DATABASE invoice_management;
\q
```

### Issue 5: Authentication failed

**Error:**
```
Error: password authentication failed for user "postgres"
```

**Solutions:**

```bash
# Method 1: Update .env with correct credentials
# Edit .env file:
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/invoice_management

# Method 2: Reset postgres password
psql -U postgres
ALTER USER postgres WITH PASSWORD 'your_new_password';
\q

# Method 3: Use peer authentication (macOS/Linux)
# Connect without password:
psql -U $(whoami) postgres
```

### Issue 6: Multiple PostgreSQL versions

**Problem:** Multiple versions installed causing conflicts

**Solution:**
```bash
# List all PostgreSQL installations
brew list | grep postgresql

# Unlink all versions
brew unlink postgresql@14
brew unlink postgresql@15
# ... etc

# Link only the version you want
brew link postgresql@14 --force

# Update PATH in ~/.zshrc or ~/.bashrc
export PATH="/usr/local/opt/postgresql@14/bin:$PATH"
# OR (for M1/M2 Macs)
export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"

# Reload shell
source ~/.zshrc
```

---

## Database Setup Steps

### 1. Start PostgreSQL

```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql

# Verify it's running
pg_isready
# Should output: "accepting connections"
```

### 2. Create Database

```bash
# Using createdb command
createdb invoice_management

# OR using psql
psql postgres
CREATE DATABASE invoice_management;
\l  # List databases to verify
\q  # Quit
```

### 3. Configure Environment

Create or update `.env` file:

```env
# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invoice_management

# Optional: Connection pool settings
DB_POOL_MAX=10
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=10000
```

### 4. Initialize Database

```bash
# Test connection
npm run db:init

# Expected output:
# Initializing database...
# [Database] ✓ PostgreSQL connection successful
# [Database] PostgreSQL version: 14.x
# ✓ Database initialized
# ✓ Database health check passed
```

### 5. Apply Schema

```bash
# Push schema to database (development)
npm run db:push

# OR generate and run migrations (production)
npm run db:generate
npm run db:migrate
```

### 6. Verify Setup

```bash
# Open Drizzle Studio to view database
npm run db:studio

# Or connect with psql
psql -U postgres -d invoice_management
\dt  # List tables
\q   # Quit
```

---

## Useful Commands

### PostgreSQL Service Management

```bash
# macOS (Homebrew)
brew services start postgresql@14      # Start
brew services stop postgresql@14       # Stop
brew services restart postgresql@14    # Restart
brew services list                     # List all services

# Linux (systemd)
sudo systemctl start postgresql        # Start
sudo systemctl stop postgresql         # Stop
sudo systemctl restart postgresql      # Restart
sudo systemctl status postgresql       # Check status
```

### Database Operations

```bash
# Create database
createdb database_name

# Drop database
dropdb database_name

# Connect to database
psql -U postgres -d database_name

# Backup database
pg_dump invoice_management > backup.sql

# Restore database
psql invoice_management < backup.sql
```

### psql Commands

```sql
-- List databases
\l

-- Connect to database
\c invoice_management

-- List tables
\dt

-- Describe table
\d table_name

-- List users
\du

-- Quit
\q
```

---

## Production Setup

### Hosted PostgreSQL Options

1. **Neon** (Recommended for serverless)
   - Serverless PostgreSQL
   - Auto-scaling
   - Free tier available
   - https://neon.tech

2. **Supabase**
   - PostgreSQL + Additional features
   - Free tier available
   - Built-in auth and storage
   - https://supabase.com

3. **AWS RDS**
   - Fully managed
   - High availability
   - Automatic backups
   - https://aws.amazon.com/rds/postgresql/

4. **Google Cloud SQL**
   - Fully managed
   - High availability
   - Auto scaling
   - https://cloud.google.com/sql

### Production Environment Variables

```env
# Use SSL for production
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Connection pooling
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=10000
DB_CONNECTION_TIMEOUT_MS=5000
```

---

## Troubleshooting Checklist

- [ ] PostgreSQL service is running (`brew services list` or `systemctl status postgresql`)
- [ ] PostgreSQL is listening on port 5432 (`lsof -i :5432`)
- [ ] Database exists (`psql -l | grep invoice_management`)
- [ ] `.env` file has correct `DATABASE_URL`
- [ ] Can connect with psql (`psql -U postgres -d invoice_management`)
- [ ] No errors in PostgreSQL logs (`tail -f /usr/local/var/log/postgresql@14.log`)

---

## Getting Help

If you're still having issues:

1. **Check PostgreSQL logs:**
   ```bash
   # macOS
   tail -f /usr/local/var/log/postgresql@14.log
   # OR (M1/M2)
   tail -f /opt/homebrew/var/log/postgresql@14.log

   # Linux
   sudo tail -f /var/log/postgresql/postgresql-14-main.log
   ```

2. **Test connection manually:**
   ```bash
   psql -U postgres -d invoice_management
   ```

3. **Verify environment variables:**
   ```bash
   cat .env | grep DATABASE_URL
   ```

4. **Check Node.js can connect:**
   ```bash
   npm run db:init
   ```

---

## Quick Reference

```bash
# Complete setup from scratch
brew install postgresql@14
brew services start postgresql@14
createdb invoice_management
cp .env.example .env
# Edit .env with your settings
npm install
npm run db:init
npm run db:push
npm run dev
```

**Need more help?** Open an issue on GitHub with:
- Your OS and PostgreSQL version
- Complete error message
- Output of `brew services list` (macOS) or `systemctl status postgresql` (Linux)
- Output of `pg_isready`
