# Documentation Index

This document provides an index of all active documentation in the TBF ReconX project.

## 📚 Main Documentation

### Getting Started
- **[README.md](../README.md)** - Project overview, setup instructions, and quick start guide
- **[POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md)** - PostgreSQL database setup and configuration

### Architecture
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture documentation (Clean Architecture pattern)

### Database
- **[DATABASE.md](./DATABASE.md)** - Complete database documentation
  - Schema overview
  - Migration guide
  - Enterprise-grade features
  - Database commands

### Development
- Additional development documentation may be added here as needed

## 📁 Specialized Documentation

### Migrations
- **[../drizzle/migrations/README.md](../drizzle/migrations/README.md)** - Migration guide and history
- **[../migrations/README_VENDOR_IMPORT.md](../migrations/README_VENDOR_IMPORT.md)** - Vendor import guide


## 🗂️ Documentation Structure

```
.
├── README.md                    # Main project documentation
├── docs/
│   ├── DOCUMENTATION.md         # This file - Documentation index
│   ├── ARCHITECTURE.md          # Architecture overview
│   ├── DATABASE.md              # Database documentation
│   ├── POSTGRESQL_SETUP.md      # Database setup
│   ├── ARCHITECTURE_REVIEW.md   # Architecture review (if exists)
│   ├── DASHBOARD_CONFIG.md      # Dashboard config (if exists)
│   ├── STRUCTURE.md             # Project structure (if exists)
│   └── blueprint.md             # Project blueprint (if exists)
├── drizzle/migrations/
│   └── README.md                # Migration guide
└── migrations/
    └── README_VENDOR_IMPORT.md  # Vendor import guide
```

## 📖 Quick Reference

### For New Developers
1. Start with [README.md](../README.md)
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Set up database: [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md)
4. Read [DATABASE.md](./DATABASE.md) for database details

### For Database Work
- Schema changes: [DATABASE.md](./DATABASE.md) → Migrations section
- Running migrations: [../drizzle/migrations/README.md](../drizzle/migrations/README.md)
- Vendor import: [../migrations/README_VENDOR_IMPORT.md](../migrations/README_VENDOR_IMPORT.md)

### For Architecture
- Clean Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔍 Finding Documentation

- **Setup & Getting Started**: `README.md` (root), `docs/POSTGRESQL_SETUP.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Database**: `docs/DATABASE.md`, `drizzle/migrations/README.md`
- **All Documentation**: `docs/DOCUMENTATION.md` (this file)

---

**Last Updated**: 2024  
**Maintained By**: TBF ReconX Team

