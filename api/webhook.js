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
      
      if (events && events.length > 0) {
        const event = events[0];
        const replyToken = event.replyToken;

        // ดักจับรูปภาพ
        if (event.type === "message" && event.message.type === "image") {
          const messageId = event.message.id;
          const imageBuffer = await getLineImage(messageId);
          const aiResult = await analyzeFoodWithGemini(imageBuffer);
          await replyFlexMessage(replyToken, aiResult);
        } 
        // ดักจับข้อความหรือปุ่ม Quick Reply ที่ผู้ใช้กดส่งมา
        else if (event.type === "message" && event.message.type === "text") {
          const userText = event.message.text.trim();
          
          if (userText === "โดเนท" || userText === "สนับสนุน" || userText === "Donate") {
            await replyDonateFlex(replyToken);
          } else {
            await replyText(replyToken, "ส่งรูปอาหารของคุณมาให้เราวิเคราะห์แคลอรีได้เลยครับ! 📸🍽️");
          }
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

async function getLineImage(messageId) {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      "Authorization": `Bearer ${LINE_TOKEN}`
    }
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function analyzeFoodWithGemini(imageBuffer) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  
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
  
  const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  try {
    return JSON.parse(cleanJsonText);
  } catch (e) {
    console.error("JSON Parse Error:", e, text);
    return {
      name: "ไม่สามารถระบุได้ชัดเจน",
      calories: "N/A",
      carb: "-", protein: "-", fat: "-",
      description: "ขออภัยครับ กรุณาส่งรูปที่เห็นอาหารชัดเจนกว่านี้อีกนิดนะครับ"
    };
  }
}

async function replyFlexMessage(replyToken, data) {
  const affiliateAds = [
    {
      imageUrl: "https://down-th.img.susercontent.com/file/th-11134207-81zti-mg6dafkmxlajac.jpg", 
      clickUrl: "https://s.shopee.co.th/BTvGjsXqB" 
    },
    {
      imageUrl: "https://down-th.img.susercontent.com/file/th-11134207-81zte-mimgbv3vkyrm1b.jpg", 
      clickUrl: "https://s.shopee.co.th/7ptMOV29sd" 
    },
    {
      imageUrl: "https://down-th.img.susercontent.com/file/th-11134207-81ztd-mllv6fxi5rep37.jpg",
      clickUrl: "https://s.shopee.co.th/9fL0ZiMFRJ" 
    }
  ];

  const randomAd = affiliateAds[Math.floor(Math.random() * affiliateAds.length)];

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
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: randomAd.imageUrl, 
            size: "full",
            aspectRatio: "1:1", 
            aspectMode: "cover",
            action: {
              type: "uri",
              label: "ดูรายละเอียดสินค้า", 
              uri: randomAd.clickUrl 
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

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
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

  if (!response.ok) {
    const errData = await response.json();
    console.error("LINE API Error (Flex):", JSON.stringify(errData));
  }
}

// ฟังก์ชันส่งการ์ดโดเนท
async function replyDonateFlex(replyToken) {
  const flexMessage = {
    type: "flex",
    altText: "สนับสนุนนักพัฒนา (Donate)",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "☕ สนับสนุนนักพัฒนา", weight: "bold", color: "#1DB446", size: "md" }
        ]
      },
      hero: {
        type: "image",
        url: "https://promptpay.io/0985058698.png", 
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "contain",
        action: {
          type: "uri",
          uri: "https://promptpay.io/0985058698.png"
        }
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "พร้อมเพย์ (PromptPay)", weight: "bold", size: "sm", color: "#555555" },
          { type: "text", text: "098-505-8698", size: "xl", weight: "bold", color: "#111111", margin: "md" },
          { type: "text", text: "ขอบคุณที่สนับสนุนครับ 🙏", size: "xs", color: "#888888", margin: "sm" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1DB446",
            action: {
              type: "clipboard",
              label: "📋 คัดลอกเบอร์",
              clipboardText: "0985058698" 
            }
          },
          {
            type: "text",
            text: "*แตะที่รูป QR Code เพื่อบันทึกลงเครื่อง",
            wrap: true,
            size: "xxs",
            color: "#aaaaaa",
            align: "center",
            margin: "md"
          }
        ]
      }
    }
  };

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
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

  if (!response.ok) {
    const errData = await response.json();
    console.error("LINE API Error (Donate):", JSON.stringify(errData));
  }
}

// ฟังก์ชันส่งข้อความพร้อมปุ่ม Quick Reply (เพิ่มปุ่มโดเนทเข้าไปแล้ว)
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
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "☕ โดเนทสนับสนุน",
                text: "โดเนท"
              }
            }
          ]
        }
      }]
    })
  });
}
