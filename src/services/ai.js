const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Qualifies a lead using Gemini AI.
 * @param {Object} lead - The lead to qualify.
 * @returns {Promise<Object>} - Object with { score, problem, pitch_angle }
 */
async function qualifyLead(lead) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key') {
        console.warn('⚠️ GEMINI_API_KEY is not configured or uses default value.');
        return {
            score: 0,
            problem: 'AI Config Missing',
            pitch_angle: 'N/A'
        };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); 

    const prompt = `
    Analyze the following local business to determine its quality as a lead for digital marketing/tech services.
    
    Business Details:
    Name: ${lead.name}
    Niche: ${process.env.TARGET_NICHE || 'business'}
    City: ${process.env.TARGET_CITY || 'local area'}
    Rating: ${lead.rating}
    Total Reviews: ${lead.reviews}
    Website Presence: ${lead.website ? 'Yes' : 'No'}
    
    Your task:
    1. Analyze business quality based on rating, reviews, and website presence.
    2. Identify if they need digital services (e.g., website creation, review management, SEO).
    3. Detect their main problem.
    4. Assign a score from 0 to 100 representing how good of a lead they are.
       - A missing website but moderate reviews might mean a high score (need a website).
       - Terrible ratings might mean they need reputation management.
       - Outstanding ratings and lots of reviews + website might mean they are already established (lower score).

    Respond ONLY in valid JSON format with the following exact keys:
    {
        "score": number (0-100),
        "problem": string (short description of their main problem),
        "pitch_angle": string (short pitch angle for our services)
    }
    DO NOT wrap the response in markdown blocks like \`\`\`json. Just return the raw JSON object.
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        
        // Remove markdown formatting if Gemini added it despite instructions
        if (text.startsWith('```json')) {
            text = text.replace('```json', '').replace('```', '').trim();
        } else if (text.startsWith('```')) {
            text = text.replace(/```/g, '').trim();
        }

        const data = JSON.parse(text);
        
        return {
            score: Number(data.score) || 0,
            problem: data.problem || 'Unknown Problem',
            pitch_angle: data.pitch_angle || 'General Pitch'
        };
    } catch (error) {
        console.error(`AI qualification failed for ${lead.name}:`, error.message);
        return { score: 0, problem: 'AI Analysis Failed', pitch_angle: 'Error' };
    }
}

module.exports = { qualifyLead };
