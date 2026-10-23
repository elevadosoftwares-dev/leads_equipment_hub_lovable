-- Store Management System schema for SQL Server.
-- Applied automatically at startup by src/server/db.server.ts. Every statement is idempotent,
-- so the script can run on every start. Batches are separated by GO.
--
-- Foreign keys to master data (category, sub category, department, technician, set) use
-- NO ACTION because SQL Server rejects multiple cascade paths; the delete server functions
-- clear those references explicitly in a transaction instead.

-- ── Accounts ────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(320)    NOT NULL CONSTRAINT uq_users_email UNIQUE,
  full_name     NVARCHAR(200)    NOT NULL DEFAULT N'',
  password_hash NVARCHAR(256)    NOT NULL,
  role          NVARCHAR(10)     NOT NULL DEFAULT N'user' CONSTRAINT ck_users_role CHECK (role IN (N'admin', N'user')),
  created_at    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_sessions PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sessions_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Uploaded files (photos, certificates, manuals) ─────────────────────────────────────
IF OBJECT_ID(N'dbo.files', N'U') IS NULL
CREATE TABLE dbo.files (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_files PRIMARY KEY DEFAULT NEWID(),
  name         NVARCHAR(400)    NOT NULL DEFAULT N'',
  content_type NVARCHAR(200)    NOT NULL DEFAULT N'application/octet-stream',
  size         BIGINT           NOT NULL DEFAULT 0,
  data         VARBINARY(MAX)   NOT NULL,
  created_at   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Master data ─────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
CREATE TABLE dbo.categories (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_categories PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_categories_name UNIQUE,
  created_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.subcategories', N'U') IS NULL
CREATE TABLE dbo.subcategories (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_subcategories PRIMARY KEY DEFAULT NEWID(),
  category_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_subcategories_category REFERENCES dbo.categories(id),
  name        NVARCHAR(200)    NOT NULL,
  created_at  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_subcategories_name UNIQUE (category_id, name)
);
GO

IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
CREATE TABLE dbo.departments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_departments PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_departments_name UNIQUE,
  created_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.technicians', N'U') IS NULL
CREATE TABLE dbo.technicians (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_technicians PRIMARY KEY DEFAULT NEWID(),
  name          NVARCHAR(200)    NOT NULL,
  employee_no   NVARCHAR(100)    NOT NULL DEFAULT N'',
  department_id UNIQUEIDENTIFIER NULL CONSTRAINT fk_technicians_department REFERENCES dbo.departments(id),
  phone         NVARCHAR(100)    NOT NULL DEFAULT N'',
  created_at    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.equipment_sets', N'U') IS NULL
CREATE TABLE dbo.equipment_sets (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment_sets PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_equipment_sets_name UNIQUE,
  notes      NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  created_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Equipment ───────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.equipment_code_seq', N'SO') IS NULL
CREATE SEQUENCE dbo.equipment_code_seq AS BIGINT START WITH 1 INCREMENT BY 1;
GO

IF OBJECT_ID(N'dbo.equipment', N'U') IS NULL
CREATE TABLE dbo.equipment (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment PRIMARY KEY DEFAULT NEWID(),
  code              NVARCHAR(20)     NOT NULL CONSTRAINT uq_equipment_code UNIQUE,
  type              NVARCHAR(200)    NOT NULL,
  brand             NVARCHAR(200)    NOT NULL DEFAULT N'',
  model             NVARCHAR(200)    NOT NULL DEFAULT N'',
  serial_no         NVARCHAR(200)    NOT NULL DEFAULT N'',
  store_no          NVARCHAR(200)    NOT NULL DEFAULT N'',
  photo_path        NVARCHAR(400)    NULL,
  specification     NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  location          NVARCHAR(400)    NOT NULL DEFAULT N'',
  service_details   NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  notes             NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  status            NVARCHAR(20)     NOT NULL DEFAULT N'available',
  condition         NVARCHAR(20)     NOT NULL DEFAULT N'Good',
  quarantine_reason NVARCHAR(400)    NOT NULL DEFAULT N'',
  category_id       UNIQUEIDENTIFIER NULL CONSTRAINT fk_equipment_category REFERENCES dbo.categories(id),
  subcategory_id    UNIQUEIDENTIFIER NULL CONSTRAINT fk_equipment_subcategory REFERENCES dbo.subcategories(id),
  department_id     UNIQUEIDENTIFIER NULL CONSTRAINT fk_equipment_department REFERENCES dbo.departments(id),
  set_id            UNIQUEIDENTIFIER NULL CONSTRAINT fk_equipment_set REFERENCES dbo.equipment_sets(id),
  created_at        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.calibrations', N'U') IS NULL
CREATE TABLE dbo.calibrations (
  id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_calibrations PRIMARY KEY DEFAULT NEWID(),
  equipment_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_calibrations_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  calibration_date DATE             NOT NULL,
  expiry_date      DATE             NOT NULL,
  certificate_path NVARCHAR(400)    NULL,
  certificate_name NVARCHAR(400)    NULL,
  performed_by     NVARCHAR(200)    NOT NULL DEFAULT N'',
  remarks          NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  created_at       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.equipment_files', N'U') IS NULL
CREATE TABLE dbo.equipment_files (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment_files PRIMARY KEY DEFAULT NEWID(),
  equipment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_equipment_files_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  kind         NVARCHAR(20)     NOT NULL DEFAULT N'file',
  path         NVARCHAR(400)    NOT NULL,
  name         NVARCHAR(400)    NOT NULL DEFAULT N'',
  created_at   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Issuances ───────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.issuance_report_seq', N'SO') IS NULL
CREATE SEQUENCE dbo.issuance_report_seq AS BIGINT START WITH 1 INCREMENT BY 1;
GO

IF OBJECT_ID(N'dbo.issuances', N'U') IS NULL
CREATE TABLE dbo.issuances (
  id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_issuances PRIMARY KEY DEFAULT NEWID(),
  equipment_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_issuances_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  technician_id        UNIQUEIDENTIFIER NULL CONSTRAINT fk_issuances_technician REFERENCES dbo.technicians(id),
  report_no            NVARCHAR(20)     NOT NULL,
  issued_to            NVARCHAR(200)    NOT NULL,
  department           NVARCHAR(200)    NOT NULL DEFAULT N'',
  purpose              NVARCHAR(400)    NOT NULL DEFAULT N'',
  job_no               NVARCHAR(100)    NOT NULL DEFAULT N'',
  job_description      NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  job_location         NVARCHAR(400)    NOT NULL DEFAULT N'',
  issuance_date        DATE             NOT NULL,
  expected_return_date DATE             NULL,
  return_date          DATE             NULL,
  return_condition     NVARCHAR(20)     NULL,
  notes                NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  return_notes         NVARCHAR(MAX)    NOT NULL DEFAULT N'',
  reconciled           BIT              NOT NULL DEFAULT 0,
  reconciled_by        NVARCHAR(320)    NOT NULL DEFAULT N'',
  created_at           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Indexes on foreign keys ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_calibrations_equipment')
  CREATE INDEX ix_calibrations_equipment ON dbo.calibrations (equipment_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_issuances_equipment')
  CREATE INDEX ix_issuances_equipment ON dbo.issuances (equipment_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_issuances_report_no')
  CREATE INDEX ix_issuances_report_no ON dbo.issuances (report_no);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_equipment_files_equipment')
  CREATE INDEX ix_equipment_files_equipment ON dbo.equipment_files (equipment_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessions_user')
  CREATE INDEX ix_sessions_user ON dbo.sessions (user_id);
GO
