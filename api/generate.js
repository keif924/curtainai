// Vercel Serverless Function — KIE AI 代理
// 模式 1（有圖片）: JSON base64 上傳 → nano-banana-edit
// 模式 2（無圖片）: 純文字 → nano-banana-2（材質特寫）

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
      // ── 模式 1：JSON base64 上傳取得 URL ──────────────────────
      const dataUrl = image_input[0];

      // 用 JSON body 方式上傳（避免 multipart 問題）
      const uploadRes = await fetch(KIE_UPLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data: dataUrl,
          uploadPath: 'curtainai',
          fileName: 'room_' + Date.now() + '.jpg',
        }),
      });

      const uploadText = await uploadRes.text();
      console.log('Upload status:', uploadRes.status);
      console.log('Upload response:', uploadText.slice(0, 300));

      if (!uploadRes.ok) {
        // 上傳失敗，嘗試直接用 base64 data URL 傳給 KIE
        console.log('Upload failed, trying direct base64 in image_input...');
        
        // 嘗試方案 B：直接用 nano-banana-edit 的 image_input 傳 base64
        const payloadB = {
          model: 'nano-banana-2',
          input: {
            prompt,
            image_input: [dataUrl],
            aspect_ratio: 'auto',
            resolution: '1K',
            output_format: 'png',
          },
        };

        const kieResB = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${KIE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payloadB),
        });

        const dataB = await kieResB.json();
        console.log('Fallback KIE response:', JSON.stringify(dataB));

        if (!kieResB.ok) return res.status(kieResB.status).json({ error: dataB });
        return res.status(200).json(dataB);
      }

      // 上傳成功，取得 URL
      let uploadData;
      try { uploadData = JSON.parse(uploadText); } catch(e) { uploadData = {}; }
      
      const imageUrl = uploadData?.data?.downloadUrl
        || uploadData?.data?.fileUrl
        || uploadData?.downloadUrl
        || uploadData?.fileUrl;

      console.log('Image URL:', imageUrl);

      if (!imageUrl) {
        return res.status(500).json({ 
          error: '上傳成功但無法取得 URL，回應：' + uploadText.slice(0, 150) 
        });
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
      console.log('Mode: image-to-image via URL');

    } else {
      // ── 模式 2：無圖片，純文字生成材質特寫 ────────────────────
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
      console.log('Mode: text-to-image for swatch');
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
    console.log('KIE final response:', JSON.stringify(data));

    if (!kieRes.ok) return res.status(kieRes.status).json({ error: data });
    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
