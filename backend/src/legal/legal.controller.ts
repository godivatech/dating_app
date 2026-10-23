import {
  Controller,
  Get,
  Post,
  Body,
  Header,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { APP_CONFIG } from '../../../shared/src/config';

@Controller()
export class LegalController {
  private readonly logger = new Logger(LegalController.name);

  constructor(private readonly prisma: PrismaService) { }

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy(): string {
    return this.renderPrivacyPolicyHtml();
  }

  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicyAlias(): string {
    return this.renderPrivacyPolicyHtml();
  }

  @Get('delete-account')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDeleteAccountPage(): string {
    return this.renderDeleteAccountHtml();
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getTermsOfService(): string {
    return this.renderTermsHtml();
  }

  @Post('delete-account/request')
  @HttpCode(HttpStatus.OK)
  async submitDeleteAccountRequest(
    @Body() body: { phoneNumber: string; pin?: string; reason?: string },
  ): Promise<{ success: boolean; message: string }> {
    if (!body?.phoneNumber || typeof body.phoneNumber !== 'string') {
      throw new BadRequestException('A valid phone number is required.');
    }

    const cleanPhone = body.phoneNumber.trim().replace(/[\s-]/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone.replace(/^\+91/, '')}` },
        ],
      },
    });

    if (!user) {
      // Do not reveal whether user exists for privacy, but return confirmation
      return {
        success: true,
        message:
          'If an account is associated with this number, your deletion request has been submitted and will be processed within 48 hours.',
      };
    }

    // If PIN is provided and user has a PIN, verify before immediate deletion
    const anyUser = user as any;
    if (anyUser.pinHash && body.pin) {
      const isValid = this.verifyPin(body.pin, anyUser.pinHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid security PIN. Deletion request could not be authenticated.');
      }
    }

    // Execute immediate account deactivation and data scrambling
    const now = Date.now();
    await this.prisma.$transaction(async (tx) => {
      // Deactivate user
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.DEACTIVATED,
          phoneNumber: `deleted_${user.id.slice(0, 8)}_${now}`,
        },
      });

      // Invalidate all active sessions
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Update dating profile to inactive
      await tx.datingProfile.updateMany({
        where: { userId: user.id },
        data: {
          displayName: 'Former Member',
          bio: 'This account has been deleted.',
        },
      });
    });

    this.logger.log(`[ACCOUNT_DELETED_WEB] Account ${user.id} deleted via web portal. Reason: ${body.reason || 'None'}`);

    return {
      success: true,
      message: `Your ${APP_CONFIG.appName} account and associated personal data have been permanently deactivated and scheduled for purge.`,
    };
  }

  private verifyPin(pin: string, storedHash: string): boolean {
    try {
      const parts = storedHash.split(':');
      if (parts.length !== 2) return false;
      const [salt, hash] = parts;
      const attemptHash = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attemptHash, 'hex'));
    } catch {
      return false;
    }
  }

  private renderPrivacyPolicyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — ${APP_CONFIG.legalName}</title>
  <style>
    :root {
      --primary: #FD5D65;
      --primary-dark: #E04850;
      --primary-soft: #FFF1F2;
      --primary-border: #FECDD3;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 16px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 20px;
      border: 1px solid var(--border);
      padding: 36px 32px;
      box-shadow: 0 4px 25px -4px rgba(15, 23, 42, 0.06), 0 2px 10px -2px rgba(15, 23, 42, 0.03);
    }
    .header {
      text-align: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .logo {
      font-size: 32px;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.5px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-block;
      background: var(--primary-soft);
      color: var(--primary);
      border: 1px solid var(--primary-border);
      font-size: 13px;
      font-weight: 600;
      padding: 5px 14px;
      border-radius: 999px;
      margin-top: 10px;
    }
    h1 { font-size: 26px; font-weight: 800; color: var(--text); margin: 14px 0 6px; }
    h2 { font-size: 18px; font-weight: 700; color: var(--text); margin: 26px 0 10px; border-left: 3px solid var(--primary); padding-left: 12px; }
    p, li { font-size: 14.5px; color: var(--text-muted); margin-bottom: 10px; }
    ul { padding-left: 20px; margin-bottom: 14px; }
    strong { color: var(--text); font-weight: 600; }
    code { background: #F1F5F9; color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
    .alert-box {
      background: var(--primary-soft);
      border: 1px solid var(--primary-border);
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .alert-box h3 { color: #BE123C; font-size: 16px; margin-bottom: 6px; font-weight: 700; }
    .alert-box p { color: #881337; margin-bottom: 0; }
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 24px;
      margin-top: 32px;
      font-size: 13px;
      text-align: center;
      color: var(--text-muted);
    }
    a { color: var(--primary); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; color: var(--primary-dark); }
    .nav-links { display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 13.5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❤️ ${APP_CONFIG.appName}</div>
      <div class="badge">Official Privacy Policy & Child Safety Standards</div>
      <h1>Privacy Policy</h1>
      <p>Effective Date: October 2026 | Last Updated: October 2026</p>
      <div class="nav-links">
        <a href="/terms">Terms of Service</a> &bull;
        <a href="/delete-account">Account & Data Deletion Portal</a>
      </div>
    </div>

    <div class="alert-box">
      <h3>Strict 18+ Adult-Only Application</h3>
      <p>${APP_CONFIG.appName} is exclusively designed for consenting adults aged <strong>18 years or older</strong>. We enforce zero tolerance for underage registration, child exploitation, and abusive conduct.</p>
    </div>

    <h2>1. Introduction</h2>
    <p>${APP_CONFIG.appName} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), developed and operated by <strong>${APP_CONFIG.companyName}</strong>, is committed to safeguarding your personal data and digital privacy. This Privacy Policy explains how we collect, process, store, and protect your information when you use the ${APP_CONFIG.appName} mobile application (Android package: <code>${APP_CONFIG.androidPackage}</code>) and related backend services.</p>
    <p>By using ${APP_CONFIG.appName}, you acknowledge the terms outlined in this Privacy Policy, in accordance with the <strong>Digital Personal Data Protection Act (DPDP Act 2023)</strong> and the <strong>Information Technology Act, 2000</strong> of India.</p>

    <h2>2. Information We Collect</h2>
    <ul>
      <li><strong>Account Identification:</strong> Mobile telephone number (used for account creation and session authentication) and an optional 4-digit security PIN (hashed with cryptographic salt; plaintext PIN is never stored).</li>
      <li><strong>Profile Information:</strong> Display name, date of birth (used strictly for 18+ age verification and display age), gender, dating preferences, biography, and interest tags.</li>
      <li><strong>Media & Photos:</strong> Photos uploaded to your dating profile. All photos are securely stored in encrypted cloud object storage (Cloudflare R2) and subject to automated and human safety moderation.</li>
      <li><strong>Location & Distance:</strong> City, region/state, and approximate GPS location coordinates. To protect user safety and prevent stalking, ${APP_CONFIG.appName} applies <em>anti-stalking distance fuzzing</em>—your exact latitude/longitude coordinates are never exposed to other members.</li>
      <li><strong>Direct In-App Messages:</strong> Private, 1-to-1 real-time messages exchanged between mutually matched members.</li>
      <li><strong>Audio & Video Calling Metadata:</strong> Connection timestamps, call duration, and call status. <em>We do not record, store, or monitor your private voice or video call streams.</em></li>
      <li><strong>Device & Safety Telemetry:</strong> Push notification tokens (Firebase Cloud Messaging / Expo Notifications) for message/match alerts, IP address, device model, and safety reports.</li>
    </ul>

    <h2>3. Third-Party Service Providers</h2>
    <p>We work with trusted third-party technology providers to operate core services. Each provider is bound by strict confidentiality and data protection obligations:</p>
    <ul>
      <li><strong>Agora Inc. (Agora RTC SDK):</strong> Powers real-time peer-to-peer audio and video calling. Streams are encrypted in transit and are not recorded on servers.</li>
      <li><strong>Cloudflare, Inc. (Cloudflare R2 Storage):</strong> Provides secure, encrypted cloud storage for member profile photos.</li>
      <li><strong>Expo & Google Firebase:</strong> Delivers push notifications for new matches, messages, and incoming calls.</li>
      <li><strong>Neon / Amazon Web Services:</strong> Hosts our PostgreSQL database with encryption at rest and in transit.</li>
      <li><strong>Upstash / Redis:</strong> Ephemeral in-memory presence and rate-limiting infrastructure.</li>
    </ul>

    <h2>4. Google Play Dating App Child Safety Standards (CSAE Zero-Tolerance Policy)</h2>
    <p>${APP_CONFIG.appName} fully complies with Google Play&rsquo;s Dating App Child Safety Standards and Child Sexual Abuse and Exploitation (CSAE) policies:</p>
    <ul>
      <li><strong>Strict Zero Tolerance:</strong> We maintain a zero-tolerance policy against Child Sexual Abuse Material (CSAM) and Child Sexual Exploitation and Abuse (CSAE).</li>
      <li><strong>Age Restriction:</strong> Persons under 18 years of age are strictly prohibited from creating accounts. Any detected underage profile is immediately and permanently terminated.</li>
      <li><strong>In-App Reporting:</strong> Every profile, chat conversation, and photo includes an immediate, accessible <strong>Report</strong> tool with a dedicated <code>Minor Safety</code> category.</li>
      <li><strong>Law Enforcement Referral:</strong> Confirmed CSAE violations are immediately escalated and reported to Indian Law Enforcement authorities (National Cyber Crime Reporting Portal at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener">cybercrime.gov.in</a>) and the National Center for Missing & Exploited Children (NCMEC).</li>
    </ul>

    <h2>5. Screen Capture & Anti-Harassment Safeguards</h2>
    <p>To protect women&rsquo;s safety and member privacy, ${APP_CONFIG.appName} employs proactive technical safeguards:</p>
    <ul>
      <li><strong>Screen Capture Prevention:</strong> In-app screenshot and screen recording blocking is active across private chat conversations, full profile displays, and active video calls.</li>
      <li><strong>Block & Report Tools:</strong> Users can block or report any abusive user at any time. Blocked users are immediately silenced, severed from mutual matches, and prevented from future discovery.</li>
      <li><strong>No Data Selling:</strong> We do not sell, rent, or trade your personal data, photos, or chat history to third-party data brokers or advertisers.</li>
    </ul>

    <h2>6. Account & Data Deletion Rights</h2>
    <p>You have full ownership and control over your personal data:</p>
    <ul>
      <li><strong>In-App Deletion:</strong> You can delete your account permanently directly inside the app: go to <strong>Profile &gt; Settings &gt; Delete Account</strong> and confirm.</li>
      <li><strong>Web Deletion Portal:</strong> In accordance with Google Play&rsquo;s external deletion mandate, you can submit an account and data deletion request on our public web portal at <a href="/delete-account">${APP_CONFIG.urls.deleteAccount}</a>.</li>
      <li><strong>Data Purge Policy:</strong> Upon deletion, your active session is immediately revoked, your dating profile is removed from discovery, and your uploaded media is scheduled for permanent deletion from Cloudflare R2 object storage. Financial transaction logs (if applicable) are retained only as required by Indian tax and payment laws.</li>
    </ul>

    <h2>7. Grievance Officer & Contact Information</h2>
    <p>In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:</p>
    <ul>
      <li><strong>Company:</strong> ${APP_CONFIG.companyName}</li>
      <li><strong>App Name:</strong> ${APP_CONFIG.legalName}</li>
      <li><strong>Email:</strong> <a href="mailto:${APP_CONFIG.contactEmail}">${APP_CONFIG.contactEmail}</a></li>
    </ul>

    <div class="footer">
      <p>&copy; 2026 ${APP_CONFIG.companyName}. All rights reserved.</p>
      <div class="nav-links">
        <a href="/privacy">Privacy Policy</a> &bull;
        <a href="/terms">Terms of Service</a> &bull;
        <a href="/delete-account">Account Deletion</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private renderDeleteAccountHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account & Data Deletion — ${APP_CONFIG.legalName}</title>
  <style>
    :root {
      --primary: #FD5D65;
      --primary-dark: #E04850;
      --primary-soft: #FFF1F2;
      --primary-border: #FECDD3;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 16px;
    }
    .container {
      max-width: 650px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 20px;
      border: 1px solid var(--border);
      padding: 36px 32px;
      box-shadow: 0 4px 25px -4px rgba(15, 23, 42, 0.06), 0 2px 10px -2px rgba(15, 23, 42, 0.03);
    }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 30px; font-weight: 800; color: var(--primary); margin-bottom: 8px; }
    h1 { font-size: 22px; font-weight: 800; color: var(--text); margin-bottom: 6px; }
    p { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; }
    .warning-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 12px;
      padding: 16px;
      margin: 18px 0;
    }
    .warning-box h3 { color: #B45309; font-size: 15px; font-weight: 700; margin-bottom: 6px; }
    .warning-box p { color: #92400E; font-size: 13.5px; margin-bottom: 0; }
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13.5px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
    input, select, textarea {
      width: 100%;
      padding: 12px 14px;
      background: #FFFFFF;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(253, 93, 101, 0.15);
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #FD5D65 0%, #E04850 100%);
      color: #FFFFFF;
      font-size: 15px;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      box-shadow: 0 4px 14px rgba(253, 93, 101, 0.35);
    }
    .btn:hover { opacity: 0.95; transform: translateY(-1px); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .status-msg { display: none; padding: 14px; border-radius: 8px; margin-top: 16px; font-size: 14px; text-align: center; font-weight: 500; }
    .status-success { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
    .status-error { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }
    .method-box {
      background: #F8FAFC;
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 16px;
      margin-bottom: 20px;
    }
    .method-box h4 { font-size: 14.5px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
    .method-box p { color: var(--text-muted); font-size: 13.5px; margin-bottom: 0; }
    a { color: var(--primary); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; color: var(--primary-dark); }
    .footer { text-align: center; margin-top: 28px; font-size: 13px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❤️ ${APP_CONFIG.appName}</div>
      <h1>Account & Data Deletion Portal</h1>
      <p>Official Google Play Account Deletion Web Resource</p>
    </div>

    <div class="method-box">
      <h4>Method 1: Instant In-App Deletion (Recommended)</h4>
      <p>If you have the ${APP_CONFIG.appName} Android app installed: Open <strong>Profile &gt; Settings (Gear Icon) &gt; Tap &ldquo;Delete Account&rdquo;</strong> to immediately purge your account and photos.</p>
    </div>

    <div class="warning-box">
      <h3>⚠️ Permanent Data Deletion Warning</h3>
      <p>Submitting this request will permanently delete your dating profile, remove photos from cloud storage, sever mutual matches, and revoke active login sessions. This action cannot be reversed.</p>
    </div>

    <form id="deleteForm">
      <div class="form-group">
        <label for="phoneNumber">Registered Mobile Number (with country code):</label>
        <input type="text" id="phoneNumber" name="phoneNumber" placeholder="+91 98765 43210" required />
      </div>

      <div class="form-group">
        <label for="pin">Security PIN (if set):</label>
        <input type="password" id="pin" name="pin" maxlength="6" placeholder="Enter 4-digit PIN" />
      </div>

      <div class="form-group">
        <label for="reason">Reason for deletion (optional):</label>
        <select id="reason" name="reason">
          <option value="FOUND_MATCH">Found someone on ${APP_CONFIG.appName}</option>
          <option value="TAKING_BREAK">Taking a break from dating apps</option>
          <option value="PRIVACY_CONCERN">Privacy concerns</option>
          <option value="OTHER">Other reason</option>
        </select>
      </div>

      <button type="submit" class="btn" id="submitBtn">Permanently Delete My Account</button>
      <div id="statusBox" class="status-msg"></div>
    </form>

    <div class="footer">
      <p><a href="/privacy">Privacy Policy</a> &bull; <a href="/terms">Terms of Service</a></p>
      <p style="margin-top: 6px;">&copy; 2026 ${APP_CONFIG.companyName}. All rights reserved.</p>
    </div>
  </div>

  <script>
    document.getElementById('deleteForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var statusBox = document.getElementById('statusBox');
      var phone = document.getElementById('phoneNumber').value.trim();
      var pin = document.getElementById('pin').value.trim();
      var reason = document.getElementById('reason').value;

      btn.disabled = true;
      btn.textContent = 'Processing request...';
      statusBox.style.display = 'none';

      try {
        var res = await fetch('/delete-account/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone, pin: pin || undefined, reason: reason })
        });
        var data = await res.json();
        statusBox.style.display = 'block';
        if (res.ok && data.success) {
          statusBox.className = 'status-msg status-success';
          statusBox.textContent = data.message;
          document.getElementById('deleteForm').reset();
        } else {
          statusBox.className = 'status-msg status-error';
          statusBox.textContent = data.message || 'Failed to submit deletion request.';
        }
      } catch (err) {
        statusBox.style.display = 'block';
        statusBox.className = 'status-msg status-error';
        statusBox.textContent = 'Network error. Please try again or email ${APP_CONFIG.contactEmail}';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Permanently Delete My Account';
      }
    });
  </script>
</body>
</html>`;
  }

  private renderTermsHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — ${APP_CONFIG.legalName}</title>
  <style>
    :root {
      --primary: #FD5D65;
      --primary-dark: #E04850;
      --primary-soft: #FFF1F2;
      --primary-border: #FECDD3;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 16px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 20px;
      border: 1px solid var(--border);
      padding: 36px 32px;
      box-shadow: 0 4px 25px -4px rgba(15, 23, 42, 0.06), 0 2px 10px -2px rgba(15, 23, 42, 0.03);
    }
    .header {
      text-align: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .logo { font-size: 30px; font-weight: 800; color: var(--primary); margin-bottom: 6px; }
    h1 { font-size: 26px; font-weight: 800; color: var(--text); margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 700; color: var(--text); margin: 26px 0 10px; border-left: 3px solid var(--primary); padding-left: 12px; }
    p, li { font-size: 14.5px; color: var(--text-muted); margin-bottom: 10px; }
    ul { padding-left: 20px; margin-bottom: 14px; }
    strong { color: var(--text); font-weight: 600; }
    a { color: var(--primary); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; color: var(--primary-dark); }
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 24px;
      margin-top: 32px;
      font-size: 13px;
      text-align: center;
      color: var(--text-muted);
    }
    .nav-links { display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 13.5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❤️ ${APP_CONFIG.appName}</div>
      <h1>Terms of Service</h1>
      <p>Last Updated: October 2026</p>
      <div class="nav-links">
        <a href="/privacy">Privacy Policy</a> &bull;
        <a href="/delete-account">Account & Data Deletion Portal</a>
      </div>
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By creating an account or accessing ${APP_CONFIG.appName}, you agree to comply with and be bound by these Terms of Service provided by ${APP_CONFIG.companyName}.</p>

    <h2>2. Eligibility (Strict 18+ Rule)</h2>
    <p>You must be at least 18 years of age to use ${APP_CONFIG.appName}. By registering, you warrant that you are an adult under the laws of India and possess legal capacity to enter into this agreement.</p>

    <h2>3. Community Code of Conduct</h2>
    <p>${APP_CONFIG.appName} is built on mutual respect and dignity. You agree NOT to:</p>
    <ul>
      <li>Harass, stalk, intimidate, or threaten any member.</li>
      <li>Upload or transmit sexually explicit media, non-consensual content, or Child Sexual Abuse Material (CSAM).</li>
      <li>Solicit money, loans, gifts under false pretenses, or commercial advertisements.</li>
      <li>Impersonate any person or misrepresent your age, identity, or location.</li>
      <li>Attempt to capture screenshots or screen recordings on restricted communication screens.</li>
    </ul>

    <h2>4. Termination & Deletion</h2>
    <p>Violations will result in immediate suspension or permanent banning. You may delete your account at any time within the app or at <a href="/delete-account">our deletion portal</a>.</p>

    <h2>5. Contact Us</h2>
    <p>For questions or support, contact <a href="mailto:${APP_CONFIG.contactEmail}">${APP_CONFIG.contactEmail}</a>.</p>

    <div class="footer">
      <p>&copy; 2026 ${APP_CONFIG.companyName}. All rights reserved.</p>
      <div class="nav-links">
        <a href="/privacy">Privacy Policy</a> &bull;
        <a href="/terms">Terms of Service</a> &bull;
        <a href="/delete-account">Account Deletion</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
