'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReportDigest } from '../lib/finding-detail';

const STARTERS = [
  'What should I fix first?',
  'How do I fix the top finding?',
  'Which findings look live?',
];

const WELCOME = 'Ask about this report only — what to fix, how to rotate a secret, or why the gate Failed. Off-topic questions get a short redirect.';

export default function MuseChat({ report, open, onClose, seedQuestion = '' }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const seeded = useRef('');
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy, open]);

  function patchAssistant(content) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant') {
        next[next.length - 1] = { role: 'assistant', content };
      } else {
        next.push({ role: 'assistant', content });
      }
      return next;
    });
  }

  async function readSse(response) {
    const reader = response.body?.getReader?.();
    if (!reader) {
      const body = await response.json().catch(() => ({}));
      return body.reply || body.error || 'No reply.';
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event.type === 'delta' && event.text) {
          full += event.text;
          patchAssistant(full);
        } else if (event.type === 'done' && event.reply && !full) {
          full = event.reply;
          patchAssistant(full);
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Muse chat failed.');
        }
      }
    }
    return full || 'No reply.';
  }

  async function send(text) {
    const message = String(text || '').trim();
    if (!message || busy || !report) return;
    setDraft('');
    setError('');
    const next = [...messagesRef.current, { role: 'user', content: message }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      const response = await fetch('/api/muse-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          stream: true,
          digest: buildReportDigest(report),
          history: next.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Muse chat failed.');
      }
      const reply = await readSse(response);
      if (!String(reply || '').trim()) {
        patchAssistant('I could not form a reply just now. Ask about a finding or “What should I fix first?”');
      }
    } catch (cause) {
      setError(cause.message || 'Muse chat failed.');
      patchAssistant('I could not reach Muse just now. Try again, or open a finding’s Muse button for the local checklist.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || !seedQuestion || !report) return;
    if (seeded.current === seedQuestion) return;
    seeded.current = seedQuestion;
    send(seedQuestion);
  }, [open, seedQuestion, report]);

  function onSubmit(event) {
    event.preventDefault();
    send(draft);
  }

  if (!open) return null;

  return (
    <aside className="muse-chat" aria-label="Chat with Muse">
      <header className="muse-chat-head">
        <div>
          <p className="muse-chat-kicker">Muse · live</p>
          <h2>Ask about this report</h2>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close Muse chat">Close</button>
      </header>

      <div className="muse-chat-starters">
        {STARTERS.map((item) => (
          <button key={item} type="button" className="muse-chip" onClick={() => send(item)} disabled={busy}>
            {item}
          </button>
        ))}
      </div>

      <div className="muse-chat-log" ref={scroller}>
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`muse-bubble ${item.role}${busy && index === messages.length - 1 && item.role === 'assistant' ? ' streaming' : ''}`}>
            <span>{item.role === 'assistant' ? 'Muse' : 'You'}</span>
            <p>{item.content || (busy && item.role === 'assistant' ? '…' : '')}</p>
          </div>
        ))}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>

      <form className="muse-chat-form" onSubmit={onSubmit}>
        <label className="sr" htmlFor="muse-chat-input">Message Muse</label>
        <textarea
          id="muse-chat-input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this report only…"
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <button type="submit" className="cta" disabled={busy || !draft.trim()}>
          {busy ? 'Streaming…' : 'Send'}
        </button>
      </form>
    </aside>
  );
}
