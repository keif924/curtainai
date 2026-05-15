// Vercel Serverless Function — KIE AI 代理
// 前端呼叫 /api/generate，此函式代為呼叫 KIE AI
// API Key 安全地存在後端，不會暴露給用戶

const KIE_KEY = process.env.KIE_API_KEY || 'd075cdbb4e77102096373752ccf92827';
const KIE_BASE = 'https://api.kie.ai';

export default async function handler(req, res) {
  // CORS headers — 只允許自己的網域
  res.setHeader('Access-Control-Allow-Origin', 'https://curtainai-wine.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, image_input, aspect_ratio, resolution, output_format } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // 呼叫 KIE AI
    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-2',
        input: {
          prompt,
          image_input: image_input || [],
          aspect_ratio: aspect_ratio || 'auto',
          resolution: resolution || '1K',
          output_format: output_format || 'png',
        },
      }),
    });

    const data = await kieRes.json();

    if (!kieRes.ok) {
      return res.status(kieRes.status).json({ error: data });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('KIE API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
