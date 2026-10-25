export type MuscleGroup = '胸部' | '背部' | '腿部' | '肩部' | '手臂' | '核心' | '全身';

export type WeightUnit = 'kg' | 'lbs';

export type SetType = 'warmup' | 'working';

export interface PlanExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  targetSets: number;
  minReps: number;
  maxReps: number;
  baselineWeight: number;
  restSeconds: number;
  notes?: string;
}

export interface SplitDay {
  id: string;
  name: string;
  focus: string;
  estimatedMinutes: number;
  exercises: PlanExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  splits: SplitDay[];
}

export interface LoggedSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

export interface ActiveExerciseEntry {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  restSeconds: number;
  targetRepsLabel: string;
  aiReason?: string;
  overloadAction?: 'increase_weight' | 'increase_reps' | 'maintain' | 'deload';
  previousSummary?: string;
  notes?: string;
  sets: LoggedSet[];
}

export interface ActiveWorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  splitId: string;
  splitName: string;
  startedAt: string;
  coachSummary: string;
  readinessNote?: string;
  sessionNotes: string;
  exercises: ActiveExerciseEntry[];
}

export interface CompletedExerciseLog {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  notes?: string;
  sets: LoggedSet[];
  bestWeight: number;
  bestEstimated1RM: number;
  totalVolume: number;
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  splitId?: string;
  splitName: string;
  durationMinutes: number;
  totalVolume: number;
  totalWorkingSets: number;
  prCount: number;
  prExercises: string[];
  notes?: string;
  exercises: CompletedExerciseLog[];
}

export type AppTab = 'today' | 'program' | 'history' | 'analytics';
