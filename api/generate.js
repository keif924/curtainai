// Vercel Serverless Function — KIE AI 代理
// 優化：圖片只上傳一次，URL 傳入後直接使用
// 模式 1（有 imageUrl）: 直接用 URL 呼叫 nano-banana-edit
// 模式 2（有 image_input base64）: 先上傳取得 URL，再生成
// 模式 3（無圖片）: 純文字生成材質特寫

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
    const { prompt, image_input, imageUrl: preUploadedUrl } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    let payload;

    if (preUploadedUrl) {
      // ── 模式 1：已有上傳好的 URL（最快，無需再上傳）──────────
      console.log('Mode: using pre-uploaded URL');
      payload = {
        model: 'google/nano-banana-edit',
        input: {
          prompt,
          image_urls: [preUploadedUrl],
          output_format: 'png',
          image_size: '1:1',
        },
      };

    } else if (image_input && image_input.length > 0 && image_input[0]) {
      // ── 模式 2：上傳 base64 取得 URL ──────────────────────────
      const dataUrl = image_input[0];
      console.log('Mode: uploading image first...');

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
      console.log('Upload status:', uploadRes.status, uploadText.slice(0, 200));

      let imageUrl = null;
      if (uploadRes.ok) {
        try {
          const uploadData = JSON.parse(uploadText);
          imageUrl = uploadData?.data?.downloadUrl
            || uploadData?.data?.fileUrl
            || uploadData?.downloadUrl
            || uploadData?.fileUrl;
        } catch(e) {}
      }

      if (!imageUrl) {
        return res.status(500).json({ error: '圖片上傳失敗：' + uploadText.slice(0, 100) });
      }

      // 回傳 imageUrl 讓前端存起來，後續任務直接使用
      console.log('Upload success, imageUrl:', imageUrl);
      payload = {
        model: 'google/nano-banana-edit',
        input: {
          prompt,
          image_urls: [imageUrl],
          output_format: 'png',
          image_size: '1:1',
        },
      };

      // 把 imageUrl 附在回應裡，讓前端快取
      const result = await callKIE(payload);
      if (result.code === 200 && result.data?.taskId) {
        result._uploadedUrl = imageUrl; // 附帶上傳好的 URL
      }
      return res.status(200).json(result);

    } else {
      // ── 模式 3：無圖片，材質特寫 ──────────────────────────────
      console.log('Mode: text-to-image for swatch');
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
    }

    const result = await callKIE(payload);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function callKIE(payload) {
  // 重試最多 3 次
  let lastData = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const kieRes = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    lastData = await kieRes.json();
    console.log(`KIE attempt ${attempt}:`, JSON.stringify(lastData).slice(0, 200));

    if (kieRes.ok && lastData.code === 200 && lastData.data?.taskId) {
      return lastData;
    }

    const errMsg = lastData?.msg || '';
    const shouldRetry = errMsg.includes('could not generate')
      || errMsg.includes('internal error')
      || errMsg.includes('prompt');

    if (shouldRetry && attempt < 3) {
      console.log(`Retrying (${attempt}/3) after error: ${errMsg}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }

    return lastData;
  }
  return lastData || { code: 500, msg: 'Max retries exceeded' };
}
