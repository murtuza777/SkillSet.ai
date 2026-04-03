export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    details: unknown;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  role: "user" | "mentor" | "admin";
  status: string;
  emailVerifiedAt: string | null;
}

export interface Profile {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  language: string | null;
  experienceLevel: string | null;
  weeklyHours: number | null;
  skills?: UserSkill[];
}

export interface AuthMe {
  user: SessionUser;
  profile: Profile;
}

export interface UserSkill {
  id: string;
  slug: string;
  name: string;
  direction: "have" | "want";
  proficiencyLevel: string | null;
  targetLevel: string | null;
  priority: number | null;
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

export interface MatchRecommendation {
  id: string;
  userId: string;
  displayName: string;
  timezone: string | null;
  language: string | null;
  weeklyHours: number | null;
  experienceLevel: string | null;
  score: number;
  reasons: string[];
  status: string;
  suggestedRoomType: string;
}

export interface Room {
  id: string;
  roomType: string;
  name: string;
  relatedProjectId: string | null;
  relatedModuleId: string | null;
  createdAt: string;
  latestMessageAt: string | null;
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  messageType: string;
  body: string;
  attachments: unknown;
  replyToMessageId: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface RoomJoinToken {
  token: string;
  websocketUrl: string;
}

export interface LearningTask {
  id: string;
  title: string;
  taskType: string | null;
  instructions: string;
  difficulty: string | null;
  pointsReward: number;
  acceptanceCriteria: string[];
}

export interface LearningLesson {
  id: string;
  title: string;
  lessonType: string | null;
  summary: string | null;
  contentRef: Array<{
    sourceId: string;
    title: string;
    canonicalUrl: string;
    url?: string;
    task?: string | null;
    xp?: number | null;
    type?: "video" | "doc" | null;
  }>;
  sequenceNo: number;
}

export interface LearningModule {
  id: string;
  title: string;
  summary: string | null;
  sequenceNo: number;
  estimatedMinutes: number | null;
  unlockRule: Record<string, unknown> | null;
  lessons: LearningLesson[];
  tasks: LearningTask[];
}

export interface LearningEnrollment {
  id: string;
  status: string;
  progressPct: number;
  startedAt: string | null;
  completedAt: string | null;
  currentModuleId: string | null;
}

export interface LearningPath {
  id: string;
  skillId: string;
  skillName?: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  goalType: string | null;
  estimatedHours: number | null;
  sourceStrategy: string | null;
  version: number;
  createdAt: string;
  enrollment: LearningEnrollment | null;
  collaboration?: {
    squadId: string;
    roomId: string;
    roomName: string;
  } | null;
  modules: LearningModule[];
}

export interface TaskAttempt {
  id: string;
  taskId: string;
  userId: string;
  submissionText: string | null;
  submissionUrl: string | null;
  status: string;
  feedback: {
    summary?: string;
    suggestions?: string[];
  };
}

export interface ContentSource {
  id: string;
  provider: string;
  sourceType: string;
  canonicalUrl: string;
  externalId: string | null;
  title: string;
  authorName: string | null;
  license: string | null;
  language: string | null;
  publishedAt: string | null;
  qualityScore: number;
  metadata: Record<string, unknown>;
  chunks?: Array<{
    id: string;
    chunkIndex: number;
    text: string;
    tokenCount: number;
    vectorId: string | null;
    keywords: string[];
    summary: string | null;
  }>;
}

export interface ContentDiscovery {
  skill: Skill | null;
  sources: ContentSource[];
  cached?: boolean;
}

export interface Project {
  id: string;
  learningPathId: string | null;
  title: string;
  description: string | null;
  ownerId: string;
  visibility: string;
  repoUrl: string | null;
  status: string;
  createdAt: string;
  roomId: string | null;
}

export interface ProjectMember {
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface GamificationOverview {
  totalPoints: number;
  level: {
    levelNo: number;
    title: string;
    minPoints: number;
  } | null;
  badges: Badge[];
  recentEntries: Array<{
    id: string;
    eventType: string;
    pointsDelta: number;
    sourceEntity: string | null;
    sourceId: string | null;
    createdAt: string;
  }>;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  rarity: string | null;
  awarded?: boolean;
  awardedAt?: string;
  isActive?: boolean;
}

export interface Leaderboard {
  scopeType: string;
  scopeId: string | null;
  periodType: string;
  rankings: Array<{
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    totalPoints: number;
  }>;
}

export interface AdminMetrics {
  totalUsers: number;
  totalLearningPaths: number;
  totalProjects: number;
  totalContentSources: number;
  totalMessages: number;
}
