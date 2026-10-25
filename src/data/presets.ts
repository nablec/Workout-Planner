import type { WorkoutLog, WorkoutProgram } from '../types';
import { calculateEstimated1RM, formatDateISO } from '../utils/fitnessMath';

function daysAgoISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDateISO(d);
}

export const PRESET_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'prog_ppl_classic',
    name: '经典推拉腿三分化 (PPL 渐进力量方案)',
    description: '兼顾三大项基础力量与肌肥大容量的经典三分化循环，适合每周训练 3–6 天。',
    updatedAt: formatDateISO(),
    splits: [
      {
        id: 'split_push',
        name: '推日 A · 胸肩三头',
        focus: '胸部 · 肩部前中束 · 肱三头肌',
        estimatedMinutes: 60,
        exercises: [
          {
            id: 'ex_bench',
            name: '杠铃平板卧推',
            muscleGroup: '胸部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 6,
            maxReps: 8,
            baselineWeight: 70,
            restSeconds: 150,
            notes: '肩胛骨收紧下沉，杠铃下放至下胸轻触',
          },
          {
            id: 'ex_incline_db',
            name: '上斜哑铃卧推',
            muscleGroup: '胸部',
            equipment: '哑铃',
            targetSets: 3,
            minReps: 8,
            maxReps: 12,
            baselineWeight: 26,
            restSeconds: 120,
            notes: '30度斜板，控制离心下放 2 秒',
          },
          {
            id: 'ex_ohp',
            name: '坐姿哑铃推举',
            muscleGroup: '肩部',
            equipment: '哑铃',
            targetSets: 3,
            minReps: 8,
            maxReps: 10,
            baselineWeight: 20,
            restSeconds: 120,
            notes: '小臂垂直地面，核心收紧避免过度反弓',
          },
          {
            id: 'ex_lat_raise',
            name: '哑铃侧平举',
            muscleGroup: '肩部',
            equipment: '哑铃',
            targetSets: 4,
            minReps: 12,
            maxReps: 15,
            baselineWeight: 10,
            restSeconds: 75,
            notes: '肘部微屈，手肘领起至与肩同高',
          },
          {
            id: 'ex_tricep_rope',
            name: '绳索肱三头肌下压',
            muscleGroup: '手臂',
            equipment: '绳索',
            targetSets: 3,
            minReps: 10,
            maxReps: 14,
            baselineWeight: 25,
            restSeconds: 75,
            notes: '大臂贴紧身体两侧，底端向外分开顶峰收缩',
          },
        ],
      },
      {
        id: 'split_pull',
        name: '拉日 B · 背部与二头',
        focus: '背阔肌 · 上背中下斜方 · 肱二头肌',
        estimatedMinutes: 55,
        exercises: [
          {
            id: 'ex_bb_row',
            name: '俯身杠铃划船',
            muscleGroup: '背部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 6,
            maxReps: 10,
            baselineWeight: 70,
            restSeconds: 135,
            notes: '髋铰链俯身约45度，拉向下腹位置',
          },
          {
            id: 'ex_lat_pulldown',
            name: '宽距高位下拉',
            muscleGroup: '背部',
            equipment: '固定器械',
            targetSets: 4,
            minReps: 8,
            maxReps: 12,
            baselineWeight: 55,
            restSeconds: 105,
            notes: '先沉肩再拉肘，挺胸迎接横杆至锁骨上方',
          },
          {
            id: 'ex_cable_row',
            name: '坐姿窄距划船',
            muscleGroup: '背部',
            equipment: '绳索',
            targetSets: 3,
            minReps: 10,
            maxReps: 12,
            baselineWeight: 50,
            restSeconds: 90,
            notes: '顶峰挤压肩胛骨 1 秒，放回时充分拉伸背阔肌',
          },
          {
            id: 'ex_face_pull',
            name: '绳索面拉',
            muscleGroup: '肩部',
            equipment: '绳索',
            targetSets: 3,
            minReps: 12,
            maxReps: 15,
            baselineWeight: 20,
            restSeconds: 75,
            notes: '拉向额头两侧同时做肩外旋，强化三角肌后束',
          },
          {
            id: 'ex_db_curl',
            name: '交替哑铃弯举',
            muscleGroup: '手臂',
            equipment: '哑铃',
            targetSets: 3,
            minReps: 10,
            maxReps: 12,
            baselineWeight: 14,
            restSeconds: 75,
            notes: '避免身体晃动借力，控制下放节奏',
          },
        ],
      },
      {
        id: 'split_legs',
        name: '腿日 C · 下肢与核心',
        focus: '股四头肌 · 腘绳肌 · 臀大肌 · 核心',
        estimatedMinutes: 65,
        exercises: [
          {
            id: 'ex_squat',
            name: '杠铃颈后深蹲',
            muscleGroup: '腿部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 5,
            maxReps: 8,
            baselineWeight: 95,
            restSeconds: 180,
            notes: '腹式呼吸绷紧核心，蹲至大腿平行地面以下',
          },
          {
            id: 'ex_rdl',
            name: '罗马尼亚硬拉',
            muscleGroup: '腿部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 8,
            maxReps: 10,
            baselineWeight: 85,
            restSeconds: 135,
            notes: '杠铃贴腿下放，感受腘绳肌与臀部充分牵拉',
          },
          {
            id: 'ex_leg_press',
            name: '倒蹬机腿举',
            muscleGroup: '腿部',
            equipment: '固定器械',
            targetSets: 3,
            minReps: 10,
            maxReps: 12,
            baselineWeight: 140,
            restSeconds: 120,
            notes: '下背部始终贴紧靠垫，顶端膝关节微屈不锁死',
          },
          {
            id: 'ex_leg_curl',
            name: '俯卧器械腿弯举',
            muscleGroup: '腿部',
            equipment: '固定器械',
            targetSets: 3,
            minReps: 10,
            maxReps: 15,
            baselineWeight: 40,
            restSeconds: 90,
            notes: '髋部贴实垫面，慢放快收',
          },
          {
            id: 'ex_hanging_raise',
            name: '悬垂举腿',
            muscleGroup: '核心',
            equipment: '自重',
            targetSets: 3,
            minReps: 10,
            maxReps: 15,
            baselineWeight: 0,
            restSeconds: 60,
            notes: '骨盆后倾卷腹带动抬腿，避免惯性摆荡',
          },
        ],
      },
    ],
  },
  {
    id: 'prog_upper_lower',
    name: '上下肢四分化 (Upper / Lower 均衡进阶)',
    description: '每周 4 练的高效率力量肌肥大方案，大肌群每周保持两次最佳刺激频次。',
    updatedAt: formatDateISO(),
    splits: [
      {
        id: 'ul_upper_a',
        name: '上肢力量日 A',
        focus: '胸部 · 背部厚度 · 肩部 · 手臂',
        estimatedMinutes: 55,
        exercises: [
          {
            id: 'ul_bench',
            name: '杠铃平板卧推',
            muscleGroup: '胸部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 5,
            maxReps: 8,
            baselineWeight: 72.5,
            restSeconds: 150,
          },
          {
            id: 'ul_row',
            name: '俯身杠铃划船',
            muscleGroup: '背部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 6,
            maxReps: 8,
            baselineWeight: 70,
            restSeconds: 135,
          },
          {
            id: 'ul_ohp',
            name: '坐姿哑铃推举',
            muscleGroup: '肩部',
            equipment: '哑铃',
            targetSets: 3,
            minReps: 8,
            maxReps: 10,
            baselineWeight: 20,
            restSeconds: 120,
          },
          {
            id: 'ul_pulldown',
            name: '宽距高位下拉',
            muscleGroup: '背部',
            equipment: '固定器械',
            targetSets: 3,
            minReps: 8,
            maxReps: 12,
            baselineWeight: 55,
            restSeconds: 105,
          },
        ],
      },
      {
        id: 'ul_lower_a',
        name: '下肢力量日 B',
        focus: '股四头肌 · 臀腿后链 · 核心稳定',
        estimatedMinutes: 60,
        exercises: [
          {
            id: 'ul_squat',
            name: '杠铃颈后深蹲',
            muscleGroup: '腿部',
            equipment: '杠铃',
            targetSets: 4,
            minReps: 5,
            maxReps: 8,
            baselineWeight: 95,
            restSeconds: 180,
          },
          {
            id: 'ul_rdl',
            name: '罗马尼亚硬拉',
            muscleGroup: '腿部',
            equipment: '杠铃',
            targetSets: 3,
            minReps: 8,
            maxReps: 10,
            baselineWeight: 85,
            restSeconds: 135,
          },
          {
            id: 'ul_press',
            name: '倒蹬机腿举',
            muscleGroup: '腿部',
            equipment: '固定器械',
            targetSets: 3,
            minReps: 10,
            maxReps: 12,
            baselineWeight: 140,
            restSeconds: 120,
          },
          {
            id: 'ul_plank',
            name: '悬垂举腿',
            muscleGroup: '核心',
            equipment: '自重',
            targetSets: 3,
            minReps: 12,
            maxReps: 15,
            baselineWeight: 0,
            restSeconds: 60,
          },
        ],
      },
    ],
  },
];

