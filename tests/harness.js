/**
 * Test harness: runs real plugin code against a fake WhatsApp socket and a real
 * (temporary) SQLite database. If a command passes here, its logic genuinely runs.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkeyes-test-'))
process.env.DB_PATH = path.join(tmpDir, 'test.db')
process.env.SESSION_DIR = path.join(tmpDir, 'auth')
process.env.LOG_LEVEL = 'silent'
process.env.NODE_ENV = 'test'
process.env.OWNER_NUMBER = '2348000000001'
process.env.PREFIX = '.'

const { initDb, closeDb } = await import('../src/services/database.js')
const { services } = await import('../src/services/index.js')
const { setCapabilities } = await import('../src/core/registry.js')
const { config } = await import('../src/config/index.js')

initDb()
// Tests assume the optional services are available, so capability guards never mask logic.
setCapabilities({ ffmpeg: true, ai: true, downloader: true })

export { services, config, closeDb }

/** Collected outbound messages of the fake socket. */
export function makeSock() {
  const sent = []
  return {
    sent,
    user: { id: '2348000000001:1@s.whatsapp.net', name: 'Dark Eyes' },
    sendMessage: async (jid, content, options) => {
      sent.push({ jid, content, options })
      return { key: { id: `sent-${sent.length}` } }
    },
    sendPresenceUpdate: async () => {},
    readMessages: async () => {},
    groupMetadata: async () => ({
      id: '12345@g.us',
      subject: 'Test Group',
      participants: [
        { id: '2348000000001@s.whatsapp.net', admin: 'superadmin' },
        { id: '2348000000002@s.whatsapp.net', admin: null },
        { id: '2348000000003@s.whatsapp.net', admin: 'admin' }
      ]
    }),
    groupParticipantsUpdate: async () => [{ status: '200' }],
    groupSettingUpdate: async () => {},
    groupUpdateSubject: async () => {},
    groupUpdateDescription: async () => {},
    groupInviteCode: async () => 'INVITECODE123',
    groupRevokeInvite: async () => {},
    updateBlockStatus: async () => {},
    profilePictureUrl: async () => 'https://example.com/pic.jpg',
    fetchStatus: async () => [{ status: 'the eye that sees', setAt: new Date() }],
    updateProfileStatus: async () => {},
    updateProfilePicture: async () => {},
    removeProfilePicture: async () => {},
    fetchBlocklist: async () => [],
    rejectCall: async () => {},
    groupAcceptInvite: async () => '12345@g.us',
    groupLeave: async () => {}
  }
}

/**
 * Build the ctx object a plugin receives.
 * @param {object} plugin  the plugin under test
 * @param {{ text?: string, args?: string[], sender?: string, group?: boolean, mentions?: string[] }} overrides
 */
export function makeCtx(plugin, overrides = {}) {
  const sock = overrides.sock ?? makeSock()
  const sender = overrides.sender ?? '2348000000002@s.whatsapp.net'
  const chat = overrides.group === false ? sender : '12345@g.us'
  const replies = []
  const reactions = []

  const ctx = {
    sock,
    plugin,
    command: overrides.command ?? plugin.name,
    args: overrides.args ?? [],
    argsText: overrides.argsText ?? (overrides.args ?? []).join(' '),
    prefix: '.',
    text: overrides.text ?? '',
    raw: { key: { id: 'msg-1', remoteJid: chat, participant: sender, fromMe: false } },
    m: { key: { id: 'msg-1' } },
    chat,
    sender,
    senderNumber: sender.split('@')[0],
    pushName: overrides.pushName ?? 'Tester',
    isGroup: overrides.group !== false,
    isOwner: overrides.isOwner ?? false,
    isAdmin: overrides.isAdmin ?? false,
    isBotAdmin: overrides.isBotAdmin ?? true,
    isFromMe: false,
    mentions: overrides.mentions ?? [],
    quoted: overrides.quoted ?? null,
    quotedText: overrides.quotedText ?? '',
    quotedType: overrides.quotedType ?? null,
    media: overrides.media ?? null,
    participants: [
      { id: '2348000000001@s.whatsapp.net', admin: 'superadmin' },
      { id: '2348000000002@s.whatsapp.net', admin: null },
      { id: '2348000000003@s.whatsapp.net', admin: 'admin' }
    ],
    config,
    db: services.db,
    services,
    logger: { info() {}, warn() {}, error() {}, debug() {} },

    async reply(content, options) {
      const text = typeof content === 'string' ? content : content?.text ?? JSON.stringify(content)
      replies.push(text)
      await sock.sendMessage(chat, typeof content === 'string' ? { text: content } : content, options)
      return { key: { id: `reply-${replies.length}` } }
    },
    async say(content, options) {
      return ctx.reply(content, options)
    },
    async replyMedia(buffer, mimetype, caption) {
      replies.push(caption ?? `[media:${mimetype}]`)
      return { key: { id: 'media' } }
    },
    async react(emoji) {
      reactions.push(emoji)
    },
    async download() {
      return Buffer.from('fake-media-bytes')
    },
    async groupMeta() {
      return sock.groupMetadata()
    },
    async tagAll(message) {
      replies.push(message)
    },
    mentionText: () => '',
    replies,
    reactions
  }

  return ctx
}

/** Run a plugin and return its context (replies land in ctx.replies). */
export async function run(plugin, overrides = {}) {
  const ctx = makeCtx(plugin, overrides)
  await plugin.execute(ctx)
  return ctx
}

/** Load a plugin by name from the registry (after loadPlugins). */
export async function loadRegistry() {
  const registryModule = await import('../src/core/registry.js')
  await registryModule.loadPlugins({ silent: true })
  return registryModule
}
