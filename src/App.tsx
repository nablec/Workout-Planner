/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  ClipboardList,
  History,
  LineChart,
  Sparkles,
} from 'lucide-react';
import type {
  ActiveWorkoutSession,
  AppTab,
  WeightUnit,
  WorkoutLog,
  WorkoutProgram,
} from './types';
import { createInitialSampleLogs, PRESET_PROGRAMS } from './data/presets';
import { finalizeWorkoutSession } from './utils/fitnessMath';
import { TodayWorkoutView } from './components/TodayWorkoutView';
import { ProgramManagerView } from './components/ProgramManagerView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryLogsView } from './components/HistoryLogsView';

const STORAGE_KEYS = {
  program: 'kinetix_studio_program_v1',
  logs: 'kinetix_studio_logs_v1',
  activeSession: 'kinetix_studio_active_session_v1',
  unit: 'kinetix_studio_weight_unit_v1',
};

function loadFromStorage<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');

  const [program, setProgram] = useState<WorkoutProgram>(() =>
    loadFromStorage(STORAGE_KEYS.program, () => PRESET_PROGRAMS[0])
  );

  const [logs, setLogs] = useState<WorkoutLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.logs, () => createInitialSampleLogs())
  );

  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(() =>
    loadFromStorage<ActiveWorkoutSession | null>(STORAGE_KEYS.activeSession, () => null)
  );

  const [unit, setUnit] = useState<WeightUnit>(() =>
    loadFromStorage<WeightUnit>(STORAGE_KEYS.unit, () => 'kg')
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rest timer state
  const [restTimer, setRestTimer] = useState<{
    remainingSeconds: number;
    totalSeconds: number;
    isRunning: boolean;
    exerciseName: string;
  } | null>(null);

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.program, JSON.stringify(program));
    } catch {
      // Ignore storage quota errors
    }
  }, [program]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
    } catch {
      // Ignore storage quota errors
    }
  }, [logs]);

  useEffect(() => {
    try {
      if (activeSession) {
        localStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(activeSession));
      } else {
        localStorage.removeItem(STORAGE_KEYS.activeSession);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [activeSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.unit, JSON.stringify(unit));
    } catch {
      // Ignore
    }
  }, [unit]);

  // Rest timer 1s interval
  useEffect(() => {
    if (!restTimer || !restTimer.isRunning || restTimer.remainingSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRestTimer((prev) => {
        if (!prev || !prev.isRunning) return prev;
        if (prev.remainingSeconds <= 1) {
          return { ...prev, remainingSeconds: 0, isRunning: false };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restTimer]);

  // Auto-hide toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  const handleSaveProgram = (nextProgram: WorkoutProgram, message?: string) => {
    setProgram(nextProgram);
    if (message) showToast(message);
  };

  const handleCompleteWorkout = (session: ActiveWorkoutSession): WorkoutLog | null => {
    const finalized = finalizeWorkoutSession(session, logs);
    if (!finalized) return null;
    setLogs((prev) => [finalized, ...prev]);
    setActiveSession(null);
    setRestTimer(null);
    showToast(
      finalized.prCount > 0
        ? `训练已归档！恭喜突破 ${finalized.prCount} 项个人纪录`
        : '今日训练记录已成功保存归档'
    );
    return finalized;
  };

  const handleDeleteLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    showToast('已删除该条训练日志');
  };

  const handleImportBackup = (data: {
    program?: WorkoutProgram;
    logs?: WorkoutLog[];
  }) => {
    if (data.program) setProgram(data.program);
    if (data.logs) setLogs(data.logs);
    showToast('本地备份数据已恢复');
  };

  const handleRestoreDemoData = () => {
    setProgram(PRESET_PROGRAMS[0]);
    setLogs(createInitialSampleLogs());
    setActiveSession(null);
    showToast('已恢复 5 周渐进训练演示数据');
  };

  const handleClearAllLogs = () => {
    setLogs([]);
    showToast('已清空所有历史训练记录');
  };

  const navItems: Array<{
    key: AppTab;
    label: string;
    icon: typeof CalendarCheck2;
  }> = [
    { key: 'today', label: '今日训练', icon: CalendarCheck2 },
    { key: 'program', label: '计划模板', icon: ClipboardList },
    { key: 'analytics', label: '趋势分析', icon: LineChart },
    { key: 'history', label: '历史日志', icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F6F4] text-[#181816]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E5E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="text-lg font-bold tracking-tight text-[#181816] whitespace-nowrap shrink-0 cursor-pointer"
          >
            衡动工作室
          </button>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="主导航"
            className="hidden md:flex items-center gap-8 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#181816] text-[#181816] font-semibold'
                      : 'border-transparent text-[#6B6B66] hover:text-[#181816] hover:border-[#D4D4CE]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'program') {
                  setActiveTab('program');
                } else {
                  setActiveTab('today');
                }
              }}
              className="min-h-[40px] px-4 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{activeTab === 'program' ? '返回今日训练' : '导入旧计划'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Lightweight Non-Blocking Toast Banner */}
      {toastMessage && (
        <div className="fixed top-18 right-4 sm:right-6 z-40 max-w-sm bg-[#181816] text-white text-xs font-medium px-4 py-3 rounded-lg shadow-md">
          {toastMessage}
        </div>
      )}

      {/* Main Desktop-First Studio Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
        {activeTab === 'today' && (
          <TodayWorkoutView
            program={program}
            logs={logs}
            activeSession={activeSession}
            onUpdateSession={setActiveSession}
            onCompleteWorkout={handleCompleteWorkout}
            unit={unit}
            onToggleUnit={() => setUnit((u) => (u === 'kg' ? 'lbs' : 'kg'))}
            restTimer={restTimer}
            onStartRestTimer={(seconds, exerciseName) =>
              setRestTimer({
                remainingSeconds: seconds,
                totalSeconds: seconds,
                isRunning: true,
                exerciseName,
              })
            }
            onTogglePauseTimer={() =>
              setRestTimer((prev) =>
                prev ? { ...prev, isRunning: !prev.isRunning } : null
              )
            }
            onAdjustTimer={(delta) =>
              setRestTimer((prev) => {
                if (!prev) return null;
                const nextRem = Math.max(0, prev.remainingSeconds + delta);
                const nextTot = Math.max(prev.totalSeconds, nextRem);
                return {
                  ...prev,
                  remainingSeconds: nextRem,
                  totalSeconds: nextTot,
                  isRunning: nextRem > 0 ? prev.isRunning : false,
                };
              })
            }
            onDismissTimer={() => setRestTimer(null)}
            onNavigateProgram={() => setActiveTab('program')}
          />
        )}

        {activeTab === 'program' && (
          <ProgramManagerView
            program={program}
            unit={unit}
            onSaveProgram={handleSaveProgram}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            logs={logs}
            unit={unit}
            onNavigateToday={() => setActiveTab('today')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryLogsView
            logs={logs}
            program={program}
            unit={unit}
            onDeleteLog={handleDeleteLog}
            onImportBackup={handleImportBackup}
            onRestoreDemoData={handleRestoreDemoData}
            onClearAllLogs={handleClearAllLogs}
          />
        )}
      </main>

      {/* Quiet Studio Footer (Desktop) */}
      <footer className="hidden md:block border-t border-[#E5E5E0] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-[#6B6B66]">
          <span>衡动工作室 · 个人渐进超负荷训练与量化追踪助理</span>
          <span>数据保存在本地浏览器 · 支持 JSON 与 CSV 导出备份</span>
        </div>
      </footer>

      {/* Mobile Ergonomic Bottom Tab Navigation (Strictly <= 15% mobile viewport cap) */}
      <nav
        aria-label="移动端底部导航"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E5E5E0]"
      >
        <div className="grid grid-cols-4 items-center h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`h-full flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  isActive ? 'text-[#181816] font-semibold' : 'text-[#6B6B66]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
