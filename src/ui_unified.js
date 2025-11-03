// src/ui_unified.js — بناء رسالة HTML موحّدة تعرض هاشتاقات وروابط في رسالة واحدة
export function buildUnifiedMessage({ title = "ترند موحّد", sections = [] }) {
  const head = `<b>${escapeHtml(title)}</b>\n<i>هاشتاقات مختصرة وروابط مباشرة</i>\n`;
  const sec = (label, items = []) => {
    if (!items.length) return "";
    const lines = items.map((t, i) => `${i + 1}. <a href="${t.url}">${escapeHtml(t.tag)}</a>`);
    return `\n<b>${escapeHtml(label)}</b>\n` + lines.join("\n");
  };
  const body = sections.map(s => sec(s.label, s.items)).join("\n");
  const footer = `\n\n— رسالة واحدة. الروابط تفتح في المتصفح.`;
  return head + body + footer;
}

function escapeHtml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

