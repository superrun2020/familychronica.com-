let context = null;
let currentSession = null;
let pendingStartEpoch = 0;
let chatAvailable = false;
let transcriptionAvailable = false;

const MAX_RECORDING_MS = 30 * 60 * 1000;
const MAX_ARCHIVE_BYTES = 9 * 1024 * 1024;
const MAX_PENDING_SEGMENTS = 6;

const copy = {
  en: {
    private: 'Private family', signOut: 'Sign out', hello: 'Hello, what story would you like to record today?',
    record: 'Record memory', photos: 'Add photos and videos', write: 'Write a memory', members: 'Family members',
    memories: 'Your memories', empty: 'No memories yet. Your first one will appear here.', home: 'Home', tree: 'Family Tree', albums: 'Albums', profile: 'Profile',
    ai: 'Family AI', aiHello: 'Welcome. Choose a way to begin.', askPlaceholder: 'Ask about your family stories', send: 'Send', exit: 'Exit',
    unavailable: 'Family AI and live transcription are not configured. Recording and saving still work.',
    upload: 'Upload', title: 'Title', memory: 'Your memory', save: 'Save memory', name: 'Name', relationship: 'Relationship', add: 'Add',
    start: 'Start camera & microphone', stop: 'Stop & save', retry: 'Retry failed transcription', retrySave: 'Retry save',
    permission: 'Camera and microphone access begins only when you press Start.', recording: 'REC', transcript: 'Transcript', translation: 'Translation',
  },
  'zh-CN': {
    private: '私密家庭', signOut: '退出', hello: '你好，今天想记录什么故事？', record: '录制回忆', photos: '添加照片和视频', write: '写一段回忆', members: '家庭成员',
    memories: '你的回忆', empty: '还没有回忆。第一个将显示在这里。', home: '首页', tree: '家谱', albums: '相册', profile: '资料', ai: '家庭 AI', aiHello: '欢迎。请选择一种方式开始。', askPlaceholder: '询问家庭故事', send: '发送', exit: '退出',
    unavailable: '家庭 AI 和实时转录尚未配置。录制和保存仍可使用。', upload: '上传', title: '标题', memory: '回忆内容', save: '保存回忆', name: '姓名', relationship: '关系', add: '添加',
    start: '开启摄像头和麦克风', stop: '停止并保存', retry: '重试失败的转录', retrySave: '重试保存', permission: '只有按下开始后才会请求摄像头和麦克风权限。', recording: '录制中', transcript: '转录', translation: '翻译',
  },
  es: {
    private: 'Familia privada', signOut: 'Cerrar sesión', hello: '¿Qué te gustaría conservar hoy?', record: 'Grabar un recuerdo', photos: 'Añadir fotos y videos', write: 'Escribir un recuerdo', members: 'Familiares',
    memories: 'Tus recuerdos', empty: 'Aún no hay recuerdos. El primero aparecerá aquí.', home: 'Inicio', tree: 'Árbol familiar', albums: 'Álbumes', profile: 'Perfil', ai: 'IA familiar', aiHello: 'Bienvenido. Elige una forma de empezar.', askPlaceholder: 'Pregunta sobre tus historias familiares', send: 'Enviar', exit: 'Salir',
    unavailable: 'La IA familiar y la transcripción en vivo no están configuradas. La grabación y el guardado siguen disponibles.', upload: 'Subir', title: 'Título', memory: 'Tu recuerdo', save: 'Guardar recuerdo', name: 'Nombre', relationship: 'Relación', add: 'Añadir',
    start: 'Iniciar cámara y micrófono', stop: 'Detener y guardar', retry: 'Reintentar transcripción', retrySave: 'Reintentar guardado', permission: 'El acceso a la cámara y al micrófono comienza solo al pulsar Iniciar.', recording: 'GRABANDO', transcript: 'Transcripción', translation: 'Traducción',
  },
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const language = () => ['en', 'zh-CN', 'es'].includes(localStorage.getItem('fc-language')) ? localStorage.getItem('fc-language') : 'en';
const t = () => copy[language()] || copy.en;

export function dashboardMarkup() {
  return '<section id="familyDashboard" class="family-dashboard"><div class="dashboard-loading" role="status">Loading your private family space…</div></section>';
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || 'Request failed');
    error.status = response.status;
    error.code = data.error;
    throw error;
  }
  return data;
}

