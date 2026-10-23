import nodemailer from "nodemailer";
import { TRUTH_PROFILE } from "../config/truthProfile";
import { env } from "../config/env";
import fs from "fs";
import path from "path";

export interface OutreachEmailPayload {
  toEmail: string;
  recipientName?: string;
  companyName: string;
  subject: string;
  body: string;
  resumePath?: string;
}

export function createMailerTransport() {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }
  return null;
}

export async function sendOutreachEmail(payload: OutreachEmailPayload): Promise<{ success: boolean; message: string }> {
  const transporter = createMailerTransport();

  const attachments = [];
  const resume = payload.resumePath || env.RESUME_PATH;
  if (resume && fs.existsSync(resume)) {
    attachments.push({
      filename: path.basename(resume),
      path: path.resolve(resume)
    });
  }

  const mailOptions = {
    from: `"${TRUTH_PROFILE.candidate.name}" <${env.SMTP_FROM || TRUTH_PROFILE.candidate.email}>`,
    to: payload.toEmail,
    replyTo: TRUTH_PROFILE.candidate.email,
    subject: payload.subject,
    text: payload.body,
    attachments
  };

  if (!transporter) {
    console.log(`[Mailer - Simulation / Dry Run] No SMTP credentials in .env. Email prepared for: ${payload.toEmail}`);
    console.log(`[Subject]: ${mailOptions.subject}`);
    console.log(`[Preview]:\n${payload.body.slice(0, 300)}...\n`);
    return {
      success: true,
      message: `Dry-run completed. (Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send live emails)`
    };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Successfully sent outreach email to ${payload.toEmail}. MessageId: ${info.messageId}`);
    return { success: true, message: `Sent: ${info.messageId}` };
  } catch (err: any) {
    console.error(`[Mailer] Error sending email to ${payload.toEmail}:`, err);
    return { success: false, message: err.message };
  }
}
