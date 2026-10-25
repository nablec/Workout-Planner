import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import type { MuscleGroup, WeightUnit, WorkoutLog } from '../types';
import { formatDateISO, formatShortDate } from '../utils/fitnessMath';

interface AnalyticsViewProps {
  logs: WorkoutLog[];
  unit: WeightUnit;
  onNavigateToday: () => void;
}

type TimeRange = '4w' | '12w' | 'all';
type StrengthMetric = 'estimated1RM' | 'bestWeight' | 'volume';

const MUSCLE_ORDER: MuscleGroup[] = [
  '胸部',
  '背部',
  '腿部',
  '肩部',
  '手臂',
  '核心',
  '全身',
];

export function AnalyticsView({
  logs,
  unit,
  onNavigateToday,
}: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12w');
  const [strengthMetric, setStrengthMetric] = useState<StrengthMetric>('estimated1RM');

  // Filter logs by selected time window
  const filteredLogs = useMemo(() => {
    const sortedAsc = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    if (timeRange === 'all') return sortedAsc;
    const days = timeRange === '4w' ? 28 : 84;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = formatDateISO(cutoff);
    return sortedAsc.filter((l) => l.date >= cutoffISO);
  }, [logs, timeRange]);

  // Unique exercises ranked by frequency across filtered logs
  const exerciseFrequencyList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      for (const ex of log.exercises) {
        counts.set(ex.name, (counts.get(ex.name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [filteredLogs]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const activeExerciseName = useMemo(() => {
    if (
      selectedExercise &&
      exerciseFrequencyList.some((item) => item.name === selectedExercise)
    ) {
      return selectedExercise;
    }
    return exerciseFrequencyList[0]?.name || '';
  }, [selectedExercise, exerciseFrequencyList]);

  // 1. Exercise Progression Data Series
  const exerciseSeries = useMemo(() => {
    if (!activeExerciseName) return [];
    const target = activeExerciseName.trim().toLowerCase();
    const points: Array<{
      date: string;
      shortDate: string;
      estimated1RM: number;
      bestWeight: number;
      volume: number;
      topSetDetail: string;
    }> = [];

    for (const log of filteredLogs) {
      const match = log.exercises.find(
        (ex) => ex.name.trim().toLowerCase() === target
      );
      if (match) {
        const topSet =
          match.sets.length > 0
            ? match.sets.reduce((best, cur) =>
                cur.weight * (1 + cur.reps / 30) > best.weight * (1 + best.reps / 30)
                  ? cur
                  : best
              )
            : null;
        points.push({
          date: log.date,
          shortDate: formatShortDate(log.date),
          estimated1RM: match.bestEstimated1RM,
          bestWeight: match.bestWeight,
          volume: match.totalVolume,
          topSetDetail: topSet
            ? `${topSet.weight}${unit} × ${topSet.reps}次`
            : '—',
        });
      }
    }
    return points;
  }, [filteredLogs, activeExerciseName, unit]);

  // Calculate net progress for active exercise
  const progressionDelta = useMemo(() => {
    if (exerciseSeries.length < 2) return null;
    const first = exerciseSeries[0][strengthMetric];
    const last = exerciseSeries[exerciseSeries.length - 1][strengthMetric];
    if (first <= 0) return null;
    const diff = Math.round((last - first) * 10) / 10;
    const pct = Math.round(((last - first) / first) * 1000) / 10;
    return { diff, pct, first, last };
  }, [exerciseSeries, strengthMetric]);

  // 2. Session Total Volume Series
  const sessionVolumeSeries = useMemo(() => {
    return filteredLogs.map((l) => ({
      id: l.id,
      date: l.date,
      shortDate: formatShortDate(l.date),
      splitName: l.splitName,
      totalVolume: l.totalVolume,
      sets: l.totalWorkingSets,
    }));
  }, [filteredLogs]);

  // 3. Muscle Group Effective Sets Distribution
  const muscleDistribution = useMemo(() => {
    const map = new Map<MuscleGroup, number>();
    let totalSets = 0;
    for (const m of MUSCLE_ORDER) map.set(m, 0);

    for (const log of filteredLogs) {
      for (const ex of log.exercises) {
        const workingCount = ex.sets.filter((s) => s.type === 'working').length || ex.sets.length;
        map.set(ex.muscleGroup, (map.get(ex.muscleGroup) || 0) + workingCount);
        totalSets += workingCount;
      }
    }

    return MUSCLE_ORDER.map((muscle) => {
      const sets = map.get(muscle) || 0;
      const pct = totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0;
      return { muscle, sets, pct };
    }).filter((item) => item.sets > 0);
  }, [filteredLogs]);

  // 4. Last 28 Days Consistency Calendar Grid
  const consistencyDays = useMemo(() => {
    const logByDate = new Map<string, WorkoutLog>();
    for (const l of logs) {
      logByDate.set(l.date, l);
    }
    const grid: Array<{
      iso: string;
      dayNum: string;
      trained: boolean;
      splitName?: string;
      volume?: number;
    }> = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = formatDateISO(d);
      const match = logByDate.get(iso);
      grid.push({
        iso,
        dayNum: String(d.getDate()),
        trained: Boolean(match),
        splitName: match?.splitName,
        volume: match?.totalVolume,
      });
    }
    return grid;
  }, [logs]);

  // Aggregate KPI metrics
  const kpiSummary = useMemo(() => {
    const sessions = filteredLogs.length;
    const totalTonnage = filteredLogs.reduce((acc, l) => acc + l.totalVolume, 0);
    const totalPRs = filteredLogs.reduce((acc, l) => acc + l.prCount, 0);
    const avgSets =
      sessions > 0
        ? Math.round(
            (filteredLogs.reduce((acc, l) => acc + l.totalWorkingSets, 0) / sessions) * 10
          ) / 10
        : 0;
    return { sessions, totalTonnage, totalPRs, avgSets };
  }, [filteredLogs]);

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E0] rounded-xl p-10 text-center">
        <TrendingUp className="w-8 h-8 text-[#9B9B94] mx-auto" />
        <h2 className="mt-3 text-xl font-semibold text-[#181816]">
          暂无历史训练趋势数据
        </h2>
        <p className="mt-2 text-sm text-[#6B6B66] max-w-md mx-auto">
          完成并归档您的第一次训练后，这里将自动生成核心动作 1RM 进步曲线、训练容量柱状图与肌群均衡分析。
        </p>
        <button
          type="button"
          onClick={onNavigateToday}
          className="mt-5 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] rounded-lg transition-colors cursor-pointer"
        >
          前往记录今日训练
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Analytics Header + Segmented Time Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
            <span>长期量化追踪</span>
            <span aria-hidden="true">·</span>
            <span>Epley 估算 1RM 与周期容量演进</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#181816]">
            力量与训练容量趋势分析
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EAEAE5] rounded-lg">
          {(
            [
              { key: '4w', label: '近 4 周' },
              { key: '12w', label: '近 12 周' },
              { key: 'all', label: '全部记录' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTimeRange(opt.key)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeRange === opt.key
                  ? 'bg-white text-[#181816] shadow-xs'
                  : 'text-[#6B6B66] hover:text-[#181816]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column Studio KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
          <div className="text-xs text-[#6B6B66]">区间完成训练</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
            {kpiSummary.sessions}{' '}
            <span className="text-sm font-normal text-[#9B9B94]">次</span>
          </div>
        </div>
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
          <div className="text-xs text-[#6B6B66]">累计完成总容量</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
            {kpiSummary.totalTonnage.toLocaleString()}{' '}
            <span className="text-sm font-normal text-[#9B9B94]">{unit}</span>
          </div>
        </div>
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
          <div className="text-xs text-[#6B6B66]">个人纪录突破 (PR)</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#15803D]">
            {kpiSummary.totalPRs}{' '}
            <span className="text-sm font-normal text-[#6B6B66]">项次</span>
          </div>
        </div>
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-5">
          <div className="text-xs text-[#6B6B66]">场均正式组容量</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#181816]">
            {kpiSummary.avgSets}{' '}
            <span className="text-sm font-normal text-[#9B9B94]">组/次</span>
          </div>
        </div>
      </div>

      {/* Chart 1: Core Exercise Strength Progression Curve */}
      <section className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E0]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
              <span>单动作纵向进步追踪</span>
              {progressionDelta && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-medium ${
                      progressionDelta.diff >= 0 ? 'text-[#15803D]' : 'text-[#B45309]'
                    }`}
                  >
                    {progressionDelta.diff >= 0 && (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                    {progressionDelta.diff >= 0 ? '+' : ''}
                    {progressionDelta.diff} {unit} (
                    {progressionDelta.pct >= 0 ? '+' : ''}
                    {progressionDelta.pct}%)
                  </span>
                </>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#181816]">
              {activeExerciseName || '动作力量趋势'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Exercise Selector Dropdown */}
            <select
              value={activeExerciseName}
              onChange={(e) => setSelectedExercise(e.target.value)}
              aria-label="选择分析动作"
              className="h-9 px-3 text-xs font-medium bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
            >
              {exerciseFrequencyList.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count} 次记录)
                </option>
              ))}
            </select>

            {/* Metric Segmented Switch */}
            <div className="flex items-center gap-1 p-1 bg-[#F6F6F4] rounded-lg">
              {(
                [
                  { key: 'estimated1RM', label: '估算 1RM' },
                  { key: 'bestWeight', label: '最高负重' },
                  { key: 'volume', label: '动作总容量' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setStrengthMetric(m.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    strengthMetric === m.key
                      ? 'bg-white text-[#181816] shadow-xs'
                      : 'text-[#6B6B66] hover:text-[#181816]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Exercise Chips (Functional Interactive Filter Buttons) */}
        {exerciseFrequencyList.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {exerciseFrequencyList.slice(0, 7).map((item) => {
              const active = item.name === activeExerciseName;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedExercise(item.name)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#181816] text-white'
                      : 'bg-[#F6F6F4] text-[#6B6B66] hover:text-[#181816] hover:bg-[#EAEAE5]'
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="h-[300px] w-full">
          {exerciseSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={exerciseSeries}
                margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="studioStrengthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803D" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#15803D" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECECE7" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#6B6B66', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#E5E5E0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#6B6B66', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  unit={` ${unit}`}
                  width={68}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload;
                    return (
                      <div className="bg-white border border-[#E5E5E0] rounded-lg p-3 shadow-sm text-xs space-y-1">
                        <div className="font-mono text-[#6B6B66]">{row.date}</div>
                        <div className="font-semibold text-[#181816]">
                          最佳组：{row.topSetDetail}
                        </div>
                        <div className="font-mono tabular-nums text-[#15803D]">
                          估算 1RM：{row.estimated1RM} {unit}
                        </div>
                        <div className="font-mono tabular-nums text-[#6B6B66]">
                          最高重量：{row.bestWeight} {unit} · 容量：{row.volume} {unit}
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={strengthMetric}
                  stroke="#15803D"
                  strokeWidth={2.2}
                  fill="url(#studioStrengthFill)"
                  dot={{ r: 4, fill: '#FFFFFF', stroke: '#15803D', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#15803D', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[#9B9B94]">
              当前时间范围内暂无该动作的训练记录
            </div>
          )}
        </div>
      </section>

      {/* Two-Column Secondary Analytics: Session Volume Bar Chart + Muscle Balance & Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart 2: Total Session Tonnage Bar Chart */}
        <section className="lg:col-span-7 bg-white border border-[#E5E5E0] rounded-xl p-6 flex flex-col justify-between">
          <div className="pb-4 border-b border-[#E5E5E0]">
            <div className="text-xs text-[#6B6B66]">训练负荷追踪</div>
            <h2 className="mt-1 text-lg font-semibold text-[#181816]">
              单次训练总容量演进 ({unit})
            </h2>
          </div>

          <div className="h-[270px] w-full mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sessionVolumeSeries}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECECE7" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#6B6B66', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#E5E5E0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B6B66', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: '#F6F6F4' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border border-[#E5E5E0] rounded-lg p-3 shadow-sm text-xs space-y-1">
                        <div className="font-mono text-[#6B6B66]">{item.date}</div>
                        <div className="font-semibold text-[#181816]">
                          {item.splitName}
                        </div>
                        <div className="font-mono tabular-nums text-[#181816]">
                          总容量：{item.totalVolume.toLocaleString()} {unit}
                        </div>
                        <div className="font-mono tabular-nums text-[#6B6B66]">
                          完成正式组：{item.sets} 组
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="totalVolume"
                  fill="#181816"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 3: Muscle Group Set Balance + 28-Day Consistency Matrix */}
        <section className="lg:col-span-5 bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-[#E5E5E0]">
              <div className="text-xs text-[#6B6B66]">肌群刺激均衡度</div>
              <h2 className="mt-1 text-lg font-semibold text-[#181816]">
                各部位有效正式组占比
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {muscleDistribution.map((row) => (
                <div key={row.muscle} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#181816]">{row.muscle}</span>
                    <span className="font-mono tabular-nums text-[#6B6B66]">
                      {row.sets} 组 · {row.pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#F6F6F4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#181816] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(4, row.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 28-Day Studio Consistency Grid */}
          <div className="pt-5 border-t border-[#E5E5E0]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#181816]">
                近 28 天训练出勤记录
              </span>
              <span className="text-xs font-mono tabular-nums text-[#6B6B66]">
                出勤 {consistencyDays.filter((d) => d.trained).length} / 28 天
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {consistencyDays.map((day) => (
                <div
                  key={day.iso}
                  title={
                    day.trained
                      ? `${day.iso} · ${day.splitName} (${day.volume} ${unit})`
                      : `${day.iso} · 休息日`
                  }
                  className={`h-8 rounded-md flex items-center justify-center font-mono text-xs tabular-nums transition-colors ${
                    day.trained
                      ? 'bg-[#15803D] text-white font-medium'
                      : 'bg-[#F6F6F4] text-[#9B9B94]'
                  }`}
                >
                  {day.dayNum}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
