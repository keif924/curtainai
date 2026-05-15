// Vercel Serverless Function — KIE AI 任務狀態查詢代理
// 前端呼叫 /api/status?taskId=xxx，此函式代為查詢 KIE AI

const KIE_KEY = process.env.KIE_API_KEY || 'd075cdbb4e77102096373752ccf92827';
const KIE_BASE = 'https://api.kie.ai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://curtainai-wine.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId' });
  }

  try {
    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
      },
    });

    const data = await kieRes.json();

    if (!kieRes.ok) {
      return res.status(kieRes.status).json({ error: data });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('KIE status error:', err);
    return res.status(500).json({ error: err.message });
  }
}
