// Vercel Serverless Function — KIE AI 代理
// 支援兩種模式：
// 1. 有圖片 → 上傳圖片 → google/nano-banana-edit（空間效果圖）
// 2. 無圖片 → 直接生成 → nano-banana-2（材質特寫）

const KIE_KEY = process.env.KIE_API_KEY || 'd075cdbb4e77102096373752ccf92827';
const KIE_BASE = 'https://api.kie.ai';
const KIE_UPLOAD = 'https://kieai.redpandaai.co/api/file-base64-upload';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, image_input } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const hasImage = image_input && image_input.length > 0 && image_input[0];

    let payload;

    if (hasImage) {
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
        `Content-Type: ${mimeType}${CRLF}${CRLF}`,
        'utf8'
      );
      const foot = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
      const bodyBuf = Buffer.concat([head, buffer, foot]);

      const uploadRes = await fetch(KIE_UPLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuf,
      });

      const uploadText = await uploadRes.text();
      console.log('Upload:', uploadRes.status, uploadText.slice(0, 200));

      if (!uploadRes.ok) {
        return res.status(500).json({ error: `圖片上傳失敗 ${uploadRes.status}: ${uploadText.slice(0, 100)}` });
      }

      const uploadData = JSON.parse(uploadText);
      const imageUrl = uploadData?.data?.downloadUrl || uploadData?.data?.fileUrl || uploadData?.downloadUrl;

      if (!imageUrl) {
        return res.status(500).json({ error: '上傳成功但未取得圖片 URL' });
      }

      payload = {
        model: 'google/nano-banana-edit',
        input: {
          prompt,
          image_urls: [imageUrl],
          output_format: 'png',
          image_size: '1:1',
        },
      };
      console.log('Mode: image-to-image (nano-banana-edit)');

    } else {
      payload = {
        model: 'nano-banana-2',
        input: {
          prompt,
          image_input: [],
          aspect_ratio: '1:1',
          resolution: '1K',
          output_format: 'png',
        },
      };
      console.log('Mode: text-to-image (nano-banana-2) for swatch');
    }

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
