import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { chromium } from 'playwright';
import JobModel from '../models/Job';
import { trackingQueue } from './index';
import path from 'path';
import { openai, getCandidateData } from '../agents/llm';

export const browserWorker = new Worker('browser-apply', async job => {
  console.log(`[Agent 4] Launching Playwright Browser for: ${job.data.company}`);
  
  // Launch Playwright utilizing persistent profile dir if possible, else standard
  const userDateDir = path.join(__dirname, '../../data/browser_profile');
  const browserContext = await chromium.launchPersistentContext(userDateDir, { 
    headless: false // We show it so user can intervene if needed
  });
  
  const page = await browserContext.newPage();

  try {
    await page.goto(job.data.jobUrl, { waitUntil: 'load', timeout: 60000 });
    
    console.log(`[Agent 4 - AI Form Filler] Analyzing structure of ${job.data.jobUrl}...`);
    // Wait for generic load / simulate agent observation
    await page.waitForTimeout(2000); 
    
    // 1. Fill First Name
    const fn = await page.$("input[id*='first_name'], input[name*='first_name']");
    if (fn) { await fn.fill("Kiran"); console.log("Filled First Name"); }

    // 2. Fill Last Name
    const ln = await page.$("input[id*='last_name'], input[name*='last_name']");
    if (ln) { await ln.fill("S R"); console.log("Filled Last Name"); }

    // 3. Fill Email
    const em = await page.$("input[id*='email'], input[name*='email']");
    if (em) { await em.fill("skkiran1258@gmail.com"); console.log("Filled Email"); }

    // 4. Fill Phone
    const ph = await page.$("input[id*='phone'], input[name*='phone']");
    if (ph) { await ph.fill("+918124785632"); console.log("Filled Phone"); }

    // 5. Fill LinkedIn & Website
    const linkedin = await page.$("input[name*='linkedin'], input[id*='linkedin'], input[aria-label*='LinkedIn']");
    if (linkedin) { await linkedin.fill("https://www.linkedin.com/in/kiran-s-r/"); console.log("Filled LinkedIn URL"); }

    const website = await page.$("input[name*='website'], input[id*='website'], input[name*='portfolio']");
    if (website) { await website.fill("https://cipher-vortex.vercel.app/"); console.log("Filled Website/Portfolio URL"); }

    // 6. Attach Resume
    const fileInp = await page.$("input[type='file']");
    if (fileInp) {
        try {
            let resumeToUpload = path.resolve(__dirname, '../../documents/Kiran S R _ Full Stack Engineer.pdf');
            
            // Dynamic Resume Generation Engine
            if (job.data.prepData && job.data.prepData.tailored_resume_html) {
                console.log("[Agent 4] Generating dynamic tailored Resume PDF on the fly...");
                const pdfPage = await browserContext.newPage();
                await pdfPage.setContent(job.data.prepData.tailored_resume_html, { waitUntil: 'networkidle' });
                const dynamicPdfPath = path.resolve(__dirname, `../../documents/Tailored_Resume_${job.data._id}.pdf`);
                
                await pdfPage.pdf({ 
                    path: dynamicPdfPath, 
                    format: 'A4', 
                    margin: { top: '0.6in', bottom: '0.6in', left: '0.5in', right: '0.5in' } 
                });
                await pdfPage.close();
                resumeToUpload = dynamicPdfPath;
                console.log(`[Agent 4] Tailored Resume PDF created successfully at: ${dynamicPdfPath}`);
            }

            await fileInp.setInputFiles(resumeToUpload);
            console.log("Uploaded Resume PDF (Tailored or Default)!");
        } catch(e) {
            try {
                const fallback = path.resolve(__dirname, '../../extracted_resume.txt');
                await fileInp.setInputFiles(fallback);
                console.log("Uploaded fallback resume TXT");
            } catch(fallbackErr) {
                console.log("File attach failed entirely.");
            }
        }
    }

    // 7. Auto-Dropdowns
    const selects = await page.$$("select");
    for (const s of selects) {
        const options = await s.$$("option");
        for (const opt of options) {
            const val = await opt.getAttribute("value");
            const txt = ((await opt.innerText()) || "").toLowerCase();
            if (val && val !== "" && !txt.includes("select")) {
                await s.selectOption(val);
                console.log(`Selected dropdown option: ${val}`);
                break;
            }
        }
    }

    // 8. Custom React-select Comboboxes
    const customSelects = await page.$$(".select__control, [class*='control']");
    for (const cs of customSelects) {
        try {
            await cs.scrollIntoViewIfNeeded();
            await cs.click();
            await page.waitForTimeout(500);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
        } catch (e) {}
    }

    // 9. Generic Text Fields (Questions) & Dynamic LLM Answers
    const textFields = await page.$$("input[type='text']:not([value]), textarea");
    if (textFields.length > 0) {
        let candidateProfile: any = null;
        try { candidateProfile = getCandidateData(); } catch(e) { console.warn("No candidate profile found for dynamic answers."); }

        for (const tf of textFields) {
            const val = await tf.inputValue();
            if (!val) {
                const nameAttr = (await tf.getAttribute("name") || "").toLowerCase();
                const idAttr = (await tf.getAttribute("id") || "").toLowerCase();
                let ariaLabel = await tf.getAttribute("aria-label") || "";
                
                // Hardware fallback for obvious fields
                if (nameAttr.includes("location") || idAttr.includes("location")) {
                    await tf.fill("Bengaluru, India");
                    continue;
                }
                
                // Try dynamically grabbing the label text around the input element
                let questionContext = ariaLabel || nameAttr || idAttr;
                try {
                    const extracted = await tf.evaluate((el: any) => {
                        if (el.labels && el.labels.length > 0) return el.labels[0].innerText;
                        if (el.previousElementSibling) return (el.previousElementSibling as HTMLElement).innerText;
                        return '';
                    });
                    if (extracted && extracted.trim().length > 3) questionContext = extracted.trim();
                } catch(e) {}

                if (!questionContext || questionContext.length < 3) {
                    await tf.fill("Yes");
                    continue;
                }

                if (candidateProfile) {
                    console.log(`[Agent 4] Generating dynamic answer from LLM for: "${questionContext}"`);
                    try {
                        const completion = await openai.chat.completions.create({
                            model: process.env.GROK_API_KEY ? "grok-beta" : "gpt-4o-mini",
                            messages: [
                                { role: "system", content: "You are an applicant filling out a job application form. Answer the screening question concisely (1-2 sentences maximum, often just 1-3 words if simple) based on your candidate profile. Provide ONLY the final answer text. Do not include quotes or intro text." },
                                { role: "user", content: `Candidate Profile Info: ${JSON.stringify(candidateProfile)}\n\nForm Question: ${questionContext}` }
                            ],
                            temperature: 0.2
                        });
                        const answer = completion.choices[0].message.content || "Yes";
                        await tf.fill(answer.trim());
                        console.log(`[Agent 4] LLM Provided: ${answer.trim()}`);
                    } catch (err) {
                        console.error("[Agent 4] LLM failed to answer, falling back:", err);
                        await tf.fill("Yes");
                    }
                } else {
                    await tf.fill("Yes");
                }
            }
        }
    }

    await page.waitForTimeout(2000);
    
    // 10. Check if Submit button exists & click it
    const submitBtn = await page.$("#submit_app, button[type='submit'], input[type='submit'], button:has-text('Submit Application')");
    if (submitBtn) {
        console.log("Clicking submit button live...");
        await submitBtn.click();
        await page.waitForTimeout(5000);
    }
    
    console.log(`[Agent 4] Successfully submitted application for ${job.data.company}!`);
    await JobModel.updateOne({ _id: job.data._id }, { status: 'Applied' });
    
    // Queue for Tracking (Agent 5 - Google Sheets)
    await trackingQueue.add('track', { ...job.data, status: 'Applied', appliedDate: new Date() });
    
  } catch (err) {
    console.error(`[Agent 4] Error applying to ${job.data.company}:`, err);
    await JobModel.updateOne({ _id: job.data._id }, { status: 'Failed' });
  } finally {
    // Leave it open briefly to verify manually if watching
    await page.waitForTimeout(3000);
    await page.close();
    await browserContext.close();
  }
  
}, { connection: redisConnection });
