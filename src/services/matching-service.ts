import { allRows, firstRow, runStatement } from '../db/client';
import { addSeconds, randomId, safeJsonParse } from '../lib/crypto';

interface UserSkillRow {
  user_id: string;
  skill_id: string;
  direction: string;
  proficiency_level: string | null;
  target_level: string | null;
  priority: number | null;
}

const proficiencyScore = (value: string | null) => {
  switch (value) {
    case 'advanced':
      return 3;
    case 'intermediate':
      return 2;
    case 'beginner':
      return 1;
    default:
      return 0;
  }
};

export const getPeerRecommendations = async (db: D1Database, userId: string) => {
  const baseProfile = await firstRow<{
    user_id: string;
    timezone: string | null;
    language: string | null;
    weekly_hours: number | null;
    experience_level: string | null;
  }>(
    db,
    `SELECT user_id, timezone, language, weekly_hours, experience_level
     FROM profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  const baseSkills = await allRows<UserSkillRow>(
    db,
    `SELECT user_id, skill_id, direction, proficiency_level, target_level, priority
     FROM user_skills
     WHERE user_id = ?`,
    [userId],
  );

  const candidates = await allRows<{
    user_id: string;
    display_name: string;
    timezone: string | null;
    language: string | null;
    weekly_hours: number | null;
    experience_level: string | null;
  }>(
    db,
    `SELECT u.id AS user_id, p.display_name, p.timezone, p.language, p.weekly_hours, p.experience_level
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id <> ?
       AND u.status = 'active'
     LIMIT 100`,
    [userId],
  );

  const candidateIds = candidates.map((candidate) => candidate.user_id);
  const candidateSkills =
    candidateIds.length > 0
      ? await allRows<UserSkillRow>(
          db,
          `SELECT user_id, skill_id, direction, proficiency_level, target_level, priority
           FROM user_skills
           WHERE user_id IN (${candidateIds.map(() => '?').join(', ')})`,
          candidateIds,
        )
      : [];

  const baseWanted = baseSkills.filter((skill) => skill.direction === 'want');
  const baseHave = baseSkills.filter((skill) => skill.direction === 'have');

  const recommendations = candidates
    .map((candidate) => {
      const skills = candidateSkills.filter((skill) => skill.user_id === candidate.user_id);
      const candidateWanted = skills.filter((skill) => skill.direction === 'want');
      const candidateHave = skills.filter((skill) => skill.direction === 'have');

      const overlapWantHave = baseWanted.filter((wanted) =>
        candidateHave.some((have) => have.skill_id === wanted.skill_id),
      ).length;
      const overlapSharedGoal = baseWanted.filter((wanted) =>
        candidateWanted.some((candidateWant) => candidateWant.skill_id === wanted.skill_id),
      ).length;
      const overlapHaveWanted = baseHave.filter((have) =>
        candidateWanted.some((wanted) => wanted.skill_id === have.skill_id),
      ).length;

      const goalSimilarity = overlapWantHave + overlapSharedGoal + overlapHaveWanted;
      const skillOverlap = skills.filter((skill) =>
        baseSkills.some((baseSkill) => baseSkill.skill_id === skill.skill_id),
      ).length;
      const levelProximity = Math.max(
        0,
        3 -
          Math.abs(
            proficiencyScore(candidate.experience_level) -
              proficiencyScore(baseProfile?.experience_level ?? null),
          ),
      );
      const availabilityOverlap = Math.max(
        0,
        10 - Math.abs((candidate.weekly_hours ?? 0) - (baseProfile?.weekly_hours ?? 0)),
      );
      const timezoneOverlap =
        candidate.timezone && baseProfile?.timezone && candidate.timezone === baseProfile.timezone ? 10 : 5;
      const languageMatch =
        candidate.language && baseProfile?.language && candidate.language === baseProfile.language ? 10 : 4;

      const score =
        goalSimilarity * 0.4 +
        skillOverlap * 0.2 +
        levelProximity * 0.15 +
        availabilityOverlap * 0.1 +
        timezoneOverlap * 0.1 +
        languageMatch * 0.05;

      const reasons = [];
      if (goalSimilarity > 0) reasons.push('similar learning goal');
      if (skillOverlap > 0) reasons.push('shared skill context');
      if (languageMatch >= 10) reasons.push('same language preference');
      if (timezoneOverlap >= 10) reasons.push('same timezone');

      return {
        userId: candidate.user_id,
        displayName: candidate.display_name,
        timezone: candidate.timezone,
        language: candidate.language,
        weeklyHours: candidate.weekly_hours,
        experienceLevel: candidate.experience_level,
        score: Number(score.toFixed(2)),
        reasons: reasons.slice(0, 3),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  await runStatement(db, `DELETE FROM peer_matches WHERE user_id = ? AND status = 'pending'`, [userId]);

  const storedRecommendations = [];

  for (const recommendation of recommendations) {
    const matchId = randomId();
    await runStatement(
      db,
      `INSERT INTO peer_matches
        (id, user_id, matched_user_id, score, status, reason_codes_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        matchId,
        userId,
        recommendation.userId,
        recommendation.score,
        JSON.stringify(recommendation.reasons),
        new Date().toISOString(),
        addSeconds(7 * 24 * 60 * 60),
      ],
    );

    storedRecommendations.push({
      id: matchId,
      ...recommendation,
      status: 'pending',
      suggestedRoomType: 'peer_room',
    });
  }

  return storedRecommendations;
};

