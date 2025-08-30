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
    let productSummary = "No products found.";
    try {
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
      if (productsData.products?.length) {
        productSummary = productsData.products
          .map((p) => `${p.title}: ${p.body_html.replace(/<[^>]+>/g, "")}`)
          .join("\n");
      }
    } catch (e) {
      console.error("❌ Shopify Products Fetch Error:", e);
    }

    // 🔹 Fetch Shopify store policies
    let policySummary = "No policies available.";
    try {
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
      if (policiesData.policies?.length) {
        policySummary = policiesData.policies
          .map((p) => `${p.title}: ${p.body}`)
          .join("\n");
      }
    } catch (e) {
      console.error("❌ Shopify Policies Fetch Error:", e);
    }

    console.log("✅ Products sent to AI:", productSummary);
    console.log("✅ Policies sent to AI:", policySummary);

    // 🔹 Send to OpenAI
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
Always answer about this store’s products and policies using the data below.
If unsure, say: "Let me connect you with support."

Products:
${productSummary}

Policies:
${policySummary}
`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    console.log("🔎 OpenAI response:", data);

    const reply =
      data.choices?.[0]?.message?.content || "Sorry, I don’t know that one.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
