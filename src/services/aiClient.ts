import type {
  ActiveExerciseEntry,
  ActiveWorkoutSession,
  LoggedSet,
  SplitDay,
  WeightUnit,
  WorkoutLog,
  WorkoutProgram,
} from '../types';
import {
  findLastExercisePerformance,
  formatDateISO,
  formatPreviousSummary,
  normalizeMuscleGroup,
  uid,
} from '../utils/fitnessMath';

export interface PlanFileUploadPayload {
  name: string;
  mimeType: string;
  base64Data: string;
}

export async function parsePreviousPlanWithAI(params: {
  rawText?: string;
  file?: PlanFileUploadPayload | null;
}): Promise<WorkoutProgram> {
  const res = await fetch('/api/ai/parse-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawText: params.rawText || '',
      file: params.file || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'AI 解析训练计划失败，请检查输入内容后重试。');
  }

  const rawProgram = data.program;
  if (!rawProgram || !Array.isArray(rawProgram.splits) || rawProgram.splits.length === 0) {
    throw new Error('未能从文本中识别出有效的训练日与动作，请补充动作名称和组数信息。');
  }

  const splits: SplitDay[] = rawProgram.splits.map((s: Record<string, unknown>) => ({
    id: uid('split'),
    name: String(s.name || '训练日'),
    focus: String(s.focus || '综合力量训练'),
    estimatedMinutes: Number(s.estimatedMinutes) || 55,
    exercises: Array.isArray(s.exercises)
      ? s.exercises.map((ex: Record<string, unknown>) => ({
          id: uid('ex'),
          name: String(ex.name || '未命名动作'),
          muscleGroup: normalizeMuscleGroup(String(ex.muscleGroup || '全身')),
          equipment: String(ex.equipment || '自由重量'),
          targetSets: Math.max(1, Number(ex.targetSets) || 3),
          minReps: Math.max(1, Number(ex.minReps) || 8),
          maxReps: Math.max(Number(ex.minReps) || 8, Number(ex.maxReps) || 12),
          baselineWeight: Math.max(0, Number(ex.baselineWeight) || 0),
          restSeconds: Math.max(30, Number(ex.restSeconds) || 90),
          notes: ex.notes ? String(ex.notes) : '',
        }))
      : [],
  }));

  return {
    id: uid('prog'),
    name: String(rawProgram.name || '我的导入训练计划'),
    description: String(rawProgram.description || '由既往训练计划智能解析生成'),
    updatedAt: formatDateISO(),
    splits,
  };
}

export async function generateDailyWorkoutWithAI(params: {
  split: SplitDay;
  logs: WorkoutLog[];
  readinessNote: string;
  unit: WeightUnit;
}): Promise<ActiveWorkoutSession> {
  const { split, logs, readinessNote, unit } = params;

  // Gather compact recent history for the exercises in this split
  const recentHistory = split.exercises.map((ex) => {
    const last = findLastExercisePerformance(ex.name, logs);
    return {
      exerciseName: ex.name,
      targetSets: ex.targetSets,
      targetRepRange: `${ex.minReps}-${ex.maxReps}`,
      baselineWeight: ex.baselineWeight,
      lastSessionDate: last?.date ?? null,
      lastCompletedSets: last
        ? last.log.sets
            .filter((s) => s.completed)
            .map((s) => ({
              type: s.type,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
            }))
        : [],
    };
  });

  const res = await fetch('/api/ai/generate-daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      split,
      recentHistory,
      readinessNote,
      unit,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'AI 生成今日计划失败，请稍后重试或使用模板直接开始。');
  }

  const aiPlan = data.plan;
  if (!aiPlan || !Array.isArray(aiPlan.exercises)) {
    throw new Error('AI 返回的数据格式不完整，请重试。');
  }

  const exercises: ActiveExerciseEntry[] = aiPlan.exercises.map(
    (aiEx: Record<string, unknown>, index: number) => {
      const matchedTemplate =
        split.exercises.find(
          (t) => t.name.trim().toLowerCase() === String(aiEx.name || '').trim().toLowerCase()
        ) || split.exercises[index];

      const name = String(aiEx.name || matchedTemplate?.name || '训练动作');
      const rawSets = Array.isArray(aiEx.sets) ? aiEx.sets : [];

      const sets: LoggedSet[] =
        rawSets.length > 0
          ? rawSets.map((s: Record<string, unknown>, sIdx: number) => ({
              id: uid('set'),
              setNumber: sIdx + 1,
              type: s.type === 'warmup' ? 'warmup' : 'working',
              weight: Math.max(0, Number(s.weight) || 0),
              reps: Math.max(1, Number(s.reps) || 8),
              rpe: 8,
              completed: false,
            }))
          : Array.from({ length: matchedTemplate?.targetSets || 3 }, (_, sIdx) => ({
              id: uid('set'),
              setNumber: sIdx + 1,
              type: 'working',
              weight: matchedTemplate?.baselineWeight || 20,
              reps: matchedTemplate?.minReps || 8,
              rpe: 8,
              completed: false,
            }));

      const rawAction = String(aiEx.overloadAction || 'maintain');
      const overloadAction: ActiveExerciseEntry['overloadAction'] =
        rawAction === 'increase_weight' ||
        rawAction === 'increase_reps' ||
        rawAction === 'deload'
          ? rawAction
          : 'maintain';

      return {
        id: uid('act_ex'),
        exerciseId: matchedTemplate?.id || uid('ex'),
        name,
        muscleGroup: normalizeMuscleGroup(
          String(aiEx.muscleGroup || matchedTemplate?.muscleGroup || '全身')
        ),
        equipment: String(aiEx.equipment || matchedTemplate?.equipment || '自由重量'),
        restSeconds: Math.max(
          30,
          Number(aiEx.restSeconds) || matchedTemplate?.restSeconds || 90
        ),
        targetRepsLabel: String(
          aiEx.targetRepsLabel ||
            (matchedTemplate
              ? `${matchedTemplate.minReps}-${matchedTemplate.maxReps} 次`
              : '8-12 次')
        ),
        aiReason: aiEx.aiReason ? String(aiEx.aiReason) : undefined,
        overloadAction,
        previousSummary: formatPreviousSummary(name, logs, unit),
        notes: matchedTemplate?.notes || '',
        sets,
      };
    }
  );

  return {
    id: uid('session'),
    date: formatDateISO(),
    splitId: split.id,
    splitName: split.name,
    startedAt: new Date().toISOString(),
    coachSummary: String(
      aiPlan.coachSummary || `已结合历史完成记录为您生成「${split.name}」渐进训练方案。`
    ),
    readinessNote,
    sessionNotes: '',
    exercises,
  };
}
