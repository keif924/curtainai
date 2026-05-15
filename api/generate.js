// Vercel Serverless Function — KIE AI 代理
// 模型：google/nano-banana-edit（Image to Image）
// 流程：base64 → 上傳 KIE 取得 URL → 呼叫生成 API

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

    // 步驟 1: 上傳圖片到 KIE，取得可公開訪問的 URL
    if (image_input && image_input.length > 0) {
      const dataUrl = image_input[0];
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (!matches) return res.status(400).json({ error: 'Invalid image format' });

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.split('/')[1] || 'jpg';
      const boundary = '----VercelBoundary' + Date.now().toString(16);
      const CRLF = '\r\n';

      const head = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="image.${ext}"${CRLF}` +
        `Content-Type: ${mimeType}${CRLF}` +
        `${CRLF}`,
        'utf8'
      );
      const foot = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
      const bodyBuf = Buffer.concat([head, buffer, foot]);

      try {
        const uploadRes = await fetch(`${KIE_BASE}/api/v1/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${KIE_KEY}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: bodyBuf,
        });

        const uploadText = await uploadRes.text();
        console.log('Upload response:', uploadRes.status, uploadText.slice(0, 200));

        if (uploadRes.ok) {
          const uploadData = JSON.parse(uploadText);
          imageUrl = uploadData?.data?.url || uploadData?.url || null;
        }
      } catch (e) {
        console.log('Upload error:', e.message);
      }

      if (!imageUrl) {
        return res.status(500).json({ error: '圖片上傳失敗，無法取得圖片 URL。請確認 KIE File Upload API 已啟用。' });
      }
    }

    // 步驟 2: 呼叫 google/nano-banana-edit
    // 注意：此模型用 image_urls（非 image_input），格式為 URL 陣列
    const payload = {
      model: 'google/nano-banana-edit',
      input: {
        prompt,
        image_urls: imageUrl ? [imageUrl] : [],
        output_format: 'png',
        image_size: 'auto',
      },
    };

    console.log('Calling google/nano-banana-edit, imageUrl:', imageUrl?.slice(0, 60));

    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await kieRes.json();
    console.log('KIE response:', JSON.stringify(data));

    if (!kieRes.ok) return res.status(kieRes.status).json({ error: data });
    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
