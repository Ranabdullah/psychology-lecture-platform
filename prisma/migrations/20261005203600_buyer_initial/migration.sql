-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "LectureStatus" AS ENUM ('DRAFT', 'RECORDING', 'PROCESSING', 'AI_ANALYZED', 'IN_REVIEW', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "LectureLanguage" AS ENUM ('ENGLISH', 'URDU', 'PUNJABI', 'MIXED_URDU_ENGLISH', 'MIXED_PUNJABI_ENGLISH');

-- CreateEnum
CREATE TYPE "SpeakerRole" AS ENUM ('TEACHER', 'STUDENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('TEACHER_EXPLANATION', 'STUDENT_QUESTION', 'TEACHER_ANSWER', 'DISCUSSION', 'EXAMPLE', 'IMPORTANT', 'OTHER');

-- CreateEnum
CREATE TYPE "AiAnalysisType" AS ENUM ('SUMMARY_DETAILED', 'SUMMARY_SHORT', 'REVISION_NOTES', 'KEY_CONCEPTS', 'IMPORTANT_POINTS', 'QUESTIONS_EXTRACTED', 'ANSWERS_EXTRACTED', 'EXAMPLES_EXTRACTED', 'DEFINITIONS_EXTRACTED', 'TOPIC_EXTRACTION', 'UNCLEAR_SECTIONS', 'CONTRADICTIONS', 'STUDY_QUESTIONS', 'FLASHCARDS', 'LECTURE_OUTLINE');

-- CreateEnum
CREATE TYPE "MarkerType" AS ENUM ('IMPORTANT', 'QUESTION', 'EXAMPLE', 'CONFUSING', 'RESEARCH_LATER', 'NOTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "primaryLanguage" "LectureLanguage" NOT NULL DEFAULT 'MIXED_URDU_ENGLISH',
    "plannedDuration" INTEGER,
    "actualDuration" INTEGER,
    "seriesName" TEXT,
    "partNumber" INTEGER,
    "status" "LectureStatus" NOT NULL DEFAULT 'DRAFT',
    "lectureDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureRecording" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "audioBase64" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/webm',
    "totalDurationSec" INTEGER,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "LectureRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSegment" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "startOffsetSec" DOUBLE PRECISION NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "rawLabel" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "SpeakerRole" NOT NULL DEFAULT 'UNKNOWN',
    "linkedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "speakerId" TEXT,
    "speakerRole" "SpeakerRole" NOT NULL DEFAULT 'UNKNOWN',
    "startTimeSec" DOUBLE PRECISION NOT NULL,
    "endTimeSec" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "translatedText" TEXT,
    "language" "LectureLanguage" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "segmentType" "SegmentType" NOT NULL DEFAULT 'OTHER',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "overview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureTopic" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicOccurrence" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "transcriptSegmentId" TEXT,
    "timestampSec" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicRelation" (
    "id" TEXT NOT NULL,
    "fromTopicId" TEXT NOT NULL,
    "toTopicId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'related',

    CONSTRAINT "TopicRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "type" "AiAnalysisType" NOT NULL,
    "content" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "approvedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureSummary" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentConfusion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "transcriptSegmentId" TEXT,
    "timestampSec" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "aiExplanation" JSONB,
    "submittedToTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentConfusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuestion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "topicId" TEXT,
    "transcriptSegmentId" TEXT,
    "timestampSec" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "submittedToTeacher" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAnswer" (
    "id" TEXT NOT NULL,
    "studentQuestionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualMarker" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestampSec" DOUBLE PRECISION NOT NULL,
    "markerType" "MarkerType" NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT,
    "topicId" TEXT,
    "transcriptSegmentId" TEXT,
    "timestampSec" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT,
    "topicId" TEXT,
    "timestampSec" DOUBLE PRECISION,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "transcriptSegmentId" TEXT,
    "startTimeSec" DOUBLE PRECISION,
    "endTimeSec" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureImage" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "timestampSec" DOUBLE PRECISION,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Instructor Code Words',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Lecture_status_idx" ON "Lecture"("status");

-- CreateIndex
CREATE INDEX "Lecture_seriesName_idx" ON "Lecture"("seriesName");

-- CreateIndex
CREATE INDEX "Lecture_lectureDate_idx" ON "Lecture"("lectureDate");

-- CreateIndex
CREATE INDEX "Lecture_createdById_idx" ON "Lecture"("createdById");

-- CreateIndex
CREATE INDEX "LectureRecording_lectureId_idx" ON "LectureRecording"("lectureId");

-- CreateIndex
CREATE INDEX "RecordingSegment_recordingId_idx" ON "RecordingSegment"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSegment_recordingId_sequenceIndex_key" ON "RecordingSegment"("recordingId", "sequenceIndex");

-- CreateIndex
CREATE INDEX "Speaker_lectureId_idx" ON "Speaker"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_lectureId_rawLabel_key" ON "Speaker"("lectureId", "rawLabel");

-- CreateIndex
CREATE INDEX "TranscriptSegment_lectureId_startTimeSec_idx" ON "TranscriptSegment"("lectureId", "startTimeSec");

-- CreateIndex
CREATE INDEX "TranscriptSegment_segmentType_idx" ON "TranscriptSegment"("segmentType");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_slug_idx" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "LectureTopic_topicId_idx" ON "LectureTopic"("topicId");

-- CreateIndex
CREATE INDEX "LectureTopic_lectureId_idx" ON "LectureTopic"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "LectureTopic_lectureId_topicId_key" ON "LectureTopic"("lectureId", "topicId");

-- CreateIndex
CREATE INDEX "TopicOccurrence_topicId_timestampSec_idx" ON "TopicOccurrence"("topicId", "timestampSec");

-- CreateIndex
CREATE INDEX "TopicOccurrence_lectureId_idx" ON "TopicOccurrence"("lectureId");

-- CreateIndex
CREATE INDEX "TopicRelation_fromTopicId_idx" ON "TopicRelation"("fromTopicId");

-- CreateIndex
CREATE INDEX "TopicRelation_toTopicId_idx" ON "TopicRelation"("toTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicRelation_fromTopicId_toTopicId_key" ON "TopicRelation"("fromTopicId", "toTopicId");

-- CreateIndex
CREATE INDEX "AiAnalysis_lectureId_type_idx" ON "AiAnalysis"("lectureId", "type");

-- CreateIndex
CREATE INDEX "LectureSummary_lectureId_kind_idx" ON "LectureSummary"("lectureId", "kind");

-- CreateIndex
CREATE INDEX "StudentConfusion_studentId_idx" ON "StudentConfusion"("studentId");

-- CreateIndex
CREATE INDEX "StudentConfusion_lectureId_idx" ON "StudentConfusion"("lectureId");

-- CreateIndex
CREATE INDEX "StudentConfusion_lectureId_timestampSec_idx" ON "StudentConfusion"("lectureId", "timestampSec");

-- CreateIndex
CREATE INDEX "StudentQuestion_studentId_idx" ON "StudentQuestion"("studentId");

-- CreateIndex
CREATE INDEX "StudentQuestion_lectureId_idx" ON "StudentQuestion"("lectureId");

-- CreateIndex
CREATE INDEX "StudentQuestion_submittedToTeacher_idx" ON "StudentQuestion"("submittedToTeacher");

-- CreateIndex
CREATE INDEX "TeacherAnswer_studentQuestionId_idx" ON "TeacherAnswer"("studentQuestionId");

-- CreateIndex
CREATE INDEX "ManualMarker_lectureId_timestampSec_idx" ON "ManualMarker"("lectureId", "timestampSec");

-- CreateIndex
CREATE INDEX "ManualMarker_userId_idx" ON "ManualMarker"("userId");

-- CreateIndex
CREATE INDEX "StudentNote_studentId_idx" ON "StudentNote"("studentId");

-- CreateIndex
CREATE INDEX "StudentNote_lectureId_idx" ON "StudentNote"("lectureId");

-- CreateIndex
CREATE INDEX "StudentNote_topicId_idx" ON "StudentNote"("topicId");

-- CreateIndex
CREATE INDEX "Bookmark_studentId_idx" ON "Bookmark"("studentId");

-- CreateIndex
CREATE INDEX "Bookmark_lectureId_idx" ON "Bookmark"("lectureId");

-- CreateIndex
CREATE INDEX "Bookmark_topicId_idx" ON "Bookmark"("topicId");

-- CreateIndex
CREATE INDEX "Highlight_studentId_idx" ON "Highlight"("studentId");

-- CreateIndex
CREATE INDEX "Highlight_lectureId_idx" ON "Highlight"("lectureId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LectureImage_lectureId_timestampSec_idx" ON "LectureImage"("lectureId", "timestampSec");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_term_key" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE INDEX "GlossaryTerm_term_idx" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE INDEX "GlossaryTerm_category_idx" ON "GlossaryTerm"("category");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureRecording" ADD CONSTRAINT "LectureRecording_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "LectureRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Speaker" ADD CONSTRAINT "Speaker_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureTopic" ADD CONSTRAINT "LectureTopic_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureTopic" ADD CONSTRAINT "LectureTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicOccurrence" ADD CONSTRAINT "TopicOccurrence_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicOccurrence" ADD CONSTRAINT "TopicOccurrence_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicOccurrence" ADD CONSTRAINT "TopicOccurrence_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicRelation" ADD CONSTRAINT "TopicRelation_fromTopicId_fkey" FOREIGN KEY ("fromTopicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicRelation" ADD CONSTRAINT "TopicRelation_toTopicId_fkey" FOREIGN KEY ("toTopicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConfusion" ADD CONSTRAINT "StudentConfusion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConfusion" ADD CONSTRAINT "StudentConfusion_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConfusion" ADD CONSTRAINT "StudentConfusion_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnswer" ADD CONSTRAINT "TeacherAnswer_studentQuestionId_fkey" FOREIGN KEY ("studentQuestionId") REFERENCES "StudentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnswer" ADD CONSTRAINT "TeacherAnswer_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualMarker" ADD CONSTRAINT "ManualMarker_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualMarker" ADD CONSTRAINT "ManualMarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureImage" ADD CONSTRAINT "LectureImage_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Private server database. API/browser roles must never read lecture/account tables directly.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."User" FROM PUBLIC;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Session" FROM PUBLIC;
ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PasswordResetToken" FROM PUBLIC;
ALTER TABLE public."Lecture" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Lecture" FROM PUBLIC;
ALTER TABLE public."LectureRecording" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."LectureRecording" FROM PUBLIC;
ALTER TABLE public."RecordingSegment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RecordingSegment" FROM PUBLIC;
ALTER TABLE public."Speaker" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Speaker" FROM PUBLIC;
ALTER TABLE public."TranscriptSegment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."TranscriptSegment" FROM PUBLIC;
ALTER TABLE public."Topic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Topic" FROM PUBLIC;
ALTER TABLE public."LectureTopic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."LectureTopic" FROM PUBLIC;
ALTER TABLE public."TopicOccurrence" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."TopicOccurrence" FROM PUBLIC;
ALTER TABLE public."TopicRelation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."TopicRelation" FROM PUBLIC;
ALTER TABLE public."AiAnalysis" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AiAnalysis" FROM PUBLIC;
ALTER TABLE public."LectureSummary" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."LectureSummary" FROM PUBLIC;
ALTER TABLE public."StudentConfusion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StudentConfusion" FROM PUBLIC;
ALTER TABLE public."StudentQuestion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StudentQuestion" FROM PUBLIC;
ALTER TABLE public."TeacherAnswer" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."TeacherAnswer" FROM PUBLIC;
ALTER TABLE public."ManualMarker" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ManualMarker" FROM PUBLIC;
ALTER TABLE public."StudentNote" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StudentNote" FROM PUBLIC;
ALTER TABLE public."Bookmark" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Bookmark" FROM PUBLIC;
ALTER TABLE public."Highlight" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Highlight" FROM PUBLIC;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Notification" FROM PUBLIC;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AuditLog" FROM PUBLIC;
ALTER TABLE public."LectureImage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."LectureImage" FROM PUBLIC;
ALTER TABLE public."GlossaryTerm" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GlossaryTerm" FROM PUBLIC;
DO $$ DECLARE r text; t text; BEGIN FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP FOREACH t IN ARRAY ARRAY['User','Session','PasswordResetToken','Lecture','LectureRecording','RecordingSegment','Speaker','TranscriptSegment','Topic','LectureTopic','TopicOccurrence','TopicRelation','AiAnalysis','LectureSummary','StudentConfusion','StudentQuestion','TeacherAnswer','ManualMarker','StudentNote','Bookmark','Highlight','Notification','AuditLog','LectureImage','GlossaryTerm'] LOOP EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r); END LOOP; END LOOP; END $$;