function mediaElement(media) {
  const source = `/api/auth/workspace/media/${encodeURIComponent(media.id)}`;
  if (media.mimeType.startsWith('image/')) return `<img loading="lazy" src="${source}" alt="">`;
  if (media.mimeType.startsWith('audio/')) return `<audio controls preload="metadata" src="${source}"></audio>`;
  return `<video controls preload="metadata" src="${source}"></video>`;
}

function shell(data) {
  const text = t();
  const user = data.user || {};
  const mediaById = new Map((data.media || []).map(item => [item.id, item]));
  const memories = data.memories || [];
  const chat = data.chat || [];
  return `<header class="fc-dash-head"><div><b>FamilyChronica</b><span>${escapeHtml(data.workspace.familyName)} · ${text.private}</span></div><button id="dashLogout">${text.signOut}</button></header>
    <main class="fc-dash-main"><section class="fc-welcome"><div class="fc-avatar">${escapeHtml((user.name || user.email || '?')[0].toUpperCase())}</div><p>${escapeHtml(user.name || user.email || '')}</p><h1>${text.hello}</h1></section>
    <section id="dashPanel" class="fc-panel"><h2>${text.memories}</h2><div class="fc-memory-list">${memories.length ? memories.map(memory => {
      const media = mediaById.get(memory.mediaId);
      return `<article><h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.text || memory.transcript)}</p>${memory.translation ? `<p>${escapeHtml(memory.translation)}</p>` : ''}${media ? mediaElement(media) : ''}</article>`;
    }).join('') : `<p>${text.empty}</p>`}</div></section></main>
    <nav class="fc-bottom"><button data-action="home">⌂<small>${text.home}</small></button><button data-action="members">♧<small>${text.tree}</small></button><button id="openAi" class="fc-record" aria-label="${text.ai}"><svg viewBox="0 0 64 64" aria-hidden="true"><path class="mic" d="M32 38c7 0 12-5 12-12V14a12 12 0 0 0-24 0v12c0 7 5 12 12 12Zm-20-13v2c0 11 9 20 20 20s20-9 20-20v-2M32 47v10M23 57h18"/><path class="spark" d="M50 5l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/></svg></button><button data-action="photos">+<small>${text.albums}</small></button><button data-action="profile">○<small>${text.profile}</small></button></nav>
    <section id="aiScreen" class="fc-ai-screen" hidden><header><button id="exitAi">← ${text.exit}</button><b>${text.ai}</b><span></span></header><div class="fc-ai-welcome"><h1>${text.aiHello}</h1><div class="fc-actions"><button data-ai-action="record">◉<span>${text.record}</span></button><button data-ai-action="photos">▧<span>${text.photos}</span></button><button data-ai-action="write">✎<span>${text.write}</span></button><button data-ai-action="members">♧<span>${text.members}</span></button></div></div><div id="aiMessages">${chat.map(message => `<p class="${message.role}">${escapeHtml(message.content)}</p>`).join('')}</div><p id="aiWarning" role="status"></p><div class="fc-ai-tools"><button id="aiUpload" aria-label="${text.upload}">+</button><button id="aiMic" aria-label="${text.record}">⌕</button><button id="aiWave" aria-label="${text.record}">≋</button></div><form id="aiForm"><input id="aiInput" maxlength="8000" placeholder="${text.askPlaceholder}"><button>${text.send}</button></form></section>`;
}

function showPanel(title, html) {
  cancelRecording();
  const panel = document.querySelector('#dashPanel');
  panel.innerHTML = `<h2>${escapeHtml(title)}</h2>${html}`;
  panel.scrollIntoView({ behavior: 'smooth' });
}

