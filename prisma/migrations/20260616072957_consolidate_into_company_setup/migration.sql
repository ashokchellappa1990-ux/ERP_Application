/*
  Warnings:

  - You are about to drop the `business_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `company_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `business_profiles` DROP FOREIGN KEY `business_profiles_userId_fkey`;

-- DropForeignKey
ALTER TABLE `company_profiles` DROP FOREIGN KEY `company_profiles_userId_fkey`;

-- AlterTable
ALTER TABLE `company_setups` ADD COLUMN `logoUrl` LONGTEXT NULL;

-- DropTable
DROP TABLE `business_profiles`;

-- DropTable
DROP TABLE `company_profiles`;
