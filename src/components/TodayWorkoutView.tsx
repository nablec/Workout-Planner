import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Check,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ActiveExerciseEntry,
  ActiveWorkoutSession,
  MuscleGroup,
  SplitDay,
  WeightUnit,
  WorkoutLog,
  WorkoutProgram,
} from '../types';
import {
  buildDeterministicSessionFromSplit,
  calculateEstimated1RM,
  formatPreviousSummary,
  formatReadableDate,
  uid,
} from '../utils/fitnessMath';
import { generateDailyWorkoutWithAI } from '../services/aiClient';
import { RestTimerBar } from './RestTimerBar';

interface TodayWorkoutViewProps {
  program: WorkoutProgram;
  logs: WorkoutLog[];
  activeSession: ActiveWorkoutSession | null;
  onUpdateSession: (session: ActiveWorkoutSession | null) => void;
  onCompleteWorkout: (session: ActiveWorkoutSession) => WorkoutLog | null;
  unit: WeightUnit;
  onToggleUnit: () => void;
  restTimer: {
    remainingSeconds: number;
    totalSeconds: number;
    isRunning: boolean;
    exerciseName: string;
  } | null;
  onStartRestTimer: (seconds: number, exerciseName: string) => void;
  onTogglePauseTimer: () => void;
  onAdjustTimer: (delta: number) => void;
  onDismissTimer: () => void;
  onNavigateProgram: () => void;
}

const MUSCLE_OPTIONS: MuscleGroup[] = [
  '胸部',
  '背部',
  '腿部',
  '肩部',
  '手臂',
  '核心',
  '全身',
];

