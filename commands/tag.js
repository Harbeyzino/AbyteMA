const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    // Debug logging
    const groupMetadata = await sock.groupMetadata(chatId);
    const botJid = sock.user.id;
    const botNumber = botJid.split('@')[0].split(':')[0];
    console.log('[BOT DEBUG] Actual bot JID:', botJid);
    console.log('[BOT DEBUG] Actual bot number:', botNumber);
    const botJidNormalized = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botParticipant = groupMetadata.participants.find(p => p.id === botJidNormalized);
    console.log('[TAG DEBUG] Bot JID:', botJidNormalized);
    console.log('[TAG DEBUG] Bot participant:', botParticipant);
    console.log('[TAG DEBUG] isBotAdmin:', isBotAdmin);
    console.log('[TAG DEBUG] isSenderAdmin:', isSenderAdmin);
    if (!botParticipant) {
        console.log('[TAG DEBUG] All participant JIDs:', groupMetadata.participants.map(p => p.id));
    }

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' });
        return;
    }

    if (!isSenderAdmin) {
        const stickerPath = './assets/sticktag.webp';  // Path to your sticker
        if (fs.existsSync(stickerPath)) {
            const stickerBuffer = fs.readFileSync(stickerPath);
            await sock.sendMessage(chatId, { sticker: stickerBuffer });
        }
        return;
    }

    const participants = groupMetadata.participants;
    const mentionedJidList = participants.map(p => p.id);

    if (replyMessage) {
        let messageContent = {};

        // Handle image messages
        if (replyMessage.imageMessage) {
            const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
            messageContent = {
                image: { url: filePath },
                caption: messageText || replyMessage.imageMessage.caption || '',
                mentions: mentionedJidList
            };
        }
        // Handle video messages
        else if (replyMessage.videoMessage) {
            const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
            messageContent = {
                video: { url: filePath },
                caption: messageText || replyMessage.videoMessage.caption || '',
                mentions: mentionedJidList
            };
        }
        // Handle text messages
        else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
            messageContent = {
                text: replyMessage.conversation || replyMessage.extendedTextMessage.text,
                mentions: mentionedJidList
            };
        }
        // Handle document messages
        else if (replyMessage.documentMessage) {
            const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
            messageContent = {
                document: { url: filePath },
                fileName: replyMessage.documentMessage.fileName,
                caption: messageText || '',
                mentions: mentionedJidList
            };
        }

        if (Object.keys(messageContent).length > 0) {
            await sock.sendMessage(chatId, messageContent);
        }
    } else {
        await sock.sendMessage(chatId, {
            text: messageText || "Tagged message",
            mentions: mentionedJidList
        });
    }
}

module.exports = tagCommand;
