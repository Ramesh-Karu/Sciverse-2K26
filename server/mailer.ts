import { Resend } from 'resend';
import nodemailer from 'nodemailer';

let resendInstance: any = null;
let smtpTransporter: any = null;

// Helper to strip HTML and build plain text alternative for anti-spam filters
function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const getSenderEmail = () => process.env.SENDER_EMAIL || 'noreply@npfp.site';
const getSenderName = () => process.env.SENDER_NAME || 'SciVerse 2K26';

function getEmailClient(smtpConfig?: any) {
  if (smtpConfig?.resendApiKey) {
    return { type: 'resend', client: new Resend(smtpConfig.resendApiKey) };
  } else if (process.env.RESEND_API_KEY) {
    if (!resendInstance) {
      resendInstance = new Resend(process.env.RESEND_API_KEY);
    }
    return { type: 'resend', client: resendInstance };
  }
  
  if (smtpConfig?.host) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port || '587'),
      secure: smtpConfig.secure === true || smtpConfig.secure === 'true',
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
    return { type: 'smtp', client: transporter };
  } else if (process.env.SMTP_HOST) {
    if (!smtpTransporter) {
      smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return { type: 'smtp', client: smtpTransporter };
  }
  
  return { type: 'none' };
}

// Beautiful CSS styling and standard wrappers for email templates
function wrapHtmlEmail(title: string, bodyContent: string, accentColor = '#3b82f6') {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #030712;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo-container {
          display: inline-block;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px 24px;
          border-radius: 16px;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);
        }
        .app-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.05em;
          color: #ffffff;
          margin: 0;
          text-transform: uppercase;
        }
        .app-subtitle {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #64748b;
          margin: 2px 0 0 0;
          text-transform: uppercase;
        }
        .card {
          background-color: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 35px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          margin-bottom: 20px;
          text-transform: uppercase;
        }
        .badge-success {
          background-color: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34d399;
        }
        h1 {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 12px;
        }
        p {
          font-size: 15px;
          line-height: 1.625;
          color: #cbd5e1;
          margin-top: 0;
          margin-bottom: 20px;
        }
        .divider {
          height: 1px;
          background-color: rgba(255, 255, 255, 0.06);
          margin: 25px 0;
        }
        .data-grid {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        .data-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: #64748b;
          text-transform: uppercase;
          padding-bottom: 4px;
        }
        .data-value {
          font-size: 15px;
          font-weight: 600;
          color: #f1f5f9;
          padding-bottom: 16px;
        }
        .qr-section {
          text-align: center;
          background-color: rgba(255, 255, 255, 0.015);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 25px;
          margin: 25px 0;
        }
        .qr-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .qr-subtitle {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 15px;
        }
        .qr-image {
          background-color: #ffffff;
          padding: 12px;
          border-radius: 14px;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .button-container {
          text-align: center;
          margin-top: 30px;
        }
        .button {
          display: inline-block;
          background-color: ${accentColor};
          color: #ffffff !important;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          padding: 12px 30px;
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
          transition: transform 0.2s;
        }
        .footer {
          text-align: center;
          margin-top: 35px;
        }
        .footer-text {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
          margin: 0;
        }
        .accent-text {
          color: ${accentColor};
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <h2 class="app-name"><span class="accent-text">Sci</span>Verse 2K26</h2>
            <p class="app-subtitle">Jaffna Hindu College Science Union</p>
          </div>
        </div>
        
        <div class="card">
          ${bodyContent}
        </div>
        
        <div class="footer">
          <p class="footer-text">
            © 2026 Science Union, Jaffna Hindu College. All Rights Reserved.
          </p>
          <p class="footer-text" style="margin-top: 5px; font-size: 10px;">
            This invitation was automatically generated and sent to the registered school delegation.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 1. Sends pending registration email
export async function sendPendingEmail(schoolData: any) {
  const { name, email, teacherInCharge, registrationId, expectedStudents, expectedTeachers, smtpConfig } = schoolData;
  const subject = `SciVerse 2K26 - Registration Received [${registrationId}]`;
  
  const content = `
    <div class="badge">REGISTRATION PENDING</div>
    <h1>Registration Received!</h1>
    <p>Dear <strong>${teacherInCharge}</strong>,</p>
    <p>Thank you for submitting your school's official delegation request for <strong>SciVerse 2K26</strong>. Our executive organizing board has received your records and is currently processing your pass details.</p>
    
    <div class="divider"></div>
    
    <table class="data-grid">
      <tr>
        <td class="data-label" width="50%">School Name</td>
        <td class="data-label" width="50%">Temporary Access ID</td>
      </tr>
      <tr>
        <td class="data-value">${name}</td>
        <td class="data-value" style="font-family: monospace; color: #3b82f6;">${registrationId}</td>
      </tr>
      <tr>
        <td class="data-label">Estimated Students</td>
        <td class="data-label">Estimated Teachers</td>
      </tr>
      <tr>
        <td class="data-value">${expectedStudents} Students</td>
        <td class="data-value">${expectedTeachers} Teachers</td>
      </tr>
    </table>
    
    <div class="divider"></div>
    
    <p><strong>What happens next?</strong></p>
    <p>While our administrators review your capacity and day preferences, you can log into the school delegation portal using your <strong>Temporary Access ID (${registrationId})</strong> to preview schedules and update contact profiles.</p>
    <p>You will receive an official confirmation email containing your approved Admission Pass & QR Code once your application is formally approved.</p>
    <p style="font-size: 13px; color: #64748b;">(If you do not see the confirmation email in your inbox, please check your spam or junk folder.)</p>
    
    <!-- Beautiful SciVerse Tech Card Container for actions -->
    <div style="margin-top: 35px; padding: 25px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 20px; text-align: center;">
      <div style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 15px;">Official Portal Actions</div>
      
      <!-- Primary Action: Big sleek glowing high-tech button -->
      <div style="margin-bottom: 18px;">
        <a href="https://sujhc.site/?login=${registrationId}" style="display: block; background: #3b82f6; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; padding: 13px 20px; border-radius: 12px; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25); text-align: center; font-family: 'Inter', sans-serif;">
          ⚡ Access My Portal Dashboard
        </a>
      </div>
      
      <!-- Secondary Actions: Grid-like structure with clean borders, responsive -->
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
        <tr>
          <td width="48%" valign="middle" style="padding-right: 6px;">
            <a href="https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l" style="display: block; background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.3); color: #25d366 !important; text-decoration: none; font-weight: 600; font-size: 12px; padding: 10px 12px; border-radius: 10px; text-align: center; font-family: 'Inter', sans-serif;">
              💬 WhatsApp Updates
            </a>
          </td>
          <td width="4%" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
          <td width="48%" valign="middle" style="padding-left: 6px;">
            <a href="https://sujhc.site" style="display: block; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1 !important; text-decoration: none; font-weight: 600; font-size: 12px; padding: 10px 12px; border-radius: 10px; text-align: center; font-family: 'Inter', sans-serif;">
              🌐 Visit Exhibition Site
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;

  const html = wrapHtmlEmail(subject, content, '#3b82f6');
  return await dispatchEmail(email, subject, html, smtpConfig);
}

// 2. Sends approved/confirmation email
export async function sendConfirmationEmail(schoolData: any) {
  const { id, name, email, teacherInCharge, registrationId, qrCodeUrl, quota, preferredDay, arrivalTime, isSolo, smtpConfig } = schoolData;
  const subject = `SciVerse 2K26 - ${isSolo ? 'Solo Registration' : 'Registration'} CONFIRMED! [${registrationId}]`;
  
  const content = `
    <div class="badge badge-success">REGISTRATION CONFIRMED</div>
    <h1 style="color: #10b981;">SciVerse 2K26 Entry Pass Issued!</h1>
    <p>Dear <strong>${teacherInCharge}</strong>,</p>
    <p>We are thrilled to inform you that your ${isSolo ? 'solo student' : 'school delegation'} application for <strong>SciVerse 2K26</strong> has been officially approved! Your master entrance pass has been generated, and your seating allocations are confirmed.</p>
    
    <div class="divider"></div>
    
    <table class="data-grid">
      <tr>
        <td class="data-label" width="50%">${isSolo ? 'Participant Name' : 'School Name'}</td>
        <td class="data-label" width="50%">${isSolo ? 'Solo' : 'School'} Registration Code</td>
      </tr>
      <tr>
        <td class="data-value">${name}</td>
        <td class="data-value" style="font-family: monospace; color: #10b981;">${registrationId}</td>
      </tr>
      <tr>
        <td class="data-label">Approved Attendance Day</td>
        <td class="data-label">Target Arrival Time Slot</td>
      </tr>
      <tr>
        <td class="data-value">${preferredDay}</td>
        <td class="data-value">${arrivalTime}</td>
      </tr>
      ${isSolo ? '' : `
      <tr>
        <td class="data-label" colspan="2">Allotted Student Quota</td>
      </tr>
      <tr>
        <td class="data-value" colspan="2" style="color: #60a5fa;">${quota} Max Attendees (including teachers)</td>
      </tr>
      `}
    </table>
    
    <div class="qr-section">
      <div class="qr-title">Official Entry QR Code Pass</div>
      <div class="qr-subtitle">Scan this QR code at the reception desk for instant check-in.</div>
      <div class="qr-image">
        <img src="https://quickchart.io/chart?cht=qr&chl=${registrationId}&chs=150x150" alt="SciVerse QR Pass" width="130" height="130" style="display: block;" referrerPolicy="no-referrer" />
      </div>
    </div>
    
    <div class="divider"></div>
    
    <p><strong>Crucial Instructions:</strong></p>
    <ul style="padding-left: 20px; margin-top: 0; margin-bottom: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      <li style="margin-bottom: 8px;">Please print this email or keep this digital copy handy on your phone when arriving.</li>
      ${isSolo ? `
      <li style="margin-bottom: 8px;">Present this ID at the gate: <strong>${registrationId}</strong> for verification.</li>
      ` : `
      <li style="margin-bottom: 8px;">Log into the school portal using your <strong>School Registration Code (${registrationId})</strong> to add specific student name rosters and download individual smart ID badges.</li>
      `}
      <li style="margin-bottom: 8px;">Please arrive strictly during your scheduled time slot to avoid main-gate congestion.</li>
      <li style="margin-bottom: 8px; color: #25d366; font-weight: bold;">Join the official SciVerse WhatsApp Updates Group for announcements: <a href="https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l" style="color: #60a5fa; text-decoration: underline;">https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l</a></li>
      <li style="margin-bottom: 8px; color: #facc15;">If you do not see the confirmation email in your inbox, please check your spam or junk folder.</li>
    </ul>
    
    <!-- Beautiful SciVerse Tech Card Container for actions -->
    <div style="margin-top: 35px; padding: 25px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 20px; text-align: center;">
      <div style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 15px;">Official Portal Actions</div>
      
      <!-- Primary Action: Big sleek glowing high-tech button -->
      <div style="margin-bottom: 18px;">
        <a href="https://sujhc.site/?login=${id || registrationId}${isSolo ? '&solo=true' : ''}" style="display: block; background: #10b981; color: #030712 !important; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; padding: 13px 20px; border-radius: 12px; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.25); text-align: center; font-family: 'Inter', sans-serif;">
          ⚡ Enter Secure Student Portal
        </a>
      </div>
      
      <!-- Secondary Actions: Grid-like structure with clean borders, responsive -->
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
        <tr>
          <td width="48%" valign="middle" style="padding-right: 6px;">
            <a href="https://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l" style="display: block; background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.3); color: #25d366 !important; text-decoration: none; font-weight: 600; font-size: 12px; padding: 10px 12px; border-radius: 10px; text-align: center; font-family: 'Inter', sans-serif;">
              💬 WhatsApp Updates
            </a>
          </td>
          <td width="4%" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
          <td width="48%" valign="middle" style="padding-left: 6px;">
            <a href="https://sujhc.site" style="display: block; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1 !important; text-decoration: none; font-weight: 600; font-size: 12px; padding: 10px 12px; border-radius: 10px; text-align: center; font-family: 'Inter', sans-serif;">
              🌐 Visit Exhibition Site
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;

  const html = wrapHtmlEmail(subject, content, '#10b981');
  return await dispatchEmail(email, subject, html, smtpConfig);
}

// 3. Sends test email to verify SMTP or Resend
export async function sendTestEmail(to: string, subject: string, body: string, smtpConfig?: any) {
  const content = `
    <div class="badge">SMTP TEST EMAIL</div>
    <h1>SMTP Connection Test</h1>
    <p>This is a test email sent from the SciVerse 2K26 system to verify your SMTP configuration.</p>
    <div class="divider"></div>
    <p><strong>Test Message:</strong></p>
    <p style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; font-family: monospace; font-size: 13px; line-height: 1.5; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.08);">${body}</p>
    <div class="divider"></div>
    <p>If you received this, your SMTP settings are correct and working perfectly!</p>
  `;
  const html = wrapHtmlEmail(subject, content, '#3b82f6');
  return await dispatchEmail(to, subject, html, smtpConfig);
}

// Dispatches email using configured strategy (Resend -> SMTP -> Server Console Log)
async function dispatchEmail(to: string, subject: string, html: string, smtpConfig?: any) {
  const senderEmail = smtpConfig?.senderEmail || getSenderEmail();
  const senderName = smtpConfig?.senderName || getSenderName();
  const mailer = getEmailClient(smtpConfig);
  
  console.log(`[Email System] Preparing to send email. Destination: ${to} | Subject: "${subject}" | Client Strategy: ${mailer.type}`);

  try {
    const plainText = htmlToText(html);

    if (mailer.type === 'resend') {
      try {
        const response = await mailer.client.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to,
          subject,
          text: plainText,
          html,
          headers: {
            'X-Auto-Response-Loop': 'auto-generated',
            'Precedence': 'bulk',
            'X-Entity-Ref-ID': `sciverse-${Date.now()}`
          }
        });
        console.log(`[Email System] Email sent via Resend API successfully:`, response);
        return { success: true, method: 'resend', id: response.data?.id };
      } catch (resendError: any) {
        console.error(`[Email System] Resend SDK Error:`, JSON.stringify(resendError, null, 2));
        throw resendError;
      }
    } 
    
    if (mailer.type === 'smtp') {
      const info = await mailer.client.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        text: plainText,
        html,
        headers: {
          'X-Auto-Response-Loop': 'auto-generated',
          'Precedence': 'bulk',
          'X-Mailer': 'SciVerse-Automated-Mailer',
          'X-Entity-Ref-ID': `sciverse-${Date.now()}`
        }
      });
      console.log(`[Email System] Email sent via SMTP successfully:`, info.messageId);
      return { success: true, method: 'smtp', id: info.messageId };
    }

    // Fallback: Simulation/Console Log Mode
    console.log(`\n================= SIMULATED EMAIL OUTBOX =================`);
    console.log(`TO: ${to}`);
    console.log(`FROM: "${senderName}" <${senderEmail}>`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`HTML BODY LENGTH: ${html.length} characters`);
    console.log(`--- PREVIEW CUTOUT ---`);
    const cleanPreview = html.replace(/<[^>]*>/g, ' ').substring(0, 300).trim();
    console.log(cleanPreview + '...');
    console.log(`========================================================\n`);
    
    return { 
      success: true, 
      method: 'simulation', 
      note: 'API keys not set. Email printed to console logs cleanly.' 
    };
  } catch (error) {
    console.error(`[Email System] Failed to send email to ${to}:`, error);
    // Return mock success or logged note so the main app doesn't crash on invalid credentials
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error), 
      note: 'Failed to deliver but process handled gracefully.' 
    };
  }
}
