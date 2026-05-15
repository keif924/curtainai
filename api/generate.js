// Vercel Serverless Function — KIE AI 代理
// 模型：google/nano-banana-edit（Image to Image）
// 上傳：kieai.redpandaai.co/api/file-base64-upload（JSON Base64）

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

    let imageUrl = null;

    // 步驟 1: 用 Base64 Upload API 上傳圖片，取得公開 URL
    if (image_input && image_input.length > 0) {
      const dataUrl = image_input[0]; // 完整 data URL: data:image/jpeg;base64,...

      const uploadRes = await fetch(KIE_UPLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data: dataUrl,           // 直接傳 data URL
          uploadPath: 'curtainai',
          fileName: `room_${Date.now()}.jpg`,
        }),
      });

      const uploadText = await uploadRes.text();
      console.log('Upload status:', uploadRes.status, uploadText.slice(0, 300));

      if (!uploadRes.ok) {
        return res.status(500).json({ error: `圖片上傳失敗 ${uploadRes.status}: ${uploadText.slice(0, 100)}` });
      }

      const uploadData = JSON.parse(uploadText);
      // 取得可公開訪問的 URL
      imageUrl = uploadData?.data?.downloadUrl 
        || uploadData?.data?.fileUrl 
        || uploadData?.downloadUrl 
        || null;

      console.log('Image URL:', imageUrl);

      if (!imageUrl) {
        return res.status(500).json({ error: '上傳成功但未取得圖片 URL，回應：' + uploadText.slice(0, 200) });
      }
    }

    // 步驟 2: 呼叫 google/nano-banana-edit
    const payload = {
      model: 'google/nano-banana-edit',
      input: {
        prompt,
        image_urls: imageUrl ? [imageUrl] : [],
        output_format: 'png',
        image_size: '1:1',
      },
    };

    console.log('Calling KIE model: google/nano-banana-edit, prompt:', prompt.slice(0, 60));

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
