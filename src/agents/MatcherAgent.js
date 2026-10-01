"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatcherAgent = void 0;
const llm_1 = require("./llm");
const prompts_1 = require("./prompts");
class MatcherAgent {
    static async analyzeJD(jobDescription) {
        const candidateProfile = (0, llm_1.getCandidateData)();
        const userMessage = `
    Job Description:
    ${jobDescription}

    Candidate Profile:
    ${JSON.stringify(candidateProfile, null, 2)}
    `;
        try {
            const response = await llm_1.openai.chat.completions.create({
                model: "grok-beta", // Using grok-beta/grok-2 based on Grok API
                messages: [
                    { role: "system", content: prompts_1.MATCHER_PROMPT },
                    { role: "user", content: userMessage }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            });
            const responseContent = response.choices[0]?.message?.content;
            if (!responseContent)
                throw new Error("Empty response from LLM");
            return JSON.parse(responseContent);
        }
        catch (error) {
            console.error("Error generating Match Score:", error);
            throw error;
        }
    }
}
exports.MatcherAgent = MatcherAgent;
//# sourceMappingURL=MatcherAgent.js.map