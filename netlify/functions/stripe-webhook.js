const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zaxbwqxnrofiggldoahw.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {

      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const club_id = session.metadata?.club_id;
        const plan = session.metadata?.plan || 'starter';
        if (!club_id) break;

        await supabase.from('clubs').update({
          piano: plan,
          attivo: true,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          trial_scade_il: null
        }).eq('id', club_id);

        console.log(`Club ${club_id} attivato: piano ${plan}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const customerId = sub.customer;

        await supabase.from('clubs').update({
          piano: 'sospeso',
          attivo: false
        }).eq('stripe_customer_id', customerId);

        console.log(`Abbonamento cancellato: customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        console.log(`Pagamento fallito: customer ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
