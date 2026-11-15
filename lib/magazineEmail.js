// Builds the monthly magazine email (HTML + plain text). Pure functions: used by the server (sending)
// and by the admin screen (preview).
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function itemImage(it, supabaseUrl) {
  const p = it && it.image_path;
  if (!p) return '';
  if (/^https:\/\//i.test(p)) return p;
  if (/^data:/i.test(p)) return ''; // email apps do not show embedded pictures
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/deal-images/${encodeURI(p)}` : '';
}

export function renderMagazine({ title, intro, items, siteUrl, supabaseUrl, issueDate }) {
  const site = (siteUrl || '').replace(/\/$/, '') || '#';
  const date = (issueDate ? new Date(issueDate) : new Date()).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const list = Array.isArray(items) ? items : [];
  const cards = list.map((it, i) => {
    const img = itemImage(it, supabaseUrl);
    const exp = it.expires_on ? `<div style="font-size:12px;color:#7a8499;margin-top:6px">Ends ${esc(new Date(it.expires_on).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }))}</div>` : '';
    return `<tr><td style="padding:0 0 14px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e3e8f2;border-radius:14px"><tr>
${img ? `<td width="96" valign="top" style="padding:14px 0 14px 14px"><img src="${esc(img)}" width="80" height="80" alt="" style="display:block;border-radius:10px;object-fit:cover"></td>` : ''}
<td valign="top" style="padding:14px 16px">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a8499">${esc(it.category || '')}${it.category ? ' · ' : ''}#${i + 1}</div>
<div style="font-size:18px;font-weight:700;color:#0b1f4d;margin-top:2px">${esc(it.store)}</div>
<div style="display:inline-block;background:#e8f1ff;color:#0a58ff;font-weight:700;font-size:14px;border-radius:999px;padding:3px 12px;margin-top:6px">${esc(it.discount_text)}</div>
<div style="font-size:14px;line-height:1.5;color:#33415c;margin-top:8px">${esc(it.description)}</div>${exp}
<div style="margin-top:10px"><a href="${esc(site)}" style="font-size:14px;font-weight:700;color:#0a58ff;text-decoration:none">See the deal on Dealora &rarr;</a></div>
</td></tr></table></td></tr>`;
  }).join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#eef2fa;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2fa"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">
<tr><td style="background:#06143a;background-image:linear-gradient(135deg,#06143a,#0a3fd6);border-radius:18px 18px 0 0;padding:34px 28px;text-align:center">
<div style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#7fb2ff">${esc(date)}</div>
<div style="font-size:34px;font-weight:800;color:#ffffff;margin-top:6px">${esc(title)}</div>
<div style="font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#7fe3ff;margin-top:8px">Better deals. Every day.</div>
</td></tr>
<tr><td style="background:#f7f9fe;padding:24px 22px 8px 22px">
${intro ? `<p style="font-size:15px;line-height:1.6;color:#33415c;margin:0 0 20px 0">${esc(intro).replace(/\n/g, '<br>')}</p>` : ''}
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7a8499;margin-bottom:12px">${list.length} verified deal${list.length === 1 ? '' : 's'} this month</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
<div style="text-align:center;padding:10px 0 22px 0"><a href="${esc(site)}" style="display:inline-block;background:#0a58ff;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:999px;padding:13px 30px">Open Dealora</a></div>
</td></tr>
<tr><td style="background:#06143a;border-radius:0 0 18px 18px;padding:20px 24px;text-align:center;font-size:12px;line-height:1.6;color:#93a4c9">
You get this magazine because you signed up on Dealora and chose to receive it.<br>
Codes and links stay on the site, for signed-in members.<br>
<a href="${esc(site)}/account" style="color:#7fb2ff">Unsubscribe or change your emails</a>
</td></tr></table></td></tr></table></body></html>`;

  const text = [`${title} - ${date}`, 'Better deals. Every day.', '', intro || '', '',
    ...list.map((it, i) => `${i + 1}. ${it.store} - ${it.discount_text}\n   ${it.description}`),
    '', `Open Dealora: ${site}`, `Unsubscribe: ${site}/account`].join('\n');
  return { html, text };
}
