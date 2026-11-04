# ForgeTrack — Modern Manufacturing Inventory & Production Management System

[![CI Pipeline](https://github.com/your-org/forgetrack/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/forgetrack/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.1-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)

ForgeTrack is an enterprise-grade web application tailored for small and medium-sized discrete manufacturers (furniture workshops, metal fabrication, machinery components, and assembly operations).

It bridges the critical disconnect between spreadsheet registers and shop floor operations by connecting inventory movements directly to production activity, providing real-time visibility into **material consumption, scrap generation, BOM variance, and actual manufacturing costs**.

---

## Table of Contents

1. [Key Features & Capabilities](#key-features--capabilities)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Multi-Tenancy & Security Model](#multi-tenancy--security-model)
4. [Inventory & Costing Engine](#inventory--costing-engine)
5. [Specification Test Case Walkthrough](#specification-test-case-walkthrough)
6. [Demo Accounts & Personas](#demo-accounts--personas)
7. [Getting Started (Quickstart)](#getting-started-quickstart)
   - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
   - [Option B: Local Development Setup](#option-b-local-development-setup)
8. [Automated Testing & Verification](#automated-testing--verification)
9. [API Documentation & Health Check](#api-documentation--health-check)
10. [Database Backup & Recovery](#database-backup--recovery)

---

## Key Features & Capabilities

- **Organization & Role-Based Access Control (RBAC)**: Multi-tenant organization scoping, custom user model, and 5 granular roles (*Administrator*, *Production Manager*, *Storekeeper*, *Production Operator*, *Viewer*).
- **Record-Level Production Order Isolation**: Operators are strictly restricted to orders actively assigned to them via `ProductionOrderAssignment`. Storekeepers access material issues/receipts, while Managers and Admins manage the pipeline.
- **Bill of Materials (BOM) & Immutability**: Multi-component recipe management with planned scrap allowances. Orders create an immutable snapshot of the BOM upon release—protecting historical orders from subsequent engineering revisions.
- **Append-Only Inventory Ledger**: All stock movements (Receipt, Reservation, Issue, Return, Transfer, Adjustment) are recorded as immutable ledger transactions with row-level database locking (`select_for_update()`).
- **Weighted Average Cost (WAC) Valuation**: Automatically updates unit inventory costs on receipt. Monetary and quantity values are calculated with high-precision `Decimal` arithmetic.
- **Shop Floor Material Reconciliation**: Enforces that production orders cannot be closed until all issued materials are fully accounted for via `Actual Consumption + Returned Stock = Issued Stock`.
- **Variance & Output Cost Engine**: Real-time variance tracking (`Planned vs Actual` and `Variance %`), tracking good finished output, rejected units, and scrap, culminating in the exact **Actual Material Cost per Good Unit**.
- **Role-Tailored Dashboards & Reports**: Dynamic KPIs for each role, visual pipeline status bar charts, low-stock reorder alerts, material variance tables, and live CSV data exports.

---

## Architecture & Technology Stack

ForgeTrack is engineered as a clean **Modular Monolith**:

```text
ForgeTrack/
├── backend/
│   ├── apps/
│   │   ├── organizations/     # Multi-tenancy Organization model & base querysets
│   │   ├── users/             # Custom User model, session auth, RBAC permissions
│   │   ├── inventory/         # Items, Warehouses, Stock Balances, Ledger & InventoryService
│   │   ├── products/          # Finished products & Bills of Materials (BOM)
│   │   ├── production/        # Orders, Assignments, Issues, Consumption, Outputs & ProductionService
│   │   ├── reporting/         # Role-tailored dashboards, variance reports & CSV export
│   │   └── audit/             # System-wide immutable audit trail
│   ├── config/                # Django project settings, WSGI, ASGI, and root routing
│   ├── tests/                 # Full Pytest test suite (16 tests covering RBAC, inventory, & production)
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # Typed Axios API clients with CSRF management
│   │   ├── components/ui/     # Accessible UI components (Badge, Modal, Card, Input, Select, Tabs)
│   │   ├── context/           # AuthContext with 1-click Demo Persona Switcher
│   │   ├── layouts/           # AppLayout with collapsible sidebar & topbar navigation
│   │   ├── pages/             # Login, Dashboard, Orders, OrderDetail, BOM, Items, Balances, Ledger, Users, Reports
│   │   ├── test/              # Vitest test suite (10 unit & calculation tests)
│   │   └── types/             # TypeScript domain models and enums
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci.yml
```

### Technology Highlights

| Component | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript | Strict type checking, modern component ergonomics, and fast compilation. |
| **Bundler & Build Tool**| Vite 8 | Ultra-fast Hot Module Replacement (HMR) and optimized rollup production bundles. |
| **Styling & Icons** | Tailwind CSS + Lucide React | Restrained, modern B2B SaaS aesthetics with cohesive spacing, neutral palettes, and accessible icons. |
| **State & Data Fetching**| TanStack Query v5 | Robust cache invalidation, background refetching, and declarative query state. |
| **Forms & Validation** | React Hook Form + Zod | High-performance uncontrolled forms with schema-driven validation. |
| **Backend Framework** | Django 5.1 + DRF | Battle-tested security, built-in ORM transactions, and extensible serializer pipelines. |
| **Database** | PostgreSQL 16 | ACID-compliant transactional guarantees, row-level locking, and exact numeric decimal precision. |
| **API Documentation** | drf-spectacular (OpenAPI 3) | Automatically generated interactive Swagger UI at `/api/docs/`. |

---

## Multi-Tenancy & Security Model

1. **Organization Scoping**: All operational tables inherit from `OrganizationBaseModel` with a `models.ForeignKey(Organization, on_delete=models.CASCADE)`. All queries enforce `.for_user(request.user)`.
2. **Role-Based Access Matrix**:

| Capability | Administrator | Production Manager | Storekeeper | Operator | Viewer |
|---|---|---|---|---|---|
| User Management | Full CRUD | No Access | No Access | No Access | No Access |
| Product & BOMs | Full CRUD | Full CRUD | Read-Only | Read Instructions | Read-Only |
| Inventory Movements | Full Access | Read-Only | Manage Movements | View Required Materials | Read-Only |
| Production Orders | All Org Orders | All Org Orders | Stock-Linked Orders | **Assigned Orders Only** | Authorized Orders |
| Costing Reports | Full Access | Full Access | Restricted | **Restricted** | Restricted |
| Audit Trail | Full Access | Operational Logs | Stock Logs | Own Actions | Read-Only |

3. **Secure Cookie-Based Authentication**: Uses Django session authentication with HTTP-only session cookies and CSRF protection (`X-CSRFToken`). Deactivated users are immediately terminated and blocked from authentication.

---

## Inventory & Costing Engine

### Append-Only Ledger & Balances
ForgeTrack strictly forbids updating inventory quantity fields directly. Every physical change creates an `InventoryLedgerTransaction`:
- `RECEIPT`: Goods received from supplier with purchase price; recalculates Weighted Average Cost (WAC).
- `RESERVATION`: Earmarks available stock for released production orders.
- `ISSUE`: Physical delivery from warehouse to shop floor work-in-progress.
- `RETURN`: Unconsumed raw materials transferred back to warehouse stock.
- `TRANSFER`: Inter-warehouse movement.
- `ADJUSTMENT`: Cycle count reconciliations with audit rationale.

### Material Valuation Formula (Weighted Average Cost)
$$\text{New WAC} = \frac{(\text{Current On-Hand} \times \text{Current WAC}) + (\text{Receipt Quantity} \times \text{Receipt Unit Cost})}{\text{Current On-Hand} + \text{Receipt Quantity}}$$

---

## Specification Test Case Walkthrough

ForgeTrack is verified against the prompt's exact discrete manufacturing test specification:

### Problem Statement
- **Planned Output**: 100 finished units of *Specification Bench Test Unit*.
- **BOM Requirement**: 2.0 kg of raw material per unit.
- **Scrap Allowance**: 5.0% allowance configured in the BOM.
- **Planned Requirement**:
  $$\text{Planned Requirement} = 100 \times 2.0 \times (1 + 0.05) = 210.0\text{ kg}$$
- **Actual Consumption**: 215.0 kg reported on the shop floor.
- **Material Unit Cost**: ₹40.00 / kg.

### Results Calculated by ForgeTrack
- **Actual Material Cost**:
  $$215.0\text{ kg} \times ₹40.00 = ₹8,600.00$$
- **Actual Material Cost per Good Unit**:
  $$\frac{₹8,600.00}{100\text{ good units}} = ₹86.00\text{ / unit}$$
- **Material Variance Quantity**:
  $$215.0\text{ kg} - 210.0\text{ kg} = +5.0\text{ kg}$$
- **Variance Percentage**:
  $$\frac{+5.0\text{ kg}}{210.0\text{ kg}} \times 100 \approx +2.38\%$$

> **Verification**: This scenario is pre-seeded in order `PO-SPEC-01` and tested in both backend (`test_specification_variance_and_costing_calculation`) and frontend Vitest (`calculations.test.ts`).

---

## Demo Accounts & Personas

ForgeTrack includes seeded test accounts. In the UI, you can sign in using credentials or click the **Demo Persona Switcher** on the login screen and application top-bar.

| Role | Email | Password | Scope & Primary Workflow |
|---|---|---|---|
| **Administrator** | `admin@forgetrack.com` | `ForgeTrackDemo123!` | Full organization administration, user management, audit logs, and reports. |
| **Production Manager** | `manager@forgetrack.com` | `ForgeTrackDemo123!` | Plan, release, assign orders, review variance, and close completed orders. |
| **Storekeeper** | `store@forgetrack.com` | `ForgeTrackDemo123!` | Receive stock, fulfill material issues, warehouse transfers, and reconciliation. |
| **Production Operator** | `operator@forgetrack.com` | `ForgeTrackDemo123!` | Shop floor execution: records consumption, scrap, good output, and returns for assigned jobs. |
| **Viewer** | `viewer@forgetrack.com` | `ForgeTrackDemo123!` | Read-only access to operational screens; restricted from sensitive costing. |

---

## Getting Started (Quickstart)

### Option A: Docker Compose (Recommended)

1. **Clone the repository and copy environment file**:
   ```bash
   git clone https://github.com/your-org/forgetrack.git
   cd forgetrack
   cp .env.example .env
   ```

2. **Launch all services**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
   - Web Application: [http://localhost:5173](http://localhost:5173)
   - REST API & Health Check: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)
   - Swagger OpenAPI Docs: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)

---

### Option B: Local Development Setup

#### 1. PostgreSQL Database
Ensure PostgreSQL is running. (If using Docker for DB only):
```bash
docker run -d --name forgetrack_db -e POSTGRES_DB=forgetrack -e POSTGRES_USER=forgetrack_user -e POSTGRES_PASSWORD=forgetrack_secret_password -p 5434:5432 postgres:16-alpine
```

#### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed realistic demo data
python manage.py seed_demo_data

# Run dev server
python manage.py runserver 127.0.0.1:8000
```

#### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Run Vite dev server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) and sign in with any of the demo accounts above!

---

## Automated Testing & Verification

ForgeTrack includes automated test suites covering both the Python/Django backend and the React/TypeScript frontend.

### Backend Test Suite (Pytest)
```bash
cd backend
pytest tests -v
```

**Test Coverage Highlights (16 Passing Tests)**:
- `test_unauthenticated_request_blocked`: Verifies 401/403 on protected routes.
- `test_deactivated_user_cannot_login`: Asserts immediate rejection of inactive accounts.
- `test_admin_can_manage_users` & `test_non_admin_cannot_manage_users`: RBAC authorization enforcement.
- `test_operator_only_sees_assigned_orders`: Validates record-level query filtering.
- `test_operator_cannot_access_unassigned_order_detail`: Ensures 404/403 on ID tampering.
- `test_cross_organization_access_rejected`: Asserts multi-tenant tenant data isolation.
- `test_stock_receipt_and_wac_calculation`: Verifies Weighted Average Cost calculation.
- `test_reservations_affect_available_quantity`: Ensures available quantity deductions.
- `test_warehouse_transfer`: Atomicity of multi-warehouse inventory transfers.
- `test_idempotency_prevents_duplicate_movements`: Duplicate request key protection.
- `test_bom_snapshot_immutability`: Ensures released orders preserve original BOM snapshots.
- `test_state_machine_invalid_transitions`: Rejects illegal status leaps (e.g., Draft -> Closed).
- `test_specification_variance_and_costing_calculation`: Tests prompt's exact 210kg/215kg ₹8,600 calculation.
- `test_unreconciled_materials_block_order_close`: Prevents order closure if issued != consumed + returned.

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm run test -- --run
```
**Test Coverage Highlights (10 Passing Tests)**:
- Component rendering and styling tests for `Badge`, `StatusBadge`, and `RoleBadge`.
- Mathematical validation of scrap allowances, decimal rounding, variance percentages, unit costing, and division-by-zero guards.

### Frontend Production Build
```bash
cd frontend
npm run build
```
Compiles TypeScript with zero errors and produces optimized production assets.

---

## API Documentation & Health Check

The backend exposes an interactive OpenAPI 3 (Swagger) documentation explorer:

- **Swagger UI**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **OpenAPI Schema (JSON)**: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)
- **Health Check Endpoint**: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)

### Core API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/v1/auth/login/` | Session login with CSRF cookie |
| | `POST` | `/api/v1/auth/logout/` | Invalidate current session |
| | `GET` | `/api/v1/auth/me/` | Current authenticated user profile |
| **Users** | `GET` / `POST` | `/api/v1/users/` | List and create organization users |
| | `POST` | `/api/v1/users/{id}/toggle-active/` | Activate or deactivate user |
| **Inventory** | `GET` / `POST` | `/api/v1/inventory/items/` | Item catalog and SKU management |
| | `GET` | `/api/v1/inventory/balances/` | On-hand, reserved, and available stock |
| | `GET` | `/api/v1/inventory/ledger/` | Append-only movement ledger |
| | `POST` | `/api/v1/inventory/receipts/` | Post stock receipt with WAC |
| | `POST` | `/api/v1/inventory/transfers/` | Inter-warehouse stock transfer |
| | `GET` | `/api/v1/inventory/reconcile/` | Reconcile ledger vs cached balances |
| **Products**| `GET` / `POST` | `/api/v1/products/` | Finished products catalog |
| | `GET` / `POST` | `/api/v1/products/boms/` | Bill of Materials (BOM) management |
| | `POST` | `/api/v1/products/boms/{id}/release/`| Release and lock BOM version |
| | `POST` | `/api/v1/products/boms/{id}/simulate/`| Batch material requirement simulation |
| **Production**| `GET` / `POST` | `/api/v1/production/` | List & create production orders |
| | `POST` | `/api/v1/production/{id}/release/` | Release order & snapshot BOM |
| | `POST` | `/api/v1/production/{id}/assignments/`| Assign team members to order |
| | `POST` | `/api/v1/production/{id}/issues/` | Issue materials to production |
| | `POST` | `/api/v1/production/{id}/consumption/`| Record actual consumption & scrap |
| | `POST` | `/api/v1/production/{id}/output/` | Record good & rejected finished units |
| | `POST` | `/api/v1/production/{id}/close/` | Reconcile and close order |
| **Reports** | `GET` | `/api/v1/reports/dashboard/` | Role-tailored dashboard metrics |
| | `GET` | `/api/v1/reports/material-variance/`| Material variance and cost analysis |
| | `GET` | `/api/v1/reports/material-variance/export/` | Live CSV export of material variance |
| | `GET` | `/api/v1/reports/production-costs/` | Finished goods cost per unit report |
| **Audit** | `GET` | `/api/v1/audit/` | Immutable system audit event log |

---

## Database Backup & Recovery

### Backup Procedure
To create a timestamped compressed backup of the PostgreSQL database:
```bash
# Docker container backup
docker exec -t forgetrack_db pg_dump -U forgetrack_user -d forgetrack -F c -b -v -f /tmp/forgetrack_backup_$(date +%Y%m%d_%H%M%S).dump

# Copy backup to host
docker cp forgetrack_db:/tmp/forgetrack_backup_*.dump ./backups/
```

### Restore Procedure
To restore from a backup file:
```bash
docker exec -i forgetrack_db pg_restore -U forgetrack_user -d forgetrack -v --clean /tmp/your_backup_file.dump
```

---

## License & Credits

ForgeTrack is built as an open-source manufacturing operations system. Designed for high reliability, data integrity, and operational clarity.
