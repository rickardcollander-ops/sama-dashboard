import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

function chunkText(s: string, size = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [""];
}

function richText(s: string) {
  return chunkText(s).map((t) => ({ type: "text", text: { content: t } }));
}

type NotionBlock = Record<string, unknown>;

function markdownToBlocks(md: string): NotionBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: NotionBlock[] = [];
  let inCode = false;
  const codeBuf: string[] = [];

  const para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: richText(para.join(" ")) },
      });
      para.length = 0;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) { flushPara(); inCode = true; codeBuf.length = 0; }
      else {
        blocks.push({
          object: "block",
          type: "code",
          code: { rich_text: richText(codeBuf.join("\n")), language: "plain text" },
        });
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const lvl = h[1].length;
      const type = (["heading_1", "heading_2", "heading_3"] as const)[lvl - 1];
      blocks.push({
        object: "block",
        type,
        [type]: { rich_text: richText(h[2]) },
      });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richText(line.replace(/^\s*[-*+]\s+/, "")) },
      });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: richText(line.replace(/^\s*\d+\.\s+/, "")) },
      });
      continue;
    }
    if (line.trim() === "") { flushPara(); continue; }
    para.push(line.trim());
  }
  flushPara();
  return blocks.slice(0, 100);
}

export const notionAdapter: CmsAdapter = {
  kind: "notion",

  async validate(cfg) {
    const token = cfg.integration_token?.trim();
    const dbId = cfg.database_id?.trim();
    if (!token || !dbId) return { ok: false, message: "token and database_id are required" };
    const res = await fetch(`${API}/databases/${dbId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": VERSION,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Notion ${res.status}: ${text.slice(0, 120)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.integration_token?.trim();
    const dbId = cfg.database_id?.trim();
    if (!token || !dbId) throw new PublishError("Notion: token and database_id are required", 400);

    const titleProp = cfg.title_property || "Name";
    const properties: Record<string, unknown> = {
      [titleProp]: { title: [{ type: "text", text: { content: input.title } }] },
    };
    if (cfg.status_property) {
      properties[cfg.status_property] = {
        select: { name: input.status === "draft" ? "Draft" : "Published" },
      };
    }
    if (cfg.tags_property && input.tags?.length) {
      properties[cfg.tags_property] = {
        multi_select: input.tags.map((name) => ({ name })),
      };
    }

    const res = await fetch(`${API}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties,
        children: markdownToBlocks(input.body_markdown),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Notion publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    return {
      url: data.url,
      external_id: data.id,
      raw: { id: data.id },
    };
  },
};
