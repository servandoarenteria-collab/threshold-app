export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { customerEmail, customerName, businessName, serviceName, bookingDate, bookingTime } = req.body;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${businessName} <bookings@slothaus.us>`,
        to: customerEmail,
        subject: `You're booked with ${businessName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #14181F;">You're booked, ${customerName}!</h2>
            <p style="color: #444;">Here are your appointment details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #888;">Service</td><td style="padding: 8px 0; font-weight: 600;">${serviceName}</td></tr>
              <tr><td style="padding: 8px 0; color: #888;">Date</td><td style="padding: 8px 0; font-weight: 600;">${bookingDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #888;">Time</td><td style="padding: 8px 0; font-weight: 600;">${bookingTime}</td></tr>
              <tr><td style="padding: 8px 0; color: #888;">With</td><td style="padding: 8px 0; font-weight: 600;">${businessName}</td></tr>
            </table>
            <p style="color: #888; font-size: 13px;">If you need to reschedule or cancel, contact ${businessName} directly.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.message || "Failed to send email" });
    }

    res.status(200).json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
