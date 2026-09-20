import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI lazily
let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    // Uses process.env.GEMINI_API_KEY by default
    genAIInstance = new GoogleGenAI();
  }
  return genAIInstance;
}

// Resilient AI generation with automatic fallback to prevent 503 capacity spikes
async function generateWithFallback(ai: GoogleGenAI, request: any) {
  const modelsToTry = [
    request.model || 'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        ...request,
        model,
      });
      return response;
    } catch (err: any) {
      console.warn(`[AI] Model ${model} encountered error, trying next fallback...`, err?.message);
      lastError = err;
    }
  }
  throw lastError;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Notice Generator for School Closure / Public Holidays
app.post('/api/generate-holiday-notice', async (req, res) => {
  try {
    const {
      holidayName,
      startDate,
      endDate,
      reopenDate,
      targetAudience = 'សិស្សានុសិស្ស លោកគ្រូ-អ្នកគ្រូ និងមាតាបិតា/អាណាព្យាបាល',
      extraNotes = '',
      schoolName = 'សាលាបឋមសិក្សា រោគ',
    } = req.body;

    if (!holidayName || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'សូមបញ្ជាក់ឈ្មោះពិធីបុណ្យ ឬថ្ងៃឈប់សម្រាក និងកាលបរិច្ឆេទឱ្យបានត្រឹមត្រូវ',
      });
    }

    const ai = getGenAI();
    const systemPrompt = `អ្នកគឺជាអ្នករដ្ឋបាលជាន់ខ្ពស់ និងជាជំនួយការនាយិកាសាលាបឋមសិក្សា នៅកម្ពុជា (ក្រោមឱវាទក្រសួងអប់រំ យុវជន និងកីឡា)។
ភារកិច្ចរបស់អ្នកគឺរៀបចំតាក់តែង «សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាក» ឬ «របាយការណ៍ជូនដំណឹងស្តីពីការបិទទ្វារសាលាបណ្តោះអាសន្ន» ជាភាសាខ្មែរផ្លូវការ ស្របតាមក្បួនខ្នាតរដ្ឋបាលកម្ពុជា។

លក្ខណៈទម្រង់តម្រូវឱ្យមាន៖
១. ក្បាលលិខិតផ្លូវការ៖
   ព្រះរាជាណាចក្រកម្ពុជា
   ជាតិ សាសនា ព្រះមហាក្សត្រ
   (សញ្ញាត្រេ)
   មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ
   ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុកភ្នំស្រុក
   ${schoolName}

២. ចំណងជើងច្បាស់លាស់៖
   សេចក្តីជូនដំណឹង
   ស្តីពីការឈប់សម្រាកក្នុងឱកាស «${holidayName}» របស់${schoolName}

៣. ខ្លឹមសារលិខិត៖
   - គោរពជម្រាបជូនដល់៖ ${targetAudience}
   - កាលបរិច្ឆេទនៃការឈប់សម្រាក៖ ចាប់ពីថ្ងៃទី... ដល់ថ្ងៃទី... (បញ្ជាក់ចំនួនថ្ងៃឱ្យច្បាស់)
   - កាលបរិច្ឆេទនៃការចូលរៀនឡើងវិញ៖ ${reopenDate ? `ថ្ងៃទី ${reopenDate}` : 'បន្ទាប់ពីចប់ពិធីបុណ្យ'}
   - សេចក្តីផ្តាំផ្ញើ និងការណែនាំ៖ ការថែរក្សាសុខភាព សុវត្ថិភាពក្នុងការធ្វើដំណើរ ការចូលរួមអភិរក្សប្រពៃណីទំនៀមទម្លាប់ និងការបន្តស្វ័យសិក្សារបស់សិស្សានុសិស្សនៅគេហដ្ឋាន
   ${extraNotes ? `- សំណូមពរបន្ថែមពិសេស៖ ${extraNotes}` : ''}
   - កាលបរិច្ឆេទចេញលិខិត និងហត្ថលេខានាយិកាសាលា (អ្នកស្រី ម៉ែន សុខនីម)

សូមសរសេរជាភាសាខ្មែរយ៉ាងរលូន ត្រឹមត្រូវតាមអក្ខរាវិរុទ្ធ មានភាពថ្លៃថ្នូរ និងកក់ក្តៅ។ ផ្តល់ជូនជាទម្រង់ JSON ត្រឹមត្រូវតាមរចនាសម្ព័ន្ធខាងក្រោម៖
{
  "title": "ចំណងជើងសេចក្តីជូនដំណឹង",
  "summary": "សេចក្តីសង្ខេបខ្លី ១-២ បន្ទាត់សម្រាប់ផ្ញើតាម Telegram ឬបណ្តាញសង្គម",
  "fullContent": "ខ្លឹមសារលិខិតផ្លូវការពេញលេញទាំងអស់ រួមទាំងក្បាលលិខិត និងកន្លែងចុះហត្ថលេខា"
}`;

    const response = await generateWithFallback(ai, {
      model: 'gemini-3.8-flash',
      contents: `សូមរៀបចំសេចក្តីជូនដំណឹងសម្រាប់ការឈប់សម្រាក «${holidayName}» ចាប់ពីថ្ងៃ ${startDate} ដល់ថ្ងៃ ${endDate || startDate} និងចូលរៀនវិញនៅថ្ងៃ ${reopenDate || 'បន្ទាប់'}។`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = {
        title: `សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាក ${holidayName}`,
        summary: `សេចក្តីជូនដំណឹងស្តីពីការឈប់សម្រាកឱកាស ${holidayName} ចាប់ពីថ្ងៃ ${startDate} ដល់ថ្ងៃ ${endDate || startDate}`,
        fullContent: responseText,
      };
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error generating holiday notice with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'បរាជ័យក្នុងការបង្កើតសេចក្តីជូនដំណឹងតាម AI',
    });
  }
});

