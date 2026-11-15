// Runs once a day on Netlify. It asks the site to send the magazine to the members whose turn it is
// (2 days after signing up, then every 30 days). Needs CRON_SECRET in the Netlify variables.
export default async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || '').replace(/\/$/, '');
  if (!base || !process.env.CRON_SECRET) { console.log('magazine-cron: missing URL or CRON_SECRET'); return; }
  const r = await fetch(base + '/api/magazine/send', {
    method: 'POST',
    headers: { 'x-cron-secret': process.env.CRON_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'run' }),
  });
  console.log('magazine-cron:', r.status, await r.text());
};
export const config = { schedule: '0 7 * * *' };
