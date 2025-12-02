import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { AIAgent } from '../ai';
import { SpeechService } from '../ai/speech';
import { ConversationService } from '../ai/conversation';
import { authenticateToken } from '../auth/middleware';
import { GeminiClient } from '../ai/gemini-client';
import { OpenAIClient } from '../ai/client';
import { MemoryStore } from '../ai/memory';

const router = Router();
const aiAgent = new AIAgent();
const speechService = new SpeechService();
const conversationService = new ConversationService();
const plannerClient = process.env.GEMINI_API_KEY ? new GeminiClient() : new OpenAIClient();
const memoryStore = new MemoryStore();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for Whisper API
  },
  fileFilter: (req, file, cb) => {
    const supportedFormats = speechService.getSupportedFormats();
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (fileExtension && supportedFormats.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format. Supported formats: ${supportedFormats.join(', ')}`));
    }
  },
});

// Request validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  deviceContext: z.object({
    deviceId: z.string().uuid(),
    deviceType: z.enum(['mobile', 'desktop', 'wearable', 'web']),
    capabilities: z.object({
      hasVoiceInput: z.boolean(),
      hasVoiceOutput: z.boolean(),
      hasHapticFeedback: z.boolean(),
      hasFileAccess: z.boolean(),
      hasCalendarAccess: z.boolean(),
      supportsGestures: z.boolean(),
    }),
  }).optional(),
});

const conversationParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

// POST /api/ai/chat - Process a chat message
router.post('/chat', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('📨 Chat request received:', { 
      userId: req.user?.id, 
      message: req.body.message?.substring(0, 50) 
    });

    const validatedData = chatRequestSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      console.log('❌ User not authenticated');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('🤖 Processing message with AI agent...');
    const response = await aiAgent.processMessage({
      userId,
      message: validatedData.message,
      ...(validatedData.conversationId && { conversationId: validatedData.conversationId }),
      ...(validatedData.deviceContext && { deviceContext: validatedData.deviceContext }),
    });

    console.log('✅ AI response generated:', { 
      contentLength: response.content?.length || 0,
      preview: response.content?.substring(0, 100)
    });

    return res.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/plan - Plan executable actions from a user request
router.post('/plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const message = (req.body?.message || '').toString();
    if (!message.trim()) {
      return res.json({ success: true, data: { actions: [] } });
    }

    // Basic system prompt to force structured JSON
    const system = `You are an action planner for a desktop assistant.
Decide if the user's request requires executable actions. If so, output a JSON object ONLY, no prose.
Schema:
{
  "actions": [
    { "type": "open_url", "url": "https://..." },
    { "type": "open_path", "path": "C:/Users/..." },
    { "type": "open_application", "name": "notepad" },
    { "type": "close_application", "name": "chrome.exe" },
    { "type": "create_folder", "path": "C:/Users/.../project" },
    { "type": "create_file", "path": "C:/Users/.../file.txt", "content": "..." },
    { "type": "delete_file", "path": "C:/Users/.../file.txt" },
    { "type": "delete_folder", "path": "C:/Users/.../folder" },
    { "type": "search_files", "path": "C:/Users", "pattern": "*.txt" },
    { "type": "git_init", "path": "C:/Users/.../project" },
    { "type": "create_virtual_env", "path": "C:/Users/.../venv", "type": "python" },
    { "type": "install_dependencies", "path": "C:/Users/.../project", "packageManager": "npm" },
    { "type": "open_in_ide", "path": "C:/Users/.../project", "ide": "cursor" },
    { "type": "take_screenshot", "path": "C:/Users/.../screenshot.png" },
    { "type": "kill_process", "name": "chrome.exe" },
    { "type": "shutdown", "delay": 0 },
    { "type": "restart", "delay": 0 },
    { "type": "sleep" },
    { "type": "empty_trash" },
    { "type": "run_script", "language": "python", "script": "C:/path/to/script.py", "args": ["arg1"] },
    { "type": "execute_command", "command": "npm", "args": ["install"], "workingDir": "C:/project" }
  ]
}
Rules:
- If the request is just informational, return {"actions": []}.
- For file operations: create_folder, create_file, delete_file, delete_folder, search_files
- For apps: open_application, close_application, open_in_ide
- For development: git_init, create_virtual_env, install_dependencies
- For system: shutdown, restart, sleep, empty_trash, take_screenshot, kill_process, get_system_info
- Use Windows paths (C:/Users/...) for file operations
- For "create project" → create_folder, git_init, create_virtual_env
- For "open in cursor/vscode" → open_in_ide with ide: "cursor" or "code"
- For "take screenshot" → take_screenshot
- For "close app" → close_application with process name
Return ONLY JSON.`;

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: message },
    ] as any;

    const raw = await (plannerClient as any).generateResponse(messages, { temperature: 0.2, maxTokens: 400 });

    // Try to coerce the raw response to an { actions: [] } object
    let parsed: any = null;
    try {
      if (typeof raw === 'string') {
        // Extract JSON if model returned extra text or code fences
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : raw;
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : candidate;
        parsed = JSON.parse(jsonText);
      } else if (raw && typeof raw === 'object') {
        // Some clients may already return an object or { content: '...' }
        if (Array.isArray((raw as any).actions)) {
          parsed = raw;
        } else if (typeof (raw as any).content === 'string') {
          const content = (raw as any).content as string;
          const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
          const candidate = fenced ? fenced[1] : content;
          const jsonMatch = candidate.match(/\{[\s\S]*\}/);
          const jsonText = jsonMatch ? jsonMatch[0] : candidate;
          parsed = JSON.parse(jsonText);
        } else {
          // Last resort: try JSON.stringify then parse
          parsed = JSON.parse(JSON.stringify(raw));
        }
      }
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.actions)) {
      parsed = { actions: [] };
    }

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('Plan endpoint error:', error);
    // Per preference: do not return an error to client; return empty result
    return res.json({ success: true, data: { actions: [] } });
  }
});

// GET /api/ai/messages/recent - Get recent messages across conversations
router.get('/messages/recent', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = parseInt((req.query.limit as string) || '50', 10);
    const messages = await memoryStore.getRecentMessagesForUser(userId, isNaN(limit) ? 50 : limit);

    return res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Get recent messages error:', error);
    // Return empty list on error to avoid breaking client
    return res.json({ success: true, data: [] });
  }
});

// GET /api/ai/conversations - Get user's conversations with search and filtering
router.get('/conversations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse query parameters
    const {
      query,
      limit = '20',
      offset = '0',
      dateFrom,
      dateTo,
      deviceType,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const searchOptions: any = {
      userId,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as 'relevance' | 'date' | 'length',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    if (query) searchOptions.query = query as string;
    if (dateFrom) searchOptions.dateFrom = new Date(dateFrom as string);
    if (dateTo) searchOptions.dateTo = new Date(dateTo as string);
    if (deviceType) searchOptions.deviceType = deviceType as string;

    const result = await conversationService.searchConversations(searchOptions);

    return res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve conversations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/conversations/:conversationId/history - Get conversation history
router.get('/conversations/:conversationId/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { conversationId } = conversationParamsSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // TODO: Add authorization check to ensure user owns the conversation

    const history = await aiAgent.getConversationHistory(conversationId);

    return res.json({
      success: true,
      data: history,
    });

  } catch (error) {
    console.error('Get conversation history error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to retrieve conversation history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/ai/conversations/:conversationId/title - Update conversation title
router.put('/conversations/:conversationId/title', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { conversationId } = conversationParamsSchema.parse(req.params);
    const userId = req.user?.id;
    const { title } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Valid title is required' });
    }

    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }

    await conversationService.updateConversationTitle(conversationId, userId, title.trim());

    return res.json({
      success: true,
      message: 'Conversation title updated successfully',
    });

  } catch (error) {
    console.error('Update conversation title error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to update conversation title',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/ai/conversations/:conversationId - Delete a conversation
router.delete('/conversations/:conversationId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { conversationId } = conversationParamsSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await conversationService.deleteConversation(conversationId, userId);

    return res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to delete conversation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/analytics - Get conversation analytics
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { days = '30' } = req.query;
    const analytics = await conversationService.getConversationAnalytics(userId, parseInt(days as string));

    return res.json({
      success: true,
      data: analytics,
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/speech-to-text - Convert speech to text
router.post('/speech-to-text', authenticateToken, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Validate audio file
    const validationResult = await speechService.validateAndConvertAudio(req.file.buffer);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error });
    }

    // Convert speech to text
    const options: any = {};
    if (req.body.language) options.language = req.body.language;
    if (req.body.prompt) options.prompt = req.body.prompt;
    if (req.body.temperature) options.temperature = parseFloat(req.body.temperature);

    const result = await speechService.speechToText(req.file.buffer, options);

    return res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Speech-to-text endpoint error:', error);
    return res.status(500).json({
      error: 'Failed to process speech',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/text-to-speech - Convert text to speech
router.post('/text-to-speech', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { text, voice, speed, format } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    // Convert text to speech
    const ttsOptions: any = {};
    if (voice) ttsOptions.voice = voice;
    if (speed) ttsOptions.speed = parseFloat(speed);
    if (format) ttsOptions.format = format;

    const result = await speechService.textToSpeech(text, ttsOptions);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Set appropriate headers for audio response
    const contentType = format === 'wav' ? 'audio/wav' : 
                       format === 'flac' ? 'audio/flac' :
                       format === 'opus' ? 'audio/opus' :
                       format === 'aac' ? 'audio/aac' : 'audio/mpeg';

    res.set({
      'Content-Type': contentType,
      'Content-Length': result.data ? (result.data as Buffer).length.toString() : '0',
      'Content-Disposition': `attachment; filename="speech.${format || 'mp3'}"`,
    });

    return res.send(result.data);

  } catch (error) {
    console.error('Text-to-speech endpoint error:', error);
    return res.status(500).json({
      error: 'Failed to generate speech',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/voice - Process voice message (speech-to-text + AI response + text-to-speech)
router.post('/voice', authenticateToken, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Parse optional parameters
    const conversationId = req.body.conversationId;
    const deviceContext = req.body.deviceContext ? JSON.parse(req.body.deviceContext) : undefined;
    const responseFormat = req.body.responseFormat || 'json'; // 'json' or 'audio'
    const voice = req.body.voice || 'alloy';

    // Step 1: Convert speech to text
    const transcriptionResult = await speechService.speechToText(req.file.buffer);

    // Step 2: Process with AI agent
    const aiResponse = await aiAgent.processMessage({
      userId,
      message: transcriptionResult.text,
      ...(conversationId && { conversationId }),
      ...(deviceContext && { deviceContext }),
    });

    // Step 3: If audio response requested, convert AI response to speech
    let audioData: Buffer | undefined;
    if (responseFormat === 'audio') {
      const ttsResult = await speechService.textToSpeech(aiResponse.content, { voice });
      if (ttsResult.success) {
        audioData = ttsResult.data as Buffer;
      }
    }

    const response = {
      success: true,
      data: {
        transcription: transcriptionResult,
        aiResponse,
        ...(audioData && { audioResponse: audioData.toString('base64') }),
      },
    };

    return res.json(response);

  } catch (error) {
    console.error('Voice processing endpoint error:', error);
    return res.status(500).json({
      error: 'Failed to process voice message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/speech/voices - Get available TTS voices
router.get('/speech/voices', authenticateToken, async (req: Request, res: Response) => {
  try {
    const voices = speechService.getAvailableVoices();
    return res.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error('Get voices error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve available voices',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/speech/formats - Get supported audio formats
router.get('/speech/formats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const formats = speechService.getSupportedFormats();
    return res.json({
      success: true,
      data: {
        input: formats,
        output: ['mp3', 'opus', 'aac', 'flac'],
      },
    });
  } catch (error) {
    console.error('Get formats error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve supported formats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/health - Health check for AI service
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check speech services health
    const speechHealth = await speechService.healthCheck();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ai_agent: 'operational',
        memory_store: 'operational',
        context_manager: 'operational',
        speech_to_text: speechHealth.whisper ? 'operational' : 'degraded',
        text_to_speech: speechHealth.tts ? 'operational' : 'degraded',
      },
      ...(speechHealth.error && { warnings: [speechHealth.error] }),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;