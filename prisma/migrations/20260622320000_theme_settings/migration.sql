-- Per-tenant application theme / branding.
CREATE TABLE `theme_settings` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `tenantId`       INT NOT NULL,
  `theme`          VARCHAR(30) NOT NULL DEFAULT 'oasys',
  `density`        VARCHAR(20) NOT NULL DEFAULT 'comfortable',
  `primaryColor`   VARCHAR(20) NULL,
  `secondaryColor` VARCHAR(20) NULL,
  `accentColor`    VARCHAR(20) NULL,
  `fontFamily`     VARCHAR(80) NULL,
  `updatedAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `theme_settings_tenantId_key` (`tenantId`),
  CONSTRAINT `theme_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
