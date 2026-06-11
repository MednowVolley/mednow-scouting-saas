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

  // Azioni POST
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const clubId = body.club_id;
    if (!clubId) return { statusCode: 400, body: JSON.stringify({ error: 'club_id mancante' }) };

    // Protezione: mai toccare Mednow Volley (club 1) e SaaS Admin (club 7)
    if ([1, 7].includes(Number(clubId))) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Club protetto' }) };
    }

    if (body.action === 'extend_trial') {
      const now = new Date();
      const { data: club } = await supabase.from('clubs').select('trial_scade_il').eq('id', clubId).single();
      const base = club?.trial_scade_il && new Date(club.trial_scade_il) > now ? new Date(club.trial_scade_il) : now;
      base.setDate(base.getDate() + 7);
      await supabase.from('clubs').update({ trial_scade_il: base.toISOString(), piano: 'trial', attivo: true }).eq('id', clubId);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'suspend') {
      await supabase.from('clubs').update({ attivo: false }).eq('id', clubId);
      await supabase.from('utenti').update({ attivo: false }).eq('club_id', clubId);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'activate') {
      await supabase.from('clubs').update({ attivo: true }).eq('id', clubId);
      await supabase.from('utenti').update({ attivo: true }).eq('club_id', clubId);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    if (body.action === 'change_plan' && ['trial','starter','club','pro'].includes(body.piano)) {
      await supabase.from('clubs').update({ piano: body.piano, attivo: true }).eq('id', clubId);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'Azione non valida' }) };
  }

  try {
    // Fetch tutti i club
    const { data: clubs, error: clubsErr } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });
    if (clubsErr) throw clubsErr;

    // Admin per club
    const { data: utenti, error: utentiErr } = await supabase
      .from('utenti')
      .select('club_id, email, nome, ruolo, attivo');
    if (utentiErr) throw utentiErr;

    // Conteggio atlete per club
    const { data: atleteCounts, error: atleteErr } = await supabase
      .rpc('count_atlete_per_club');
    if (atleteErr) throw atleteErr;
    const atleteMap = {};
    (atleteCounts || []).forEach(r => { atleteMap[r.club_id] = r.n; });

    // Merge
    const result = clubs.map(club => {
      const clubUsers = utenti.filter(u => u.club_id === club.id);
      const admin = clubUsers.find(u => u.ruolo === 'admin');
      const trialScade = club.trial_scade_il ? new Date(club.trial_scade_il) : null;
      const now = new Date();
      const giorniRimasti = trialScade ? Math.ceil((trialScade - now) / (1000*60*60*24)) : null;
      return {
        ...club,
        admin_email: admin?.email || '—',
        admin_nome: admin?.nome || '—',
        n_utenti: clubUsers.length,
        n_atlete: atleteMap[club.id] || 0,
        giorni_rimasti: giorniRimasti
      };
    });

    // KPI
    const kpi = {
      totale: clubs.length,
      trial: clubs.filter(c => c.piano === 'trial' && c.attivo).length,
      starter: clubs.filter(c => c.piano === 'starter').length,
      club: clubs.filter(c => c.piano === 'club').length,
      sospesi: clubs.filter(c => !c.attivo).length,
      mrr: clubs.filter(c => c.piano === 'starter' && c.attivo).length * 29 + clubs.filter(c => c.piano === 'club' && c.attivo).length * 79
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
