const { GoogleGenerativeAI } = require("@google/generative-ai");

// ดึงคีย์จาก Vercel Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("Bot Backend is running!");
  }

  if (req.method === "POST") {
    try {
      const events = req.body.events;
      
      // ตรวจสอบว่ามี Event ส่งมา และเป็นข้อความหรือไม่
      if (events && events.length > 0) {
        const event = events[0];
        const replyToken = event.replyToken;

        // ถ้าผู้ใช้ส่ง "รูปภาพ" เข้ามา
        if (event.type === "message" && event.message.type === "image") {
          const messageId = event.message.id;
          
          // 1. ไปดาวน์โหลดรูปภาพจากเซิร์ฟเวอร์ LINE
          const imageBuffer = await getLineImage(messageId);
          
          // 2. ส่งรูปให้ Gemini AI วิเคราะห์
          const aiResult = await analyzeFoodWithGemini(imageBuffer);
          
          // 3. สร้างและส่ง Flex Message กลับไปหาผู้ใช้
          await replyFlexMessage(replyToken, aiResult);
        } 
        // ถ้าผู้ใช้ส่ง "ข้อความ" ธรรมดา
        else if (event.type === "message" && event.message.type === "text") {
          await replyText(replyToken, "ส่งรูปอาหารของคุณมาให้เราวิเคราะห์แคลอรีได้เลยครับ! 📸🍽️");
        }
      }
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).send("Server Error");
    }
  }
}

// ------------------------------------------------------------------
// ฟังก์ชันย่อยสำหรับทำงานต่างๆ
// ------------------------------------------------------------------

// ฟังก์ชันโหลดรูปจาก LINE
async function getLineImage(messageId) {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      "Authorization": `Bearer ${LINE_TOKEN}`
    }
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ฟังก์ชันส่งรูปให้ Gemini วิเคราะห์
async function analyzeFoodWithGemini(imageBuffer) {
  
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
   
  // สั่ง AI ให้ตอบกลับมาเป็น JSON เพื่อง่ายต่อการเอาไปจัดลง Flex Message
  const prompt = `
    คุณคือนักโภชนาการเชี่ยวชาญอาหารไทย วิเคราะห์รูปอาหารนี้และประเมินแคลอรี
    จงตอบกลับมาเป็น JSON format ตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นปน):
    {
      "name": "ชื่ออาหาร",
      "calories": "ตัวเลขแคลอรีโดยประมาณ (เช่น 450 - 500)",
      "carb": "ปริมาณคาร์บ (g)",
      "protein": "ปริมาณโปรตีน (g)",
      "fat": "ปริมาณไขมัน (g)",
      "description": "คำอธิบายสั้นๆ เกี่ยวกับอาหารนี้และข้อควรระวัง"
    }
  `;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: "image/jpeg"
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text();
  
  // ลบตัวครอบ Markdown ของ JSON (ถ้า AI ใส่มา) เพื่อให้แปลงเป็น Object ได้
  const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  try {
    return JSON.parse(cleanJsonText);
  } catch (e) {
    console.error("JSON Parse Error:", e, text);
    // กรณี AI ดื้อ ไม่ยอมตอบเป็น JSON
    return {
      name: "ไม่สามารถระบุได้ชัดเจน",
      calories: "N/A",
      carb: "-", protein: "-", fat: "-",
      description: "ขออภัยครับ กรุณาส่งรูปที่เห็นอาหารชัดเจนกว่านี้อีกนิดนะครับ"
    };
  }
}

// ฟังก์ชันส่ง Flex Message กลับไปที่ LINE (แบบมีแบนเนอร์โฆษณา)
async function replyFlexMessage(replyToken, data) {
  const flexMessage = {
    type: "flex",
    altText: `ผลวิเคราะห์แคลอรี: ${data.name}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🍽️ ผลวิเคราะห์อาหาร", weight: "bold", color: "#1DB446", size: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: data.name, weight: "bold", size: "xl", wrap: true },
          { type: "text", text: `🔥 ${data.calories} kcal`, size: "md", color: "#ff3344", margin: "md", weight: "bold" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box", layout: "baseline", spacing: "sm",
                contents: [
                  { type: "text", text: "คาร์บ", color: "#aaaaaa", size: "sm", flex: 1 },
                  { type: "text", text: `${data.carb} g`, wrap: true, color: "#666666", size: "sm", flex: 3 }
                ]
              },
              {
                type: "box", layout: "baseline", spacing: "sm",
                contents: [
                  { type: "text", text: "โปรตีน", color: "#aaaaaa", size: "sm", flex: 1 },
                  { type: "text", text: `${data.protein} g`, wrap: true, color: "#666666", size: "sm", flex: 3 }
                ]
              },
              {
                type: "box", layout: "baseline", spacing: "sm",
                contents: [
                  { type: "text", text: "ไขมัน", color: "#aaaaaa", size: "sm", flex: 1 },
                  { type: "text", text: `${data.fat} g`, wrap: true, color: "#666666", size: "sm", flex: 3 }
                ]
              }
            ]
          },
          { type: "text", text: data.description, wrap: true, color: "#888888", size: "xs", margin: "xl" }
        ]
      },
      // ส่วน Footer สำหรับใส่รูปแบนเนอร์โฆษณา
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: "https://img.freepik.com/free-vector/healthy-food-banner-template_23-2149021671.jpg", // ลิงก์รูปโฆษณา (ต้องเป็น https)
            size: "full",
            aspectRatio: "20:7",
            aspectMode: "cover",
            action: {
              type: "uri",
              label: "คลิกเพื่อดูโฆษณา",
              uri: "https://shopee.co.th/" // ลิงก์ปลายทางเมื่อคนกดรูปโฆษณา
            }
          },
          {
            type: "text",
            text: "SPONSORED",
            color: "#cccccc",
            size: "xxs",
            align: "end",
            margin: "sm"
          }
        ]
      }
    }
  };

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [flexMessage]
    })
  });
}

// ฟังก์ชันส่งข้อความธรรมดาพร้อมปุ่ม Quick Reply ให้กดเปิดกล้องได้
async function replyText(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ 
        type: "text", 
        text: text,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "camera",
                label: "📸 เปิดกล้องถ่ายรูป"
              }
            },
            {
              type: "action",
              action: {
                type: "cameraRoll",
                label: "🖼️ เลือกจากอัลบั้ม"
              }
            }
          ]
        }
      }]
    })
  });
}
