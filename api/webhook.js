const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send("Bot Backend is running on Vercel!");
  }

  if (req.method === 'POST') {
    try {
      const events = req.body.events;
      if (events && events.length > 0) {
         console.log("ได้รับข้อมูลจาก LINE:", events[0]);
      }
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).send("Server Error");
    }
  }
}
