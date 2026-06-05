const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zaxbwqxnrofiggldoahw.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { club_id } = JSON.parse(event.body || '{}');
    if (!club_id) return { statusCode: 400, body: JSON.stringify({ error: 'club_id mancante' }) };

    // Recupera stripe_customer_id dal club
    const { data: club, error } = await supabase
      .from('clubs')
      .select('stripe_customer_id, nome')
      .eq('id', club_id)
      .single();

    if (error || !club?.stripe_customer_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nessun abbonamento attivo trovato' }) };
    }

    // Crea sessione Customer Portal
    const session = await stripe.billingPortal.sessions.create({
      customer: club.stripe_customer_id,
      return_url: 'https://mednowscouting.it/app',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('Portal error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
