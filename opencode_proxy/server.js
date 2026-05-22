#!/usr/bin/env node
const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const TRANSLATE_MODEL = process.env.OPENCODE_TRANSLATE_MODEL || "openai/gpt-5.4-mini";
const TRANSLATE_VARIANT = process.env.OPENCODE_TRANSLATE_VARIANT || "low";
const ASK_MODEL = process.env.OPENCODE_ASK_MODEL || "openai/gpt-5.5";
const ASK_VARIANT = process.env.OPENCODE_ASK_VARIANT || "";

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || !["/ask", "/translate"].includes(req.url)) {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  try {
    const body = await readJson(req);

    if (req.url === "/ask") {
      const answer = await askWithOpenCode({
        prompt: String(body.prompt || body.question || "").trim()
      });
      sendJson(res, 200, { ok: true, answer });
      return;
    }

    const items = normalizeItems(body.items);
    if (!items.length) {
      sendJson(res, 200, { ok: true, translations: [] });
      return;
    }

    const translations = await translateWithOpenCode({
      items,
      targetLanguage: body.targetLanguage || "Korean",
      tone:
        body.tone ||
        "natural, fluent Korean for technical reading; preserve technical terms when translating them would reduce clarity"
    });
    sendJson(res, 200, { ok: true, translations });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error?.message || "Unknown proxy error"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`OpenCode proxy listening on http://${HOST}:${PORT}`);
});

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item?.id || ""),
      text: String(item?.text || "").trim()
    }))
    .filter((item) => item.id && item.text);
}

function askWithOpenCode({ prompt }) {
  if (!prompt) throw new Error("Missing prompt.");

  const fullPrompt = [
    "Answer the user's request clearly and concisely.",
    "",
    "User request:",
    prompt
  ].join("\n");

  return runOpenCode({
    model: ASK_MODEL,
    variant: ASK_VARIANT,
    prompt: fullPrompt
  }).then(parseOpenCodeText);
}

function translateWithOpenCode({ items, targetLanguage, tone }) {
  const prompt = [
    "Translate webpage body text for bilingual reading.",
    `Translate into ${targetLanguage}.`,
    `Style: ${tone}.`,
    "Keep code identifiers, API names, product names, file paths, command names, and URLs unchanged unless a natural Korean gloss is useful.",
    "Return only minified JSON in this exact shape:",
    '{"translations":[{"id":"same-id","translation":"translated text"}]}',
    "Do not add markdown, comments, explanations, or code fences.",
    "",
    JSON.stringify({ items })
  ].join("\n");

  return runOpenCode({
    model: TRANSLATE_MODEL,
    variant: TRANSLATE_VARIANT,
    prompt
  }).then(parseOpenCodeTranslations);
}

function runOpenCode({ model, variant, prompt }) {
  return new Promise((resolve, reject) => {
    const args = ["run", "--model", model];
    if (variant) args.push("--variant", variant);
    args.push("--format", "json", prompt);

    const child = spawn("opencode", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(trimError(stderr) || `opencode exited with ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseOpenCodeTranslations(stdout) {
  const text = parseOpenCodeText(stdout);
  const parsed = parseJsonFromText(text);
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenCode returned JSON without translations.");
  }
  return parsed.translations.map((item) => ({
    id: String(item.id),
    translation: String(item.translation || "")
  }));
}

function parseOpenCodeText(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const event = JSON.parse(line);
        if (event.type === "text") return event.part?.text || "";
      } catch {
        return "";
      }
      return "";
    })
    .join("")
    .trim();
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenCode returned no JSON.");
    return JSON.parse(match[0]);
  }
}

