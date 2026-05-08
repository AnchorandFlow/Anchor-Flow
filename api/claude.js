// /api/claude.js
// Vercel serverless function — proxies requests to Anthropic API.
// Keeps the API key server-side so it's never exposed to the browser.
//
// Setup: add ANTHROPIC_API_KEY to your Vercel project environment variables.
// Project Settings → Environment Variables → add ANTHROPIC_API_KEY

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    return res.status(500).json({ error: "Proxy request failed" });
  }
}
