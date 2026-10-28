-- Leads Store Management System (equipment hub) - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d new_leads_equipmenthub -i database/schema.sql

SET NOCOUNT ON;

-- Staff accounts. role: admin (Master Admin: can delete equipment and manage admins) or user.
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(320)    NOT NULL CONSTRAINT uq_users_email UNIQUE,
  full_name     NVARCHAR(200)    NOT NULL CONSTRAINT df_users_full_name DEFAULT N'',
  password_hash NVARCHAR(256)    NOT NULL,
  role          NVARCHAR(10)     NOT NULL CONSTRAINT df_users_role DEFAULT N'user'
    CONSTRAINT ck_users_role CHECK (role IN (N'admin', N'user')),
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME()
);

-- Login sessions. token_hash is the SHA-256 of the random token kept in the browser cookie.
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_sessions PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sessions_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_sessions_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessions_user_id')
  CREATE INDEX ix_sessions_user_id ON dbo.sessions(user_id);

-- Uploaded files (photos, certificates, manuals). Rows refer to a file by its path.
IF OBJECT_ID(N'dbo.files', N'U') IS NULL
CREATE TABLE dbo.files (
  path         NVARCHAR(400)  NOT NULL CONSTRAINT pk_files PRIMARY KEY,
  file_name    NVARCHAR(260)  NOT NULL,
  content_type NVARCHAR(200)  NOT NULL,
  data         VARBINARY(MAX) NOT NULL,
  created_at   DATETIME2(3)   NOT NULL CONSTRAINT df_files_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
CREATE TABLE dbo.categories (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_categories PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_categories_name UNIQUE,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_categories_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.subcategories', N'U') IS NULL
CREATE TABLE dbo.subcategories (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_subcategories PRIMARY KEY DEFAULT NEWID(),
  category_id UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_subcategories_category REFERENCES dbo.categories(id) ON DELETE CASCADE,
  name        NVARCHAR(200)    NOT NULL,
  created_at  DATETIME2(3)     NOT NULL CONSTRAINT df_subcategories_created_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_subcategories_name UNIQUE (category_id, name)
);

IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
CREATE TABLE dbo.departments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_departments PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_departments_name UNIQUE,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_departments_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.technicians', N'U') IS NULL
CREATE TABLE dbo.technicians (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_technicians PRIMARY KEY DEFAULT NEWID(),
  name          NVARCHAR(200)    NOT NULL,
  employee_no   NVARCHAR(100)    NOT NULL CONSTRAINT df_technicians_employee_no DEFAULT N'',
  department_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_technicians_department REFERENCES dbo.departments(id) ON DELETE SET NULL,
  phone         NVARCHAR(100)    NOT NULL CONSTRAINT df_technicians_phone DEFAULT N'',
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_technicians_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.equipment_sets', N'U') IS NULL
CREATE TABLE dbo.equipment_sets (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment_sets PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_equipment_sets_name UNIQUE,
  notes      NVARCHAR(MAX)    NOT NULL CONSTRAINT df_equipment_sets_notes DEFAULT N'',
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_equipment_sets_created_at DEFAULT SYSUTCDATETIME()
);

-- Equipment codes: EQ-00001, EQ-00002, ...
IF OBJECT_ID(N'dbo.equipment_code_seq', N'SO') IS NULL
  CREATE SEQUENCE dbo.equipment_code_seq AS BIGINT START WITH 1 INCREMENT BY 1;

-- status: available / issued. condition: Good / Spoiled / Quarantined. photo_path: a dbo.files path.
IF OBJECT_ID(N'dbo.equipment', N'U') IS NULL
CREATE TABLE dbo.equipment (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment PRIMARY KEY DEFAULT NEWID(),
  code              NVARCHAR(20)     NOT NULL CONSTRAINT uq_equipment_code UNIQUE
    CONSTRAINT df_equipment_code
      DEFAULT (N'EQ-' + RIGHT(N'00000' + CAST(NEXT VALUE FOR dbo.equipment_code_seq AS NVARCHAR(20)), 5)),
  type              NVARCHAR(200)    NOT NULL,
  brand             NVARCHAR(200)    NOT NULL CONSTRAINT df_equipment_brand DEFAULT N'',
  model             NVARCHAR(200)    NOT NULL CONSTRAINT df_equipment_model DEFAULT N'',
  serial_no         NVARCHAR(200)    NOT NULL CONSTRAINT df_equipment_serial_no DEFAULT N'',
  photo_path        NVARCHAR(400)    NULL,
  specification     NVARCHAR(MAX)    NOT NULL CONSTRAINT df_equipment_specification DEFAULT N'',
  location          NVARCHAR(300)    NOT NULL CONSTRAINT df_equipment_location DEFAULT N'',
  service_details   NVARCHAR(MAX)    NOT NULL CONSTRAINT df_equipment_service_details DEFAULT N'',
  notes             NVARCHAR(MAX)    NOT NULL CONSTRAINT df_equipment_notes DEFAULT N'',
  status            NVARCHAR(20)     NOT NULL CONSTRAINT df_equipment_status DEFAULT N'available',
  category_id       UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_equipment_category REFERENCES dbo.categories(id) ON DELETE SET NULL,
  -- NO ACTION: SQL Server allows only one cascade path; subcategories are cleared by the app
  -- when their category is deleted (see deleteRow in src/lib/store.functions.ts).
  subcategory_id    UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_equipment_subcategory REFERENCES dbo.subcategories(id),
  department_id     UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_equipment_department REFERENCES dbo.departments(id) ON DELETE SET NULL,
  store_no          NVARCHAR(100)    NOT NULL CONSTRAINT df_equipment_store_no DEFAULT N'',
  condition         NVARCHAR(20)     NOT NULL CONSTRAINT df_equipment_condition DEFAULT N'Good',
  quarantine_reason NVARCHAR(MAX)    NOT NULL CONSTRAINT df_equipment_quarantine_reason DEFAULT N'',
  set_id            UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_equipment_set REFERENCES dbo.equipment_sets(id) ON DELETE SET NULL,
  created_at        DATETIME2(3)     NOT NULL CONSTRAINT df_equipment_created_at DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)     NOT NULL CONSTRAINT df_equipment_updated_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.calibrations', N'U') IS NULL
CREATE TABLE dbo.calibrations (
  id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_calibrations PRIMARY KEY DEFAULT NEWID(),
  equipment_id     UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_calibrations_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  calibration_date DATE             NOT NULL,
  expiry_date      DATE             NOT NULL,
  certificate_path NVARCHAR(400)    NULL,
  certificate_name NVARCHAR(260)    NULL,
  performed_by     NVARCHAR(200)    NOT NULL CONSTRAINT df_calibrations_performed_by DEFAULT N'',
  remarks          NVARCHAR(MAX)    NOT NULL CONSTRAINT df_calibrations_remarks DEFAULT N'',
  created_at       DATETIME2(3)     NOT NULL CONSTRAINT df_calibrations_created_at DEFAULT SYSUTCDATETIME()
);

-- Issuance report numbers: IR-00001, ... (all items issued together share one number).
IF OBJECT_ID(N'dbo.issuance_report_seq', N'SO') IS NULL
  CREATE SEQUENCE dbo.issuance_report_seq AS BIGINT START WITH 1 INCREMENT BY 1;

IF OBJECT_ID(N'dbo.issuances', N'U') IS NULL
CREATE TABLE dbo.issuances (
  id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_issuances PRIMARY KEY DEFAULT NEWID(),
  equipment_id         UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_issuances_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  issued_to            NVARCHAR(200)    NOT NULL,
  department           NVARCHAR(200)    NOT NULL CONSTRAINT df_issuances_department DEFAULT N'',
  purpose              NVARCHAR(MAX)    NOT NULL CONSTRAINT df_issuances_purpose DEFAULT N'',
  issuance_date        DATE             NOT NULL,
  expected_return_date DATE             NULL,
  return_date          DATE             NULL,
  return_condition     NVARCHAR(20)     NULL,
  notes                NVARCHAR(MAX)    NOT NULL CONSTRAINT df_issuances_notes DEFAULT N'',
  return_notes         NVARCHAR(MAX)    NOT NULL CONSTRAINT df_issuances_return_notes DEFAULT N'',
  technician_id        UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_issuances_technician REFERENCES dbo.technicians(id) ON DELETE SET NULL,
  report_no            NVARCHAR(20)     NOT NULL
    CONSTRAINT df_issuances_report_no
      DEFAULT (N'IR-' + RIGHT(N'00000' + CAST(NEXT VALUE FOR dbo.issuance_report_seq AS NVARCHAR(20)), 5)),
  job_no               NVARCHAR(200)    NOT NULL CONSTRAINT df_issuances_job_no DEFAULT N'',
  job_description      NVARCHAR(MAX)    NOT NULL CONSTRAINT df_issuances_job_description DEFAULT N'',
  job_location         NVARCHAR(300)    NOT NULL CONSTRAINT df_issuances_job_location DEFAULT N'',
  reconciled           BIT              NOT NULL CONSTRAINT df_issuances_reconciled DEFAULT 0,
  reconciled_by        NVARCHAR(320)    NOT NULL CONSTRAINT df_issuances_reconciled_by DEFAULT N'',
  created_at           DATETIME2(3)     NOT NULL CONSTRAINT df_issuances_created_at DEFAULT SYSUTCDATETIME()
);

-- Manuals, software and other files attached to a piece of equipment (path: a dbo.files path).
IF OBJECT_ID(N'dbo.equipment_files', N'U') IS NULL
CREATE TABLE dbo.equipment_files (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_equipment_files PRIMARY KEY DEFAULT NEWID(),
  equipment_id UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_equipment_files_equipment REFERENCES dbo.equipment(id) ON DELETE CASCADE,
  kind         NVARCHAR(20)     NOT NULL CONSTRAINT df_equipment_files_kind DEFAULT N'file',
  path         NVARCHAR(400)    NOT NULL,
  name         NVARCHAR(260)    NOT NULL CONSTRAINT df_equipment_files_name DEFAULT N'',
  created_at   DATETIME2(3)     NOT NULL CONSTRAINT df_equipment_files_created_at DEFAULT SYSUTCDATETIME()
);
