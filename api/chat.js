// api/chat.js
export default async function handler(req, res) {
    const allowedOrigin = "https://devilsdick.myshopify.com";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method === "GET") return res.status(200).json({ status: "Chat proxy running ✅" });
  
    if (req.method === "POST") {
      try {
        const { message } = req.body;
        if (!message || message.trim() === "") return res.status(400).json({ error: "Message is required" });
        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key missing!" });
  
        const safeClean = (text) => (text ? text.replace(/<[^>]*>?/gm, "").trim() : "");
  
        // --- Fetch products safely ---
        let productSummary = "No products available.";
        try {
          const productsRes = await fetch(
            `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/products.json?limit=5`,
            { headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN, "Content-Type": "application/json" } }
          );
          const productsData = await productsRes.json();
          const products = Array.isArray(productsData.products)
            ? productsData.products.map((p) => ({
                title: p.title || "Untitled product",
                description: safeClean(p.body_html),
              }))
            : [];
          if (products.length) productSummary = products.map((p, i) => `(${i+1}) ${p.title}: ${p.description}`).join("\n");
        } catch (e) {
          console.error("❌ Shopify products fetch failed:", e);
        }
  
        // --- Fetch policies safely ---
        let policySummary = "No store policies available.";
        try {
          const policiesRes = await fetch(
            `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/policies.json`,
            { headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN, "Content-Type": "application/json" } }
          );
          const policiesData = await policiesRes.json();
          if (Array.isArray(policiesData.policies) && policiesData.policies.length > 0) {
            policySummary = policiesData.policies.map((p) => `${p.title}: ${safeClean(p.body)}`).join("\n");
          }
        } catch (e) {
          console.error("❌ Shopify policies fetch failed:", e);
        }
  
        // --- Send to OpenAI ---
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are Planty, a friendly Shopify AI assistant.
  Use the following store info to answer customer questions.
  
  Products:
  ${productSummary}
  
  Policies:
  ${policySummary}
  
  If unsure, say "Let me connect you with support."`,
              },
              { role: "user", content: message },
            ],
          }),
        });
  
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Sorry, I don’t have an answer right now.";
        return res.status(200).json({ reply });
  
      } catch (err) {
        console.error("❌ Proxy error:", err);
        // Always return a default message to frontend
        return res.status(200).json({ reply: "Sorry, I don’t have an answer right now." });
      }
    }
  
    return res.status(405).json({ error: "Method not allowed" });
  }
  