function writePanel() {
  const text = t();
  showPanel(text.write, `<form id="memoryForm"><label>${text.title}<input id="memoryTitle" maxlength="200" required></label><label>${text.memory}<textarea id="memoryText" maxlength="100000" required></textarea></label><button>${text.save}</button><p id="saveStatus" role="status"></p></form>`);
  document.querySelector('#memoryForm').onsubmit = async event => {
    event.preventDefault();
    const status = document.querySelector('#saveStatus');
    status.textContent = 'Saving…';
    try {
      await request('/api/auth/workspace/memories', { method: 'POST', body: JSON.stringify({ clientId: crypto.randomUUID(), title: document.querySelector('#memoryTitle').value, text: document.querySelector('#memoryText').value }) });
      await refresh();
    } catch (error) { status.textContent = error.message; }
  };
}

function membersPanel(data) {
  const text = t();
  showPanel(text.members, `<form id="memberForm"><label>${text.name}<input id="memberName" maxlength="120" required></label><label>${text.relationship}<input id="memberRelation" maxlength="120"></label><button>${text.add}</button><p id="memberStatus" role="alert"></p></form><div>${data.members.map(member => `<p>${escapeHtml(member.name)} · ${escapeHtml(member.relationship)}</p>`).join('') || `<p>${text.empty}</p>`}</div>`);
  document.querySelector('#memberForm').onsubmit = async event => {
    event.preventDefault();
    const status = document.querySelector('#memberStatus');
    try {
      await request('/api/auth/workspace/members', { method: 'POST', body: JSON.stringify({ name: document.querySelector('#memberName').value, relationship: document.querySelector('#memberRelation').value }) });
      await refresh('members');
    } catch (error) { status.textContent = error.message; }
  };
}

