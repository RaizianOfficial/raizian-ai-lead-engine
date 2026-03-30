require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listGeminiModels() {
    if (!API_KEY) {
        console.error("❌ Error: GEMINI_API_KEY is not set. Check your .env file.");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        console.log("🔍 Fetching available models...\n");
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API responded with HTTP status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log("=== 🚀 Models Available for Lead Qualification ===");
        
        const textModels = data.models.filter(model => 
            model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes("generateContent")
        );

        textModels.forEach(model => {
            const cleanName = model.name.replace('models/', '');
            console.log(`✅ ${cleanName}`);
        });

    } catch (error) {
        console.error("❌ Failed to list models:", error.message);
    }
}

listGeminiModels();