// AI Chat Assistant for General School Admin, Absence Solutions & Guidance
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { messages = [], currentContext = {} } = req.body;

    if (!messages || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'សូមបញ្ចូលសារ ឬសំណួរដែលចង់សួរ AI',
      });
    }

    const ai = getGenAI();
    const systemInstruction = `អ្នកគឺជា «AI ជំនួយការសាលារៀន» ជំនួយការវៃឆ្លាតប្រចាំ សាលាបឋមសិក្សា រោគ (ឃុំរោគ ស្រុកភ្នំស្រុក ខេត្តបន្ទាយមានជ័យ) ក្រោមឱវាទក្រសួងអប់រំ យុវជន និងកីឡា។
នាយិកាសាលា៖ អ្នកស្រី ម៉ែន សុខនីម។
ភារកិច្ចចម្បងរបស់អ្នក៖
១. ជួយឆ្លើយសំណួរអំពីបទបញ្ជាផ្ទៃក្នុងសាលាបឋមសិក្សា ក្រមសីលធម៌គ្រូបង្រៀន និងច្បាប់ការងាររដ្ឋបាលអប់រំកម្ពុជា
២. ផ្តល់យោបល់ និងដំណោះស្រាយរហ័សចំពោះបញ្ហាគ្រូអវត្តមាន (ការរៀបចំគ្រូជំនួស ការបញ្ចូលថ្នាក់ ឬការបង្រៀនបំប៉ន)
៣. ជួយណែនាំការរៀបចំឯកសាររដ្ឋបាលសាលារៀន របាយការណ៍បច្ចេកទេស និងផែនការបង្រៀន
៤. ជួយពន្យល់ និងសង្ខេបវិភាគទិន្នន័យវត្តមានបុគ្គលិកអប់រំ
៥. ព្រាងលិខិតរដ្ឋបាល ឬសារផ្ញើផ្លូវការ។

រចនាប័ទ្មនៃការឆ្លើយតប៖
- ឆ្លើយជាភាសាខ្មែរត្រឹមត្រូវតាមក្បួនខ្នាតរដ្ឋបាល គួរសម ថ្លៃថ្នូរ និងកក់ក្តៅ
- រៀបចំចម្លើយឱ្យមានរចនាសម្ព័ន្ធងាយមើល (ប្រើចំណុចលេខ ឬ bullet points)
- ប្រសិនបើសួរអំពីការព្រាងលិខិត សូមផ្តល់ទម្រង់គំរូពេញលេញដែលអាចយកទៅប្រើប្រាស់បានភ្លាមៗ។
${currentContext?.role ? `អ្នកប្រើប្រាស់បច្ចុប្បន្នមានតួនាទីជា៖ ${currentContext.role} (ឈ្មោះ: ${currentContext.userName || 'លោកគ្រូ/អ្នកគ្រូ'})` : ''}`;

    // Convert client messages to Gemini contents format
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text || m.content || '' }],
    }));

    const response = await generateWithFallback(ai, {
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.6,
      },
    });

    const replyText = response.text || 'សុំទោស ខ្ញុំមិនអាចបង្កើតចម្លើយបាននៅពេលនេះទេ។';

    return res.json({
      success: true,
      reply: replyText,
    });
  } catch (error: any) {
    console.error('Error in AI Chat API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'មានបញ្ហាក្នុងការទាក់ទងជាមួយ AI ជំនួយការ',
    });
  }
});