export const SAMPLE_PASTE_TEXT = `周一 推胸+肩+三头：
1. 杠铃平板卧推 4组 6-8次 目前75kg
2. 上斜哑铃卧推 3组 8-12次 单手28kg
3. 坐姿哑铃推肩 3组 8-10次 22kg
4. 哑铃侧平举 4组 12-15次 10kg
5. 绳索下压 3组 12次 25kg

周三 拉背+二头：
1. 宽距高位下拉 4组 8-12次 60kg
2. 俯身杠铃划船 4组 8-10次 72.5kg
3. 坐姿器械划船 3组 10-12次 55kg
4. 绳索面拉 3组 15次 20kg
5. 杠铃弯举 3组 10-12次 30kg

周五 臀腿训练：
1. 杠铃深蹲 4组 5-8次 100kg
2. 罗马尼亚硬拉 4组 8-10次 90kg
3. 保加利亚分腿蹲 3组 10次 18kg
4. 器械腿弯举 3组 12-15次 45kg`;

function makeSampleExercise(
  id: string,
  name: string,
  muscleGroup: WorkoutLog['exercises'][0]['muscleGroup'],
  equipment: string,
  setsSpec: Array<{ weight: number; reps: number; rpe?: number }>
): WorkoutLog['exercises'][0] {
  let bestWeight = 0;
  let bestEstimated1RM = 0;
  let totalVolume = 0;

  const sets = setsSpec.map((spec, idx) => {
    if (spec.weight > bestWeight) bestWeight = spec.weight;
    const e1rm = calculateEstimated1RM(spec.weight, spec.reps);
    if (e1rm > bestEstimated1RM) bestEstimated1RM = e1rm;
    totalVolume += spec.weight * spec.reps;
    return {
      id: `${id}_s${idx + 1}`,
      setNumber: idx + 1,
      type: 'working' as const,
      weight: spec.weight,
      reps: spec.reps,
      rpe: spec.rpe ?? 8,
      completed: true,
    };
  });

  return {
    id,
    name,
    muscleGroup,
    equipment,
    sets,
    bestWeight,
    bestEstimated1RM,
    totalVolume: Math.round(totalVolume),
  };
}

