// api/subscribe.js
// Vercel Edge Function — forwards email signups to Kit (ConvertKit)
// Place this file at: /api/subscribe.js in your project root
//
// No environment variables needed — form ID comes from the client
// Kit's public form endpoint doesn't require an API key

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, formId } = req.body;

  // Basic validation
  if (!email || !email.includes('@') || !formId) {
    return res.status(400).json({ error: 'Missing email or formId' });
  }

  try {
    // Kit's public subscribe endpoint — no API key required for form subscriptions
    const kitRes = await fetch(`https://api.kit.com/v4/forms/${formId}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: email })
    });

    if (!kitRes.ok) {
      const errText = await kitRes.text();
      console.error('Kit API error:', kitRes.status, errText);
      return res.status(500).json({ error: 'Kit subscription failed' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
