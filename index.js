/**
 * Knight Bot - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 * Licensed under the MIT License
 */
require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const axios = require('axios');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { smsg, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep } = require('./lib/myfunc');
const { 
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");

// Configuration
const phoneNumber = "2349119002176"; // Without + prefix
const owner = JSON.parse(fs.readFileSync('./data/owner.json'));
global.botname = "KNIGHT BOT";
global.themeemoji = "•";

// Store implementation
const store = {
    messages: {},
    contacts: {},
    chats: {},
    bind: function(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (msg.key?.remoteJid) {
                    this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {};
                    this.messages[msg.key.remoteJid][msg.key.id] = msg;
                }
            });
        }),
        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) this.contacts[contact.id] = contact;
            });
        }),
        ev.on('chats.set', (chats) => {
            this.chats = chats;
        });
    },
    loadMessage: async (jid, id) => {
        return this.messages[jid]?.[id] || null;
    }
};

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const msgRetryCounterCache = new NodeCache();

        const bot = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
        });

        store.bind(bot.ev);

        // JID normalization helper
        bot.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
            }
            return jid;
        };

        // Event handlers
        bot.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                console.log('Scan QR code with WhatsApp:');
                require('qrcode-terminal').generate(qr, { small: true });
            }
            
            if (connection === "open") {
                console.log(chalk.yellow(`Connected to: ${JSON.stringify(bot.user, null, 2)}`));
                
                // Send connection notification
                const botNumber = `${bot.user.id.split(':')[0]}@s.whatsapp.net`;
                await bot.sendMessage(botNumber, { 
                    text: `🤖 Bot Connected Successfully!\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online`
                }).catch(console.error);
                
                console.log(chalk.yellow(`\n\n[ ${global.botname} ]\n\n`));
                console.log(chalk.cyan('<==================================================>'));
                console.log(chalk.magenta(`${global.themeemoji} YT CHANNEL: MR UNIQUE HACKER`));
                console.log(chalk.magenta(`${global.themeemoji} WA NUMBER: ${owner}`));
            }
            
            if (connection === "close" && update.lastDisconnect?.error?.output.statusCode !== 401) {
                startBot(); // Reconnect
            }
        });

        bot.ev.on('creds.update', saveCreds);
        bot.ev.on('messages.upsert', handleMessagesWrapper(bot));
        bot.ev.on('group-participants.update', (update) => handleGroupParticipantUpdate(bot, update));
        bot.ev.on('status.update', (status) => handleStatus(bot, status));

        // Helper functions
        bot.getName = async (jid, withoutContact = false) => {
            const id = bot.decodeJid(jid);
            
            if (id.endsWith("@g.us")) {
                const v = store.contacts[id] || {};
                if (!(v.name || v.subject)) {
                    const groupMeta = await bot.groupMetadata(id).catch(() => ({}));
                    return groupMeta.subject || PhoneNumber(`+${id.replace('@s.whatsapp.net', '')}`).getNumber('international');
                }
                return v.name || v.subject;
            }
            
            const v = id === '0@s.whatsapp.net' ? { name: 'WhatsApp' } : 
                      id === bot.decodeJid(bot.user.id) ? bot.user : 
                      store.contacts[id] || {};
            return withoutContact ? '' : v.name || v.verifiedName || 
                   PhoneNumber(`+${jid.replace('@s.whatsapp.net', '')}`).getNumber('international');
        };

        bot.serializeM = (m) => smsg(bot, m, store);
        bot.public = true;

        return bot;

    } catch (error) {
        console.error('Bot initialization failed:', error);
        process.exit(1);
    }
}

// Message handler wrapper
function handleMessagesWrapper(bot) {
    return async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            mek.message = mek.message.ephemeralMessage?.message || mek.message;
            
            if (mek.key?.remoteJid === 'status@broadcast') {
                await handleStatus(bot, chatUpdate);
                return;
            }
            
            if (!bot.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;
            
            await handleMessages(bot, chatUpdate, true);
        } catch (err) {
            console.error("Message handling error:", err);
            if (mek.key?.remoteJid) {
                await bot.sendMessage(mek.key.remoteJid, { 
                    text: '❌ An error occurred while processing your message.'
                }).catch(console.error);
            }
        }
    };
}

// Start the bot
startBot().catch(console.error);

// Error handling
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// File watch for development
if (require.main === module) {
    const file = require.resolve(__filename);
    fs.watchFile(file, () => {
        fs.unwatchFile(file);
        console.log(chalk.redBright(`Updated ${__filename}`));
        delete require.cache[file];
        require(file);
    });
}