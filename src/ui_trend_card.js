// src/ui_trend_card.js

export function buildUnifiedMessage({ x = [], google = [] }) {
  const head = `<b>ترند اليوم</b>\n<i>هاشتاقات مختصرة من X وGoogle</i>\n`;
  const sec = (title, arr) => {
    if (!arr || arr.length === 0) return "";
    const lines = arr.map(
      (t, i) => `${i + 1}. <a href="${t.url}">${escapeHtml(t.tag)}</a>`
    );
    return `\n<b>${title}</b>\n` + lines.join("\n");
  };

  const body = [
    sec("X", x.slice(0, 10)),
    sec("Google", google.slice(0, 10))
  ].join("\n");

  const footer = `\n\n— تحديث تلقائي. الروابط تفتح في نافذة المتصفح.`;
  return head + body + footer;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