function buildWorkoutLog(
  id: string,
  daysAgo: number,
  splitId: string,
  splitName: string,
  durationMinutes: number,
  prExercises: string[],
  notes: string,
  exercises: WorkoutLog['exercises']
): WorkoutLog {
  const totalVolume = exercises.reduce((sum, e) => sum + e.totalVolume, 0);
  const totalWorkingSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  return {
    id,
    date: daysAgoISO(daysAgo),
    splitId,
    splitName,
    durationMinutes,
    totalVolume,
    totalWorkingSets,
    prCount: prExercises.length,
    prExercises,
    notes,
    exercises,
  };
}

/**
 * Realistic 5-week progressive training history so trend charts and
 * progressive overload recommendations are immediately meaningful on first visit.
 */
export function createInitialSampleLogs(): WorkoutLog[] {
  return [
    buildWorkoutLog(
      'sample_log_1',
      30,
      'split_push',
      '推日 A · 胸肩三头',
      58,
      [],
      '周期第一周基准测试，动作节奏稳定',
      [
        makeSampleExercise('sl1_1', '杠铃平板卧推', '胸部', '杠铃', [
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 7 },
          { weight: 67.5, reps: 7 },
        ]),
        makeSampleExercise('sl1_2', '上斜哑铃卧推', '胸部', '哑铃', [
          { weight: 24, reps: 10 },
          { weight: 24, reps: 10 },
          { weight: 24, reps: 9 },
        ]),
        makeSampleExercise('sl1_3', '坐姿哑铃推举', '肩部', '哑铃', [
          { weight: 18, reps: 10 },
          { weight: 18, reps: 9 },
          { weight: 18, reps: 9 },
        ]),
        makeSampleExercise('sl1_4', '哑铃侧平举', '肩部', '哑铃', [
          { weight: 8, reps: 15 },
          { weight: 8, reps: 14 },
          { weight: 8, reps: 14 },
          { weight: 8, reps: 12 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_2',
      27,
      'split_pull',
      '拉日 B · 背部与二头',
      54,
      [],
      '背部发力感清晰，握力稳定',
      [
        makeSampleExercise('sl2_1', '俯身杠铃划船', '背部', '杠铃', [
          { weight: 65, reps: 9 },
          { weight: 65, reps: 8 },
          { weight: 65, reps: 8 },
          { weight: 65, reps: 8 },
        ]),
        makeSampleExercise('sl2_2', '宽距高位下拉', '背部', '固定器械', [
          { weight: 50, reps: 11 },
          { weight: 50, reps: 10 },
          { weight: 50, reps: 10 },
          { weight: 50, reps: 10 },
        ]),
        makeSampleExercise('sl2_3', '坐姿窄距划船', '背部', '绳索', [
          { weight: 45, reps: 12 },
          { weight: 45, reps: 12 },
          { weight: 45, reps: 11 },
        ]),
        makeSampleExercise('sl2_4', '交替哑铃弯举', '手臂', '哑铃', [
          { weight: 12, reps: 12 },
          { weight: 12, reps: 12 },
          { weight: 12, reps: 10 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_3',
      24,
      'split_legs',
      '腿日 C · 下肢与核心',
      64,
      [],
      '深蹲深度达标，核心稳定无塌腰',
      [
        makeSampleExercise('sl3_1', '杠铃颈后深蹲', '腿部', '杠铃', [
          { weight: 90, reps: 7 },
          { weight: 90, reps: 7 },
          { weight: 90, reps: 6 },
          { weight: 90, reps: 6 },
        ]),
        makeSampleExercise('sl3_2', '罗马尼亚硬拉', '腿部', '杠铃', [
          { weight: 80, reps: 9 },
          { weight: 80, reps: 9 },
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
        ]),
        makeSampleExercise('sl3_3', '倒蹬机腿举', '腿部', '固定器械', [
          { weight: 130, reps: 12 },
          { weight: 130, reps: 11 },
          { weight: 130, reps: 10 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_4',
      20,
      'split_push',
      '推日 A · 胸肩三头',
      60,
      ['杠铃平板卧推'],
      '卧推 67.5kg 全部满 8 次，下次准备上 70kg',
      [
        makeSampleExercise('sl4_1', '杠铃平板卧推', '胸部', '杠铃', [
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 8 },
        ]),
        makeSampleExercise('sl4_2', '上斜哑铃卧推', '胸部', '哑铃', [
          { weight: 24, reps: 12 },
          { weight: 24, reps: 11 },
          { weight: 24, reps: 10 },
        ]),
        makeSampleExercise('sl4_3', '坐姿哑铃推举', '肩部', '哑铃', [
          { weight: 20, reps: 8 },
          { weight: 20, reps: 8 },
          { weight: 20, reps: 8 },
        ]),
        makeSampleExercise('sl4_4', '绳索肱三头肌下压', '手臂', '绳索', [
          { weight: 22.5, reps: 12 },
          { weight: 22.5, reps: 12 },
          { weight: 22.5, reps: 11 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_5',
      17,
      'split_pull',
      '拉日 B · 背部与二头',
      56,
      ['俯身杠铃划船', '宽距高位下拉'],
      '划船加至 67.5kg 表现稳健',
      [
        makeSampleExercise('sl5_1', '俯身杠铃划船', '背部', '杠铃', [
          { weight: 67.5, reps: 9 },
          { weight: 67.5, reps: 9 },
          { weight: 67.5, reps: 8 },
          { weight: 67.5, reps: 8 },
        ]),
        makeSampleExercise('sl5_2', '宽距高位下拉', '背部', '固定器械', [
          { weight: 55, reps: 10 },
          { weight: 55, reps: 10 },
          { weight: 55, reps: 9 },
          { weight: 55, reps: 9 },
        ]),
        makeSampleExercise('sl5_3', '绳索面拉', '肩部', '绳索', [
          { weight: 20, reps: 15 },
          { weight: 20, reps: 14 },
          { weight: 20, reps: 14 },
        ]),
        makeSampleExercise('sl5_4', '交替哑铃弯举', '手臂', '哑铃', [
          { weight: 14, reps: 10 },
          { weight: 14, reps: 10 },
          { weight: 14, reps: 9 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_6',
      13,
      'split_legs',
      '腿日 C · 下肢与核心',
      66,
      ['杠铃颈后深蹲', '罗马尼亚硬拉'],
      '深蹲突破 95kg 正式组，状态充沛',
      [
        makeSampleExercise('sl6_1', '杠铃颈后深蹲', '腿部', '杠铃', [
          { weight: 95, reps: 7 },
          { weight: 95, reps: 7 },
          { weight: 95, reps: 6 },
          { weight: 95, reps: 6 },
        ]),
        makeSampleExercise('sl6_2', '罗马尼亚硬拉', '腿部', '杠铃', [
          { weight: 85, reps: 9 },
          { weight: 85, reps: 8 },
          { weight: 85, reps: 8 },
          { weight: 85, reps: 8 },
        ]),
        makeSampleExercise('sl6_3', '倒蹬机腿举', '腿部', '固定器械', [
          { weight: 140, reps: 11 },
          { weight: 140, reps: 11 },
          { weight: 140, reps: 10 },
        ]),
        makeSampleExercise('sl6_4', '俯卧器械腿弯举', '腿部', '固定器械', [
          { weight: 40, reps: 12 },
          { weight: 40, reps: 12 },
          { weight: 40, reps: 11 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_7',
      9,
      'split_push',
      '推日 A · 胸肩三头',
      59,
      ['杠铃平板卧推', '上斜哑铃卧推'],
      '卧推 70kg 4×8 全部高质量达标！',
      [
        makeSampleExercise('sl7_1', '杠铃平板卧推', '胸部', '杠铃', [
          { weight: 70, reps: 8, rpe: 8 },
          { weight: 70, reps: 8, rpe: 8 },
          { weight: 70, reps: 8, rpe: 8.5 },
          { weight: 70, reps: 8, rpe: 8.5 },
        ]),
        makeSampleExercise('sl7_2', '上斜哑铃卧推', '胸部', '哑铃', [
          { weight: 26, reps: 10, rpe: 8 },
          { weight: 26, reps: 10, rpe: 8.5 },
          { weight: 26, reps: 9, rpe: 8.5 },
        ]),
        makeSampleExercise('sl7_3', '坐姿哑铃推举', '肩部', '哑铃', [
          { weight: 20, reps: 10, rpe: 8 },
          { weight: 20, reps: 10, rpe: 8.5 },
          { weight: 20, reps: 9, rpe: 9 },
        ]),
        makeSampleExercise('sl7_4', '哑铃侧平举', '肩部', '哑铃', [
          { weight: 10, reps: 14 },
          { weight: 10, reps: 14 },
          { weight: 10, reps: 13 },
          { weight: 10, reps: 12 },
        ]),
        makeSampleExercise('sl7_5', '绳索肱三头肌下压', '手臂', '绳索', [
          { weight: 25, reps: 12 },
          { weight: 25, reps: 12 },
          { weight: 25, reps: 11 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_8',
      6,
      'split_pull',
      '拉日 B · 背部与二头',
      57,
      ['俯身杠铃划船'],
      '划船 70kg 控制良好，背阔肌泵感明显',
      [
        makeSampleExercise('sl8_1', '俯身杠铃划船', '背部', '杠铃', [
          { weight: 70, reps: 9, rpe: 8 },
          { weight: 70, reps: 9, rpe: 8 },
          { weight: 70, reps: 8, rpe: 8.5 },
          { weight: 70, reps: 8, rpe: 8.5 },
        ]),
        makeSampleExercise('sl8_2', '宽距高位下拉', '背部', '固定器械', [
          { weight: 55, reps: 12, rpe: 8 },
          { weight: 55, reps: 12, rpe: 8 },
          { weight: 55, reps: 11, rpe: 8.5 },
          { weight: 55, reps: 10, rpe: 8.5 },
        ]),
        makeSampleExercise('sl8_3', '坐姿窄距划船', '背部', '绳索', [
          { weight: 50, reps: 12 },
          { weight: 50, reps: 11 },
          { weight: 50, reps: 11 },
        ]),
        makeSampleExercise('sl8_4', '交替哑铃弯举', '手臂', '哑铃', [
          { weight: 14, reps: 12 },
          { weight: 14, reps: 11 },
          { weight: 14, reps: 10 },
        ]),
      ]
    ),
    buildWorkoutLog(
      'sample_log_9',
      3,
      'split_legs',
      '腿日 C · 下肢与核心',
      65,
      ['杠铃颈后深蹲', '倒蹬机腿举'],
      '深蹲 97.5kg 全部站稳，下周推日轮转',
      [
        makeSampleExercise('sl9_1', '杠铃颈后深蹲', '腿部', '杠铃', [
          { weight: 97.5, reps: 8, rpe: 8 },
          { weight: 97.5, reps: 8, rpe: 8.5 },
          { weight: 97.5, reps: 7, rpe: 8.5 },
          { weight: 97.5, reps: 7, rpe: 9 },
        ]),
        makeSampleExercise('sl9_2', '罗马尼亚硬拉', '腿部', '杠铃', [
          { weight: 85, reps: 10, rpe: 8 },
          { weight: 85, reps: 10, rpe: 8 },
          { weight: 85, reps: 10, rpe: 8.5 },
          { weight: 85, reps: 9, rpe: 8.5 },
        ]),
        makeSampleExercise('sl9_3', '倒蹬机腿举', '腿部', '固定器械', [
          { weight: 145, reps: 12 },
          { weight: 145, reps: 12 },
          { weight: 145, reps: 11 },
        ]),
        makeSampleExercise('sl9_4', '悬垂举腿', '核心', '自重', [
          { weight: 0, reps: 14 },
          { weight: 0, reps: 13 },
          { weight: 0, reps: 12 },
        ]),
      ]
    ),
  ];
}
