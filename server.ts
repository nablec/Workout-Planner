import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('服务端未检测到 GEMINI_API_KEY 环境变量，请检查运行配置。');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface UploadedPlanFile {
  name: string;
  mimeType: string;
  base64Data: string;
}

async function extractFilePayload(file: UploadedPlanFile): Promise<{
  extractedText?: string;
  inlinePart?: { inlineData: { mimeType: string; data: string } };
}> {
  const ext = path.extname(file.name || '').toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();
  const cleanBase64 = file.base64Data.includes(',')
    ? file.base64Data.split(',')[1]
    : file.base64Data;
  const buffer = Buffer.from(cleanBase64, 'base64');

  // 1. Excel / Spreadsheet (.xlsx, .xls, .ods)
  if (
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.ods' ||
    mime.includes('spreadsheet') ||
    mime.includes('excel')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetTexts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
      if (csv) {
        sheetTexts.push(`【工作表：${sheetName}】\n${csv}`);
      }
    }
    if (sheetTexts.length === 0) {
      throw new Error('上传的 Excel 表格内容为空，请确认表格中包含训练动作与组数信息。');
    }
    return {
      extractedText: `文件名：${file.name}\n${sheetTexts.join('\n\n')}`,
    };
  }

  // 2. Word Document (.docx)
  if (
    ext === '.docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    const docText = (result.value || '').trim();
    if (!docText) {
      throw new Error('未能从 Word 文档中读取到文本内容，请检查文件内容。');
    }
    return {
      extractedText: `文件名：${file.name}\n${docText}`,
    };
  }

  // 3. CSV / TXT / Markdown
  if (
    ext === '.csv' ||
    ext === '.txt' ||
    ext === '.md' ||
    mime.startsWith('text/')
  ) {
    const textContent = buffer.toString('utf-8').trim();
    if (!textContent) {
      throw new Error('上传的文本或 CSV 文件内容为空。');
    }
    return {
      extractedText: `文件名：${file.name}\n${textContent}`,
    };
  }

  // 4. PDF (.pdf) -> Native Gemini Multimodal PDF input
  if (ext === '.pdf' || mime === 'application/pdf') {
    return {
      inlinePart: {
        inlineData: {
          mimeType: 'application/pdf',
          data: cleanBase64,
        },
      },
    };
  }

  // 5. Images (.png, .jpg, .jpeg, .webp) -> Native Gemini Multimodal Image input
  if (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    mime.startsWith('image/')
  ) {
    const resolvedImageMime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : mime.startsWith('image/')
            ? mime
            : 'image/jpeg';
    return {
      inlinePart: {
        inlineData: {
          mimeType: resolvedImageMime,
          data: cleanBase64,
        },
      },
    };
  }

  throw new Error(
    '暂不支持该文件格式，请上传 Excel (.xlsx/.xls)、PDF (.pdf)、CSV (.csv)、Word (.docx)、TXT 或图片文件。'
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // 1. Parse previous workout plan (from uploaded Excel/PDF/Docx/CSV/Image file and/or pasted text)
  app.post('/api/ai/parse-plan', async (req: Request, res: Response) => {
    try {
      const { rawText, file } = req.body as {
        rawText?: string;
        file?: UploadedPlanFile;
      };

      const hasText = Boolean(rawText && rawText.trim());
      const hasFile = Boolean(file && file.base64Data);

      if (!hasText && !hasFile) {
        res.status(400).json({
          error: '请上传健身计划文件（Excel / PDF / CSV / Word / 图片）或粘贴计划文本。',
        });
        return;
      }

      let extractedFileText = '';
      let multimodalPart: { inlineData: { mimeType: string; data: string } } | undefined;

      if (hasFile && file) {
        const extracted = await extractFilePayload(file);
        if (extracted.extractedText) {
          extractedFileText = extracted.extractedText;
        }
        if (extracted.inlinePart) {
          multimodalPart = extracted.inlinePart;
        }
      }

      const combinedContextParts: string[] = [];
      if (extractedFileText) {
        combinedContextParts.push(`【上传文件解析内容】\n${extractedFileText}`);
      }
      if (hasText && rawText) {
        combinedContextParts.push(
          hasFile
            ? `【用户补充说明或附加文本】\n${rawText.trim()}`
            : `【用户输入的健身计划文本】\n${rawText.trim()}`
        );
      }

      const instructionPrompt = `请将用户提供的既往健身计划（可能来自上传的 PDF 文档、Excel 表格、图片或文本）解析为结构化的周期训练方案（JSON）。
解析规则：
1. 自动识别训练日分化结构（如推日/拉日/腿日、周一至周五、上肢/下肢等），忽略无关页眉页脚或纯热身拉伸说明。
2. 如果文档或表格中没有明确写出组间休息时间、器械类型或基准重量，请根据常规力量训练科学给出合理默认值（若原文写了重量则严格保留原文重量数值，若为区间如 60-70kg 取下限 60，未写则填合理起步参考值或自重填 0；器械类型如：杠铃、哑铃、固定器械、绳索、自重）。
3. 动作所属肌群必须严格从以下枚举中选择一个：胸部、背部、腿部、肩部、手臂、核心、全身。

${combinedContextParts.join('\n\n')}`;

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];
      if (multimodalPart) {
        parts.push(multimodalPart);
      }
      parts.push({ text: instructionPrompt });

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction:
            '你是一位严谨、专业的力量与体能训练师。请精准识别并提取用户健身计划文档、表格或图片中的训练日、动作名称、组数、次数区间和重量数据，输出整洁规范的中文结构化 JSON 数据。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: '训练方案名称，例如：经典推拉腿三分化计划',
              },
              description: {
                type: Type.STRING,
                description: '训练方案的一句话简要总结，不超过50字',
              },
              splits: {
                type: Type.ARRAY,
                description: '分化训练日列表',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: '训练日名称，例如：推日 A（胸肩三头）',
                    },
                    focus: {
                      type: Type.STRING,
                      description: '当日侧重肌群摘要，如：胸部 · 肩部前中束 · 肱三头肌',
                    },
                    estimatedMinutes: {
                      type: Type.INTEGER,
                      description: '预计完成时长（分钟），通常在40到75之间',
                    },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING, description: '标准中文动作名称' },
                          muscleGroup: {
                            type: Type.STRING,
                            description: '必须是：胸部、背部、腿部、肩部、手臂、核心、全身 之一',
                          },
                          equipment: {
                            type: Type.STRING,
                            description: '器械类型，如：杠铃、哑铃、固定器械、绳索、自重',
                          },
                          targetSets: { type: Type.INTEGER, description: '正式组组数，如 3 或 4' },
                          minReps: { type: Type.INTEGER, description: '目标次数下限，如 8' },
                          maxReps: { type: Type.INTEGER, description: '目标次数上限，如 12' },
                          baselineWeight: {
                            type: Type.NUMBER,
                            description: '基准参考重量（数值），若原文未提及可填 20 或自重填 0',
                          },
                          restSeconds: {
                            type: Type.INTEGER,
                            description: '建议组间休息秒数，复合动作通常 120-150，孤立动作 60-90',
                          },
                          notes: {
                            type: Type.STRING,
                            description: '简短动作要领或原文备注（25字以内）',
                          },
                        },
                        required: [
                          'name',
                          'muscleGroup',
                          'equipment',
                          'targetSets',
                          'minReps',
                          'maxReps',
                          'baselineWeight',
                          'restSeconds',
                        ],
                      },
                    },
                  },
                  required: ['name', 'focus', 'estimatedMinutes', 'exercises'],
                },
              },
            },
            required: ['name', 'description', 'splits'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        res.status(502).json({ error: 'AI 未返回有效解析结果，请稍后重试。' });
        return;
      }

      const parsed = JSON.parse(text);
      res.json({ program: parsed });
    } catch (err: unknown) {
      console.error('Error in /api/ai/parse-plan:', err);
      const message = err instanceof Error ? err.message : '解析训练计划时发生未知错误';
      res.status(500).json({ error: message });
    }
  });

  // 2. Generate daily progressive overload plan from selected split + recent workout logs
  app.post('/api/ai/generate-daily', async (req: Request, res: Response) => {
    try {
      const { split, recentHistory, readinessNote, unit } = req.body as {
        split?: unknown;
        recentHistory?: unknown;
        readinessNote?: string;
        unit?: string;
      };

      if (!split) {
        res.status(400).json({ error: '缺少目标训练日模板数据。' });
        return;
      }

      const weightUnit = unit === 'lbs' ? 'lbs' : 'kg';
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `请根据用户的目标训练日模板、最近同动作历史训练记录，以及用户今日身体状态说明，制定今日的科学渐进超负荷（Progressive Overload）训练计划。

渐进超负荷核心原则：
1. 如果某动作上次所有正式组均达到了目标次数上限（且主观疲劳度 RPE <= 8.5），复合动作建议增加 2.5${weightUnit}，小肌群/孤立动作建议增加 1.25-2.5${weightUnit} 或在原重量下提高次数。
2. 如果上次未完成目标次数下限或状态吃力，建议维持原重量巩固动作质量，或视今日疲劳说明微调减载（Deload 5%-10%）。
3. 如果某动作没有历史记录，则采用计划模板中的 baselineWeight 作为起步推荐重量。
4. 每个动作给出推荐的正式组列表（包含每组建议重量和建议次数），并用简明客观的一句话说明推荐依据（aiReason）。

目标训练日模板：
${JSON.stringify(split)}

近期相关动作历史表现：
${JSON.stringify(recentHistory || [])}

用户今日状态/特别说明：
${readinessNote ? readinessNote : '状态正常，按标准渐进超负荷推进'}
当前重量单位：${weightUnit}`,
        config: {
          systemInstruction:
            '你是一位注重数据驱动的力量举与肌肥大教练。给出的重量与次数推荐必须温和、可执行、符合渐进超负荷科学，语言简洁平实，不喊口号。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              coachSummary: {
                type: Type.STRING,
                description: '今日整体训练策略概述（40-80字，客观专业）',
              },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: '必须与模板中的动作名称一致',
                    },
                    muscleGroup: {
                      type: Type.STRING,
                      description: '胸部、背部、腿部、肩部、手臂、核心、全身 之一',
                    },
                    equipment: {
                      type: Type.STRING,
                    },
                    restSeconds: {
                      type: Type.INTEGER,
                    },
                    targetRepsLabel: {
                      type: Type.STRING,
                      description: '目标次数区间描述，如 "8-10 次"',
                    },
                    overloadAction: {
                      type: Type.STRING,
                      description: '必须是 increase_weight, increase_reps, maintain, deload 之一',
                    },
                    aiReason: {
                      type: Type.STRING,
                      description: '一句话推荐理由，引用上次数据说明为何加重/增次/维持（35字以内）',
                    },
                    sets: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: {
                            type: Type.STRING,
                            description: 'warmup 或 working',
                          },
                          weight: {
                            type: Type.NUMBER,
                            description: '建议重量',
                          },
                          reps: {
                            type: Type.INTEGER,
                            description: '建议完成次数',
                          },
                        },
                        required: ['type', 'weight', 'reps'],
                      },
                    },
                  },
                  required: [
                    'name',
                    'muscleGroup',
                    'equipment',
                    'restSeconds',
                    'targetRepsLabel',
                    'overloadAction',
                    'aiReason',
                    'sets',
                  ],
                },
              },
            },
            required: ['coachSummary', 'exercises'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        res.status(502).json({ error: 'AI 未能生成今日训练计划，请稍后重试。' });
        return;
      }

      const generated = JSON.parse(text);
      res.json({ plan: generated });
    } catch (err: unknown) {
      console.error('Error in /api/ai/generate-daily:', err);
      const message = err instanceof Error ? err.message : '生成今日训练计划时发生错误';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetix Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
