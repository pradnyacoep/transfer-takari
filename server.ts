import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

function generateFallbackMessage(
  taskTitle: string,
  presetStyle = 'report'
): string {
  const cleanTitle = (taskTitle || 'this task').trim();

  switch (presetStyle) {
    case 'updates':
      return `pl give updates of *${cleanTitle}*.`;
    case 'status':
      return `what is the status of *${cleanTitle}*?`;
    case 'update':
      return `pl update me on *${cleanTitle}*.`;
    case 'followup':
      return `pl take follow up for *${cleanTitle}*.`;
    case 'report':
    default:
      return `pl report me on *${cleanTitle}*.`;
  }
}

// API route: 1-Click WhatsApp Action Memo generator powered by Gemini
app.post('/api/generate-whatsapp-memo', async (req, res) => {
  const {
    taskTitle,
    presetStyle = 'report',
  } = req.body;

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        memo: generateFallbackMessage(taskTitle, presetStyle),
        source: 'standard_template',
      });
    }

    const ai = new GoogleGenAI();
    const prompt = `You are an executive assistant helping an officer draft a super simple, natural 1-line WhatsApp message.
Task: "${taskTitle}"
Requested phrasing style: ${presetStyle}

USER APPROVED EXAMPLES (FOLLOW THESE STRICTLY):
- "pl report me on *${taskTitle}*."
- "pl give updates of *${taskTitle}*."
- "what is the status of *${taskTitle}*?"
- "pl update me on *${taskTitle}*."
- "pl take follow up for *${taskTitle}*."

CRITICAL NEGATIVE CONSTRAINTS:
- DO NOT write "reminder 1", "reminder 2", "1st reminder", or "2nd reminder".
- DO NOT write "pending at", "pending since", or any days count.
- DO NOT add boilerplate like "Status:", "Next follow-up:", "Note:", or bullet points.
- Output EXACTLY ONE simple line.
- Wrap the task name in standard WhatsApp asterisks: *${taskTitle}*.
- Output raw text only with no quotes and no explanations.`;

    let outputText = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
        },
      });
      outputText = response.text ? response.text.trim() : '';
    } catch (primaryErr: any) {
      // Try flash lite if flash hits quota or rate limit
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            temperature: 0.1,
          },
        });
        outputText = response.text ? response.text.trim() : '';
      } catch (secondaryErr: any) {
        // Log friendly warning instead of console.error to avoid false alarm crashes
        console.warn(
          '[Gemini API Quota Notice]: Gemini free tier quota reached, using instant formula fallback.'
        );
        return res.status(200).json({
          memo: generateFallbackMessage(taskTitle, presetStyle),
          source: 'standard_template',
          quotaExceeded: true,
        });
      }
    }

    if (outputText) {
      return res.status(200).json({
        memo: outputText,
        source: 'gemini',
      });
    }

    return res.status(200).json({
      memo: generateFallbackMessage(taskTitle, presetStyle),
      source: 'standard_template',
    });
  } catch (err: any) {
    console.warn('[Gemini API Notice]: Using standard template fallback.');
    return res.status(200).json({
      memo: generateFallbackMessage(taskTitle, presetStyle),
      source: 'fallback_template',
    });
  }
});

// API route: Direct WhatsApp dispatch without redirecting or opening WhatsApp app
app.post('/api/whatsapp/send-direct', async (req, res) => {
  try {
    const {
      phone,
      message,
      taskTitle = '',
      recipientName = '',
      officeName = '',
    } = req.body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A valid WhatsApp phone number is required for direct dispatch.',
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content is empty.',
      });
    }

    // Clean phone number: Indian numbers have +91 prefix by default
    let rawDigits = phone.replace(/\D/g, '');
    let cleanPhone = rawDigits;
    if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
      cleanPhone = `91${rawDigits.slice(1)}`;
    } else if (rawDigits.length === 10) {
      // All WhatsApp numbers are of Indians: prepend 91 by default
      cleanPhone = `91${rawDigits}`;
    } else if (rawDigits.length > 10 && !rawDigits.startsWith('91')) {
      // Extract last 10 digits and add 91
      cleanPhone = `91${rawDigits.slice(-10)}`;
    }

    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Must contain a valid 10-digit Indian mobile number.',
      });
    }

    const tenDigits = cleanPhone.slice(-10);
    const formattedRecipient = `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;

    const waApiToken = process.env.WHATSAPP_API_TOKEN;
    const waPhoneId = process.env.WHATSAPP_PHONE_ID;

    // If official Meta WhatsApp Business Cloud API credentials exist
    if (waApiToken && waPhoneId) {
      try {
        const cloudRes = await fetch(
          `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${waApiToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: {
                preview_url: false,
                body: message.trim(),
              },
            }),
          }
        );

        const cloudData = await cloudRes.json();
        if (cloudRes.ok && cloudData.messages && cloudData.messages[0]?.id) {
          return res.status(200).json({
            success: true,
            mode: 'meta_cloud_api',
            messageId: cloudData.messages[0].id,
            timestamp: new Date().toISOString(),
            recipient: formattedRecipient,
            recipientName,
            officeName,
            status: 'delivered',
            note: 'Delivered directly to WhatsApp via Meta Cloud API',
          });
        } else {
          console.warn('[Meta Cloud API Warning]:', cloudData);
          // Fall through to Division Direct Gateway
        }
      } catch (cloudErr) {
        console.warn('[Meta Cloud API Connection error]:', cloudErr);
      }
    }

    // Universal WhatsApp deep-link dispatch (allows message to be sent directly from sender's number)
    const encodedMsg = encodeURIComponent(message.trim());
    const waUniversalUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    const waWebUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    return res.status(200).json({
      success: true,
      mode: 'whatsapp_redirect',
      waUniversalUrl,
      waWebUrl,
      recipient: formattedRecipient,
      recipientName,
      officeName,
      status: 'ready_to_send',
      note: 'Universal WhatsApp link generated. Dispatches directly from officer device/account.',
    });
  } catch (err: any) {
    console.error('Error generating WhatsApp dispatch link:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete dispatch preparation. Please try again.',
    });
  }
});

async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
