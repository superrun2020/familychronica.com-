import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider } from '../backend/openai.mjs';

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test('Responses API text is parsed from output content and chat input is bounded', async () => {
  const calls = [];
  const provider = createOpenAIProvider(
    { FAMILYCHRONICA_OPENAI_API_KEY: 'test-only' },
    async (url, options) => {
      calls.push({ url, options });
      return response({
        output: [
          { content: [{ type: 'reasoning', text: 'ignore' }] },
          { content: [{ type: 'output_text', text: ' A useful answer. ' }] },
        ],
      });
    },
  );

  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}-${'x'.repeat(2_000)}`,
  }));
  const result = await provider.chat({ messages });

  assert.equal(result.text, 'A useful answer.');
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.max_output_tokens, 700);
  assert.ok(JSON.stringify(sent.input).length <= 25_000);
  assert.ok(sent.input.length < 20);
});

test('empty Responses replies are rejected and zh-CN is normalized for transcription', async () => {
  const languages = [];
  const empty = createOpenAIProvider(
    { FAMILYCHRONICA_OPENAI_API_KEY: 'test-only' },
    async () => response({ output: [{ content: [{ type: 'output_text', text: '   ' }] }] }),
  );
  await assert.rejects(() => empty.chat({ messages: [{ role: 'user', content: 'hello' }] }), /empty/i);

  let call = 0;
  const provider = createOpenAIProvider(
    { FAMILYCHRONICA_OPENAI_API_KEY: 'test-only' },
    async (url, options) => {
      call += 1;
      if (call === 1) {
        languages.push(options.body.get('language'));
        return response({ text: 'Hello family' });
      }
      return response({ output: [{ content: [{ type: 'output_text', text: '  你好，家人  ' }] }] });
    },
  );
  const result = await provider.transcribe({
    bytes: Uint8Array.from([1, 2, 3]),
    mimeType: 'audio/mp4',
    language: 'zh-CN',
    translateTo: 'zh-CN',
    sequence: 1,
  });
  assert.deepEqual(languages, ['zh']);
  assert.equal(result.translation, '你好，家人');
});

test('unsupported environment model overrides are rejected',()=>{
  assert.throws(()=>createOpenAIProvider({FAMILYCHRONICA_OPENAI_API_KEY:'test-only',FAMILYCHRONICA_OPENAI_CHAT_MODEL:'unpriced-model'},async()=>response({})),/Unsupported FamilyChronica chat model/);
});
