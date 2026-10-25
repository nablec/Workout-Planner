import type {
  ActiveExerciseEntry,
  ActiveWorkoutSession,
  CompletedExerciseLog,
  LoggedSet,
  MuscleGroup,
  PlanExercise,
  SplitDay,
  WeightUnit,
  WorkoutLog,
} from '../types';

/**
 * Epley 1RM formula: weight * (1 + reps / 30)
 * For 1 rep, returns weight directly.
 */
export function calculateEstimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const e1rm = weight * (1 + reps / 30);
  return Math.round(e1rm * 10) / 10;
}

export function formatDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatReadableDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[1]}/${parts[2]}`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

const VALID_MUSCLE_GROUPS: MuscleGroup[] = [
  '胸部',
  '背部',
  '腿部',
  '肩部',
  '手臂',
  '核心',
  '全身',
];

export function normalizeMuscleGroup(raw: string): MuscleGroup {
  const found = VALID_MUSCLE_GROUPS.find((m) => raw.includes(m.replace('部', '')));
  if (found) return found;
  if (raw.includes('胸')) return '胸部';
  if (raw.includes('背') || raw.includes('阔')) return '背部';
  if (raw.includes('腿') || raw.includes('臀') || raw.includes('股')) return '腿部';
  if (raw.includes('肩') || raw.includes('三角')) return '肩部';
  if (raw.includes('臂') || raw.includes('二头') || raw.includes('三头')) return '手臂';
  if (raw.includes('腹') || raw.includes('核心')) return '核心';
  return '全身';
}

/**
 * Find the most recent completed exercise performance matching by name
 */
export function findLastExercisePerformance(
  exerciseName: string,
  logs: WorkoutLog[]
): { date: string; log: CompletedExerciseLog } | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const normalizedTarget = exerciseName.trim().toLowerCase();

  for (const workout of sorted) {
    const match = workout.exercises.find(
      (ex) => ex.name.trim().toLowerCase() === normalizedTarget
    );
    if (match && match.sets.some((s) => s.completed)) {
      return { date: workout.date, log: match };
    }
  }
  return null;
}

export function formatPreviousSummary(
  exerciseName: string,
  logs: WorkoutLog[],
  unit: WeightUnit
): string | undefined {
  const last = findLastExercisePerformance(exerciseName, logs);
  if (!last) return undefined;
  const workingSets = last.log.sets.filter((s) => s.completed && s.type === 'working');
  const pool = workingSets.length > 0 ? workingSets : last.log.sets.filter((s) => s.completed);
  if (pool.length === 0) return undefined;

  const topSet = pool.reduce((best, cur) =>
    cur.weight * (1 + cur.reps / 30) > best.weight * (1 + best.reps / 30) ? cur : best
  );
  return `上次 (${formatShortDate(last.date)}): ${topSet.weight}${unit} × ${topSet.reps}次 · 共${pool.length}组`;
}

/**
 * Deterministic progressive overload calculator (used for instant session creation
 * or fallback when user starts a session directly from template)
 */
export function buildDeterministicSessionFromSplit(
  split: SplitDay,
  logs: WorkoutLog[],
  unit: WeightUnit,
  readinessNote = ''
): ActiveWorkoutSession {
  const exercises: ActiveExerciseEntry[] = split.exercises.map((planEx: PlanExercise) => {
    const last = findLastExercisePerformance(planEx.name, logs);
    const prevSummary = formatPreviousSummary(planEx.name, logs, unit);

    let targetWeight = planEx.baselineWeight;
    let targetReps = planEx.minReps;
    let overloadAction: ActiveExerciseEntry['overloadAction'] = 'maintain';
    let reason = `按计划基准负重 ${planEx.baselineWeight}${unit} 启动，专注动作控制`;

    if (last) {
      const completedWorking = last.log.sets.filter(
        (s) => s.completed && s.type === 'working'
      );
      if (completedWorking.length > 0) {
        const avgWeight =
          Math.round(
            (completedWorking.reduce((acc, s) => acc + s.weight, 0) /
              completedWorking.length) *
              2
          ) / 2;
        const allHitMax = completedWorking.every((s) => s.reps >= planEx.maxReps);
        const allHitMin = completedWorking.every((s) => s.reps >= planEx.minReps);

        if (allHitMax && completedWorking.length >= planEx.targetSets) {
          const step = planEx.muscleGroup === '手臂' || planEx.muscleGroup === '肩部' ? 1.25 : 2.5;
          targetWeight = avgWeight > 0 ? Math.round((avgWeight + step) * 100) / 100 : 0;
          targetReps = planEx.minReps;
          overloadAction = 'increase_weight';
          reason = `上次全部达到 ${planEx.maxReps} 次上限，今日进阶 +${step}${unit}`;
        } else if (allHitMin) {
          targetWeight = avgWeight;
          const prevAvgReps = Math.round(
            completedWorking.reduce((acc, s) => acc + s.reps, 0) / completedWorking.length
          );
          targetReps = Math.min(planEx.maxReps, prevAvgReps + 1);
          overloadAction = 'increase_reps';
          reason = `维持 ${avgWeight}${unit} 负重，每组争取比上次多完成 1 次`;
        } else {
          targetWeight = avgWeight;
          targetReps = planEx.minReps;
          overloadAction = 'maintain';
          reason = `维持上次 ${avgWeight}${unit} 负重，优先稳固 ${planEx.minReps} 次标准动作`;
        }
      }
    }

    const sets: LoggedSet[] = Array.from({ length: Math.max(1, planEx.targetSets) }, (_, i) => ({
      id: uid('set'),
      setNumber: i + 1,
      type: 'working',
      weight: targetWeight,
      reps: targetReps,
      rpe: 8,
      completed: false,
    }));

    return {
      id: uid('act_ex'),
      exerciseId: planEx.id,
      name: planEx.name,
      muscleGroup: planEx.muscleGroup,
      equipment: planEx.equipment,
      restSeconds: planEx.restSeconds,
      targetRepsLabel: `${planEx.minReps}-${planEx.maxReps} 次`,
      aiReason: reason,
      overloadAction,
      previousSummary: prevSummary,
      notes: planEx.notes || '',
      sets,
    };
  });

  return {
    id: uid('session'),
    date: formatDateISO(),
    splitId: split.id,
    splitName: split.name,
    startedAt: new Date().toISOString(),
    coachSummary: `基于「${split.name}」与近期完成度为您匹配了今日目标。达标动作已做微幅渐进加载，训练时请留意顶端休息计时。`,
    readinessNote,
    sessionNotes: '',
    exercises,
  };
}

/**
 * Compute PRs and build a finalized WorkoutLog when user finishes an active session
 */
export function finalizeWorkoutSession(
  session: ActiveWorkoutSession,
  existingLogs: WorkoutLog[]
): WorkoutLog | null {
  const completedExercises: CompletedExerciseLog[] = [];
  let totalVolume = 0;
  let totalWorkingSets = 0;
  const prExercises: string[] = [];

  for (const ex of session.exercises) {
    const doneSets = ex.sets.filter((s) => s.completed);
    if (doneSets.length === 0) continue;

    // Historical max 1RM for this exercise
    let historicalBest1RM = 0;
    let hasHistory = false;
    const targetName = ex.name.trim().toLowerCase();

    for (const oldLog of existingLogs) {
      for (const oldEx of oldLog.exercises) {
        if (oldEx.name.trim().toLowerCase() === targetName) {
          hasHistory = true;
          if (oldEx.bestEstimated1RM > historicalBest1RM) {
            historicalBest1RM = oldEx.bestEstimated1RM;
          }
        }
      }
    }

    let exVolume = 0;
    let bestWeight = 0;
    let best1RM = 0;

    doneSets.forEach((s, idx) => {
      s.setNumber = idx + 1;
      if (s.type === 'working') {
        totalWorkingSets += 1;
      }
      const vol = (s.weight > 0 ? s.weight : 0) * s.reps;
      exVolume += vol;
      if (s.weight > bestWeight) bestWeight = s.weight;
      const e1rm = calculateEstimated1RM(s.weight, s.reps);
      if (e1rm > best1RM) best1RM = e1rm;
    });

    totalVolume += exVolume;

    if (hasHistory && best1RM > historicalBest1RM && best1RM > 0) {
      prExercises.push(ex.name);
    }

    completedExercises.push({
      id: uid('comp_ex'),
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      notes: ex.notes,
      sets: doneSets,
      bestWeight,
      bestEstimated1RM: best1RM,
      totalVolume: Math.round(exVolume),
    });
  }

  if (completedExercises.length === 0) {
    return null;
  }

  const startedMs = Date.parse(session.startedAt);
  const elapsedMin = Number.isNaN(startedMs)
    ? 50
    : Math.max(15, Math.min(180, Math.round((Date.now() - startedMs) / 60000)));

  return {
    id: uid('log'),
    date: session.date,
    splitId: session.splitId,
    splitName: session.splitName,
    durationMinutes: elapsedMin,
    totalVolume: Math.round(totalVolume),
    totalWorkingSets,
    prCount: prExercises.length,
    prExercises,
    notes: session.sessionNotes.trim() || undefined,
    exercises: completedExercises,
  };
}
