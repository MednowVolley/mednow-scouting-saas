const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { email, nome, club_nome } = JSON.parse(event.body || '{}');
  if (!email || !club_nome) return { statusCode: 400, body: 'Parametri mancanti' };

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return { statusCode: 500, body: 'RESEND_API_KEY non configurata' };

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:Inter,system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:40px 20px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td style="background:#0A1628;padding:32px 40px;text-align:center">
    <div style="font-size:24px;font-weight:900;color:#fff">Mednow<span style="color:#4DA3E8">Scouting</span></div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;text-transform:uppercase;letter-spacing:.1em">Piattaforma gestionale sportiva</div>
  </td></tr>
  <tr><td style="padding:40px">
    <h1 style="font-size:26px;font-weight:800;color:#0A1628;margin:0 0 8px">Benvenuto in Mednow Scouting!</h1>
    <p style="font-size:15px;color:#6B7280;line-height:1.6;margin:0 0 28px">
      Il tuo spazio per <strong>${club_nome}</strong> e' pronto. 
      Hai <strong>30 giorni gratuiti</strong> per esplorare tutte le funzionalita'.
    </p>
    <div style="background:#F0F7FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Le tue credenziali</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:13px;color:#6B7280;padding:4px 0">Club</td><td style="font-size:13px;font-weight:600;color:#0A1628;text-align:right">${club_nome}</td></tr>
        <tr><td style="font-size:13px;color:#6B7280;padding:4px 0">Email</td><td style="font-size:13px;font-weight:600;color:#0A1628;text-align:right">${email}</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:32px">
      <a href="https://mednowscouting.it/app" style="display:inline-block;padding:14px 32px;background:#1e6aff;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
        Accedi all'app &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0">
      Hai bisogno di aiuto? <a href="mailto:info@mednowscouting.it" style="color:#1e6aff;text-decoration:none">info@mednowscouting.it</a>
    </p>
  </td></tr>
  <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 40px;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">2026 Mednow Scouting &middot; <a href="https://mednowscouting.it" style="color:#9CA3AF">mednowscouting.it</a></p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  const payload = JSON.stringify({
    from: 'Mednow Scouting <noreply@mednowscouting.it>',
    to: [email],
    subject: `Benvenuto in Mednow Scouting — il tuo club e' pronto!`,
    html
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: 200, body: JSON.stringify({ sent: res.statusCode < 300 }) }));
    });
    req.on('error', () => resolve({ statusCode: 200, body: JSON.stringify({ sent: false }) }));
    req.write(payload); req.end();
  });
};
