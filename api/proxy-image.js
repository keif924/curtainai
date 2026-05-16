// Vercel Serverless Function - Image Proxy for download
// 繞過 CORS，讓前端可以下載外部圖片

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const decoded = decodeURIComponent(url);
    // Only allow KIE AI image URLs for security
    if (!decoded.includes('kie.ai') && !decoded.includes('kieai') && !decoded.includes('redpandaai')) {
      return res.status(403).json({ error: 'URL not allowed' });
    }

    const response = await fetch(decoded);
    if (!response.ok) return res.status(response.status).json({ error: 'Upstream error' });

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="CurtainAI.png"');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
