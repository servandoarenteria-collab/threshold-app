import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const {
      serviceName,
      priceCents,
      businessId,
      serviceId,
      bookingDate,
      bookingTime,
      customerName,
      customerEmail,
      returnUrl,
    } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: serviceName },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        businessId,
        serviceId,
        serviceName,
        bookingDate,
        bookingTime,
        customerName,
        customerEmail,
      },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
