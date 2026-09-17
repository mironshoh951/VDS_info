-- AlterTable
ALTER TABLE "banner_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "form_field_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "menu_item_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "milestone_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "office_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "partner_category_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "team_member_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "testimonial_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;

-- AlterTable
ALTER TABLE "ui_translations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID;
