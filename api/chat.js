export default async function handler(req, res) {
    // -------------------------------
    // Set CORS headers for every request
    // -------------------------------
    const allowedOrigin = "https://devilsdick.myshopify.com"; // Replace with your store URL
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    // Health check
    if (req.method === "GET") {
      return res.status(200).json({ status: "Chat proxy running ✅" });
    }
  
    // -------------------------------
    // Handle POST chat request
    // -------------------------------
    if (req.method === "POST") {
      try {
        const { message, conversation = [] } = req.body;
  
        if (!message || message.trim() === "") {
          return res.status(400).json({ error: "Message is required" });
        }
  
        if (!process.env.OPENAI_API_KEY) {
          return res.status(500).json({ error: "OpenAI API key missing!" });
        }
  
        // -------------------------------
        // Build messages array for ChatGPT
        // -------------------------------
        const messages = [
          {
            role: "system",
            content: "You are an AI assistant named Planty. Always respond as Planty in a friendly tone."
          },
          ...conversation, // optional previous conversation for context
          {
            role: "user",
            content: message
          }
        ];
  
        // -------------------------------
        // Call OpenAI API
        // -------------------------------
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages
          })
        });
  
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "Sorry, I don’t know.";
  
        return res.status(200).json({ reply });
  
      } catch (err) {
        console.error("Proxy error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  
    return res.status(405).json({ error: "Method not allowed" });
  }
  