// Dynamically loaded ESM module
let makeWASocket, useMultiFileAuthState, DisconnectReason;

async function loadBaileys() {
    if (!makeWASocket) {
        const baileys = await import('@whiskeysockets/baileys');
        makeWASocket = baileys.makeWASocket;
        useMultiFileAuthState = baileys.useMultiFileAuthState;
        DisconnectReason = baileys.DisconnectReason;
    }
}
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { updateLeadMeta, logReply } = require('./db');
const { randomDelay } = require('../utils/delay');
const { generatePersonalizedMessage } = require('../utils/messageGenerator');

let sock = null;

/**
 * Initializes the WhatsApp connection and authentication using Baileys.
 */
async function initWhatsApp() {
    await loadBaileys();
    const { state, saveCreds } = await useMultiFileAuthState('./wa_auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // Suppress detailed logs
        browser: ['Leads Automation Agent', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 WhatsApp QR Code Required: Scan to link device:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`WhatsApp connection closed. Reconnecting: ${shouldReconnect}`, lastDisconnect.error?.message);
            
            if (shouldReconnect) {
                initWhatsApp(); // Auto-reconnect
            } else {
                console.error("WhatsApp session logged out. Please delete the 'wa_auth_info' folder and scan QR again.");
            }
        } else if (connection === 'open') {
            console.log('\n✅ WhatsApp successfully connected and ready to send messages!');
        }
    });

    // Reply Listener
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        for (const msg of m.messages) {
            if (!msg.key.fromMe && msg.message) {
                const senderId = msg.key.remoteJid;
                
                // Exclude status replies and groups
                if (senderId.includes('@g.us') || senderId === 'status@broadcast') continue;

                const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

                if (textMessage) {
                    console.log(`\n💬 New Reply Received from: ${senderId}`);
                    console.log(`   Message: ${textMessage}`);

                    // Clean phone format from JID (e.g., 919876543210@s.whatsapp.net -> 919876543210)
                    const phoneId = senderId.split('@')[0];
                    
                    await logReply(phoneId, textMessage);
                }
            }
        }
    });
}

/**
 * Formats a phone number for WhatsApp ID.
 */
function formatWAPhone(phone) {
    // Remove all non-numeric characters (including +)
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Fallback: If no country code, assuming India (91) - customize as needed
    if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
    }

    return `${cleanPhone}@s.whatsapp.net`;
}

/**
 * Sends a single WhatsApp message.
 * @param {string} phone - Target phone number.
 * @param {string} text - Message text.
 */
async function sendMessage(phone, text) {
    if (!sock) {
        console.error('WhatsApp socket is not initialized.');
        return false;
    }

    const jid = formatWAPhone(phone);

    try {
        // Send typing indicator... Optional but nice for anti-ban
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, 2000));
        await sock.sendPresenceUpdate('paused', jid);

        await sock.sendMessage(jid, { text });
        console.log(`✅ Message successfully sent to ${phone}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message to ${phone}:`, error.message);
        return false;
    }
}

/**
 * Sends WhatsApp messages to a list of leads with anti-ban delays.
 * @param {Array} leads - The array of leads.
 */
async function sendBulkMessages(leads) {
    if (!sock) {
        console.warn('⚠️ WhatsApp is not connected. Skipping bulk message sending.');
        return;
    }

    if (!leads || leads.length === 0) {
        console.log('No leads provided for WhatsApp messaging.');
        return;
    }

    console.log(`\n--- STEP 8: WhatsApp Automated Messaging (Lead count: ${leads.length}) ---`);

    // Add a mandatory initial delay after WhatsApp connection (anti-ban practice)
    console.log('[Anti-Ban] Waiting 15 seconds before starting batch...');
    await randomDelay(15, 20);

    let sentCount = 0;

    for (const lead of leads) {
        // Only message leads with valid phone numbers
        if (!lead.phone) continue;

        // Message body generation
        const messageBody = generatePersonalizedMessage(lead);

        console.log(`\nSending WhatsApp to: ${lead.name} (${lead.phone})`);
        
        const success = await sendMessage(lead.phone, messageBody);

        if (success) {
            sentCount++;
            // Update Firestore with message state
            await updateLeadMeta(lead.phone, {
                message_sent: true,
                sent_at: new Date().toISOString()
            });

            // If it's not the last lead, pause (30-90s) to prevent spam bans
            if (sentCount < leads.length) {
                await randomDelay(30, 90);
            }
        }
    }

    console.log(`\n🎉 WhatsApp Messaging Batch Completed: ${sentCount}/${leads.length} sent successfully.`);
}

module.exports = {
    initWhatsApp,
    sendMessage,
    sendBulkMessages
};
