import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { WeightUnit, WorkoutLog, WorkoutProgram } from '../types';
import { formatReadableDate } from '../utils/fitnessMath';

interface HistoryLogsViewProps {
  logs: WorkoutLog[];
  program: WorkoutProgram;
  unit: WeightUnit;
  onDeleteLog: (id: string) => void;
  onImportBackup: (data: {
    program?: WorkoutProgram;
    logs?: WorkoutLog[];
  }) => void;
  onRestoreDemoData: () => void;
  onClearAllLogs: () => void;
}

export function HistoryLogsView({
  logs,
  program,
  unit,
  onDeleteLog,
  onImportBackup,
  onRestoreDemoData,
  onClearAllLogs,
}: HistoryLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] ? { [sorted[0].id]: true } : {};
  });
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (l) =>
        l.splitName.toLowerCase().includes(q) ||
        l.date.includes(q) ||
        (l.notes && l.notes.toLowerCase().includes(q)) ||
        l.exercises.some(
          (ex) =>
            ex.name.toLowerCase().includes(q) ||
            ex.muscleGroup.toLowerCase().includes(q)
        )
    );
  }, [logs, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Export Full JSON Backup
  const handleExportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      program,
      logs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinetix_fitness_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Detailed Workout History CSV (with UTF-8 BOM for Excel)
  const handleExportCSV = () => {
    const header = [
      '日期',
      '训练日分化',
      '动作名称',
      '目标肌群',
      '器械',
      '组号',
      '组性质',
      `重量(${unit})`,
      '次数',
      'RPE',
      `估算1RM(${unit})`,
    ];
    const rows: string[][] = [header];

    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of sorted) {
      for (const ex of log.exercises) {
        for (const s of ex.sets) {
          rows.push([
            log.date,
            `"${log.splitName.replace(/"/g, '""')}"`,
            `"${ex.name.replace(/"/g, '""')}"`,
            ex.muscleGroup,
            ex.equipment,
            String(s.setNumber),
            s.type === 'warmup' ? '热身组' : '正式组',
            String(s.weight),
            String(s.reps),
            s.rpe ? String(s.rpe) : '',
            String(ex.bestEstimated1RM),
          ]);
        }
      }
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinetix_workout_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON Backup
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || (!parsed.program && !Array.isArray(parsed.logs))) {
          throw new Error('备份文件结构无效，请选择由本站导出的 JSON 备份文件。');
        }
        onImportBackup({
          program: parsed.program,
          logs: Array.isArray(parsed.logs) ? parsed.logs : undefined,
        });
        setImportFeedback({
          type: 'success',
          text: `成功导入备份：包含 ${
            Array.isArray(parsed.logs) ? parsed.logs.length : 0
          } 条历史训练记录。`,
        });
      } catch (err: unknown) {
        setImportFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : '读取 JSON 备份文件失败。',
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Data Backup & Portability Bar */}
      <section className="bg-white border border-[#E5E5E0] rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
              <span>本地浏览器安全存储</span>
              <span aria-hidden="true">·</span>
              <span>支持跨设备文件迁移</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#181816]">
              历史训练日志与数据备份
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJSON}
              className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 JSON 备份</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入 JSON 恢复</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>导出 CSV 明细</span>
            </button>

            <button
              type="button"
              onClick={onRestoreDemoData}
              className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B66] hover:text-[#181816] bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置为演示样本</span>
            </button>

            {logs.length > 0 &&
              (confirmClearAll ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllLogs();
                      setConfirmClearAll(false);
                    }}
                    className="min-h-[40px] px-3 py-2 text-xs font-medium text-white bg-[#B91C1C] rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    确认清空日志
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="min-h-[40px] px-3 py-2 text-xs font-medium text-[#6B6B66] bg-[#F6F6F4] rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="min-h-[40px] px-3 py-2 inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空记录</span>
                </button>
              ))}
          </div>
        </div>

        {importFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium ${
              importFeedback.type === 'success'
                ? 'bg-[#15803D]/10 text-[#15803D]'
                : 'bg-[#FEF2F2] text-[#B91C1C]'
            }`}
          >
            {importFeedback.text}
          </div>
        )}

        {/* Search Input */}
        <div className="mt-5 relative">
          <Search className="w-4 h-4 text-[#9B9B94] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索动作名称（如：深蹲、卧推）、分化名称、肌群或日期..."
            className="w-full h-11 pl-10 pr-4 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] placeholder:text-[#9B9B94] focus:outline-none focus:border-[#181816]"
          />
        </div>
      </section>

      {/* Historical Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-10 text-center text-sm text-[#6B6B66]">
          {logs.length === 0
            ? '当前没有任何历史训练记录。您可以在「今日训练」完成打卡，或点击上方「导入 JSON 恢复」。'
            : '没有找到与搜索词匹配的历史训练记录。'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const expanded = Boolean(expandedIds[log.id]);
            return (
              <article
                key={log.id}
                className="bg-white border border-[#E5E5E0] rounded-xl overflow-hidden"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(log.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(log.id);
                    }
                  }}
                  className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-[#FAFAF8] transition-colors cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B66]">
                      <span className="font-mono tabular-nums font-medium text-[#181816]">
                        {formatReadableDate(log.date)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {log.durationMinutes} 分钟
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        正式组 {log.totalWorkingSets} 组
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        总容量 {log.totalVolume.toLocaleString()} {unit}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-[#181816]">
                      {log.splitName}
                    </h2>

                    {log.prExercises.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>突破纪录：{log.prExercises.join('、')}</span>
                      </div>
                    )}
                    {log.notes && (
                      <p className="text-xs text-[#6B6B66] pt-0.5">{log.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLog(log.id);
                      }}
                      aria-label="删除本条训练日志"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#9B9B94] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-9 h-9 flex items-center justify-center text-[#6B6B66]">
                      {expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-[#F0F0EC] divide-y divide-[#F0F0EC]">
                    {log.exercises.map((ex, idx) => (
                      <div key={ex.id} className="py-3.5 space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs tabular-nums text-[#9B9B94]">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-semibold text-[#181816]">
                              {ex.name}
                            </span>
                            <span className="text-xs text-[#6B6B66]">
                              · {ex.muscleGroup} · {ex.equipment}
                            </span>
                          </div>
                          <div className="font-mono text-xs tabular-nums text-[#6B6B66]">
                            最高 {ex.bestWeight}
                            {unit} · 估算 1RM {ex.bestEstimated1RM}
                            {unit} · 容量 {ex.totalVolume}
                            {unit}
                          </div>
                        </div>

                        <div className="pl-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-xs tabular-nums text-[#181816]">
                          {ex.sets.map((s) => (
                            <span key={s.id} className="text-[#6B6B66]">
                              {s.type === 'warmup' ? '热身' : `第${s.setNumber}组`}:{' '}
                              <strong className="font-medium text-[#181816]">
                                {s.weight}
                                {unit} × {s.reps}
                              </strong>
                              {s.rpe ? ` @RPE${s.rpe}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
