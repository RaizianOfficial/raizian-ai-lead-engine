/**
 * Generates a personalized WhatsApp message based on lead data.
 * @param {Object} lead - The lead object containing name, problem, and pitch.
 * @returns {string} - The generated message template.
 */
function generatePersonalizedMessage(lead) {
    // Extract first name nicely (fallback to "there" if single word or unknown)
    const firstName = lead.name && lead.name.split(' ')[0] !== 'Unknown' 
        ? lead.name.split(' ')[0] 
        : 'there';

    const templates = [
        `Hi ${firstName},\n\nI noticed that ${lead.problem.toLowerCase()}.\n\n${lead.pitch} Would you be open to a quick chat about this?`,
        `Hello ${firstName}! I was checking out local businesses and saw your profile.\n\nIt looks like ${lead.problem.toLowerCase()}.\n\n${lead.pitch} Let me know if you’d like to explore how we can help!`,
        `Hey ${firstName},\n\nI specialize in helping businesses like yours. I noticed an issue where ${lead.problem.toLowerCase()}.\n\n${lead.pitch} Are you currently looking into this?`
    ];

    // Pick a random template
    const randomIndex = Math.floor(Math.random() * templates.length);
    let message = templates[randomIndex];

    // Fallback if AI didn't return a good pitch
    if (!lead.pitch || lead.pitch === 'N/A' || lead.pitch === 'Error') {
        message = `Hi ${firstName},\n\nI was looking at your online presence and thought there might be a few areas where we could help improve your digital footprint. Let me know if you're open to a brief chat!`;
    }

    return message;
}

module.exports = { generatePersonalizedMessage };