// AI Fast Letter / Document Drafter
app.post('/api/ai-draft-letter', async (req, res) => {
  try {
    const {
      letterType = 'leave_request', // leave_request, mission_order, meeting_invitation, general_report
      requesterName = '',
      role = '',
      reason = '',
      duration = '',
      startDate = '',
      endDate = '',
      additionalInfo = '',
      schoolName = 'សាលាបឋមសិក្សា រោគ',
    } = req.body;

    const ai = getGenAI();
    const systemPrompt = `អ្នកជាអ្នកជំនាញរដ្ឋបាលអប់រំកម្ពុជា។ សូមជួយរៀបចំសេចក្តីព្រាងលិខិតផ្លូវការជាភាសាខ្មែរសម្រាប់ ${schoolName} ស្រុកភ្នំស្រុក ខេត្តបន្ទាយមានជ័យ។
ប្រភេទលិខិត៖ ${letterType}
ឈ្មោះអ្នកស្នើសុំ/សាមីខ្លួន៖ ${requesterName || 'លោកគ្រូ/អ្នកគ្រូ'}
តួនាទី៖ ${role || 'គ្រូបង្រៀន'}
មូលហេតុ/កម្មវត្ថុ៖ ${reason || 'មានធុរៈផ្ទាល់ខ្លួន/សុខភាព'}
រយៈពេល៖ ${duration || '១ ថ្ងៃ'} (ពីថ្ងៃ ${startDate || '...'} ដល់ថ្ងៃ ${endDate || '...'})
ព័ត៌មានបន្ថែម៖ ${additionalInfo || 'គ្មាន'}

សូមរៀបចំទម្រង់លិខិតផ្លូវការឱ្យបានត្រឹមត្រូវ ១០០% តាមរចនាប័ទ្មក្រសួងអប់រំ យុវជន និងកីឡា រួមមាន៖
- ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ
- ក្បាលលិខិតអង្គភាព (មន្ទីរអប់រំខេត្តបន្ទាយមានជ័យ / ការិយាល័យអប់រំស្រុកភ្នំស្រុក / ${schoolName})
- កម្មវត្ថុ ឬ សេចក្តីសង្ខេប
- ខ្លឹមសារលម្អិត
- ទីកន្លែង កាលបរិច្ឆេទ និងកន្លែងចុះហត្ថលេខា (សាមីខ្លួន និងការឯកភាពរបស់លោកស្រីនាយិកាសាលា)

សូមផ្តល់ជូនជា JSON ដូចខាងក្រោម៖
{
  "title": "ចំណងជើងលិខិត",
  "letterNumber": "លេខលិខិតគំរូ (បើមាន)",
  "fullLetter": "ខ្លឹមសារលិខិតរដ្ឋបាលពេញលេញ"
}`;

    const response = await generateWithFallback(ai, {
      model: 'gemini-3.8-flash',
      contents: `សូមព្រាងលិខិត ${letterType} សម្រាប់ ${requesterName} មូលហេតុ៖ ${reason}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = {
        title: `លិខិត ${letterType}`,
        fullLetter: responseText,
      };
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error drafting letter with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'បរាជ័យក្នុងការព្រាងលិខិតតាម AI',
    });
  }
});

// ==========================================
// TELEGRAM NOTIFICATION CONFIG & ROUTES
// ==========================================

const TELEGRAM_CONFIG_FILE = path.join(process.cwd(), 'telegram_config.json');

function getTelegramConfig(): {
  botToken: string;
  botUsername: string;
  botName: string;
  chatId: string;
  chatTitle: string;
} {
  let config = {
    botToken: '8938252796:AAH5lv7q2Y8QSGRsL2gTnYSpnNQJBbRB-xk',
    botUsername: 'raukSchoolAttendanceBot',
    botName: 'attendanceBot',
    chatId: '',
    chatTitle: '',
  };

  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      const raw = fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8');
      config = { ...config, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Error reading telegram_config.json:', err);
  }

  // Helper to validate Telegram chat ID format
  const isValidChatId = (id: string) => {
    if (!id) return false;
    const t = id.trim();
    return /^-?\d+$/.test(t) || /^@[a-zA-Z0-9_]{3,}$/.test(t);
  };

  // Environment variables override if valid
  if (process.env.TELEGRAM_BOT_TOKEN?.trim() && /^\d+:[\w-]+$/.test(process.env.TELEGRAM_BOT_TOKEN.trim())) {
    config.botToken = process.env.TELEGRAM_BOT_TOKEN.trim();
  }

  // If config.chatId is set and valid, keep it; otherwise check env
  if (!isValidChatId(config.chatId)) {
    if (process.env.TELEGRAM_CHAT_ID?.trim() && isValidChatId(process.env.TELEGRAM_CHAT_ID.trim())) {
      config.chatId = process.env.TELEGRAM_CHAT_ID.trim();
    } else {
      config.chatId = '';
    }
  }

  return config;
}

function saveTelegramConfig(
  newConfig: Partial<{
    botToken: string;
    botUsername: string;
    botName: string;
    chatId: string;
    chatTitle: string;
  }>
) {
  const current = getTelegramConfig();
  const merged = { ...current, ...newConfig };
  try {
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing telegram_config.json:', err);
  }
  return merged;
}

// Get Telegram Bot & Chat Configuration Status
app.get('/api/telegram/status', async (req, res) => {
  const config = getTelegramConfig();
  const token = config.botToken?.trim();
  const chatId = config.chatId?.trim();
  const isConfigured = Boolean(token && chatId);

  let botInfo: any = null;
  if (token) {
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = (await meRes.json()) as any;
      if (meData.ok && meData.result) {
        botInfo = meData.result;
        // update cached username if changed
        if (botInfo.username && botInfo.username !== config.botUsername) {
          saveTelegramConfig({
            botUsername: botInfo.username,
            botName: botInfo.first_name,
          });
        }
      }
    } catch {
      // ignore network errors
    }
  }

  res.json({
    isConfigured,
    hasToken: Boolean(token),
    botTokenMasked: token ? `${token.slice(0, 10)}...${token.slice(-6)}` : '',
    botUsername: botInfo?.username || config.botUsername || 'raukSchoolAttendanceBot',
    botName: botInfo?.first_name || config.botName || 'attendanceBot',
    chatId: chatId || '',
    chatTitle: config.chatTitle || '',
  });
});

// Save or Update Telegram Chat ID & Title
app.post('/api/telegram/save-chat-id', (req, res) => {
  try {
    const { chatId, chatTitle, botToken } = req.body;
    const updates: any = {};
    if (chatId !== undefined) updates.chatId = String(chatId).trim();
    if (chatTitle !== undefined) updates.chatTitle = String(chatTitle).trim();
    if (botToken !== undefined && botToken.trim()) updates.botToken = botToken.trim();

    const updated = saveTelegramConfig(updates);
    res.json({
      success: true,
      config: {
        chatId: updated.chatId,
        chatTitle: updated.chatTitle,
        botUsername: updated.botUsername,
        isConfigured: Boolean(updated.botToken && updated.chatId),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-detect groups or chats where the bot was added or sent messages
app.get('/api/telegram/detect-chats', async (req, res) => {
  const config = getTelegramConfig();
  const token = config.botToken?.trim();

  if (!token) {
    return res.status(400).json({ success: false, error: 'មិនទាន់មាន Telegram Bot Token នៅឡើយទេ' });
  }

  try {
    const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const updatesData = (await updatesRes.json()) as any;

    if (!updatesRes.ok || !updatesData.ok) {
      return res.status(502).json({
        success: false,
        error: updatesData.description || 'បរាជ័យក្នុងការទាញយកព័ត៌មានពី Telegram API',
      });
    }

    const chatsMap = new Map<string, any>();
    for (const update of updatesData.result || []) {
      const chat =
        update.message?.chat ||
        update.channel_post?.chat ||
        update.my_chat_member?.chat ||
        update.edited_message?.chat;

      if (chat && chat.id) {
        const idStr = String(chat.id);
        const name =
          chat.title ||
          (chat.username ? `@${chat.username}` : '') ||
          `${chat.first_name || ''} ${chat.last_name || ''}`.trim() ||
          `Chat ${idStr}`;

        chatsMap.set(idStr, {
          id: idStr,
          title: name,
          type: chat.type, // group, supergroup, channel, private
          date: update.message?.date || update.channel_post?.date,
        });
      }
    }

    const detectedChats = Array.from(chatsMap.values());
    return res.json({
      success: true,
      chats: detectedChats,
      botUsername: config.botUsername,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'មានបញ្ហាក្នុងការស្វែងរក Group លើ Telegram',
    });
  }
});

// Send Telegram notification when a staff member registers attendance
app.post('/api/telegram/notify-attendance', async (req, res) => {
  try {
    const {
      staffName,
      staffGender = '',
      staffPosition = '',
      staffClass = '',
      periodLabel = 'វត្តមាន',
      timeStr = '',
      dateStr = '',
      khmerDateStr = '',
      gpsDistance = null,
      gpsStatus = '',
      schoolName = 'សាលាបឋមសិក្សា រោគ',
    } = req.body;

    if (!staffName) {
      return res.status(400).json({ success: false, error: 'ឈ្មោះមន្ត្រីត្រូវបានទាមទារ' });
    }

    const config = getTelegramConfig();
    const token = config.botToken?.trim();
    const chatId = config.chatId?.trim();

    // Format GPS Status text
    let gpsText = 'មិនបានបញ្ជាក់ទីតាំង';
    if (typeof gpsDistance === 'number') {
      if (gpsDistance <= 10000) {
        gpsText = `នៅក្នុងបរិវេណសាលា (ចម្ងាយប្រមាណ ${Math.round(gpsDistance)} ម៉ែត្រ) 📍`;
      } else {
        gpsText = `ក្រៅបរិវេណសាលា (ចម្ងាយ ${(gpsDistance / 1000).toFixed(1)} គ.ម) ⚠️`;
      }
    } else if (gpsStatus) {
      gpsText = gpsStatus;
    }

    // Compose elegant Telegram message with HTML formatting
    const roleDetails = staffPosition
      ? `${staffPosition}${staffClass && staffClass !== '-' ? ` (ថ្នាក់៖ ${staffClass})` : ''}`
      : 'បុគ្គលិកអប់រំ';

    const genderText = staffGender ? ` (${staffGender})` : '';

    const messageHtml = `🔔 <b>សេចក្តីជូនដំណឹងវត្តមានបុគ្គលិក</b>
🏫 <b>${schoolName}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>ឈ្មោះមន្ត្រី៖</b> ${staffName}${genderText}
💼 <b>តួនាទី៖</b> ${roleDetails}
📋 <b>វេនវត្តមាន៖</b> <b>${periodLabel}</b>
⏰ <b>ម៉ោងចុះហត្ថលេខា៖</b> ${timeStr || new Date().toLocaleTimeString('en-US', { hour12: false })}
📅 <b>កាលបរិច្ឆេទ៖</b> ${khmerDateStr || dateStr}
📍 <b>ទីតាំង GPS៖</b> ${gpsText}
✍️ <b>ស្ថានភាព៖</b> បានចុះហត្ថលេខាឌីជីថលរួចរាល់ ✅
━━━━━━━━━━━━━━━━━━━━
<i>📡 ប្រព័ន្ធគ្រប់គ្រងវត្តមានឌីជីថល រដ្ឋបាលសាលាបឋមសិក្សា រោគ</i>`;

    // If Telegram is configured, send live to Telegram Bot API
    if (token && chatId) {
      const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageHtml,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const tgData = (await tgResponse.json()) as any;
      if (!tgResponse.ok || !tgData.ok) {
        console.warn('[Telegram API Error]', tgData);
        return res.status(502).json({
          success: false,
          error: tgData.description || 'បរាជ័យក្នុងការផ្ញើសារទៅកាន់ Telegram Bot API',
          mode: 'telegram_error',
        });
      }

      return res.json({
        success: true,
        mode: 'telegram_live',
        messageId: tgData.result?.message_id,
        preview: messageHtml,
      });
    }

    // If no chatId is configured yet, return preview and inform user
    console.log(`[Telegram Attendance Alert - Ready] ${staffName} signed: ${periodLabel} at ${timeStr}`);
    return res.json({
      success: true,
      simulated: true,
      mode: 'simulated',
      message: 'បានកត់ត្រាការជូនដំណឹង (Bot Token រួចរាល់ហើយ ប៉ុន្តែមិនទាន់បានកំណត់ Chat ID)',
      preview: messageHtml,
    });
  } catch (err: any) {
    console.error('Error in /api/telegram/notify-attendance:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'មានបញ្ហាក្នុងការផ្ញើការជូនដំណឹង Telegram',
    });
  }
});

// Test sending a verification message to the Telegram Group
app.post('/api/telegram/test-message', async (req, res) => {
  try {
    const config = getTelegramConfig();
    const token = config.botToken?.trim();
    const chatId = (req.body?.chatId || config.chatId)?.trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        notConfigured: true,
        error: 'សូមបញ្ចូល TELEGRAM_BOT_TOKEN ជាមុនសិន។',
      });
    }

    if (!chatId) {
      return res.status(400).json({
        success: false,
        notConfigured: true,
        error: 'សូមជ្រើសរើស ឬបញ្ចូល Telegram Chat ID (ឧ. -100...) មុននឹងតេស្តផ្ញើសារ។',
      });
    }

    const testTime = new Date().toLocaleString('km-KH', { timeZone: 'Asia/Phnom_Penh' });
    const testMessage = `🔔 <b>តេស្តប្រព័ន្ធជូនដំណឹង Telegram</b>
🏫 <b>សាលាបឋមសិក្សា រោគ</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>ប្រព័ន្ធតភ្ជាប់ដោយជោគជ័យ!</b>
⏰ ម៉ោងតេស្ត៖ ${testTime}
📌 ប្រព័ន្ធត្រៀមរួចរាល់ក្នុងការផ្ញើការជូនដំណឹងវត្តមានរបស់លោកគ្រូ-អ្នកគ្រូដោយស្វ័យប្រវត្តិមកកាន់ក្រុមរដ្ឋបាលនេះ។
━━━━━━━━━━━━━━━━━━━━
<i>📡 ប្រព័ន្ធគ្រប់គ្រងវត្តមានឌីជីថល រដ្ឋបាលសាលាបឋមសិក្សា រោគ (@${config.botUsername})</i>`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const tgData = (await tgResponse.json()) as any;
    if (!tgResponse.ok || !tgData.ok) {
      return res.status(502).json({
        success: false,
        error: tgData.description || 'បរាជ័យក្នុងការផ្ញើសារតេស្តទៅ Telegram Bot',
      });
    }

    // Auto-save this chatId if it worked!
    if (chatId !== config.chatId) {
      saveTelegramConfig({ chatId });
    }

    return res.json({
      success: true,
      messageId: tgData.result?.message_id,
      message: 'បានផ្ញើសារតេស្តទៅកាន់ Telegram ដោយជោគជ័យ! 🎉',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'មានបញ្ហាក្នុងការតេស្ត Telegram Bot',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Cache static assets efficiently to minimize memory and I/O
    app.use(express.static(distPath, { maxAge: '1h', etag: true }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
