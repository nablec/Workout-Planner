import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  MuscleGroup,
  PlanExercise,
  SplitDay,
  WeightUnit,
  WorkoutProgram,
} from '../types';
import { PRESET_PROGRAMS, SAMPLE_PASTE_TEXT } from '../data/presets';
import {
  parsePreviousPlanWithAI,
  type PlanFileUploadPayload,
} from '../services/aiClient';
import { formatDateISO, uid } from '../utils/fitnessMath';

interface ProgramManagerViewProps {
  program: WorkoutProgram;
  unit: WeightUnit;
  onSaveProgram: (program: WorkoutProgram, message?: string) => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  '胸部',
  '背部',
  '腿部',
  '肩部',
  '手臂',
  '核心',
  '全身',
];

const ACCEPTED_EXTENSIONS = [
  '.xlsx',
  '.xls',
  '.ods',
  '.pdf',
  '.csv',
  '.docx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
];

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileFormatLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.ods')) {
    return 'Excel 表格';
  }
  if (lower.endsWith('.pdf')) return 'PDF 文档';
  if (lower.endsWith('.csv')) return 'CSV 数据表';
  if (lower.endsWith('.docx')) return 'Word 文档';
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp')
  ) {
    return '计划图片';
  }
  return '文本文档';
}

