const { createClient } = require('@supabase/supabase-js');

const ADMIN_TOKEN = process.env.ADMIN_SECRET_TOKEN;
const supabase = createClient(
  'https://zaxbwqxnrofiggldoahw.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // Verifica token admin
  const token = event.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Non autorizzato' }) };
  }

  // Azione POST (extend trial, ecc.)
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    if (body.action === 'extend_trial' && body.club_id) {
      const now = new Date();
      const { data: club } = await supabase.from('clubs').select('trial_scade_il').eq('id', body.club_id).single();
      const base = club?.trial_scade_il && new Date(club.trial_scade_il) > now ? new Date(club.trial_scade_il) : now;
      base.setDate(base.getDate() + 7);
      await supabase.from('clubs').update({ trial_scade_il: base.toISOString(), piano: 'trial', attivo: true }).eq('id', body.club_id);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
  }

  try {
    // Fetch tutti i club
    const { data: clubs, error: clubsErr } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });
    if (clubsErr) throw clubsErr;

    // Fetch utenti admin per ogni club
    const { data: utenti, error: utentiErr } = await supabase
      .from('utenti')
      .select('club_id, email, nome, ruolo')
      .eq('ruolo', 'admin');
    if (utentiErr) throw utentiErr;

    // Merge
    const result = clubs.map(club => {
      const admin = utenti.find(u => u.club_id === club.id);
      const trialScade = club.trial_scade_il ? new Date(club.trial_scade_il) : null;
      const now = new Date();
      const giorniRimasti = trialScade ? Math.ceil((trialScade - now) / (1000*60*60*24)) : null;
      return {
        ...club,
        admin_email: admin?.email || '—',
        admin_nome: admin?.nome || '—',
        giorni_rimasti: giorniRimasti
      };
    });

    // KPI
    const kpi = {
      totale: clubs.length,
      trial: clubs.filter(c => c.piano === 'trial' && c.attivo).length,
      starter: clubs.filter(c => c.piano === 'starter').length,
      club: clubs.filter(c => c.piano === 'club').length,
      sospesi: clubs.filter(c => c.piano === 'sospeso' || !c.attivo).length,
      mrr: clubs.filter(c => c.piano === 'starter').length * 29 + clubs.filter(c => c.piano === 'club').length * 79
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubs: result, kpi })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
