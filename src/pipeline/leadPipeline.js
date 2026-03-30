const { scrapeLeads } = require('../services/scraper');
const { saveLead, isLeadSent, markLeadAsSent } = require('../services/db');
const { qualifyLead } = require('../services/ai');
const { sendEmailReport } = require('../services/email');
const { sendBulkMessages } = require('../services/whatsappService');

async function runPipeline() {
    try {
        console.log('🚀 Starting Daily Lead Generation Pipeline...');

        const targetCity = process.env.TARGET_CITY || 'Patna';
    const targetNiche = process.env.TARGET_NICHE || 'gym';
    const scrapeLimit = Number(process.env.SCRAPE_LIMIT) || 50;
    const minScoreThreshold = Number(process.env.MIN_SCORE_THRESHOLD) || 70;
    const dailyLimit = Number(process.env.DAILY_LEAD_LIMIT) || 10;

    // STEP 1: SCRAPE LEADS
    console.log(`\n--- STEP 1: Searching for ${targetNiche} in ${targetCity} (Limit: ${scrapeLimit}) ---`);
    let rawLeads = await scrapeLeads(targetCity, targetNiche, scrapeLimit);

    if (!rawLeads || rawLeads.length === 0) {
        console.log('No leads scraped today. Ending pipeline.');
        return;
    }

    // STEP 2: STORE RAW LEADS
    console.log('\n--- STEP 2: Storing Raw Leads ---');
    for (const lead of rawLeads) {
        await saveLead(lead);
    }
    console.log(`Saved ${rawLeads.length} leads to database.`);

    // STEP 3: BASIC FILTER (NO AI)
    console.log('\n--- STEP 3: Basic Filtering ---');
    let filteredLeads = rawLeads.filter(lead => {
        // Reject if rating >= 4.5 AND reviews > 300
        if (lead.rating >= 4.5 && lead.reviews > 300) {
            return false; // too established, reject
        }
        return true;
    });
    console.log(`Leads after basic filtering: ${filteredLeads.length} (Discarded: ${rawLeads.length - filteredLeads.length})`);

    // STEP 4: AI QUALIFICATION
    console.log('\n--- STEP 4: AI Qualification ---');
    let qualifiedLeads = [];
    for (const lead of filteredLeads) {
        // Increase delay to avoid 429 rate-limiting on Gemini free tier (15 RPM)
        await new Promise(r => setTimeout(r, 4500));
        
        console.log(`Qualifying: ${lead.name}`);
        const aiAnalysis = await qualifyLead(lead);
        
        const qualifiedLead = {
            ...lead,
            ...aiAnalysis, // adds score, problem, pitch_angle
        };
        
        // Rules: <60 reject, 60-79 medium, 80+ high
        if (qualifiedLead.score >= 60) {
            qualifiedLead.qualified = true;
            qualifiedLeads.push(qualifiedLead);
            console.log(`  -> Passed (Score: ${qualifiedLead.score})`);
        } else {
            console.log(`  -> Rejected (Score: ${qualifiedLead.score} < 60)`);
        }

        // Save AI analysis back to db
        await saveLead(qualifiedLead);
    }

    // STEP 5: DUPLICATE CHECK
    console.log('\n--- STEP 5: Duplicate Check (Against Sent Leads) ---');
    let newLeads = [];
    for (const lead of qualifiedLeads) {
        const isSent = await isLeadSent(lead.phone);
        if (!isSent) {
            newLeads.push(lead);
        } else {
            console.log(`  -> ${lead.name} already sent before. Skipping.`);
        }
    }
    console.log(`Leads after duplicate check: ${newLeads.length}`);

    // STEP 6: SELECT TOP LEADS
    console.log('\n--- STEP 6: Select Top Leads ---');
    let topLeads = newLeads.filter(l => l.score >= minScoreThreshold);
    console.log(`Leads meeting score threshold (${minScoreThreshold}): ${topLeads.length}`);
    
    // Sort by score DESC
    topLeads.sort((a, b) => b.score - a.score);
    
    // Select daily limit
    topLeads = topLeads.slice(0, dailyLimit);
    console.log(`Selected Top ${topLeads.length} leads for delivery.`);

    if (topLeads.length === 0) {
        console.log('No eligible leads to send today.');
        return;
    }

    // STEP 7: SEND EMAIL REPORT
    console.log('\n--- STEP 7: Sending Email ---');
    const emailSent = await sendEmailReport(topLeads);

        if (emailSent) {
            // STEP 8: MARK AS SENT
            console.log('\n--- STEP 8: Marking Leads as Sent ---');
            for (const lead of topLeads) {
                await markLeadAsSent(lead);
            }
            console.log('Leads successfully marked as sent.');
            
            // STEP 9: WHATSAPP OUTREACH
            await sendBulkMessages(topLeads);
        } else {
            console.error('Email failed to send. Leads were NOT marked as sent.');
        }

        console.log('\n🏁 Pipeline Execution Complete.');
    } catch (error) {
        console.error('\n❌ CRITICAL PIPELINE ERROR:', error);
        throw error; // Rethrow to let index.js handler catch it
    }
}

module.exports = { runPipeline };
