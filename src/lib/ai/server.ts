import { createServerFn } from "@tanstack/react-start";

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    composer: { type: "string" },
    key: { type: "string" },
    timeSignature: { type: "string" },
    tempo: { type: "number" },
    notation: { type: "string" },
    notes: { type: "string" },
  },
  required: ["title", "notation"],
} as const;

const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "tips"],
} as const;

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function grokChat(opts: {
  messages: unknown[];
  max_tokens: number;
  schema?: { name: string; schema: unknown };
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "当前环境暂未开启识别服务" };

  const body: Record<string, unknown> = {
    model: "grok-4.5",
    messages: opts.messages,
    max_tokens: opts.max_tokens,
    temperature: 0.2,
  };
  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: true },
    };
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `识别服务暂时不可用（${res.status}）` };
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { ok: true, text };
}

export const recognizeScore = createServerFn({ method: "POST" })
  .validator((input: { imageDataUrl: string }) => input)
  .handler(async ({ data }) => {
    if (!data.imageDataUrl?.startsWith("data:image/")) {
      return { ok: false as const, error: "请上传有效的曲谱图片" };
    }
    if (data.imageDataUrl.length > 900_000) {
      return { ok: false as const, error: "图片太大，请换一张更清晰的局部谱" };
    }

    const prompt = `你是乐谱识谱助手。从图片中提取主旋律（忽略歌词、伴奏织体如果太密就只取最高声部）。
用简易记谱输出：音名+八度+时值。规则：
- 音名如 C4 D#4 Bb3，休止符 R
- 时值：/1 全音符 /2 二分 /4 或不写 四分 /8 八分 /16 十六分，附点在后如 /2.
- 小节线用 |
- 同时发响的和弦用 [C4,E4,G4]/4
只返回 JSON：{"title":string,"composer":string,"key":string,"timeSignature":"4/4","tempo":number,"notation":string}
key 用 C G D A F Bb Am 等。timeSignature 形如 4/4 或 3/4。notation 是一整串记谱。`;

    const result = await grokChat({
      max_tokens: 1800,
      schema: { name: "score", schema: SCORE_SCHEMA },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: data.imageDataUrl, detail: "high" } },
          ],
        },
      ],
    });
    if (!result.ok) return { ok: false as const, error: result.error };

    const parsed = extractJson(result.text);
    if (!parsed || typeof parsed.notation !== "string" || !parsed.notation.trim()) {
      return { ok: false as const, error: "没能从图片里读出音符，请换更清晰的谱或改用在线输入" };
    }
    const tsRaw = String(parsed.timeSignature ?? "4/4");
    const tsParts = tsRaw.split("/");
    const num = Number(tsParts[0]) || 4;
    const den = Number(tsParts[1]) || 4;
    return {
      ok: true as const,
      title: String(parsed.title || "未命名曲谱"),
      composer: String(parsed.composer || "未知"),
      key: String(parsed.key || "C"),
      timeSignature: { num, den },
      tempo: Math.max(40, Math.min(200, Number(parsed.tempo) || 90)),
      notation: String(parsed.notation).trim(),
    };
  });

export const coachPractice = createServerFn({ method: "POST" })
  .validator(
    (input: {
      title: string;
      composer: string;
      score: number;
      accuracy: number;
      timing: number;
      mode: string;
      weakNotes: string[];
      tips: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const prompt = `你是耐心的钢琴老师。根据练习数据，用简体中文给出 1 句总评和 3 条可执行建议（每条不超过 40 字）。不要客套，不要emoji。
曲目：${data.title}（${data.composer}）
模式：${data.mode === "follow" ? "跟弹" : "演奏"}
得分 ${data.score}，准确率 ${data.accuracy}%，节奏 ${data.timing}
易错音：${data.weakNotes.join("、") || "无"}
已有观察：${data.tips.join("；")}`;

    const result = await grokChat({
      max_tokens: 500,
      schema: { name: "coach", schema: COACH_SCHEMA },
      messages: [{ role: "user", content: prompt }],
    });
    if (!result.ok) return { ok: false as const, error: result.error, summary: "", tips: data.tips };
    const parsed = extractJson(result.text);
    const tips = Array.isArray(parsed?.tips)
      ? (parsed!.tips as unknown[]).map(String).slice(0, 4)
      : data.tips;
    return {
      ok: true as const,
      summary: String(parsed?.summary || ""),
      tips: tips.length ? tips : data.tips,
    };
  });
