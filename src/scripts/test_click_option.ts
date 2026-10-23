import { chromium } from "playwright";

async function testReactSelectClick() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("https://job-boards.greenhouse.io/gitlab/jobs/8826965002", { waitUntil: "networkidle" });

  const questionId = "question_38435288002"; // Are you subject to any employment agreements...
  const input = await page.$(`#${questionId}`);
  if (input) {
    await input.click();
    await page.waitForTimeout(300);
    await input.fill("No");
    await page.waitForTimeout(500);

    const options = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[class*='option'], [id*='-option-']")).map(o => ({
        id: o.id,
        className: o.className,
        text: o.textContent?.trim()
      }));
    });
    console.log("Visible options:", JSON.stringify(options, null, 2));

    const optionToClick = await page.$("[class*='option']:has-text('No'), [id*='-option-']:has-text('No')");
    if (optionToClick) {
      await optionToClick.click();
      console.log("Clicked option directly!");
    }

    await page.waitForTimeout(500);

    // Check hidden input value
    const hiddenVal = await page.evaluate((qId) => {
      const container = document.querySelector(`label[for="${qId}"]`)?.closest('.field, div');
      const hidden = container?.querySelector('.remix-css-1a0ro4n-requiredInput') as HTMLInputElement;
      return hidden ? { value: hidden.value, name: hidden.name, required: hidden.required } : null;
    }, questionId);

    console.log("Hidden input state after click:", JSON.stringify(hiddenVal, null, 2));
  }

  await browser.close();
}

testReactSelectClick();
