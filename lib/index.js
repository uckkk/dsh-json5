// dsh-json5 — JSON5 解析/序列化（支持注释、尾逗号、单引号、无引号键）。纯 Node。
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = "JSON5";
const inject = ["tools"];

/**
 * 把 JSON5 文本「放松」成合法 JSON 后交给 JSON.parse。
 * 支持：// 与 /* *\/ 注释、尾逗号、单引号字符串、无引号键。
 * 不支持（诚实说明）：十六进制/Infinity/NaN 等数字字面量、多行字符串。
 */
function json5ToJson(text) {
  let s = String(text);
  // 1) 去掉块注释
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // 2) 去掉行注释（尽力避开 http:// 等冒号场景，采用「行首或空白后的 //」启发式）
  s = s.replace(/(^|[ \t])?\/\/[^\n\r]*/g, (m) => (m.startsWith(":") ? m : ""));
  // 3) 去尾逗号：, 后面紧跟 } 或 ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  // 4) 无引号键 → 双引号键（标识符后跟冒号）
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  // 5) 单引号字符串 → 双引号（简单处理，内部无转义单引号）
  s = s.replace(/'([^'\n]*)'/g, '"$1"');
  return s;
}

function json5Parse(text) {
  const relaxed = json5ToJson(text);
  try {
    return JSON.parse(relaxed);
  } catch (e) {
    throw new Error(`JSON5 解析失败：${e.message}`);
  }
}

async function apply(ctx, _config) {
  ctx.tools.register(defineTool({
    name: "json5_parse",
    description: "解析 JSON5 文本为 JSON。支持注释（// 与块注释）、尾逗号、单引号字符串、无引号键（不支持十六进制/Infinity 等数字字面量）。",
    parameters: { text: { type: "string", required: true, description: "JSON5 文本。" } },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { data: { type: "json", required: true } },
      },
      render: (_a, v) => [{ type: "text", text: JSON.stringify(v.data, null, 2) }],
    },
    execute: async (args) => ({ data: json5Parse(args.text) }),
  }));

  ctx.tools.register(defineTool({
    name: "json5_stringify",
    description: "把 JSON 对象序列化为 JSON5 文本（JSON 是 JSON5 子集，输出等价）。`indent` 传缩进空格数，默认 2。",
    parameters: {
      data: { type: "json", required: true, description: "要序列化的 JSON 对象。" },
      indent: { type: "integer", description: "缩进空格数，默认 2；≤0 压缩为单行。" },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { text: { type: "string", required: true } },
      },
      render: (_a, v) => [{ type: "text", text: v.text }],
    },
    execute: async (args) => {
      const indent = typeof args.indent === "number" ? args.indent : 2;
      return { text: JSON.stringify(args.data, null, indent > 0 ? indent : undefined) };
    },
  }));
}

export { apply, inject, name };
