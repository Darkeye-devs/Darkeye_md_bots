import { config } from '../config/index.js'
import { fetchJson } from '../lib/http.js'
import { db } from './index.js'
import { log } from '../core/logger.js'
import { LIMITS } from '../config/constants.js'
import { UserError } from '../lib/errors.js'

const logger = log('ai')

export const enabled = Boolean(config.ai.apiKey)

function assertEnabled() {
  if (!enabled) {
    throw new UserError('AI is not configured yet.', { hint: 'Set AI_API_KEY in .env and restart.' })
  }
}

const headers = () => ({
  authorization: `Bearer ${config.ai.apiKey}`,
  'content-type': 'application/json'
})

/**
 * Chat completion with per-chat memory.
 * Works against any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, Together, Ollama…).
 */
export async function chat(chatJid, prompt, { sender = null, system = null, remember = true } = {}) {
  assertEnabled()

  const history = remember ? db.aiMemory.history(chatJid, LIMITS.aiMemoryTurns) : []
  const messages = [
    { role: 'system', content: system ?? config.ai.systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: prompt }
  ]

  const payload = {
    model: config.ai.model,
    messages,
    temperature: 0.8,
    max_tokens: 800
  }

  const data = await fetchJson(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: payload,
    timeout: 45_000
  })

  const answer = data?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('the model returned an empty response')

  if (remember) {
    db.aiMemory.push(chatJid, 'user', prompt)
    db.aiMemory.push(chatJid, 'assistant', answer)
  }
  return answer
}

/** One-shot completion with a custom instruction — used by .summarize, .translate, .rewrite… */
export async function complete(instruction, input, { system = null, maxTokens = 900 } = {}) {
  assertEnabled()
  const data = await fetchJson(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: {
      model: config.ai.model,
      messages: [
        { role: 'system', content: system ?? 'You are a precise assistant. Answer with the requested output only.' },
        { role: 'user', content: `${instruction}\n\n---\n${input}` }
      ],
      temperature: 0.5,
      max_tokens: maxTokens
    },
    timeout: 60_000
  })
  const answer = data?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('empty model response')
  return answer
}

/** Vision: describe an image buffer. */
export async function vision(buffer, prompt = 'Describe this image in two sentences.') {
  assertEnabled()
  const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`
  const data = await fetchJson(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: {
      model: process.env.AI_VISION_MODEL || config.ai.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: 500
    },
    timeout: 60_000
  })
  return data?.choices?.[0]?.message?.content?.trim() ?? ''
}

/** Image generation (gpt-image-1 / dall-e-3 compatible endpoints). */
export async function image(prompt, { size = '1024x1024' } = {}) {
  assertEnabled()
  const data = await fetchJson(`${config.ai.baseUrl}/images/generations`, {
    method: 'POST',
    headers: headers(),
    body: {
      model: process.env.AI_IMAGE_MODEL || 'dall-e-3',
      prompt,
      n: 1,
      size,
      response_format: 'b64_json'
    },
    timeout: 120_000
  })

  const b64 = data?.data?.[0]?.b64_json
  if (!b64) {
    const url = data?.data?.[0]?.url
    if (!url) throw new Error('no image returned')
    const res = await fetch(url)
    return Buffer.from(await res.arrayBuffer())
  }
  return Buffer.from(b64, 'base64')
}

export function clearMemory(chatJid) {
  return db.aiMemory.clear(chatJid)
}

export default { chat, complete, vision, image, clearMemory, enabled }
