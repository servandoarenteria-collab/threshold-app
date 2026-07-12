import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SUPABASE_URL = "https://ojwjtvbeugjfnqekpfpv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hmcl41xWWsZ5J3VlgnIZfQ___Zh3N85";

export default async function handler(req, res) {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    const m = session.metadata;

    // Avoid creating a duplicate booking if this session was already confirmed once
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?stripe_payment_intent_id=eq.${session.payment_intent}&select=id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const existing = await existingRes.json();
    if (existing.length > 0) {
      return res.status(200).json({ alreadyExists: true, metadata: m });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        business_id: m.businessId,
        service_id: m.serviceId,
        customer_name: m.customerName,
        customer_email: m.customerEmail,
        booking_date: m.bookingDate,
        booking_time: m.bookingTime,
        status: "confirmed",
        stripe_payment_intent_id: session.payment_intent,
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.message || "Failed to save booking" });
    }

    // Look up the business name for the email
    let businessName = "the business";
    try {
      const bizRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${m.businessId}&select=name`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const biz = await bizRes.json();
      if (biz[0]) businessName = biz[0].name;
    } catch (e) {}

    fetch(`${req.headers.origin || "https://" + req.headers.host}/api/send-confirmation-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: m.customerEmail,
        customerName: m.customerName,
        businessName,
        serviceName: m.serviceName,
        bookingDate: m.bookingDate,
        bookingTime: m.bookingTime,
      }),
    }).catch(() => {});

    res.status(200).json({ metadata: m });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
