// Vercel Serverless Function — KIE AI 代理
// 步驟1: 上傳圖片取得 URL
// 步驟2: 用 URL 呼叫 nano-banana-edit 生成

const KIE_KEY = process.env.KIE_API_KEY || 'd075cdbb4e77102096373752ccf92827';
const KIE_BASE = 'https://api.kie.ai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_input } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    let imageUrl = null;

    // 步驟1: 若有圖片，先上傳取得 URL
    if (image_input && image_input.length > 0) {
      const dataUrl = image_input[0];
      
      // 解析 base64
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid image format' });
      
      const mimeType = matches[1]; // e.g. image/jpeg
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.split('/')[1] || 'jpg';
      const filename = `upload.${ext}`;

      // 上傳到 KIE File Upload API
      const { FormData, Blob } = await import('formdata-node');
      const form = new FormData();
      form.set('file', new Blob([buffer], { type: mimeType }), filename);

      const uploadRes = await fetch(`${KIE_BASE}/api/v1/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${KIE_KEY}` },
        body: form,
      });

      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        // 若上傳 API 不存在，改用 base64 data URL 直接傳
        console.log('Upload failed, using base64 directly:', t);
        imageUrl = dataUrl;
      } else {
        const uploadData = await uploadRes.json();
        imageUrl = uploadData?.data?.url || uploadData?.url || dataUrl;
      }
    }

    // 步驟2: 呼叫 nano-banana-edit（image-to-image 模型）
    const body = {
      model: 'nano-banana-edit',
      input: {
        prompt,
        image_input: imageUrl ? [imageUrl] : [],
        aspect_ratio: 'auto',
        resolution: '1K',
        output_format: 'png',
      },
    };

    console.log('Sending to KIE:', JSON.stringify({ model: body.model, prompt: prompt.slice(0, 80) }));

    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await kieRes.json();
    console.log('KIE response:', JSON.stringify(data));

    if (!kieRes.ok) return res.status(kieRes.status).json({ error: data });
    return res.status(200).json(data);

  } catch (err) {
    console.error('KIE API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
