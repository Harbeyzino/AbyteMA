function normalizeJid(jid) {
    if (!jid) return '';
    // Remove device suffix (e.g., :2) and extract only the number part
    let base = jid.split('@')[0].split(':')[0];
    // Remove any non-digit characters (should be only numbers)
    base = base.replace(/\D/g, '');
    // Ensure it starts with country code (e.g., 234)
    return base.startsWith('234') ? base : `234${base}`;
}

module.exports = async function isAdmin(sock, chatId, senderId) {
    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants.map(p => p.id);

    // Normalize all participant numbers
    const normalizedParticipants = participants.map(normalizeJid);

    // Normalize bot and sender numbers
    const botNumber = normalizeJid(sock.user.id);
    const senderNumber = normalizeJid(senderId);

    const botParticipant = groupMetadata.participants.find(p => normalizeJid(p.id) === botNumber);
    const senderParticipant = groupMetadata.participants.find(p => normalizeJid(p.id) === senderNumber);

    const isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
    const isSenderAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');

    // Debug
    console.log('[ADMIN DEBUG] Raw Participants:', participants);
    console.log('[ADMIN DEBUG] Normalized Bot Number:', botNumber);
    console.log('[ADMIN DEBUG] Bot Participant Found:', !!botParticipant);
    console.log('[ADMIN DEBUG] Sender Participant Found:', !!senderParticipant);

    return { isBotAdmin, isSenderAdmin };
};