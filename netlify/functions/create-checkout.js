const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  starter: 'price_1TexRiChaDXeD6E8TMMI1o30',
  club:    'price_1TexS6ChaDXeD6E8YI0lwpEA'
};

const BASE_URL = 'https://mednowscouting.it';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan, club_id, email } = JSON.parse(event.body || '{}');

    if (!plan || !club_id || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Parametri mancanti' }) };
    }

    const priceId = PRICES[plan];
    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Piano non valido' }) };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      customer_email: email,
      success_url: `${BASE_URL}/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/app?payment=cancelled`,
      metadata: { club_id: String(club_id), plan },
      locale: 'it',
      subscription_data: {
        trial_period_days: 0,
        metadata: { club_id: String(club_id), plan }
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
