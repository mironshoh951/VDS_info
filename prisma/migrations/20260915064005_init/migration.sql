-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('MISSING', 'AI_DRAFT', 'HUMAN_DRAFT', 'APPROVED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "TranslationOrigin" AS ENUM ('HUMAN', 'AI', 'IMPORT');

-- CreateEnum
CREATE TYPE "TextDirection" AS ENUM ('LTR', 'RTL');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PAGE', 'PRODUCT', 'PRODUCT_CATEGORY', 'PARTNER', 'BRAND', 'SERVICE', 'ACHIEVEMENT', 'EVENT', 'ARTICLE', 'RESOURCE', 'CERTIFICATE', 'FAQ', 'TESTIMONIAL', 'TEAM_MEMBER', 'OFFICE', 'MILESTONE', 'MENU', 'MENU_ITEM', 'MEDIA_ASSET', 'FORM', 'INQUIRY', 'BANNER', 'USER', 'SITE_SETTING', 'TAG', 'PARTNER_CATEGORY');

-- CreateEnum
CREATE TYPE "PartnershipType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'TECHNOLOGY', 'STRATEGIC', 'EDUCATION', 'SERVICE', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('BROCHURE', 'CATALOG', 'MANUAL', 'CERTIFICATE', 'DATASHEET', 'PRESENTATION', 'COMPANY_PROFILE', 'TECHNICAL', 'POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PDF', 'BROCHURE', 'CATALOG', 'MANUAL', 'CERTIFICATE', 'PRESENTATION', 'COMPANY_PROFILE', 'TECHNICAL_DOCUMENT', 'VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'EXHIBITION', 'SEMINAR', 'WORKSHOP', 'TRAINING', 'WEBINAR', 'OTHER');

-- CreateEnum
CREATE TYPE "EventParticipation" AS ENUM ('EXHIBITOR', 'VISITOR', 'SPEAKER', 'SPONSOR', 'ORGANIZER', 'PARTNER');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('AWARD', 'CERTIFICATION', 'MILESTONE', 'PARTNERSHIP', 'BUSINESS', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "MenuItemTarget" AS ENUM ('PAGE', 'PRODUCT', 'PRODUCT_CATEGORY', 'PARTNER', 'BRAND', 'SERVICE', 'EVENT', 'ARTICLE', 'ROUTE', 'EXTERNAL_URL', 'NONE');

-- CreateEnum
CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER_PRIMARY', 'FOOTER_SECONDARY', 'FOOTER_LEGAL', 'MOBILE', 'SIDEBAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'RADIO', 'FILE', 'CONSENT', 'HIDDEN', 'DATE', 'NUMBER');

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('GENERAL', 'PRODUCT', 'PARTNER', 'SERVICE', 'DISTRIBUTION', 'CAREER', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONTACTED', 'RESOLVED', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateEnum
CREATE TYPE "AITaskType" AS ENUM ('PUBLIC_CHAT', 'TRANSLATE', 'SEO', 'SUMMARIZE', 'REWRITE', 'ALT_TEXT', 'AUDIT', 'EMBED', 'CLASSIFY');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIActorKind" AS ENUM ('PUBLIC_VISITOR', 'ADMIN_USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'MFA_ENROLLED', 'MFA_DISABLED', 'MFA_FAILURE', 'RECOVERY_CODE_USED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'STEP_UP_SUCCESS', 'STEP_UP_FAILURE', 'SESSION_REVOKED', 'IP_BLOCKED', 'RATE_LIMIT_TRIPPED', 'AUTHORIZATION_DENIED', 'SUSPICIOUS_ACTIVITY', 'SETTINGS_CHANGED');

-- CreateEnum
CREATE TYPE "ConsentCategory" AS ENUM ('NECESSARY', 'ANALYTICS', 'MARKETING', 'PREFERENCES');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('NEW_INQUIRY', 'NEW_SUBMISSION', 'AI_JOB_COMPLETED', 'AI_JOB_FAILED', 'AI_BUDGET_WARNING', 'SECURITY_ALERT', 'SYSTEM_ERROR', 'CONTENT_SCHEDULED', 'CERTIFICATE_EXPIRING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "avatarId" UUID,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "mfaSatisfiedAt" TIMESTAMP(3),
    "stepUpVerifiedAt" TIMESTAMP(3),
    "stepUpScope" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_credentials" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Authenticator',
    "confirmedAt" TIMESTAMP(3),
    "lastUsedCounter" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "email" CITEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "host" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_up_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "mfaUsed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_up_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" "UserRole",
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "entityLabel" TEXT,
    "before" JSONB,
    "after" JSONB,
    "diff" JSONB,
    "locale" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "stepUpUsed" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "userId" UUID,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdById" UUID,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "code" VARCHAR(16) NOT NULL,
    "bcp47" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "direction" "TextDirection" NOT NULL DEFAULT 'LTR',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "flagEmoji" TEXT,
    "fallbackTo" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ui_translations" (
    "id" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "canonicalUrl" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageId" UUID,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "nofollow" BOOLEAN NOT NULL DEFAULT false,
    "structuredData" JSONB,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "summary" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "locale" VARCHAR(16),
    "reason" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_folders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" CITEXT NOT NULL,
    "parentId" UUID,
    "path" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "MediaStatus" NOT NULL DEFAULT 'PROCESSING',
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "blurhash" TEXT,
    "dominantColor" TEXT,
    "folderId" UUID,
    "uploadedById" UUID,
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset_translations" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "title" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_usages" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tags" (
    "id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tags_on_assets" (
    "assetId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "media_tags_on_assets_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "systemKey" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "template" TEXT NOT NULL DEFAULT 'default',
    "showInSitemap" BOOLEAN NOT NULL DEFAULT true,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_translations" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_blocks" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "props" JSONB NOT NULL DEFAULT '{}',
    "anchor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_block_translations" (
    "id" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_block_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" "MenuLocation" NOT NULL DEFAULT 'HEADER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "target" "MenuItemTarget" NOT NULL DEFAULT 'NONE',
    "pageId" UUID,
    "productId" UUID,
    "productCategoryId" UUID,
    "partnerId" UUID,
    "brandId" UUID,
    "serviceId" UUID,
    "eventId" UUID,
    "articleId" UUID,
    "routeKey" TEXT,
    "externalUrl" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "rel" TEXT,
    "icon" TEXT,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "visibleLocales" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_translations" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "ariaLabel" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "legalName" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "partnershipType" "PartnershipType" NOT NULL DEFAULT 'OTHER',
    "partnershipStart" TIMESTAMP(3),
    "foundedYear" INTEGER,
    "countryCode" VARCHAR(2),
    "city" TEXT,
    "addressLine" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logoId" UUID,
    "coverId" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_translations" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" JSONB,
    "specialization" TEXT,
    "highlights" TEXT[],
    "addressLocalized" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_categories" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "partner_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_category_translations" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_categories_on_partners" (
    "partnerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "partner_categories_on_partners_pkey" PRIMARY KEY ("partnerId","categoryId")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_media" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "partnerId" UUID,
    "countryCode" VARCHAR(2),
    "website" TEXT,
    "foundedYear" INTEGER,
    "logoId" UUID,
    "coverId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_translations" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" JSONB,
    "tagline" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_documents" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "sku" TEXT,
    "productCode" TEXT,
    "gtin" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "brandId" UUID,
    "partnerId" UUID,
    "manufacturer" TEXT,
    "countryOfOrigin" VARCHAR(2),
    "unit" TEXT,
    "packaging" TEXT,
    "minOrderQty" INTEGER,
    "leadTimeDays" INTEGER,
    "hsCode" TEXT,
    "weightGrams" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" JSONB,
    "benefits" TEXT[],
    "applications" TEXT[],
    "indications" TEXT[],
    "compatibility" TEXT,
    "usageNotes" JSONB,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "parentId" UUID,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category_translations" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "description" JSONB,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories_on_products" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_categories_on_products_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_documents" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_specifications" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "groupKey" TEXT NOT NULL DEFAULT 'general',
    "labelKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "localized" JSONB,

    CONSTRAINT "product_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'select',
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "labels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "valueString" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBool" BOOLEAN,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_relations" (
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'related',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_relations_pkey" PRIMARY KEY ("sourceId","targetId","kind")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "iconKey" TEXT,
    "iconId" UUID,
    "coverId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_translations" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" JSONB,
    "benefits" TEXT[],
    "processSteps" JSONB,
    "ctaLabel" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_on_services" (
    "productId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "products_on_services_pkey" PRIMARY KEY ("productId","serviceId")
);

-- CreateTable
CREATE TABLE "services_on_partners" (
    "serviceId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,

    CONSTRAINT "services_on_partners_pkey" PRIMARY KEY ("serviceId","partnerId")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "category" "AchievementCategory" NOT NULL DEFAULT 'MILESTONE',
    "achievedOn" TIMESTAMP(3),
    "location" TEXT,
    "countryCode" VARCHAR(2),
    "externalUrl" TEXT,
    "partnerId" UUID,
    "imageId" UUID,
    "documentId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_translations" (
    "id" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "description" JSONB,
    "issuer" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "type" "EventType" NOT NULL DEFAULT 'CONFERENCE',
    "participation" "EventParticipation" NOT NULL DEFAULT 'VISITOR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "countryCode" VARCHAR(2),
    "city" TEXT,
    "venue" TEXT,
    "addressLine" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "organizer" TEXT,
    "website" TEXT,
    "boothNumber" TEXT,
    "coverId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_translations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" JSONB,
    "summary" JSONB,
    "participationNote" TEXT,
    "venueLocalized" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_media" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_speakers" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "organization" TEXT,
    "photoId" UUID,
    "bio" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners_on_events" (
    "partnerId" UUID NOT NULL,
    "eventId" UUID NOT NULL,

    CONSTRAINT "partners_on_events_pkey" PRIMARY KEY ("partnerId","eventId")
);

-- CreateTable
CREATE TABLE "products_on_events" (
    "productId" UUID NOT NULL,
    "eventId" UUID NOT NULL,

    CONSTRAINT "products_on_events_pkey" PRIMARY KEY ("productId","eventId")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "categoryId" UUID,
    "coverId" UUID,
    "authorName" TEXT,
    "authorUserId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translations" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" JSONB,
    "readingMinutes" INTEGER,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_categories" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "names" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_tags" (
    "articleId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "products_on_articles" (
    "productId" UUID NOT NULL,
    "articleId" UUID NOT NULL,

    CONSTRAINT "products_on_articles_pkey" PRIMARY KEY ("productId","articleId")
);

-- CreateTable
CREATE TABLE "partners_on_articles" (
    "partnerId" UUID NOT NULL,
    "articleId" UUID NOT NULL,

    CONSTRAINT "partners_on_articles_pkey" PRIMARY KEY ("partnerId","articleId")
);

-- CreateTable
CREATE TABLE "articles_on_events" (
    "articleId" UUID NOT NULL,
    "eventId" UUID NOT NULL,

    CONSTRAINT "articles_on_events_pkey" PRIMARY KEY ("articleId","eventId")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'PDF',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "fileId" UUID,
    "thumbnailId" UUID,
    "externalUrl" TEXT,
    "contentLocale" VARCHAR(16),
    "partnerId" UUID,
    "categoryKey" TEXT,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_translations" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_on_resources" (
    "productId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,

    CONSTRAINT "products_on_resources_pkey" PRIMARY KEY ("productId","resourceId")
);

-- CreateTable
CREATE TABLE "resource_downloads" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "locale" VARCHAR(16),
    "visitorHash" TEXT,
    "referrer" TEXT,
    "countryCode" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "kind" TEXT NOT NULL DEFAULT 'CERTIFICATE',
    "issuer" TEXT,
    "referenceNo" TEXT,
    "issuedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "fileId" UUID,
    "thumbnailId" UUID,
    "partnerId" UUID,
    "productId" UUID,
    "brandId" UUID,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_translations" (
    "id" UUID NOT NULL,
    "certificateId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "slug" CITEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuerLocalized" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offices" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "phoneSecondary" TEXT,
    "email" TEXT,
    "imageId" UUID,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "workingHours" JSONB,
    "mapEmbedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_translations" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "cityLocalized" TEXT,
    "contactPerson" TEXT,
    "note" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "photoId" UUID,
    "email" TEXT,
    "phone" TEXT,
    "languages" TEXT[],
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member_translations" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "bio" JSONB,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "imageId" UUID,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_translations" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorName" TEXT NOT NULL,
    "avatarId" UUID,
    "logoId" UUID,
    "partnerId" UUID,
    "rating" INTEGER,
    "consentOnFile" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial_translations" (
    "id" UUID NOT NULL,
    "testimonialId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "quote" TEXT NOT NULL,
    "authorTitle" TEXT,
    "organization" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonial_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "slug" CITEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryKey" TEXT,
    "serviceId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_translations" (
    "id" UUID NOT NULL,
    "faqId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "question" TEXT NOT NULL,
    "answer" JSONB,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "partnerId" UUID,
    "brandId" UUID,
    "teamMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "inquiryType" "InquiryType" NOT NULL DEFAULT 'GENERAL',
    "notifyEmails" TEXT[],
    "successRedirect" TEXT,
    "minFillSeconds" INTEGER NOT NULL DEFAULT 3,
    "requireCaptcha" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "validation" JSONB,
    "options" JSONB,
    "width" TEXT NOT NULL DEFAULT 'full',

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_field_translations" (
    "id" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "helpText" TEXT,
    "optionLabels" JSONB,
    "errorMessages" JSONB,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_field_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "locale" VARCHAR(16),
    "sourcePath" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "countryCode" VARCHAR(2),
    "spamScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission_files" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "type" "InquiryType" NOT NULL DEFAULT 'GENERAL',
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "countryCode" VARCHAR(2),
    "message" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "sourcePath" TEXT,
    "submissionId" UUID,
    "productId" UUID,
    "partnerId" UUID,
    "serviceId" UUID,
    "assignedToId" UUID,
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_notes" (
    "id" UUID NOT NULL,
    "inquiryId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "locale" VARCHAR(16),
    "name" TEXT,
    "confirmTokenHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeTokenHash" TEXT,
    "source" TEXT,
    "consentText" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "sectionLabel" TEXT,
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "actorKind" "AIActorKind" NOT NULL DEFAULT 'PUBLIC_VISITOR',
    "userId" UUID,
    "visitorHash" TEXT,
    "locale" VARCHAR(16),
    "title" TEXT,
    "surface" TEXT NOT NULL DEFAULT 'PUBLIC_ASSISTANT',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "citations" JSONB,
    "cards" JSONB,
    "refusalReason" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "taskType" "AITaskType" NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "surface" TEXT,
    "userId" UUID,
    "entityType" "EntityType",
    "entityId" TEXT,
    "locale" VARCHAR(16),
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "taskType" "AITaskType" NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
    "createdById" UUID,
    "params" JSONB NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_job_items" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ai_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "taskType" "AITaskType" NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "variables" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "visitorHash" TEXT,
    "sessionHash" TEXT,
    "referrerHost" TEXT,
    "countryCode" VARCHAR(2),
    "deviceType" TEXT,
    "entityType" "EntityType",
    "entityId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_views" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_query_logs" (
    "id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "clickedEntityType" "EntityType",
    "clickedEntityId" TEXT,
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cta_clicks" (
    "id" UUID NOT NULL,
    "ctaKey" TEXT NOT NULL,
    "path" TEXT,
    "locale" VARCHAR(16),
    "entityType" "EntityType",
    "entityId" TEXT,
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cta_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_events" (
    "id" UUID NOT NULL,
    "assetId" UUID,
    "entityType" "EntityType",
    "entityId" TEXT,
    "locale" VARCHAR(16),
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT,
    "locale" VARCHAR(16),
    "entityType" "EntityType",
    "entityId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "localized" JSONB,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "placement" TEXT NOT NULL DEFAULT 'home_hero',
    "imageId" UUID,
    "mobileImageId" UUID,
    "linkTarget" "MenuItemTarget" NOT NULL DEFAULT 'NONE',
    "linkUrl" TEXT,
    "linkEntityId" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "locales" TEXT[],
    "devices" TEXT NOT NULL DEFAULT 'all',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dismissible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_translations" (
    "id" UUID NOT NULL,
    "bannerId" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MISSING',
    "origin" "TranslationOrigin" NOT NULL DEFAULT 'HUMAN',
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_consents" (
    "id" UUID NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "categories" "ConsentCategory"[],
    "policyVersion" TEXT NOT NULL,
    "locale" VARCHAR(16),
    "countryCode" VARCHAR(2),
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "cookie_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "userId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "mfa_credentials_userId_idx" ON "mfa_credentials"("userId");

-- CreateIndex
CREATE INDEX "recovery_codes_userId_usedAt_idx" ON "recovery_codes"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ip_createdAt_idx" ON "login_attempts"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "password_history_userId_createdAt_idx" ON "password_history"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "step_up_challenges_tokenHash_key" ON "step_up_challenges"("tokenHash");

-- CreateIndex
CREATE INDEX "step_up_challenges_userId_scope_consumedAt_idx" ON "step_up_challenges"("userId", "scope", "consumedAt");

-- CreateIndex
CREATE INDEX "step_up_challenges_expiresAt_idx" ON "step_up_challenges"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_revokedAt_idx" ON "api_keys"("revokedAt");

-- CreateIndex
CREATE INDEX "locales_enabled_sortOrder_idx" ON "locales"("enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "ui_translations_namespace_idx" ON "ui_translations"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "ui_translations_locale_namespace_key_key" ON "ui_translations"("locale", "namespace", "key");

-- CreateIndex
CREATE INDEX "seo_meta_entityType_entityId_idx" ON "seo_meta"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "seo_meta_entityType_entityId_locale_key" ON "seo_meta"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "content_versions_entityType_entityId_createdAt_idx" ON "content_versions"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_entityType_entityId_version_key" ON "content_versions"("entityType", "entityId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_fromPath_key" ON "redirects"("fromPath");

-- CreateIndex
CREATE INDEX "redirects_enabled_idx" ON "redirects"("enabled");

-- CreateIndex
CREATE INDEX "media_folders_path_idx" ON "media_folders"("path");

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_parentId_slug_key" ON "media_folders"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_kind_status_deletedAt_idx" ON "media_assets"("kind", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "media_assets_folderId_idx" ON "media_assets"("folderId");

-- CreateIndex
CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_storageKey_key" ON "media_variants"("storageKey");

-- CreateIndex
CREATE INDEX "media_variants_assetId_idx" ON "media_variants"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_assetId_label_format_key" ON "media_variants"("assetId", "label", "format");

-- CreateIndex
CREATE INDEX "media_asset_translations_locale_status_idx" ON "media_asset_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_translations_assetId_locale_key" ON "media_asset_translations"("assetId", "locale");

-- CreateIndex
CREATE INDEX "media_usages_entityType_entityId_idx" ON "media_usages"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "media_usages_assetId_entityType_entityId_field_key" ON "media_usages"("assetId", "entityType", "entityId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "media_tags_name_key" ON "media_tags"("name");

-- CreateIndex
CREATE INDEX "media_tags_on_assets_tagId_idx" ON "media_tags_on_assets"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pages_systemKey_key" ON "pages"("systemKey");

-- CreateIndex
CREATE INDEX "pages_status_publishedAt_idx" ON "pages"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "pages_deletedAt_idx" ON "pages"("deletedAt");

-- CreateIndex
CREATE INDEX "page_translations_locale_status_idx" ON "page_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "page_translations_pageId_locale_key" ON "page_translations"("pageId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "page_translations_locale_slug_key" ON "page_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "page_blocks_pageId_sortOrder_idx" ON "page_blocks"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "page_block_translations_locale_status_idx" ON "page_block_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "page_block_translations_blockId_locale_key" ON "page_block_translations"("blockId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "menus_key_key" ON "menus"("key");

-- CreateIndex
CREATE INDEX "menus_location_enabled_idx" ON "menus"("location", "enabled");

-- CreateIndex
CREATE INDEX "menu_items_menuId_parentId_sortOrder_idx" ON "menu_items"("menuId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "menu_item_translations_locale_status_idx" ON "menu_item_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_translations_itemId_locale_key" ON "menu_item_translations"("itemId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE INDEX "partners_status_publishedAt_idx" ON "partners"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "partners_countryCode_idx" ON "partners"("countryCode");

-- CreateIndex
CREATE INDEX "partners_partnershipType_idx" ON "partners"("partnershipType");

-- CreateIndex
CREATE INDEX "partners_featured_sortOrder_idx" ON "partners"("featured", "sortOrder");

-- CreateIndex
CREATE INDEX "partners_deletedAt_idx" ON "partners"("deletedAt");

-- CreateIndex
CREATE INDEX "partner_translations_locale_status_idx" ON "partner_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_translations_partnerId_locale_key" ON "partner_translations"("partnerId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "partner_translations_locale_slug_key" ON "partner_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "partner_categories_slug_key" ON "partner_categories"("slug");

-- CreateIndex
CREATE INDEX "partner_categories_parentId_sortOrder_idx" ON "partner_categories"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "partner_category_translations_locale_status_idx" ON "partner_category_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_category_translations_categoryId_locale_key" ON "partner_category_translations"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "partner_categories_on_partners_categoryId_idx" ON "partner_categories_on_partners"("categoryId");

-- CreateIndex
CREATE INDEX "partner_documents_partnerId_sortOrder_idx" ON "partner_documents"("partnerId", "sortOrder");

-- CreateIndex
CREATE INDEX "partner_media_partnerId_sortOrder_idx" ON "partner_media"("partnerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "partner_media_partnerId_assetId_role_key" ON "partner_media"("partnerId", "assetId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_status_publishedAt_idx" ON "brands"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "brands_partnerId_idx" ON "brands"("partnerId");

-- CreateIndex
CREATE INDEX "brands_featured_sortOrder_idx" ON "brands"("featured", "sortOrder");

-- CreateIndex
CREATE INDEX "brands_deletedAt_idx" ON "brands"("deletedAt");

-- CreateIndex
CREATE INDEX "brand_translations_locale_status_idx" ON "brand_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "brand_translations_brandId_locale_key" ON "brand_translations"("brandId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "brand_translations_locale_slug_key" ON "brand_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "brand_documents_brandId_sortOrder_idx" ON "brand_documents"("brandId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_status_publishedAt_idx" ON "products"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "products_brandId_status_idx" ON "products"("brandId", "status");

-- CreateIndex
CREATE INDEX "products_partnerId_status_idx" ON "products"("partnerId", "status");

-- CreateIndex
CREATE INDEX "products_featured_sortOrder_idx" ON "products"("featured", "sortOrder");

-- CreateIndex
CREATE INDEX "products_countryOfOrigin_idx" ON "products"("countryOfOrigin");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "product_translations_locale_status_idx" ON "product_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_productId_locale_key" ON "product_translations"("productId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_locale_slug_key" ON "product_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_parentId_sortOrder_idx" ON "product_categories"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_categories_path_idx" ON "product_categories"("path");

-- CreateIndex
CREATE INDEX "product_category_translations_locale_status_idx" ON "product_category_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_translations_categoryId_locale_key" ON "product_category_translations"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_translations_locale_slug_key" ON "product_category_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "product_categories_on_products_categoryId_isPrimary_idx" ON "product_categories_on_products"("categoryId", "isPrimary");

-- CreateIndex
CREATE INDEX "product_media_productId_sortOrder_idx" ON "product_media"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_media_productId_assetId_role_key" ON "product_media"("productId", "assetId", "role");

-- CreateIndex
CREATE INDEX "product_documents_productId_sortOrder_idx" ON "product_documents"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_specifications_productId_groupKey_sortOrder_idx" ON "product_specifications"("productId", "groupKey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_key_key" ON "product_attributes"("key");

-- CreateIndex
CREATE INDEX "product_attributes_filterable_sortOrder_idx" ON "product_attributes"("filterable", "sortOrder");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_valueString_idx" ON "product_attribute_values"("attributeId", "valueString");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_productId_attributeId_valueString_key" ON "product_attribute_values"("productId", "attributeId", "valueString");

-- CreateIndex
CREATE INDEX "product_relations_targetId_idx" ON "product_relations"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_status_publishedAt_idx" ON "services"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "services_featured_sortOrder_idx" ON "services"("featured", "sortOrder");

-- CreateIndex
CREATE INDEX "services_deletedAt_idx" ON "services"("deletedAt");

-- CreateIndex
CREATE INDEX "service_translations_locale_status_idx" ON "service_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_translations_serviceId_locale_key" ON "service_translations"("serviceId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "service_translations_locale_slug_key" ON "service_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "products_on_services_serviceId_idx" ON "products_on_services"("serviceId");

-- CreateIndex
CREATE INDEX "services_on_partners_partnerId_idx" ON "services_on_partners"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_slug_key" ON "achievements"("slug");

-- CreateIndex
CREATE INDEX "achievements_status_achievedOn_idx" ON "achievements"("status", "achievedOn");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "achievements_deletedAt_idx" ON "achievements"("deletedAt");

-- CreateIndex
CREATE INDEX "achievement_translations_locale_status_idx" ON "achievement_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_translations_achievementId_locale_key" ON "achievement_translations"("achievementId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_translations_locale_slug_key" ON "achievement_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_startDate_idx" ON "events"("status", "startDate");

-- CreateIndex
CREATE INDEX "events_type_startDate_idx" ON "events"("type", "startDate");

-- CreateIndex
CREATE INDEX "events_featured_idx" ON "events"("featured");

-- CreateIndex
CREATE INDEX "events_deletedAt_idx" ON "events"("deletedAt");

-- CreateIndex
CREATE INDEX "event_translations_locale_status_idx" ON "event_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_translations_eventId_locale_key" ON "event_translations"("eventId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "event_translations_locale_slug_key" ON "event_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "event_media_eventId_sortOrder_idx" ON "event_media"("eventId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "event_media_eventId_assetId_role_key" ON "event_media"("eventId", "assetId", "role");

-- CreateIndex
CREATE INDEX "event_speakers_eventId_sortOrder_idx" ON "event_speakers"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "partners_on_events_eventId_idx" ON "partners_on_events"("eventId");

-- CreateIndex
CREATE INDEX "products_on_events_eventId_idx" ON "products_on_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "articles_categoryId_status_idx" ON "articles"("categoryId", "status");

-- CreateIndex
CREATE INDEX "articles_featured_idx" ON "articles"("featured");

-- CreateIndex
CREATE INDEX "articles_deletedAt_idx" ON "articles"("deletedAt");

-- CreateIndex
CREATE INDEX "article_translations_locale_status_idx" ON "article_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_articleId_locale_key" ON "article_translations"("articleId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_locale_slug_key" ON "article_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_slug_key" ON "article_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "article_tags_tagId_idx" ON "article_tags"("tagId");

-- CreateIndex
CREATE INDEX "products_on_articles_articleId_idx" ON "products_on_articles"("articleId");

-- CreateIndex
CREATE INDEX "partners_on_articles_articleId_idx" ON "partners_on_articles"("articleId");

-- CreateIndex
CREATE INDEX "articles_on_events_eventId_idx" ON "articles_on_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "resources_slug_key" ON "resources"("slug");

-- CreateIndex
CREATE INDEX "resources_status_publishedAt_idx" ON "resources"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "resources_type_status_idx" ON "resources"("type", "status");

-- CreateIndex
CREATE INDEX "resources_partnerId_idx" ON "resources"("partnerId");

-- CreateIndex
CREATE INDEX "resources_deletedAt_idx" ON "resources"("deletedAt");

-- CreateIndex
CREATE INDEX "resource_translations_locale_status_idx" ON "resource_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "resource_translations_resourceId_locale_key" ON "resource_translations"("resourceId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "resource_translations_locale_slug_key" ON "resource_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "products_on_resources_resourceId_idx" ON "products_on_resources"("resourceId");

-- CreateIndex
CREATE INDEX "resource_downloads_resourceId_createdAt_idx" ON "resource_downloads"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_downloads_createdAt_idx" ON "resource_downloads"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_slug_key" ON "certificates"("slug");

-- CreateIndex
CREATE INDEX "certificates_status_sortOrder_idx" ON "certificates"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "certificates_expiresOn_idx" ON "certificates"("expiresOn");

-- CreateIndex
CREATE INDEX "certificates_deletedAt_idx" ON "certificates"("deletedAt");

-- CreateIndex
CREATE INDEX "certificate_translations_locale_status_idx" ON "certificate_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_translations_certificateId_locale_key" ON "certificate_translations"("certificateId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_translations_locale_slug_key" ON "certificate_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "offices_key_key" ON "offices"("key");

-- CreateIndex
CREATE INDEX "offices_visible_sortOrder_idx" ON "offices"("visible", "sortOrder");

-- CreateIndex
CREATE INDEX "office_translations_locale_status_idx" ON "office_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "office_translations_officeId_locale_key" ON "office_translations"("officeId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_slug_key" ON "team_members"("slug");

-- CreateIndex
CREATE INDEX "team_members_visible_sortOrder_idx" ON "team_members"("visible", "sortOrder");

-- CreateIndex
CREATE INDEX "team_member_translations_locale_status_idx" ON "team_member_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_translations_memberId_locale_key" ON "team_member_translations"("memberId", "locale");

-- CreateIndex
CREATE INDEX "milestones_year_sortOrder_idx" ON "milestones"("year", "sortOrder");

-- CreateIndex
CREATE INDEX "milestone_translations_locale_status_idx" ON "milestone_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_translations_milestoneId_locale_key" ON "milestone_translations"("milestoneId", "locale");

-- CreateIndex
CREATE INDEX "testimonials_status_featured_sortOrder_idx" ON "testimonials"("status", "featured", "sortOrder");

-- CreateIndex
CREATE INDEX "testimonial_translations_locale_status_idx" ON "testimonial_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "testimonial_translations_testimonialId_locale_key" ON "testimonial_translations"("testimonialId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "faqs_slug_key" ON "faqs"("slug");

-- CreateIndex
CREATE INDEX "faqs_status_sortOrder_idx" ON "faqs"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "faqs_serviceId_idx" ON "faqs"("serviceId");

-- CreateIndex
CREATE INDEX "faq_translations_locale_status_idx" ON "faq_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "faq_translations_faqId_locale_key" ON "faq_translations"("faqId", "locale");

-- CreateIndex
CREATE INDEX "social_links_partnerId_idx" ON "social_links"("partnerId");

-- CreateIndex
CREATE INDEX "social_links_brandId_idx" ON "social_links"("brandId");

-- CreateIndex
CREATE INDEX "social_links_teamMemberId_idx" ON "social_links"("teamMemberId");

-- CreateIndex
CREATE INDEX "social_links_visible_sortOrder_idx" ON "social_links"("visible", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "forms_key_key" ON "forms"("key");

-- CreateIndex
CREATE INDEX "form_fields_formId_sortOrder_idx" ON "form_fields"("formId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_formId_key_key" ON "form_fields"("formId", "key");

-- CreateIndex
CREATE INDEX "form_field_translations_locale_status_idx" ON "form_field_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "form_field_translations_fieldId_locale_key" ON "form_field_translations"("fieldId", "locale");

-- CreateIndex
CREATE INDEX "form_submissions_formId_createdAt_idx" ON "form_submissions"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "form_submissions_createdAt_idx" ON "form_submissions"("createdAt");

-- CreateIndex
CREATE INDEX "form_submission_files_submissionId_idx" ON "form_submission_files"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_reference_key" ON "inquiries"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_submissionId_key" ON "inquiries"("submissionId");

-- CreateIndex
CREATE INDEX "inquiries_status_createdAt_idx" ON "inquiries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "inquiries_type_status_idx" ON "inquiries"("type", "status");

-- CreateIndex
CREATE INDEX "inquiries_email_idx" ON "inquiries"("email");

-- CreateIndex
CREATE INDEX "inquiries_createdAt_idx" ON "inquiries"("createdAt");

-- CreateIndex
CREATE INDEX "inquiry_notes_inquiryId_createdAt_idx" ON "inquiry_notes"("inquiryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirmTokenHash_key" ON "newsletter_subscribers"("confirmTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeTokenHash_key" ON "newsletter_subscribers"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_confirmedAt_unsubscribedAt_idx" ON "newsletter_subscribers"("confirmedAt", "unsubscribedAt");

-- CreateIndex
CREATE INDEX "knowledge_documents_locale_isPublic_idx" ON "knowledge_documents"("locale", "isPublic");

-- CreateIndex
CREATE INDEX "knowledge_documents_contentHash_idx" ON "knowledge_documents"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_entityType_entityId_locale_key" ON "knowledge_documents"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "knowledge_chunks_contentHash_idx" ON "knowledge_chunks"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_documentId_chunkIndex_key" ON "knowledge_chunks"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ai_conversations_surface_createdAt_idx" ON "ai_conversations"("surface", "createdAt");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_createdAt_idx" ON "ai_conversations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_taskType_createdAt_idx" ON "ai_usage"("taskType", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_userId_createdAt_idx" ON "ai_usage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_jobs_status_createdAt_idx" ON "ai_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_jobs_createdById_createdAt_idx" ON "ai_jobs"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ai_job_items_jobId_status_idx" ON "ai_job_items"("jobId", "status");

-- CreateIndex
CREATE INDEX "ai_job_items_entityType_entityId_idx" ON "ai_job_items"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_key_key" ON "ai_prompt_templates"("key");

-- CreateIndex
CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");

-- CreateIndex
CREATE INDEX "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");

-- CreateIndex
CREATE INDEX "page_views_entityType_entityId_createdAt_idx" ON "page_views"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "entity_views_entityType_entityId_createdAt_idx" ON "entity_views"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "entity_views_createdAt_idx" ON "entity_views"("createdAt");

-- CreateIndex
CREATE INDEX "search_query_logs_normalized_createdAt_idx" ON "search_query_logs"("normalized", "createdAt");

-- CreateIndex
CREATE INDEX "search_query_logs_resultCount_createdAt_idx" ON "search_query_logs"("resultCount", "createdAt");

-- CreateIndex
CREATE INDEX "search_query_logs_createdAt_idx" ON "search_query_logs"("createdAt");

-- CreateIndex
CREATE INDEX "cta_clicks_ctaKey_createdAt_idx" ON "cta_clicks"("ctaKey", "createdAt");

-- CreateIndex
CREATE INDEX "cta_clicks_createdAt_idx" ON "cta_clicks"("createdAt");

-- CreateIndex
CREATE INDEX "download_events_entityType_entityId_createdAt_idx" ON "download_events"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "download_events_createdAt_idx" ON "download_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_daily_metric_date_idx" ON "analytics_daily"("metric", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_date_metric_dimension_locale_entityType_ent_key" ON "analytics_daily"("date", "metric", "dimension", "locale", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "site_settings_namespace_idx" ON "site_settings"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_namespace_key_key" ON "site_settings"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "banners_key_key" ON "banners"("key");

-- CreateIndex
CREATE INDEX "banners_placement_status_sortOrder_idx" ON "banners"("placement", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "banner_translations_locale_status_idx" ON "banner_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "banner_translations_bannerId_locale_key" ON "banner_translations"("bannerId", "locale");

-- CreateIndex
CREATE INDEX "cookie_consents_visitorHash_createdAt_idx" ON "cookie_consents"("visitorHash", "createdAt");

-- CreateIndex
CREATE INDEX "cookie_consents_createdAt_idx" ON "cookie_consents"("createdAt");

-- CreateIndex
CREATE INDEX "job_runs_queue_status_createdAt_idx" ON "job_runs"("queue", "status", "createdAt");

-- CreateIndex
CREATE INDEX "job_runs_createdAt_idx" ON "job_runs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_kind_createdAt_idx" ON "notifications"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_credentials" ADD CONSTRAINT "mfa_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_up_challenges" ADD CONSTRAINT "step_up_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_translations" ADD CONSTRAINT "ui_translations_locale_fkey" FOREIGN KEY ("locale") REFERENCES "locales"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_meta" ADD CONSTRAINT "seo_meta_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset_translations" ADD CONSTRAINT "media_asset_translations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags_on_assets" ADD CONSTRAINT "media_tags_on_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tags_on_assets" ADD CONSTRAINT "media_tags_on_assets_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "media_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_block_translations" ADD CONSTRAINT "page_block_translations_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "page_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_translations" ADD CONSTRAINT "menu_item_translations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_translations" ADD CONSTRAINT "partner_translations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_categories" ADD CONSTRAINT "partner_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "partner_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_category_translations" ADD CONSTRAINT "partner_category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "partner_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_categories_on_partners" ADD CONSTRAINT "partner_categories_on_partners_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_categories_on_partners" ADD CONSTRAINT "partner_categories_on_partners_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "partner_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_media" ADD CONSTRAINT "partner_media_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_media" ADD CONSTRAINT "partner_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_translations" ADD CONSTRAINT "brand_translations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_translations" ADD CONSTRAINT "product_category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories_on_products" ADD CONSTRAINT "product_categories_on_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories_on_products" ADD CONSTRAINT "product_categories_on_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "product_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_translations" ADD CONSTRAINT "service_translations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_services" ADD CONSTRAINT "products_on_services_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_services" ADD CONSTRAINT "products_on_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_on_partners" ADD CONSTRAINT "services_on_partners_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_on_partners" ADD CONSTRAINT "services_on_partners_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_translations" ADD CONSTRAINT "achievement_translations_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_translations" ADD CONSTRAINT "event_translations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners_on_events" ADD CONSTRAINT "partners_on_events_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners_on_events" ADD CONSTRAINT "partners_on_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_events" ADD CONSTRAINT "products_on_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_events" ADD CONSTRAINT "products_on_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "article_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_articles" ADD CONSTRAINT "products_on_articles_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_articles" ADD CONSTRAINT "products_on_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners_on_articles" ADD CONSTRAINT "partners_on_articles_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners_on_articles" ADD CONSTRAINT "partners_on_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_on_events" ADD CONSTRAINT "articles_on_events_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_on_events" ADD CONSTRAINT "articles_on_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_translations" ADD CONSTRAINT "resource_translations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_resources" ADD CONSTRAINT "products_on_resources_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_on_resources" ADD CONSTRAINT "products_on_resources_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_translations" ADD CONSTRAINT "certificate_translations_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offices" ADD CONSTRAINT "offices_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_translations" ADD CONSTRAINT "office_translations_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_translations" ADD CONSTRAINT "team_member_translations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_translations" ADD CONSTRAINT "milestone_translations_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial_translations" ADD CONSTRAINT "testimonial_translations_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "testimonials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_translations" ADD CONSTRAINT "faq_translations_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_field_translations" ADD CONSTRAINT "form_field_translations_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "form_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_files" ADD CONSTRAINT "form_submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_files" ADD CONSTRAINT "form_submission_files_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_job_items" ADD CONSTRAINT "ai_job_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ai_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_mobileImageId_fkey" FOREIGN KEY ("mobileImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_translations" ADD CONSTRAINT "banner_translations_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