function photosPanel(data) {
  const text = t();
  showPanel(text.photos, `<form id="uploadForm"><input id="uploadFile" type="file" accept="image/png,image/jpeg,video/webm,video/mp4,audio/webm,audio/mp4" required><button>${text.upload}</button><p id="uploadStatus" role="status"></p></form><div class="fc-media-grid">${(data.media || []).map(mediaElement).join('')}</div>`);
  document.querySelector('#uploadForm').onsubmit = async event => {
    event.preventDefault();
    const file = document.querySelector('#uploadFile').files[0];
    const status = document.querySelector('#uploadStatus');
    status.textContent = 'Uploading…';
    try {
      await request(`/api/auth/workspace/media?kind=album&clientId=${crypto.randomUUID()}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      await refresh('photos');
    } catch (error) { status.textContent = error.message; }
  };
}

function supportedAudioMime() {
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function stopRecorder(recorder) {
  if (!recorder || recorder.state === 'inactive') return Promise.resolve();
  return new Promise(resolve => {
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.stop();
  });
}

async function sendSegment(session, item) {
  const params = new URLSearchParams({ recordingId: session.id, segmentId: item.id, sequence: String(item.sequence), language: session.sourceLanguage, translateTo: session.targetLanguage });
  return request(`/api/auth/workspace/transcription/segments?${params}`, { method: 'POST', body: item.blob, signal: session.controller.signal, headers: { 'Content-Type': item.blob.type.split(';')[0] } });
}

async function drainSegments(session) {
  if (session.draining || !transcriptionAvailable || session.cancelled) return;
  session.draining = true;
  try {
    while (session.pending.length) {
      const item = session.pending[0];
      try {
        const result = await sendSegment(session, item);
        if (session.cancelled) return;
        session.transcript.push(result.segment.transcript);
        if (result.segment.translation) session.translation.push(result.segment.translation);
        session.pending.shift();
        renderRecordingState(session);
      } catch (error) {
        if (session.cancelled) return;
        session.failure = error.message;
        renderRecordingState(session);
        break;
      }
    }
  } finally { session.draining = false; }
}

function renderRecordingState(session) {
  if (session.cancelled || session !== currentSession) return;
  const transcript = document.querySelector('#liveTranscript');
  const translation = document.querySelector('#liveTranslation');
  const status = document.querySelector('#recordStatus');
  if (transcript) transcript.textContent = session.transcript.join('\n');
  if (translation) translation.textContent = session.translation.join('\n');
  if (status && session.failure) status.textContent = `Transcription paused: ${session.failure}`;
  document.querySelector('#retrySegments')?.toggleAttribute('hidden', !session.failure);
  document.querySelector('#savePartial')?.toggleAttribute('hidden', !(session.failure && session.archiveBlob));
}

function createSegmentRecorder(session) {
  if (session.cancelled || session.stopping) return;
  const recorder = new MediaRecorder(session.audioStream, { mimeType: session.audioMime });
  const parts = [];
  session.segmentRecorder = recorder;
  recorder.addEventListener('dataavailable', event => { if (event.data.size) parts.push(event.data); });
  recorder.addEventListener('stop', () => {
    if (!parts.length || session.cancelled) return;
    session.sequence += 1;
    session.pending.push({ id: crypto.randomUUID(), sequence: session.sequence, blob: new Blob(parts, { type: recorder.mimeType }) });
    if (session.pending.length > MAX_PENDING_SEGMENTS) {
      session.failure = 'Upload queue is full; recording stopped to protect this memory.';
      void finishRecording(session);
    } else void drainSegments(session);
  });
  recorder.start();
}

async function rotateSegment(session) {
  if (session.stopping || session.cancelled) return;
  const recorder = session.segmentRecorder;
  await stopRecorder(recorder);
  if (!session.stopping && !session.cancelled) createSegmentRecorder(session);
}

function updateTimer(session) {
  const elapsed = Date.now() - session.startedAt;
  const seconds = Math.floor(elapsed / 1000);
  const timer = document.querySelector('#recordTimer');
  if (timer) timer.textContent = `${t().recording} ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (elapsed >= MAX_RECORDING_MS || session.archiveBytes >= MAX_ARCHIVE_BYTES) void finishRecording(session);
}

async function finishRecording(session) {
  if (!session || session.stopping) return session?.finishPromise;
  session.stopping = true;
  session.finishPromise = (async () => {
    clearInterval(session.segmentInterval);
    clearInterval(session.timerInterval);
    await Promise.all([stopRecorder(session.segmentRecorder), stopRecorder(session.archiveRecorder)]);
    session.stream.getTracks().forEach(track => track.stop());
    session.audioStream.getTracks().forEach(track => track.stop());
    if (session.cancelled) return;
    while (session.draining) await new Promise(resolve => setTimeout(resolve, 10));
    await drainSegments(session);
    if (session.cancelled) return;
    const archive = new Blob(session.archiveParts, { type: session.archiveRecorder.mimeType });
    session.archiveBlob = archive;
    if (session.pending.length) {
      const status = document.querySelector('#recordStatus');
      if (status) status.textContent = `Recording retained locally. ${session.failure}`;
      document.querySelector('#savePartial')?.removeAttribute('hidden');
      return;
    }
    await saveRecording(session);
  })();
  return session.finishPromise;
}

async function saveRecording(session) {
  if (!session || session.cancelled || session !== currentSession) return;
  const status = document.querySelector('#recordStatus');
  if (status) status.textContent = 'Saving…';
  try {
    const media = await request(`/api/auth/workspace/media?kind=recording&clientId=${session.id}`, { method: 'POST', body: session.archiveBlob, signal: session.controller.signal, headers: { 'Content-Type': session.archiveBlob.type.split(';')[0] } });
    await request('/api/auth/workspace/memories', { method: 'POST', signal: session.controller.signal, body: JSON.stringify({ clientId: session.id, title: 'Recorded memory', transcript: session.transcript.join('\n'), translation: session.translation.join('\n'), mediaId: media.media.id }) });
    if (session.cancelled || session !== currentSession) return;
    currentSession = null;
    await refresh();
  } catch (error) {
    if (session.cancelled || session !== currentSession) return;
    session.failure = error.message;
    if (status) status.textContent = `Recording retained locally: ${error.message}`;
    document.querySelector('#retrySave')?.removeAttribute('hidden');
  }
}

async function beginRecording(video, audioOnly = false) {
  if (currentSession) return;
  const sourceLanguage = document.querySelector('#recordSourceLanguage').value;
  const targetLanguage = document.querySelector('#recordTargetLanguage').value;
  const epoch = ++pendingStartEpoch;
  currentSession = { pending: true, epoch, cancelled: false };
  const startButton = document.querySelector('#startRecording');
  if (startButton) startButton.disabled = true;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia(audioOnly ? { audio: true, video: false } : { audio: true, video: true }); }
  catch (error) { if (currentSession?.epoch === epoch) currentSession = null; throw error; }
  if (currentSession?.epoch !== epoch || currentSession.cancelled || !document.querySelector('#recordStatus')) { stream.getTracks().forEach(track => track.stop()); return; }
  let audioStream, archiveRecorder;
  try { audioStream = new MediaStream(stream.getAudioTracks()); archiveRecorder = new MediaRecorder(stream); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); if (currentSession?.epoch === epoch) currentSession = null; throw error; }
  const session = { sourceLanguage, targetLanguage, id: crypto.randomUUID(), stream, audioStream, archiveRecorder, controller: new AbortController(), archiveParts: [], archiveBytes: 0, audioMime: supportedAudioMime(), segmentRecorder: null, sequence: 0, pending: [], transcript: [], translation: [], failure: '', draining: false, stopping: false, cancelled: false, startedAt: Date.now() };
  if (currentSession?.epoch !== epoch || currentSession.cancelled) { stream.getTracks().forEach(track => track.stop()); audioStream.getTracks().forEach(track => track.stop()); return; }
  currentSession = session;
  if (video) video.srcObject = stream;
  archiveRecorder.addEventListener('dataavailable', event => { if (event.data.size) { session.archiveParts.push(event.data); session.archiveBytes += event.data.size; } });
  archiveRecorder.start(1000);
  if (transcriptionAvailable) {
    createSegmentRecorder(session);
    session.segmentInterval = setInterval(() => void rotateSegment(session), 10_000);
  }
  session.timerInterval = setInterval(() => updateTimer(session), 250);
  updateTimer(session);
  document.querySelector('#startRecording')?.toggleAttribute('disabled', true);
  document.querySelector('#stopRecording')?.toggleAttribute('disabled', false);
}

function recordPanel(audioOnly = false) {
  const text = t();
  showPanel(text.record, `<p>${text.permission}</p><label>${language()==='zh-CN'?'说话语言':language()==='es'?'Idioma hablado':'Spoken language'}<select id="recordSourceLanguage"><option value="auto">Auto / 自动</option><option value="en">English</option><option value="zh-CN">中文</option><option value="es">Español</option></select></label><label>${text.translation}<select id="recordTargetLanguage"><option value="en">English</option><option value="zh-CN">中文</option><option value="es">Español</option></select></label><div id="recordTimer" class="fc-rec-timer"></div>${audioOnly ? '' : '<video id="recordPreview" autoplay playsinline muted></video>'}<div><button id="startRecording">${text.start}</button><button id="stopRecording" disabled>${text.stop}</button><button id="retrySegments" hidden>${text.retry}</button><button id="savePartial" hidden>Save recording without remaining transcript</button><button id="retrySave" hidden>${text.retrySave}</button></div><h3>${text.transcript}</h3><pre id="liveTranscript"></pre><h3>${text.translation}</h3><pre id="liveTranslation"></pre><p id="recordStatus" role="status"></p>`);
  document.querySelector('#recordTargetLanguage').value = language();
  const video = document.querySelector('#recordPreview');
  document.querySelector('#startRecording').onclick = async () => {
    try { await beginRecording(video, audioOnly); }
    catch (error) {
      cancelRecording();
      const status = document.querySelector('#recordStatus');
      if (status) status.textContent = error.message;
      document.querySelector('#startRecording')?.removeAttribute('disabled');
    }
  };
  document.querySelector('#stopRecording').onclick = () => finishRecording(currentSession);
  document.querySelector('#retrySegments').onclick = async () => {
    if (!currentSession) return;
    currentSession.failure = '';
    await drainSegments(currentSession);
    if (currentSession.stopping && !currentSession.pending.length && currentSession.archiveBlob) await saveRecording(currentSession);
  };
  document.querySelector('#retrySave').onclick = () => currentSession?.archiveBlob && saveRecording(currentSession);
  document.querySelector('#savePartial').onclick = () => currentSession?.archiveBlob && saveRecording(currentSession);
  if (!transcriptionAvailable) document.querySelector('#recordStatus').textContent = text.unavailable;
}

function openAi() {
  document.querySelector('#aiScreen').hidden = false;
}

function setupAi(data) {
  const screen = document.querySelector('#aiScreen');
  const warning = document.querySelector('#aiWarning');
  document.querySelector('#openAi').onclick = openAi;
  document.querySelector('#exitAi').onclick = () => { screen.hidden = true; cancelRecording(); };
  document.querySelectorAll('[data-ai-action]').forEach(button => button.onclick = () => {
    screen.hidden = true;
    const action = button.dataset.aiAction;
    if (action === 'record') recordPanel();
    if (action === 'photos') photosPanel(data);
    if (action === 'write') writePanel();
    if (action === 'members') membersPanel(data);
  });
  document.querySelector('#aiUpload').onclick = () => { screen.hidden = true; photosPanel(data); };
  document.querySelector('#aiMic').onclick = () => { screen.hidden = true; recordPanel(true); };
  document.querySelector('#aiWave').onclick = () => { screen.hidden = true; recordPanel(false); };
  request('/api/auth/workspace/ai/status').then(status => {
    chatAvailable = status.chatAvailable;
    transcriptionAvailable = status.transcriptionAvailable;
    if (!chatAvailable || !transcriptionAvailable) warning.textContent = t().unavailable;
  }).catch(error => { warning.textContent = error.message; });
  document.querySelector('#aiForm').onsubmit = async event => {
    event.preventDefault();
    const input = document.querySelector('#aiInput');
    const messages = document.querySelector('#aiMessages');
    const value = input.value.trim();
    if (!value) return;
    const mine = document.createElement('p');
    mine.className = 'user';
    mine.textContent = value;
    messages.append(mine);
    try {
      const result = await request('/api/auth/workspace/ai/chat', { method: 'POST', body: JSON.stringify({ clientId: crypto.randomUUID(), message: value }) });
      input.value = '';
      const reply = document.createElement('p');
      reply.className = 'assistant';
      reply.textContent = result.message.content;
      messages.append(reply);
    } catch (error) { warning.textContent = error.message; }
  };
}

async function refresh(openPanel = '') {
  if (!context) return;
  cancelRecording();
  await mountFamilyDashboard(context);
  if (openPanel === 'photos') document.querySelector('[data-action="photos"]')?.click();
  if (openPanel === 'members') document.querySelector('[data-action="members"]')?.click();
}

export async function mountFamilyDashboard(options) {
  cancelRecording();
  context = options;
  const root = document.querySelector('#familyDashboard');
  if (!root) return;
  try {
    const data = await request('/api/auth/workspace');
    root.innerHTML = shell(data);
    root.querySelectorAll('[data-action]').forEach(button => button.onclick = () => {
      const action = button.dataset.action;
      if (action === 'home') refresh();
      if (action === 'photos') photosPanel(data);
      if (action === 'members') membersPanel(data);
      if (action === 'profile') showPanel(t().profile, `<p>${escapeHtml(data.user.name || '')}</p><p>${escapeHtml(data.user.email || '')}</p>`);
    });
    document.querySelector('#dashLogout').onclick = async () => { cancelRecording(); await request('/api/auth/logout', { method: 'POST', body: '{}' }); options.route('/login'); };
    setupAi(data);
  } catch (error) {
    if (error.status === 401) return options.route('/login?next=/dashboard', true);
    root.innerHTML = `<p class="dashboard-error">${escapeHtml(error.message)}</p>`;
  }
}

function cancelRecording() {
  pendingStartEpoch += 1;
  const session = currentSession;
  if (!session) return;
  session.cancelled = true;
  session.controller?.abort();
  clearInterval(session.segmentInterval);
  clearInterval(session.timerInterval);
  try { if (session.segmentRecorder?.state === 'recording') session.segmentRecorder.stop(); } catch {}
  try { if (session.archiveRecorder?.state === 'recording') session.archiveRecorder.stop(); } catch {}
  session.stream?.getTracks().forEach(track => track.stop());
  session.audioStream?.getTracks().forEach(track => track.stop());
  currentSession = null;
}

export function releaseDashboardMedia() { cancelRecording(); }
addEventListener('pagehide', releaseDashboardMedia);
addEventListener('beforeunload', releaseDashboardMedia);