export function ProgramManagerView({
  program,
  unit,
  onSaveProgram,
}: ProgramManagerViewProps) {
  const [pasteText, setPasteText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<
    (PlanFileUploadPayload & { sizeBytes: number }) | null
  >(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<WorkoutProgram | null>(null);

  const [activeSplitIdx, setActiveSplitIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const safeSplitIdx =
    program.splits.length === 0
      ? -1
      : Math.min(activeSplitIdx, program.splits.length - 1);
  const currentSplit: SplitDay | undefined =
    safeSplitIdx >= 0 ? program.splits[safeSplitIdx] : undefined;

  const processSelectedFile = (file: File) => {
    setParseError(null);

    if (file.size > MAX_FILE_BYTES) {
      setParseError('文件体积不能超过 15 MB，请压缩或拆分后重试。');
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isSupportedExt = ACCEPTED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    if (!isSupportedExt) {
      setParseError(
        '暂不支持该文件格式，请选择 Excel (.xlsx/.xls)、PDF (.pdf)、CSV (.csv)、Word (.docx)、TXT 或图片文件。'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      const base64Data = resultStr.includes(',')
        ? resultStr.split(',')[1]
        : resultStr;

      setUploadedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
        sizeBytes: file.size,
      });
    };
    reader.onerror = () => {
      setParseError('读取本地文件失败，请重新选择文件。');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleParsePlan = async () => {
    if (!uploadedFile && !pasteText.trim()) {
      setParseError('请上传健身计划文件（如 Excel / PDF），或在下方粘贴计划文本。');
      return;
    }
    setIsParsing(true);
    setParseError(null);
    setParsedPreview(null);
    try {
      const result = await parsePreviousPlanWithAI({
        rawText: pasteText,
        file: uploadedFile
          ? {
              name: uploadedFile.name,
              mimeType: uploadedFile.mimeType,
              base64Data: uploadedFile.base64Data,
            }
          : null,
      });
      setParsedPreview(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解析失败，请稍后重试';
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyParsed = () => {
    if (!parsedPreview) return;
    onSaveProgram(parsedPreview, '已应用 AI 解析生成的训练计划模板');
    setParsedPreview(null);
    setPasteText('');
    setUploadedFile(null);
    setActiveSplitIdx(0);
  };

  const handleApplyPreset = (preset: WorkoutProgram) => {
    const cloned: WorkoutProgram = JSON.parse(JSON.stringify(preset));
    cloned.updatedAt = formatDateISO();
    onSaveProgram(cloned, `已切换至预设模板「${cloned.name}」`);
    setActiveSplitIdx(0);
  };

  // Manual Editor Handlers
  const updateProgramMeta = (field: 'name' | 'description', value: string) => {
    onSaveProgram({
      ...program,
      [field]: value,
      updatedAt: formatDateISO(),
    });
  };

  const handleAddSplit = () => {
    const newSplit: SplitDay = {
      id: uid('split'),
      name: `训练日 ${program.splits.length + 1}`,
      focus: '自定义重点肌群',
      estimatedMinutes: 50,
      exercises: [
        {
          id: uid('ex'),
          name: '杠铃卧推',
          muscleGroup: '胸部',
          equipment: '杠铃',
          targetSets: 4,
          minReps: 8,
          maxReps: 10,
          baselineWeight: 40,
          restSeconds: 120,
          notes: '',
        },
      ],
    };
    const nextSplits = [...program.splits, newSplit];
    onSaveProgram({
      ...program,
      splits: nextSplits,
      updatedAt: formatDateISO(),
    });
    setActiveSplitIdx(nextSplits.length - 1);
  };

  const handleDeleteSplit = (splitId: string) => {
    const nextSplits = program.splits.filter((s) => s.id !== splitId);
    onSaveProgram({
      ...program,
      splits: nextSplits,
      updatedAt: formatDateISO(),
    });
    setActiveSplitIdx(0);
  };

  const updateCurrentSplit = (updater: (s: SplitDay) => SplitDay) => {
    if (!currentSplit) return;
    const nextSplits = program.splits.map((s, idx) =>
      idx === safeSplitIdx ? updater(s) : s
    );
    onSaveProgram({
      ...program,
      splits: nextSplits,
      updatedAt: formatDateISO(),
    });
  };

  const handleAddExercise = () => {
    updateCurrentSplit((s) => ({
      ...s,
      exercises: [
        ...s.exercises,
        {
          id: uid('ex'),
          name: '新训练动作',
          muscleGroup: '全身',
          equipment: '哑铃',
          targetSets: 3,
          minReps: 8,
          maxReps: 12,
          baselineWeight: 15,
          restSeconds: 90,
          notes: '',
        },
      ],
    }));
  };

  const handleUpdateExercise = (exId: string, patch: Partial<PlanExercise>) => {
    updateCurrentSplit((s) => ({
      ...s,
      exercises: s.exercises.map((ex) =>
        ex.id === exId ? { ...ex, ...patch } : ex
      ),
    }));
  };

  const handleMoveExercise = (index: number, direction: -1 | 1) => {
    if (!currentSplit) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= currentSplit.exercises.length) return;
    const arr = [...currentSplit.exercises];
    const [moved] = arr.splice(index, 1);
    arr.splice(targetIdx, 0, moved);
    updateCurrentSplit((s) => ({ ...s, exercises: arr }));
  };

  const handleDeleteExercise = (exId: string) => {
    updateCurrentSplit((s) => ({
      ...s,
      exercises: s.exercises.filter((ex) => ex.id !== exId),
    }));
  };

  return (
    <div className="space-y-8">
      {/* Section 1: AI Multimodal File & Text Previous Plan Importer */}
      <section className="bg-white border border-[#E5E5E0] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B66]">
              <span>智能计划迁移</span>
              <span aria-hidden="true">·</span>
              <span>支持 Excel / PDF / Word / CSV / 图片及文本粘贴</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#181816]">
              导入您之前的健身计划
            </h1>
            <p className="mt-1 text-sm text-[#6B6B66] max-w-2xl">
              上传现有的训练课表文件（Excel、PDF、Word、CSV 或课表截图），或直接粘贴训练备忘文本，AI 将自动识别训练日分化、动作、组数与基准负重。
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPasteText(SAMPLE_PASTE_TEXT);
              setParseError(null);
            }}
            className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>填入示例旧计划文本</span>
          </button>
        </div>

        {/* File Upload Dropzone / Attached File Card */}
        <div className="mt-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.pdf,.csv,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {uploadedFile ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#FAFAF8] border border-[#181816] rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#181816] text-white flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#181816] truncate">
                    {uploadedFile.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6B6B66] font-mono tabular-nums mt-0.5">
                    <span className="font-sans">
                      {getFileFormatLabel(uploadedFile.name)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatFileSize(uploadedFile.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans text-[#15803D]">已就绪待解析</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#181816] bg-[#EAEAE5] hover:bg-[#DFDFD9] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  更换文件
                </button>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  aria-label="移除已上传文件"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#6B6B66] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleDrop}
              className={`p-5 rounded-lg border border-dashed transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer ${
                isDraggingFile
                  ? 'border-[#181816] bg-[#F0F0EC]'
                  : 'border-[#D4D4CE] bg-[#FAFAF8] hover:bg-[#F3F3EF]'
              }`}
            >
              <div className="flex items-center gap-3.5 text-center sm:text-left">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E5E0] flex items-center justify-center text-[#181816] shrink-0 mx-auto sm:mx-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#181816]">
                    点击选择或拖拽课表文件至此上传
                  </div>
                  <div className="mt-0.5 text-xs text-[#6B6B66]">
                    支持 Excel (.xlsx / .xls) · PDF (.pdf) · CSV (.csv) · Word (.docx) · TXT · 课表图片 (.png / .jpg)，最大 15MB
                  </div>
                </div>
              </div>
              <span className="min-h-[38px] px-4 py-2 inline-flex items-center justify-center text-xs font-medium text-[#181816] bg-white border border-[#E5E5E0] rounded-lg whitespace-nowrap shrink-0">
                选择本地文件
              </span>
            </div>
          )}
        </div>

        {/* Text Paste / Supplemental Instructions Box */}
        <div className="mt-4">
          <label
            htmlFor="plan-raw-text"
            className="block text-xs font-medium text-[#6B6B66] mb-1.5"
          >
            {uploadedFile
              ? '补充解析要求（可选，如：仅提取第 2 个工作表 / 忽略拉伸动作）'
              : '或者直接在此粘贴健身计划文本'}
          </label>
          <textarea
            id="plan-raw-text"
            rows={uploadedFile ? 3 : 5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              uploadedFile
                ? '可选填写补充说明，留空则直接完整解析上方文件中的所有训练分化与动作...'
                : `示例格式（任意自然语言均可）：\n周一 练胸+三头：杠铃卧推 4组 6-8次 75kg，上斜哑铃 3组10次 26kg...\n周三 练背+二头：高位下拉 4组10次 55kg，杠铃划船 4组8次 70kg...`
            }
            className="w-full p-3.5 text-sm font-sans leading-relaxed bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] placeholder:text-[#9B9B94] focus:outline-none focus:border-[#181816]"
          />
        </div>

        {parseError && (
          <div className="mt-3 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-[#B91C1C]">
            {parseError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B66]">
            <span>快速载入经典预设：</span>
            {PRESET_PROGRAMS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleParsePlan}
            disabled={isParsing}
            className="min-h-[44px] px-5 py-2.5 inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#181816] hover:bg-[#2E2E2A] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {uploadedFile
                    ? 'AI 正在读取并解析文件...'
                    : 'AI 正在解析结构...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {uploadedFile
                    ? 'AI 解析文件生成计划模板'
                    : 'AI 智能解析为计划模板'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Parsed Preview Confirmation Box */}
        {parsedPreview && (
          <div className="mt-6 pt-6 border-t border-[#E5E5E0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#15803D]">
                  AI 解析完成 · 共识别出 {parsedPreview.splits.length} 个训练分化日
                </div>
                <h3 className="mt-0.5 text-lg font-semibold text-[#181816]">
                  {parsedPreview.name}
                </h3>
                <p className="text-xs text-[#6B6B66]">{parsedPreview.description}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setParsedPreview(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#6B6B66] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg whitespace-nowrap cursor-pointer"
                >
                  放弃预览
                </button>
                <button
                  type="button"
                  onClick={handleApplyParsed}
                  className="min-h-[40px] px-4 py-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确认设为当前训练计划</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {parsedPreview.splits.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg space-y-2.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#181816]">{s.name}</div>
                    <div className="text-xs text-[#6B6B66] mt-0.5">
                      {s.focus} · 约 {s.estimatedMinutes} 分钟
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs border-t border-[#E5E5E0] pt-2.5">
                    {s.exercises.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-center justify-between gap-2 text-[#181816]"
                      >
                        <span className="truncate">{ex.name}</span>
                        <span className="font-mono tabular-nums text-[#6B6B66] shrink-0">
                          {ex.targetSets}×{ex.minReps}-{ex.maxReps}
                          {ex.baselineWeight > 0 ? ` @${ex.baselineWeight}${unit}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Manual Split & Exercise Template Studio Editor */}
      <section className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#E5E5E0]">
          <div className="space-y-3 flex-1 min-w-[260px]">
            <div className="text-xs text-[#6B6B66]">
              当前生效模板编辑器（所有修改实时自动保存）
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#6B6B66] mb-1">方案名称</label>
                <input
                  type="text"
                  value={program.name}
                  onChange={(e) => updateProgramMeta('name', e.target.value)}
                  className="w-full h-10 px-3 text-sm font-semibold bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B6B66] mb-1">周期说明</label>
                <input
                  type="text"
                  value={program.description}
                  onChange={(e) => updateProgramMeta('description', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddSplit}
            className="min-h-[42px] px-4 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增分化训练日</span>
          </button>
        </div>

        {/* Split Tabs */}
        {program.splits.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {program.splits.map((s, idx) => {
                const active = idx === safeSplitIdx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSplitIdx(idx)}
                    className={`min-h-[40px] px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#181816] text-white border-[#181816]'
                        : 'bg-[#FAFAF8] text-[#181816] border-[#E5E5E0] hover:bg-[#F0F0EC]'
                    }`}
                  >
                    {s.name}
                    <span
                      className={`ml-2 font-mono text-xs tabular-nums ${
                        active ? 'text-stone-300' : 'text-[#6B6B66]'
                      }`}
                    >
                      ({s.exercises.length})
                    </span>
                  </button>
                );
              })}
            </div>

            {currentSplit && (
              <div className="space-y-5 pt-2">
                {/* Split Day Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs text-[#6B6B66] mb-1">
                      分化日名称
                    </label>
                    <input
                      type="text"
                      value={currentSplit.name}
                      onChange={(e) =>
                        updateCurrentSplit((s) => ({ ...s, name: e.target.value }))
                      }
                      className="w-full h-10 px-3 text-sm font-medium bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#6B6B66] mb-1">
                      侧重肌群摘要
                    </label>
                    <input
                      type="text"
                      value={currentSplit.focus}
                      onChange={(e) =>
                        updateCurrentSplit((s) => ({ ...s, focus: e.target.value }))
                      }
                      className="w-full h-10 px-3 text-sm bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-[#6B6B66] mb-1">
                        预计时长 (分钟)
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={180}
                        value={currentSplit.estimatedMinutes}
                        onChange={(e) =>
                          updateCurrentSplit((s) => ({
                            ...s,
                            estimatedMinutes: Math.max(15, Number(e.target.value) || 45),
                          }))
                        }
                        className="w-full h-10 px-3 font-mono text-sm tabular-nums bg-[#FAFAF8] border border-[#E5E5E0] rounded-lg text-[#181816] focus:outline-none focus:border-[#181816]"
                      />
                    </div>
                    {program.splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSplit(currentSplit.id)}
                        title="删除该分化训练日"
                        className="h-10 px-3 flex items-center justify-center gap-1 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除本分化</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Exercise Rows Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-medium text-[#6B6B66] border-b border-[#E5E5E0]">
                        <th className="py-2.5 pr-2 w-16">排序</th>
                        <th className="py-2.5 px-2 min-w-[160px]">动作名称</th>
                        <th className="py-2.5 px-2 w-24">目标肌群</th>
                        <th className="py-2.5 px-2 w-28">器械类型</th>
                        <th className="py-2.5 px-2 w-20">正式组</th>
                        <th className="py-2.5 px-2 w-32">目标次数区间</th>
                        <th className="py-2.5 px-2 w-28">基准负重 ({unit})</th>
                        <th className="py-2.5 px-2 w-24">休息 (秒)</th>
                        <th className="py-2.5 pl-2 text-right w-14">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0EC]">
                      {currentSplit.exercises.map((ex, idx) => (
                        <tr key={ex.id} className="hover:bg-[#FAFAF8]">
                          <td className="py-2.5 pr-2">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveExercise(idx, -1)}
                                aria-label="上移"
                                className="w-7 h-8 flex items-center justify-center text-[#6B6B66] hover:text-[#181816] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === currentSplit.exercises.length - 1}
                                onClick={() => handleMoveExercise(idx, 1)}
                                aria-label="下移"
                                className="w-7 h-8 flex items-center justify-center text-[#6B6B66] hover:text-[#181816] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="text"
                              value={ex.name}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, { name: e.target.value })
                              }
                              className="w-full h-9 px-2.5 text-sm font-medium bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <select
                              value={ex.muscleGroup}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, {
                                  muscleGroup: e.target.value as MuscleGroup,
                                })
                              }
                              className="w-full h-9 px-2 text-xs bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            >
                              {MUSCLE_GROUPS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="text"
                              value={ex.equipment}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, { equipment: e.target.value })
                              }
                              className="w-full h-9 px-2.5 text-xs bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={ex.targetSets}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, {
                                  targetSets: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-full h-9 px-2 text-center font-mono text-xs tabular-nums bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
                              <input
                                type="number"
                                min={1}
                                value={ex.minReps}
                                onChange={(e) =>
                                  handleUpdateExercise(ex.id, {
                                    minReps: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-12 h-9 px-1 text-center bg-white border border-[#E5E5E0] rounded-md"
                              />
                              <span className="text-[#9B9B94]">-</span>
                              <input
                                type="number"
                                min={1}
                                value={ex.maxReps}
                                onChange={(e) =>
                                  handleUpdateExercise(ex.id, {
                                    maxReps: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-12 h-9 px-1 text-center bg-white border border-[#E5E5E0] rounded-md"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              value={ex.baselineWeight}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, {
                                  baselineWeight: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-full h-9 px-2 text-center font-mono text-xs tabular-nums bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="number"
                              step="15"
                              min={15}
                              value={ex.restSeconds}
                              onChange={(e) =>
                                handleUpdateExercise(ex.id, {
                                  restSeconds: Math.max(15, Number(e.target.value) || 60),
                                })
                              }
                              className="w-full h-9 px-2 text-center font-mono text-xs tabular-nums bg-white border border-[#E5E5E0] rounded-md text-[#181816] focus:outline-none focus:border-[#181816]"
                            />
                          </td>
                          <td className="py-2.5 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteExercise(ex.id)}
                              aria-label={`删除 ${ex.name}`}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-[#9B9B94] hover:text-[#B91C1C] rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleAddExercise}
                    className="min-h-[42px] px-4 py-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#181816] bg-[#F6F6F4] hover:bg-[#EAEAE5] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>向「{currentSplit.name}」添加动作</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-sm text-[#6B6B66]">
            当前暂无分化训练日，请点击右上角「新增分化训练日」或在上方上传文件导入。
          </div>
        )}
      </section>
    </div>
  );
}