export function TodayWorkoutView({
  program,
  logs,
  activeSession,
  onUpdateSession,
  onCompleteWorkout,
  unit,
  onToggleUnit,
  restTimer,
  onStartRestTimer,
  onTogglePauseTimer,
  onAdjustTimer,
  onDismissTimer,
  onNavigateProgram,
}: TodayWorkoutViewProps) {
  // Determine recommended next split in rotation based on most recent workout log
  const recommendedSplitId = useMemo(() => {
    if (program.splits.length === 0) return '';
    if (logs.length === 0) return program.splits[0].id;
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const lastLog = sorted[0];
    const lastIdx = program.splits.findIndex(
      (s) => s.id === lastLog.splitId || s.name === lastLog.splitName
    );
    if (lastIdx === -1) return program.splits[0].id;
    return program.splits[(lastIdx + 1) % program.splits.length].id;
  }, [program.splits, logs]);

  const [selectedSplitId, setSelectedSplitId] = useState<string>(
    activeSession?.splitId || recommendedSplitId || program.splits[0]?.id || ''
  );
  const [readinessNote, setReadinessNote] = useState<string>(
    activeSession?.readinessNote || ''
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Add custom exercise inline form state
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('胸部');
  const [newExEquipment, setNewExEquipment] = useState('哑铃');
  const [newExWeight, setNewExWeight] = useState('20');
  const [newExReps, setNewExReps] = useState('10');

  // Confirm reset draft state
  const [confirmReset, setConfirmReset] = useState(false);

  // Recently finished workout celebration summary
  const [justCompletedLog, setJustCompletedLog] = useState<WorkoutLog | null>(null);
  const [validationHint, setValidationHint] = useState<string | null>(null);

  const selectedSplit: SplitDay | undefined =
    program.splits.find((s) => s.id === selectedSplitId) || program.splits[0];

  const handleGenerateAISession = async () => {
    if (!selectedSplit) return;
    setIsGeneratingAI(true);
    setAiError(null);
    setJustCompletedLog(null);
    setValidationHint(null);
    try {
      const generated = await generateDailyWorkoutWithAI({
        split: selectedSplit,
        logs,
        readinessNote,
        unit,
      });
      onUpdateSession(generated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 生成今日计划失败';
      setAiError(msg);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleStartFromTemplate = () => {
    if (!selectedSplit) return;
    setAiError(null);
    setJustCompletedLog(null);
    setValidationHint(null);
    const session = buildDeterministicSessionFromSplit(
      selectedSplit,
      logs,
      unit,
      readinessNote
    );
    onUpdateSession(session);
  };

  // Session live metrics
  const sessionStats = useMemo(() => {
    if (!activeSession) {
      return { completedSets: 0, totalSets: 0, completedVolume: 0, remainingMinutes: 0 };
    }
    let completedSets = 0;
    let totalSets = 0;
    let completedVolume = 0;

    for (const ex of activeSession.exercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.completed) {
          completedSets += 1;
          completedVolume += (s.weight > 0 ? s.weight : 0) * s.reps;
        }
      }
    }

    const remainingSets = Math.max(0, totalSets - completedSets);
    const remainingMinutes = Math.ceil(remainingSets * 2.8);

    return {
      completedSets,
      totalSets,
      completedVolume: Math.round(completedVolume),
      remainingMinutes,
    };
  }, [activeSession]);

  const updateExerciseSet = (
    exerciseId: string,
    setId: string,
    updater: (s: ActiveExerciseEntry['sets'][0]) => ActiveExerciseEntry['sets'][0]
  ) => {
    if (!activeSession) return;
    setValidationHint(null);
    const nextExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? updater(s) : s)),
      };
    });
    onUpdateSession({ ...activeSession, exercises: nextExercises });
  };

  const handleToggleSetComplete = (ex: ActiveExerciseEntry, setId: string) => {
    const target = ex.sets.find((s) => s.id === setId);
    if (!target) return;
    const nextCompleted = !target.completed;
    updateExerciseSet(ex.id, setId, (s) => ({ ...s, completed: nextCompleted }));
    if (nextCompleted) {
      onStartRestTimer(ex.restSeconds || 90, ex.name);
    }
  };

  const handleAddSet = (exerciseId: string) => {
    if (!activeSession) return;
    const nextExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet = {
        id: uid('set'),
        setNumber: ex.sets.length + 1,
        type: 'working' as const,
        weight: lastSet ? lastSet.weight : 20,
        reps: lastSet ? lastSet.reps : 8,
        rpe: lastSet?.rpe ?? 8,
        completed: false,
      };
      return { ...ex, sets: [...ex.sets, newSet] };
    });
    onUpdateSession({ ...activeSession, exercises: nextExercises });
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    if (!activeSession) return;
    const nextExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== exerciseId || ex.sets.length <= 1) return ex;
      const filtered = ex.sets
        .filter((s) => s.id !== setId)
        .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      return { ...ex, sets: filtered };
    });
    onUpdateSession({ ...activeSession, exercises: nextExercises });
  };

  const handleRemoveExercise = (exerciseId: string) => {
    if (!activeSession) return;
    onUpdateSession({
      ...activeSession,
      exercises: activeSession.exercises.filter((ex) => ex.id !== exerciseId),
    });
  };

  const handleAddCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !newExName.trim()) return;
    const w = Math.max(0, Number(newExWeight) || 0);
    const r = Math.max(1, Number(newExReps) || 10);
    const trimmedName = newExName.trim();

    const added: ActiveExerciseEntry = {
      id: uid('act_ex'),
      exerciseId: uid('custom_ex'),
      name: trimmedName,
      muscleGroup: newExMuscle,
      equipment: newExEquipment.trim() || '自由重量',
      restSeconds: 90,
      targetRepsLabel: `${r} 次`,
      overloadAction: 'maintain',
      previousSummary: formatPreviousSummary(trimmedName, logs, unit),
      sets: [1, 2, 3].map((num) => ({
        id: uid('set'),
        setNumber: num,
        type: 'working',
        weight: w,
        reps: r,
        rpe: 8,
        completed: false,
      })),
    };

    onUpdateSession({
      ...activeSession,
      exercises: [...activeSession.exercises, added],
    });
    setNewExName('');
    setShowAddExercise(false);
  };

  const handleFinishSession = () => {
    if (!activeSession) return;
    const anyCompleted = activeSession.exercises.some((ex) =>
      ex.sets.some((s) => s.completed)
    );
    if (!anyCompleted) {
      setValidationHint('请至少勾选完成 1 组训练记录后再归档保存。');
      return;
    }
    const saved = onCompleteWorkout(activeSession);
    if (saved) {
      setJustCompletedLog(saved);
      setValidationHint(null);
    }
  };

  if (program.splits.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E0] rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-[#181816]">尚未配置训练计划模板</h2>
        <p className="mt-2 text-sm text-[#6B6B66] max-w-md mx-auto">
          您可以粘贴以往的健身计划文本由 AI 自动解析，或手动创建分化训练日。
        </p>
        <button
          type="button"
          onClick={onNavigateProgram}
          className="mt-5 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] rounded-lg transition-colors cursor-pointer"
        >
          前往配置健身计划
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Completion Banner when user just archived a workout */}
      {justCompletedLog && (
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#15803D]">
                今日训练已归档保存 · {formatReadableDate(justCompletedLog.date)}
              </div>
              <h2 className="mt-1 text-xl font-semibold text-[#181816]">
                已完成「{justCompletedLog.splitName}」
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#6B6B66] font-mono tabular-nums">
                <span>正式组 {justCompletedLog.totalWorkingSets} 组</span>
                <span aria-hidden="true">·</span>
                <span>
                  总容量 {justCompletedLog.totalVolume.toLocaleString()} {unit}
                </span>
                <span aria-hidden="true">·</span>
                <span>用时 {justCompletedLog.durationMinutes} 分钟</span>
              </div>
              {justCompletedLog.prExercises.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[#15803D]">
                  <Award className="w-4 h-4 shrink-0" />
                  <span>
                    突破个人最佳力量纪录 (1RM)：
                    <strong className="font-semibold ml-1">
                      {justCompletedLog.prExercises.join('、')}
                    </strong>
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setJustCompletedLog(null)}
              className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              收起摘要
            </button>
          </div>
        </div>
      )}

      {/* Daily Plan Generator & Split Selector Studio Panel */}
      <section className="bg-white border border-[#E5E5E0] rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
                <span>当前周期方案：{program.name}</span>
                <span aria-hidden="true">·</span>
                <span>按历史表现智能渐进超负荷</span>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#181816]">
                今日训练计划与实时打卡
              </h1>
            </div>

            {/* Segmented Split Selector */}
            <div>
              <label className="block text-xs font-medium text-[#6B6B66] mb-2">
                选择今日目标分化（系统已按上次训练进度自动顺延推荐）
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {program.splits.map((split) => {
                  const isSelected = split.id === (selectedSplit?.id || '');
                  const isRecommended = split.id === recommendedSplitId;
                  return (
                    <button
                      key={split.id}
                      type="button"
                      onClick={() => setSelectedSplitId(split.id)}
                      className={`min-h-[42px] px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#181816] text-white border-[#181816]'
                          : 'bg-[#FAFAF8] text-[#181816] border-[#E5E5E0] hover:bg-[#F0F0EC]'
                      }`}
                    >
                      <span>{split.name}</span>
                      {isRecommended && (
                        <span
                          className={`ml-2 text-xs font-normal ${
                            isSelected ? 'text-stone-300' : 'text-[#15803D]'
                          }`}
                        >
                          · 今日轮转
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Readiness / Focus Input */}
            <div className="max-w-2xl">
              <label
                htmlFor="readiness-input"
                className="block text-xs font-medium text-[#6B6B66] mb-1.5"
              >
                今日状态或调整偏好（可选，供 AI 定制今日重量与组数）
              </label>
              <input
                id="readiness-input"
                type="text"
                value={readinessNote}
                onChange={(e) => setReadinessNote(e.target.value)}
                placeholder="例如：睡眠充足想冲击重量 / 昨晚没睡好希望微降容量 / 时间只有40分钟..."
                className="w-full h-11 px-3.5 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] placeholder:text-[#9B9B94] focus:outline-none focus:border-[#181816] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartFromTemplate}
              disabled={isGeneratingAI || !selectedSplit}
              className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              按本地规则快速载入
            </button>
            <button
              type="button"
              onClick={handleGenerateAISession}
              disabled={isGeneratingAI || !selectedSplit}
              className="min-h-[44px] px-5 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI 正在推演今日负重...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>AI 生成今日渐进计划</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="mt-4 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-[#B91C1C]">
            {aiError}
          </div>
        )}
      </section>

      {/* Loading Skeleton during AI generation */}
      {isGeneratingAI && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-[#E5E5E0] rounded-xl p-6 animate-pulse space-y-4"
            >
              <div className="h-5 w-48 bg-[#F0F0EC] rounded" />
              <div className="h-3.5 w-72 bg-[#F6F6F4] rounded" />
              <div className="space-y-2 pt-2">
                <div className="h-10 w-full bg-[#F6F6F4] rounded-lg" />
                <div className="h-10 w-full bg-[#F6F6F4] rounded-lg" />
                <div className="h-10 w-full bg-[#F6F6F4] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rest Timer Bar */}
      {restTimer && (
        <RestTimerBar
          remainingSeconds={restTimer.remainingSeconds}
          totalSeconds={restTimer.totalSeconds}
          isRunning={restTimer.isRunning}
          exerciseName={restTimer.exerciseName}
          onTogglePause={onTogglePauseTimer}
          onAdjustSeconds={onAdjustTimer}
          onDismiss={onDismissTimer}
        />
      )}

      {/* Active Workout Session Logger */}
      {!isGeneratingAI && activeSession ? (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E5E0]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B66]">
                  <span>进行中课表</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatReadableDate(activeSession.date)}
                  </span>
                </div>
                <h2 className="mt-0.5 text-lg font-semibold text-[#181816]">
                  {activeSession.splitName}
                </h2>
                {activeSession.coachSummary && (
                  <p className="mt-1 text-sm text-[#6B6B66] max-w-3xl">
                    {activeSession.coachSummary}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onToggleUnit}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-mono font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  单位: {unit.toUpperCase()}
                </button>
                {confirmReset ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSession(null);
                        setConfirmReset(false);
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-white bg-[#B91C1C] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      确认放弃草稿
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-[#6B6B66] bg-[#F6F6F4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="min-h-[40px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-[#6B6B66] hover:text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>重置草稿</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <div className="text-xs text-[#6B6B66]">已完成组数</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
                  {sessionStats.completedSets}{' '}
                  <span className="text-sm font-normal text-[#9B9B94]">
                    / {sessionStats.totalSets} 组
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6B6B66]">当前已完成容量</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
                  {sessionStats.completedVolume.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-[#9B9B94]">{unit}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6B6B66]">训练动作数</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
                  {activeSession.exercises.length}{' '}
                  <span className="text-sm font-normal text-[#9B9B94]">项</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6B6B66]">预计剩余时间</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
                  {sessionStats.remainingMinutes}{' '}
                  <span className="text-sm font-normal text-[#9B9B94]">分钟</span>
                </div>
              </div>
            </div>
          </div>

          {/* Exercise Logger Cards */}
          <div className="space-y-4">
            {activeSession.exercises.map((ex, exIndex) => {
              const completedCount = ex.sets.filter((s) => s.completed).length;
              return (
                <article
                  key={ex.id}
                  className="bg-white border border-[#E5E5E0] rounded-xl p-5 sm:p-6"
                >
                  {/* Card Header: Zero-Pill Metadata Discipline */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5E5E0]">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B66]">
                        <span className="font-mono tabular-nums">
                          {String(exIndex + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ex.muscleGroup}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ex.equipment}</span>
                        <span aria-hidden="true">·</span>
                        <span>目标 {ex.targetRepsLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          间歇 {ex.restSeconds}s
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-[#181816]">
                        {ex.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs">
                        {ex.previousSummary ? (
                          <span className="font-mono tabular-nums text-[#6B6B66]">
                            {ex.previousSummary}
                          </span>
                        ) : (
                          <span className="text-[#9B9B94]">暂无既往同动作记录</span>
                        )}

                        {ex.aiReason && (
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              ex.overloadAction === 'increase_weight' ||
                              ex.overloadAction === 'increase_reps'
                                ? 'text-[#15803D]'
                                : ex.overloadAction === 'deload'
                                  ? 'text-[#B45309]'
                                  : 'text-[#6B6B66]'
                            }`}
                          >
                            {(ex.overloadAction === 'increase_weight' ||
                              ex.overloadAction === 'increase_reps') && (
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {ex.overloadAction === 'deload' && (
                              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{ex.aiReason}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-[#6B6B66]">
                        已完成 {completedCount}/{ex.sets.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(ex.id)}
                        aria-label={`移除动作 ${ex.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#9B9B94] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* High-Density Set Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-medium text-[#6B6B66] border-b border-[#F0F0EC]">
                          <th className="py-2 pr-3 w-20">组别</th>
                          <th className="py-2 px-3">重量 ({unit})</th>
                          <th className="py-2 px-3">完成次数</th>
                          <th className="py-2 px-3 hidden sm:table-cell">估算 1RM</th>
                          <th className="py-2 px-3 hidden md:table-cell">RPE 疲劳度</th>
                          <th className="py-2 pl-3 text-right w-28">打卡状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F0EC]">
                        {ex.sets.map((s) => {
                          const e1rm = calculateEstimated1RM(s.weight, s.reps);
                          return (
                            <tr
                              key={s.id}
                              className={`transition-colors ${
                                s.completed ? 'bg-[#15803D]/[0.04]' : 'hover:bg-[#FAFAF8]'
                              }`}
                            >
                              {/* Set Number & Warmup/Working toggle */}
                              <td className="py-2.5 pr-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateExerciseSet(ex.id, s.id, (prev) => ({
                                      ...prev,
                                      type: prev.type === 'working' ? 'warmup' : 'working',
                                    }))
                                  }
                                  title="点击切换正式组/热身组"
                                  className="min-h-[40px] px-2.5 rounded-md bg-[#F6F6F4] hover:bg-[#EAEAE5] text-xs font-mono tabular-nums font-medium text-[#181816] whitespace-nowrap cursor-pointer"
                                >
                                  {s.type === 'warmup' ? `热身 ${s.setNumber}` : `第 ${s.setNumber} 组`}
                                </button>
                              </td>

                              {/* Weight Input with Stepper */}
                              <td className="py-2.5 px-3">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        weight: Math.max(0, Math.round((prev.weight - 2.5) * 100) / 100),
                                      }))
                                    }
                                    aria-label="减少 2.5 重量"
                                    className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#F6F6F4] hover:bg-[#EAEAE5] text-[#181816] cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={s.weight}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        weight: Number.isNaN(val) ? 0 : Math.max(0, val),
                                      }));
                                    }}
                                    aria-label={`${ex.name} 第 ${s.setNumber} 组重量`}
                                    className="w-20 h-10 px-2 text-center font-mono text-sm font-medium tabular-nums bg-white border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        weight: Math.round((prev.weight + 2.5) * 100) / 100,
                                      }))
                                    }
                                    aria-label="增加 2.5 重量"
                                    className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#F6F6F4] hover:bg-[#EAEAE5] text-[#181816] cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Reps Input with Stepper */}
                              <td className="py-2.5 px-3">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        reps: Math.max(1, prev.reps - 1),
                                      }))
                                    }
                                    aria-label="减少 1 次"
                                    className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#F6F6F4] hover:bg-[#EAEAE5] text-[#181816] cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={s.reps}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        reps: Number.isNaN(val) ? 1 : Math.max(1, val),
                                      }));
                                    }}
                                    aria-label={`${ex.name} 第 ${s.setNumber} 组次数`}
                                    className="w-16 h-10 px-2 text-center font-mono text-sm font-medium tabular-nums bg-white border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateExerciseSet(ex.id, s.id, (prev) => ({
                                        ...prev,
                                        reps: prev.reps + 1,
                                      }))
                                    }
                                    aria-label="增加 1 次"
                                    className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#F6F6F4] hover:bg-[#EAEAE5] text-[#181816] cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Estimated 1RM */}
                              <td className="py-2.5 px-3 hidden sm:table-cell font-mono text-xs tabular-nums text-[#6B6B66]">
                                {e1rm > 0 ? `${e1rm} ${unit}` : '—'}
                              </td>

                              {/* RPE Selector */}
                              <td className="py-2.5 px-3 hidden md:table-cell">
                                <select
                                  value={s.rpe ?? 8}
                                  onChange={(e) =>
                                    updateExerciseSet(ex.id, s.id, (prev) => ({
                                      ...prev,
                                      rpe: parseFloat(e.target.value),
                                    }))
                                  }
                                  aria-label="RPE 主观疲劳度"
                                  className="h-10 px-2.5 font-mono text-xs tabular-nums bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                                >
                                  <option value={6.5}>RPE 6.5 (轻松)</option>
                                  <option value={7.5}>RPE 7.5 (余2-3次)</option>
                                  <option value={8}>RPE 8.0 (余2次)</option>
                                  <option value={8.5}>RPE 8.5 (余1-2次)</option>
                                  <option value={9}>RPE 9.0 (余1次)</option>
                                  <option value={9.5}>RPE 9.5 (接近力竭)</option>
                                  <option value={10}>RPE 10 (完全力竭)</option>
                                </select>
                              </td>

                              {/* Complete Set Check + Remove Set */}
                              <td className="py-2.5 pl-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSetComplete(ex, s.id)}
                                    className={`min-h-[40px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                                      s.completed
                                        ? 'bg-[#15803D] text-white'
                                        : 'bg-[#F6F6F4] text-[#181816] hover:bg-[#EAEAE5]'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{s.completed ? '已完成' : '打卡'}</span>
                                  </button>
                                  {ex.sets.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSet(ex.id, s.id)}
                                      aria-label="删除该组"
                                      className="min-h-[40px] min-w-[36px] flex items-center justify-center text-[#9B9B94] hover:text-[#B91C1C] rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Exercise Footer Controls */}
                  <div className="mt-4 pt-3 border-t border-[#F0F0EC] flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddSet(ex.id)}
                      className="min-h-[40px] px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加一组</span>
                    </button>

                    <input
                      type="text"
                      value={ex.notes || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateSession({
                          ...activeSession,
                          exercises: activeSession.exercises.map((item) =>
                            item.id === ex.id ? { ...item, notes: val } : item
                          ),
                        });
                      }}
                      placeholder="添加本动作备注（如握距、座椅档位、发力感受）..."
                      className="flex-1 min-w-[220px] h-9 px-3 text-xs bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] placeholder:text-[#9B9B94] focus:outline-none focus:border-[#181816]"
                    />
                  </div>
                </article>
              );
            })}
          </div>

          {/* Add Temporary Custom Exercise Section */}
          <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
            {showAddExercise ? (
              <form onSubmit={handleAddCustomExercise} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#181816]">
                    临时加练动作（加入今日记录）
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddExercise(false)}
                    className="text-xs text-[#6B6B66] hover:text-[#181816] cursor-pointer"
                  >
                    收起
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <input
                    type="text"
                    required
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    placeholder="动作名称（如：蝴蝶机夹胸）"
                    className="h-10 px-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg focus:outline-none focus:border-[#181816]"
                  />
                  <select
                    value={newExMuscle}
                    onChange={(e) => setNewExMuscle(e.target.value as MuscleGroup)}
                    className="h-10 px-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg focus:outline-none focus:border-[#181816]"
                  >
                    {MUSCLE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newExEquipment}
                    onChange={(e) => setNewExEquipment(e.target.value)}
                    placeholder="器械（如：固定器械）"
                    className="h-10 px-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg focus:outline-none focus:border-[#181816]"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newExWeight}
                    onChange={(e) => setNewExWeight(e.target.value)}
                    placeholder={`重量 (${unit})`}
                    className="h-10 px-3 font-mono text-sm tabular-nums bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg focus:outline-none focus:border-[#181816]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 text-sm font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    确认加入课表
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddExercise(true)}
                className="min-h-[44px] w-full flex items-center justify-center gap-2 text-sm font-medium text-[#181816] bg-[#FAFAF8] hover:bg-[#F0F0EC] border border-dashed border-[#D4D4CE] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>临时新增今日加练动作</span>
              </button>
            )}
          </div>

          {/* Session Notes & Complete Workout Footer */}
          <div className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-4">
            <div>
              <label
                htmlFor="session-notes"
                className="block text-xs font-medium text-[#6B6B66] mb-1.5"
              >
                今日训练总结备注（可选）
              </label>
              <textarea
                id="session-notes"
                rows={2}
                value={activeSession.sessionNotes}
                onChange={(e) =>
                  onUpdateSession({ ...activeSession, sessionNotes: e.target.value })
                }
                placeholder="记录今日整体泵感、体能状态或下次需要注意的技术细节..."
                className="w-full p-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] placeholder:text-[#9B9B94] focus:outline-none focus:border-[#181816]"
              />
            </div>

            {validationHint && (
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-sm text-[#B45309]">
                {validationHint}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="text-xs text-[#6B6B66]">
                每组打卡进度已实时自动保存在当前浏览器本地，刷新页面不会丢失。
              </div>
              <button
                type="button"
                onClick={handleFinishSession}
                className="min-h-[48px] px-6 py-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>完成今日训练并归档</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        !isGeneratingAI &&
        selectedSplit && (
          /* Preview of Selected Split before starting */
          <div className="bg-white border border-[#E5E5E0] rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E5E0]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
                  <span>课表预览</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedSplit.focus}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    预计 {selectedSplit.estimatedMinutes} 分钟
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-semibold text-[#181816]">
                  {selectedSplit.name}
                </h2>
              </div>
              <span className="text-xs text-[#6B6B66]">
                点击上方「AI 生成今日渐进计划」开始记录
              </span>
            </div>

            <div className="divide-y divide-[#F0F0EC] mt-2">
              {selectedSplit.exercises.map((ex, i) => {
                const prev = formatPreviousSummary(ex.name, logs, unit);
                return (
                  <div
                    key={ex.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs tabular-nums text-[#9B9B94]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-[#181816]">
                          {ex.name}
                        </span>
                        <span className="text-xs text-[#6B6B66]">
                          · {ex.muscleGroup} · {ex.equipment}
                        </span>
                      </div>
                      {ex.notes && (
                        <p className="mt-0.5 pl-7 text-xs text-[#9B9B94]">{ex.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-[#6B6B66] shrink-0">
                      {prev && <span>{prev}</span>}
                      <span className="text-[#181816] font-medium">
                        {ex.targetSets} 组 × {ex.minReps}-{ex.maxReps} 次
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
