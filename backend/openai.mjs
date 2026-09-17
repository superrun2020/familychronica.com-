const DEFAULTS = {
  chatModel: 'gpt-4.1-mini',
  transcriptionModel: 'gpt-4o-mini-transcribe',
  translationModel: 'gpt-4.1-mini',
};

const MAX_HISTORY_BYTES = 12_000;
const ALLOWED_MODELS = {
  chat: new Set(['gpt-4.1-mini']),
  transcription: new Set(['gpt-4o-mini-transcribe']),
  translation: new Set(['gpt-4.1-mini']),
};

function responseText(data) {
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  const text = parts.join('').trim();
  if (!text) throw new Error('provider_empty_response');
  return text;
}

function boundedHistory(messages) {
  const selected = [];
  let remaining = MAX_HISTORY_BYTES;
  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    let content = String(message.content || '');
    while (Buffer.byteLength(content, 'utf8') > remaining) content = content.slice(Math.max(1, Math.ceil(content.length / 16)));
    const clipped = content;
    if (!clipped) continue;
    selected.unshift({ role: message.role, content: clipped });
    remaining -= Buffer.byteLength(clipped, 'utf8');
  }
  return selected;
}

function providerLanguage(language) {
  if (language === 'zh-CN') return 'zh';
  return ['en', 'zh', 'es'].includes(language) ? language : '';
}

async function openaiRequest(fetchImpl, path, { apiKey, body, timeoutMs = 45_000, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, ...headers },
      body,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`provider_status_${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function createOpenAIProvider(env = process.env, fetchImpl = globalThis.fetch) {
  const apiKey = env.FAMILYCHRONICA_OPENAI_API_KEY;
  if (!apiKey) return null;
  const models = {
    chat: env.FAMILYCHRONICA_OPENAI_CHAT_MODEL || DEFAULTS.chatModel,
    transcription: env.FAMILYCHRONICA_OPENAI_TRANSCRIPTION_MODEL || DEFAULTS.transcriptionModel,
    translation: env.FAMILYCHRONICA_OPENAI_TRANSLATION_MODEL || DEFAULTS.translationModel,
  };
  for (const [kind, model] of Object.entries(models)) {
    if (!ALLOWED_MODELS[kind].has(model)) throw new Error(`Unsupported FamilyChronica ${kind} model: ${model}`);
  }
  return {
    models,
    async chat({ messages }) {
      const data = await openaiRequest(fetchImpl, 'responses', {
        apiKey,
        body: JSON.stringify({ model: models.chat, input: boundedHistory(messages), max_output_tokens: 700 }),
        headers: { 'Content-Type': 'application/json' },
      });
      return { text: responseText(data) };
    },
    async transcribe({ bytes, mimeType, language, translateTo, sequence }) {
      const form = new FormData();
      form.set('model', models.transcription);
      const extension = mimeType === 'audio/mp4' ? 'mp4' : 'webm';
      form.set('file', new Blob([bytes], { type: mimeType }), `segment-${sequence}.${extension}`);
      const normalized = providerLanguage(language);
      if (normalized) form.set('language', normalized);
      const data = await openaiRequest(fetchImpl, 'audio/transcriptions', { apiKey, body: form });
      const transcript = String(data.text || '').trim().slice(0, 12_000);
      if (!transcript) throw new Error('provider_empty_transcription');
      let translation = '';
      if (translateTo) {
        const output = await openaiRequest(fetchImpl, 'responses', {
          apiKey,
          body: JSON.stringify({ model: models.translation, input: `Translate the following family-history transcript to ${translateTo}. Return only the translation.\n\n${transcript}`, max_output_tokens: 700 }),
          headers: { 'Content-Type': 'application/json' },
        });
        translation = responseText(output);
      }
      return { transcript, translation };
    },
  };
}
