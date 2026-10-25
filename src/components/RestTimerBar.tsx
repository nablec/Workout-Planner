import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';

interface RestTimerBarProps {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  exerciseName: string;
  onTogglePause: () => void;
  onAdjustSeconds: (delta: number) => void;
  onDismiss: () => void;
}

export function RestTimerBar({
  remainingSeconds,
  totalSeconds,
  isRunning,
  exerciseName,
  onTogglePause,
  onAdjustSeconds,
  onDismiss,
}: RestTimerBarProps) {
  if (totalSeconds <= 0 && remainingSeconds <= 0) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progressPct =
    totalSeconds > 0
      ? Math.max(0, Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
      : 100;
  const isFinished = remainingSeconds === 0;

  return (
    <div className="mb-6 bg-white border border-[#E5E5E0] rounded-xl p-4 transition-opacity duration-150">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isFinished
                ? 'bg-[#15803D]/10 text-[#15803D]'
                : 'bg-[#F6F6F4] text-[#181816]'
            }`}
          >
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#6B6B66]">
              <span>组间休息计时</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{exerciseName}</span>
            </div>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span
                className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${
                  isFinished ? 'text-[#15803D]' : 'text-[#181816]'
                }`}
              >
                {formatted}
              </span>
              {isFinished && (
                <span className="text-xs font-medium text-[#15803D]">
                  休息结束，可开始下一组
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onAdjustSeconds(-15)}
            className="min-h-[40px] px-3 text-xs font-mono font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => onAdjustSeconds(30)}
            className="min-h-[40px] px-3 text-xs font-mono font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            +30s
          </button>
          {isFinished ? (
            <button
              type="button"
              onClick={() => onAdjustSeconds(totalSeconds || 90)}
              className="min-h-[40px] min-w-[40px] px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="重新计时"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重计</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onTogglePause}
              className="min-h-[40px] min-w-[40px] px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>暂停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>继续</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="关闭休息计时器"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#6B6B66] hover:text-[#181816] hover:bg-[#F6F6F4] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full bg-[#F6F6F4] rounded-full overflow-hidden">
        <div
          className={`h-full transition-transform duration-300 origin-left ${
            isFinished ? 'bg-[#15803D]' : 'bg-[#181816]'
          }`}
          style={{ transform: `scaleX(${progressPct / 100})` }}
        />
      </div>
    </div>
  );
}
