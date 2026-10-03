-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Invitation" (
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "currentRole" TEXT NOT NULL DEFAULT '',
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 5,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "inventoryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "planningRevision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConfirmedSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "canonicalSkillId" TEXT,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "catalogueVersion" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmedSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "sequence" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roadmap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "inputRevision" INTEGER NOT NULL,
    "catalogueVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapTask" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "completionCriterion" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "skillIds" TEXT[],
    "resourceIds" TEXT[],
    "estimatedMinutes" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoadmapTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmedSkill_userId_key_key" ON "ConfirmedSkill"("userId", "key");

-- CreateIndex
CREATE INDEX "Consent_userId_purpose_recordedAt_idx" ON "Consent"("userId", "purpose", "recordedAt");

-- CreateIndex
CREATE INDEX "Roadmap_userId_status_idx" ON "Roadmap"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapTask_roadmapId_position_key" ON "RoadmapTask"("roadmapId", "position");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedSkill" ADD CONSTRAINT "ConfirmedSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapTask" ADD CONSTRAINT "RoadmapTask_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Business invariants enforced independently of the application.
CREATE UNIQUE INDEX "one_active_roadmap_per_user" ON "Roadmap" ("userId") WHERE status = 'active';
ALTER TABLE "Profile" ADD CONSTRAINT "hours_range" CHECK ("hoursPerWeek" BETWEEN 1 AND 40);
ALTER TABLE "Profile" ADD CONSTRAINT "years_range" CHECK ("yearsExperience" BETWEEN 0 AND 60);
ALTER TABLE "Profile" ADD CONSTRAINT "revision_nonnegative" CHECK ("planningRevision" >= 0);
ALTER TABLE "ConfirmedSkill" ADD CONSTRAINT "origin_enum" CHECK (source IN ('manual','cv'));
ALTER TABLE "RoadmapTask" ADD CONSTRAINT "task_bounds" CHECK (week BETWEEN 1 AND 12 AND "estimatedMinutes" > 0 AND revision >= 0);
ALTER TABLE "RoadmapTask" ADD CONSTRAINT "task_kind" CHECK (kind IN ('learning','practical'));
ALTER TABLE "User" ADD CONSTRAINT "user_state" CHECK (status IN ('active','deleting'));
ALTER TABLE "Roadmap" ADD CONSTRAINT "roadmap_state" CHECK (status IN ('active','archived'));
ALTER TABLE "Consent" ADD CONSTRAINT "purpose_enum" CHECK (purpose IN ('cv_extraction','roadmap_generation'));

CREATE UNIQUE INDEX "Consent_sequence_key" ON "Consent" ("sequence");
