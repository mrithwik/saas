"use client"

import { useState, useRef, FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Protect, PricingTable, UserButton } from '@clerk/nextjs';

// ── Language options ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'fa', label: 'Farsi / Persian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
];

// ── Helper: extract the patient email section from the full output ─────────────

function extractEmailSection(markdown: string): string {
  const marker = '### Draft of email to patient';
  const idx = markdown.indexOf(marker);
  if (idx === -1) return '';
  return markdown.slice(idx + marker.length).trim();
}

// ── Main form component ───────────────────────────────────────────────────────

function ConsultationForm() {
  const { getToken } = useAuth();

  // Form state
  const [patientName, setPatientName] = useState('');
  const [visitDate, setVisitDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState('');

  // Audio dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Summary streaming state
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  // Translation state
  const [selectedLang, setSelectedLang] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);

  // ── Audio recording ─────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert('Microphone access is required for audio dictation.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function transcribeAudio(blob: Blob) {
    setIsTranscribing(true);
    try {
      const jwt = await getToken();
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Transcription error:', errorText);
        alert('Transcription failed: ' + errorText);
        return;
      }

      const { transcript } = await res.json();
      setNotes((prev) => (prev ? prev + '\n' + transcript : transcript));
    } catch (err) {
      console.error(err);
      alert('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Summary generation ──────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setOutput('');
    setTranslatedText('');
    setSelectedLang('');
    setLoading(true);

    const jwt = await getToken();
    if (!jwt) {
      setOutput('Authentication required');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let buffer = '';

    await fetchEventSource('/api/consultation', {  // ← AWS path
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        patient_name: patientName,
        date_of_visit: visitDate?.toISOString().slice(0, 10),
        notes,
      }),
      onmessage(ev) {
        buffer += ev.data;
        setOutput(buffer);
      },
      onclose() {
        setLoading(false);
      },
      onerror(err) {
        console.error('SSE error:', err);
        controller.abort();
        setLoading(false);
      },
    });
  }

  // ── Translation ─────────────────────────────────────────────────────────────

  async function handleTranslate() {
    if (!selectedLang || !output) return;
    setTranslatedText('');
    setTranslating(true);

    const jwt = await getToken();
    const emailText = extractEmailSection(output);
    if (!emailText) {
      alert('Could not find the patient email section to translate. Please generate a summary first.');
      setTranslating(false);
      return;
    }

    const langLabel = LANGUAGES.find((l) => l.code === selectedLang)?.label ?? selectedLang;
    const controller = new AbortController();
    let buffer = '';

    await fetchEventSource('/api/translate', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ text: emailText, target_language: langLabel }),
      onmessage(ev) {
        buffer += ev.data;
        setTranslatedText(buffer);
      },
      onclose() {
        setTranslating(false);
      },
      onerror(err) {
        console.error('Translation SSE error:', err);
        controller.abort();
        setTranslating(false);
      },
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Consultation Assistant
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
        Type your notes or use audio dictation — then generate and translate in one click.
      </p>

      {/* ── Input form ── */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">

        {/* Patient name */}
        <div className="space-y-2">
          <label htmlFor="patient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Patient Name
          </label>
          <input
            id="patient"
            type="text"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Enter patient's full name"
          />
        </div>

        {/* Visit date */}
        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date of Visit
          </label>
          <DatePicker
            id="date"
            selected={visitDate}
            onChange={(d: Date | null) => setVisitDate(d)}
            dateFormat="yyyy-MM-dd"
            placeholderText="Select date"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Notes + Audio dictation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Consultation Notes
            </label>

            {/* Audio dictation controls */}
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="text-sm font-mono text-red-500 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {formatTime(recordingSeconds)}
                </span>
              )}
              {isTranscribing && (
                <span className="text-xs text-gray-400 italic">Transcribing…</span>
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                title={isRecording ? 'Stop recording' : 'Start audio dictation'}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  isRecording
                    ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300'
                } disabled:opacity-50`}
              >
                {isRecording ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6 10a1 1 0 0 1 2 0 8 8 0 0 1-7 7.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A8 8 0 0 1 4 11a1 1 0 1 1 2 0 6 6 0 0 0 12 0z" />
                    </svg>
                    Dictate
                  </>
                )}
              </button>
            </div>
          </div>

          <textarea
            id="notes"
            required
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Type notes here, or click Dictate to record audio…"
          />
          <p className="text-xs text-gray-400">
            Audio dictation uses Whisper AI — speak clearly and it will transcribe into this field.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || isRecording || isTranscribing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          {loading ? 'Generating Summary…' : 'Generate Summary'}
        </button>
      </form>

      {/* ── Generated output ── */}
      {output && (
        <section className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="markdown-content prose prose-blue dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {output}
            </ReactMarkdown>
          </div>

          {/* ── Translation panel ── */}
          {!loading && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Translate patient letter
              </h3>
              <div className="flex gap-3 flex-wrap items-center">
                <select
                  value={selectedLang}
                  onChange={(e) => {
                    setSelectedLang(e.target.value);
                    setTranslatedText('');
                  }}
                  className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a language…</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={!selectedLang || translating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {translating ? 'Translating…' : 'Translate'}
                </button>
              </div>

              {translatedText && (
                <div className="mt-5 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                      {LANGUAGES.find((l) => l.code === selectedLang)?.label} translation
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(translatedText)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {translatedText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Page wrapper with Clerk subscription protection ───────────────────────────

export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      <Protect
        plan="premium_subscription"
        fallback={
          <div className="container mx-auto px-4 py-12">
            <header className="text-center mb-12">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Healthcare Professional Plan
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                Streamline your patient consultations with AI-powered summaries
              </p>
            </header>
            <div className="max-w-4xl mx-auto">
              <PricingTable />
            </div>
          </div>
        }
      >
        <ConsultationForm />
      </Protect>
    </main>
  );
}