export const updatePeerMatchStatus = async (
  db: D1Database,
  payload: {
    matchId: string;
    userId: string;
    status: 'accepted' | 'rejected';
  },
) => {
  const match = await firstRow<{
    id: string;
    user_id: string;
    matched_user_id: string;
    score: number;
    reason_codes_json: string | null;
  }>(
    db,
    `SELECT id, user_id, matched_user_id, score, reason_codes_json
     FROM peer_matches
     WHERE id = ?
       AND user_id = ?
     LIMIT 1`,
    [payload.matchId, payload.userId],
  );

  if (!match) {
    return null;
  }

  await runStatement(db, `UPDATE peer_matches SET status = ? WHERE id = ?`, [payload.status, payload.matchId]);

  if (payload.status === 'accepted') {
    const existingRoom = await firstRow<{ room_id: string }>(
      db,
      `SELECT crm1.room_id
       FROM chat_room_members crm1
       JOIN chat_room_members crm2 ON crm1.room_id = crm2.room_id
       JOIN chat_rooms cr ON cr.id = crm1.room_id
       WHERE cr.room_type = 'peer_room'
         AND crm1.user_id = ?
         AND crm2.user_id = ?
       LIMIT 1`,
      [payload.userId, match.matched_user_id],
    );

    if (!existingRoom) {
      const roomId = randomId();
      await runStatement(
        db,
        `INSERT INTO chat_rooms
          (id, room_type, name, related_project_id, related_module_id, created_by, created_at)
         VALUES (?, 'peer_room', 'Peer Match Room', NULL, NULL, ?, ?)`,
        [roomId, payload.userId, new Date().toISOString()],
      );

      await runStatement(
        db,
        `INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
         VALUES (?, ?, ?, 'member', ?, NULL)`,
        [randomId(), roomId, payload.userId, new Date().toISOString()],
      );

      await runStatement(
        db,
        `INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
         VALUES (?, ?, ?, 'member', ?, NULL)`,
        [randomId(), roomId, match.matched_user_id, new Date().toISOString()],
      );

      return {
        id: match.id,
        userId: match.user_id,
        matchedUserId: match.matched_user_id,
        score: match.score,
        reasons: safeJsonParse(match.reason_codes_json, []),
        status: payload.status,
        roomId,
      };
    }

    return {
      id: match.id,
      userId: match.user_id,
      matchedUserId: match.matched_user_id,
      score: match.score,
      reasons: safeJsonParse(match.reason_codes_json, []),
      status: payload.status,
      roomId: existingRoom.room_id,
    };
  }

  return {
    id: match.id,
    userId: match.user_id,
    matchedUserId: match.matched_user_id,
    score: match.score,
    reasons: safeJsonParse(match.reason_codes_json, []),
    status: payload.status,
    roomId: null,
  };
};
