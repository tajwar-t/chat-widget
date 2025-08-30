export default async function handler(req, res) {
  const allowedOrigin = "https://devilsdick.myshopify.com"; // Replace with your store URL
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ status: "Chat proxy running ✅" });
  }

  if (req.method === "POST") {
    try {
      const { message } = req.body;

      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key missing!" });
      }

      // 🔹 Fetch Shopify products
      const productsRes = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/products.json?limit=5`,
        {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      const productsData = await productsRes.json();
      const productSummary = productsData.products
        .map((p) => `${p.title}: ${p.body_html.replace(/<[^>]+>/g, "")}`)
        .join("\n");

      // 🔹 Fetch Shopify store policies
      const policyRes = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/policies.json`,
        {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      const policiesData = await policyRes.json();
      const policySummary = policiesData.policies
        ?.map((p) => `${p.title}: ${p.body}`)
        .join("\n") || "No policies available.";

      // 🔹 Send request to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `
You are Planty, a friendly AI assistant for the Shopify store "Devil's Dick".
Answer only about this store, its products, and policies.
If unsure, say "Let me connect you with support."

🔹 Store Products:
${productSummary}

🔹 Store Policies:
${policySummary}
`,
            },
            { role: "user", content: message },
          ],
        }),
      });

      const data = await response.json();
      const reply =
        data.choices?.[0]?.message?.content || "Sorry, I don’t know that one.";

      return res.status(200).json({ reply });
    } catch (err) {
      console.error("Proxy error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
