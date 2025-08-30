// api/chat.js
export default async function handler(req, res) {
    // --- CORS ---
    const allowedOrigin = "https://devilsdick.myshopify.com"; // your store
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    // --- Health check ---
    if (req.method === "GET") {
      return res.status(200).json({ status: "Chat proxy running ✅" });
    }
  
    // --- Chat handler ---
    if (req.method === "POST") {
      try {
        const { message } = req.body;
  
        if (!message || message.trim() === "") {
          return res.status(400).json({ error: "Message is required" });
        }
  
        if (!process.env.OPENAI_API_KEY) {
          return res.status(500).json({ error: "OpenAI API key missing!" });
        }
        if (!process.env.SHOPIFY_ADMIN_API_TOKEN || !process.env.SHOPIFY_STORE_DOMAIN) {
          return res.status(500).json({ error: "Shopify Admin API credentials missing!" });
        }
  
        // --- Helper: safe text cleanup ---
        const safeClean = (text) => {
          if (!text) return "";
          return text.replace(/<[^>]*>?/gm, "").trim();
        };
  
        // --- Fetch products from Shopify ---
        const productsRes = await fetch(
          `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/products.json?limit=5`,
          {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );
  
        const productsData = await productsRes.json();
        const products = productsData.products?.map((p) => ({
          title: p.title || "Untitled product",
          description: safeClean(p.body_html),
        })) || [];
  
        // Build context string for AI
        const productContext = products
          .map((p, i) => `(${i + 1}) ${p.title}: ${p.description}`)
          .join("\n");
  
        // --- OpenAI Chat ---
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are Planty, a helpful AI assistant for a Shopify store. 
                You can answer questions about store policies, products, and general help.
                Here are some of the latest products:\n\n${productContext}`,
              },
              { role: "user", content: message },
            ],
          }),
        });
  
        const data = await response.json();
  
        const reply = data.choices?.[0]?.message?.content || "Sorry, I don’t know.";
        return res.status(200).json({ reply });
  
      } catch (err) {
        console.error("Proxy error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  
    // --- Method not allowed ---
    return res.status(405).json({ error: "Method not allowed" });
  }
  