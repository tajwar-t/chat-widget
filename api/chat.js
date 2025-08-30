// api/chat.js
export default async function handler(req, res) {
  const allowedOrigin = "https://devilsdick.myshopify.com";

  // --- Set CORS headers on every response ---
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- Handle OPTIONS preflight ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Health check ---
  if (req.method === "GET") {
    return res.status(200).json({ status: "Chat proxy running ✅" });
  }

  // --- POST: chat message ---
  if (req.method === "POST") {
    try {
      const { message } = req.body;
      if (!message || message.trim() === "")
        return res.status(400).json({ error: "Message is required" });

      if (!process.env.OPENAI_API_KEY)
        return res.status(500).json({ error: "OpenAI API key missing!" });

      if (!process.env.SHOPIFY_ADMIN_API_TOKEN || !process.env.SHOPIFY_STORE_DOMAIN)
        return res.status(500).json({ error: "Shopify Admin API credentials missing!" });

      const safeClean = (text) =>
        text ? text.replace(/<[^>]*>?/gm, "").replace(/\n+/g, " ").trim() : "";

      // --- Fetch Shopify products ---
      let productSummary = "No products available.";
      try {
        const productsRes = await fetch(
          `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/products.json?limit=10`,
          {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        const productsData = await productsRes.json();
        const products = Array.isArray(productsData?.products) ? productsData.products : [];

        if (products.length) {
          productSummary = products
            .map((p, i) => `- ${p.title}: ${safeClean(p.body_html)}`)
            .join("\n");
        }
      } catch (e) {
        console.error("❌ Shopify products fetch failed:", e);
      }

      // --- Fetch Shopify policies ---
      let policySummary = "No store policies available.";
      try {
        const policiesRes = await fetch(
          `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/policies.json`,
          {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        const policiesData = await policiesRes.json();
        const policies = Array.isArray(policiesData?.policies) ? policiesData.policies : [];

        if (policies.length) {
          policySummary = policies
            .map((p) => `- ${p.title}: ${safeClean(p.body)}`)
            .join("\n");
        }
      } catch (e) {
        console.error("❌ Shopify policies fetch failed:", e);
      }

      // --- System prompt for OpenAI ---
      const systemMessage = `
You are Planty, a friendly Shopify AI assistant.
Always answer customer questions using ONLY the following product and policy data.
Do not make up product names or policies.
If a product or info is missing, respond politely that it's unavailable.

Products:
${productSummary}

Policies:
${policySummary}
`;

      // --- Send request to OpenAI ---
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: message },
          ],
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Sorry, I don’t have an answer right now.";

      return res.status(200).json({ reply });
    } catch (err) {
      console.error("❌ Proxy error:", err);
      return res.status(200).json({ reply: "Sorry, I don’t have an answer right now." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
