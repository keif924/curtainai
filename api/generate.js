// Vercel Serverless Function — KIE AI 代理
// 使用 nano-banana-edit 模型（支援圖片輸入）
// 圖片以 base64 data URL 方式傳送

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

    // 處理圖片：先嘗試上傳取得 URL，失敗則直接用 base64
    let imageUrl = null;

    if (image_input && image_input.length > 0) {
      const dataUrl = image_input[0];
      
      // 嘗試用 KIE File Upload API 上傳圖片
      try {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.split('/')[1] || 'jpg';

          // 用 multipart/form-data 手動組裝（不依賴外部套件）
          const boundary = '----FormBoundary' + Date.now().toString(16);
          const CRLF = '\r\n';

          const header = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="file"; filename="image.${ext}"`,
            `Content-Type: ${mimeType}`,
            '',
            '',
          ].join(CRLF);

          const footer = `${CRLF}--${boundary}--${CRLF}`;

          const headerBuf = Buffer.from(header, 'utf-8');
          const footerBuf = Buffer.from(footer, 'utf-8');
          const body = Buffer.concat([headerBuf, buffer, footerBuf]);

          const uploadRes = await fetch(`${KIE_BASE}/api/v1/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${KIE_KEY}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': body.length,
            },
            body,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            imageUrl = uploadData?.data?.url || uploadData?.url || null;
            console.log('Upload success, imageUrl:', imageUrl);
          } else {
            const t = await uploadRes.text();
            console.log('Upload failed:', uploadRes.status, t);
          }
        }
      } catch (uploadErr) {
        console.log('Upload error:', uploadErr.message);
      }

      // 若上傳失敗，直接用 base64 data URL
      if (!imageUrl) {
        console.log('Using base64 data URL directly');
        imageUrl = dataUrl;
      }
    }

    // 呼叫 nano-banana-edit
    const payload = {
      model: 'nano-banana-edit',
      input: {
        prompt,
        image_input: imageUrl ? [imageUrl] : [],
        aspect_ratio: 'auto',
        resolution: '1K',
        output_format: 'png',
      },
    };

    console.log('Calling KIE model: nano-banana-edit');

    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await kieRes.json();
    console.log('KIE response code:', data.code, 'msg:', data.msg);

    if (!kieRes.ok) return res.status(kieRes.status).json({ error: data });
    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
