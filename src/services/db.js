const { db } = require('../config/firebase');

/**
 * Saves or updates a lead in the "leads" collection.
 * @param {Object} lead - The lead object.
 */
async function saveLead(lead) {
    if (!lead.phone) return;
    
    // Clean phone number to use as an ID (remove spaces, symbols)
    const phoneId = String(lead.phone).replace(/[^\d+]/g, '') || String(lead.phone);
    
    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set({
        ...lead,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Checks if a lead has already been sent by checking "sent_leads" collection.
 * @param {string} phone - The phone number of the lead.
 * @returns {Promise<boolean>} - True if it exists, false otherwise.
 */
async function isLeadSent(phone) {
    if (!phone) return false;
    
    const phoneId = String(phone).replace(/[^\d+]/g, '') || String(phone);
    const sentLeadDoc = await db.collection('sent_leads').doc(phoneId).get();
    
    return sentLeadDoc.exists;
}

/**
 * Marks a lead as sent by adding it to "sent_leads" collection.
 * @param {Object} lead - The lead that was sent.
 */
async function markLeadAsSent(lead) {
    if (!lead.phone) return;
    
    const phoneId = String(lead.phone).replace(/[^\d+]/g, '') || String(lead.phone);
    
    const sentLeadRef = db.collection('sent_leads').doc(phoneId);
    
    await sentLeadRef.set({
        phone: lead.phone,
        name: lead.name,
        sentDate: new Date().toISOString()
    });
}

/**
 * Updates metadata for a lead in Firestore.
 * @param {string} phone - Target phone number.
 * @param {Object} data - Metadata object to merge.
 */
async function updateLeadMeta(phone, data) {
    if (!phone) return;
    
    const phoneId = String(phone).replace(/[^\d+]/g, '') || String(phone);
    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set(data, { merge: true });
}

/**
 * Logs an incoming WhatsApp reply.
 * @param {string} phoneId - Caller's phone ID.
 * @param {string} messageText - The text of the reply.
 */
async function logReply(phoneId, messageText) {
    if (!phoneId) return;

    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set({
        reply_received: true,
        last_reply: messageText,
        reply_at: new Date().toISOString()
    }, { merge: true });
}

module.exports = { saveLead, isLeadSent, markLeadAsSent, updateLeadMeta, logReply };
