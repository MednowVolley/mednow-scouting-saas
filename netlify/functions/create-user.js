// Netlify Function: crea utente Supabase in modo sicuro
// La service_role key sta SOLO qui, mai nel frontend
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPA = 'https://zaxbwqxnrofiggldoahw.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_aS4aRr3OMwWLOT1TmIhGPg_gfY-dwIO';

  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Service key non configurata' }) };
  }

  try {
    const { email, password, nome, ruolo, societa, authToken } = JSON.parse(event.body);

    if (!email || !password || !nome || !ruolo || !authToken) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Parametri mancanti' }) };
    }
    if (password.length < 8) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password min. 8 caratteri' }) };
    }

    // 1. Verifica che il chiamante sia autenticato e admin
    const userRes = await fetch(SUPA + '/auth/v1/user', {
      headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + authToken }
    });
    const caller = await userRes.json();
    if (!caller?.id) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Non autenticato' }) };
    }

    // 2. Verifica ruolo admin del chiamante
    const profileRes = await fetch(SUPA + '/rest/v1/utenti?id=eq.' + caller.id + '&select=ruolo,club_id,is_saas_admin', {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
    });
    const profiles = await profileRes.json();
    const callerProfile = profiles?.[0];
    if (!callerProfile || (callerProfile.ruolo !== 'admin' && !callerProfile.is_saas_admin)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Solo gli admin possono creare utenti' }) };
    }

    // 3. Crea utente auth
    const createRes = await fetch(SUPA + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const newUser = await createRes.json();
    if (!newUser?.id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: newUser?.msg || 'Errore creazione utente' }) };
    }

    // 4. Crea profilo - club_id ereditato dal chiamante (isolamento multi-tenant)
    const profilePayload = {
      id: newUser.id, email, nome, ruolo,
      societa: societa || null,
      club_id: callerProfile.club_id,
      attivo: true
    };
    const insRes = await fetch(SUPA + '/rest/v1/utenti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Prefer': 'return=representation' },
      body: JSON.stringify([profilePayload])
    });
    const inserted = await insRes.json();

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, user: inserted?.[0] || profilePayload }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
