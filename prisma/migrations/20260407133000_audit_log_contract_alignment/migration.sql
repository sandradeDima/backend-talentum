-- Additive audit schema alignment for environments that missed production hardening.
-- This migration is idempotent and avoids destructive operations.

SET @db := DATABASE();

SET @add_audit_log_severity := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND COLUMN_NAME = 'severity'
      ),
      'SELECT 1',
      'ALTER TABLE `AuditLog`
        ADD COLUMN `severity` ENUM(''INFO'', ''WARN'', ''ERROR'', ''SECURITY'')
        NOT NULL DEFAULT ''INFO'''
    )
  )
);
PREPARE stmt FROM @add_audit_log_severity;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_audit_log_request_id := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND COLUMN_NAME = 'requestId'
      ),
      'SELECT 1',
      'ALTER TABLE `AuditLog` ADD COLUMN `requestId` VARCHAR(191) NULL'
    )
  )
);
PREPARE stmt FROM @add_audit_log_request_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_audit_log_ip_address := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND COLUMN_NAME = 'ipAddress'
      ),
      'SELECT 1',
      'ALTER TABLE `AuditLog` ADD COLUMN `ipAddress` VARCHAR(191) NULL'
    )
  )
);
PREPARE stmt FROM @add_audit_log_ip_address;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_audit_log_user_agent := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND COLUMN_NAME = 'userAgent'
      ),
      'SELECT 1',
      'ALTER TABLE `AuditLog` ADD COLUMN `userAgent` VARCHAR(191) NULL'
    )
  )
);
PREPARE stmt FROM @add_audit_log_user_agent;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_audit_log_severity_idx := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND INDEX_NAME = 'AuditLog_severity_idx'
      ),
      'SELECT 1',
      'CREATE INDEX `AuditLog_severity_idx` ON `AuditLog`(`severity`)'
    )
  )
);
PREPARE stmt FROM @add_audit_log_severity_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_audit_log_request_id_idx := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'AuditLog') = 0,
    'SELECT 1',
    IF(
      EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @db
          AND TABLE_NAME = 'AuditLog'
          AND INDEX_NAME = 'AuditLog_requestId_idx'
      ),
      'SELECT 1',
      'CREATE INDEX `AuditLog_requestId_idx` ON `AuditLog`(`requestId`)'
    )
  )
);
PREPARE stmt FROM @add_audit_log_request_id_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
