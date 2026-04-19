/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — APP ORCHESTRATOR
   Entry point. Wires Shell → Auth → Map → Discovery → Gesture → Router.
   All event binding lives here. All page HTML is inline per function.
   ═══════════════════════════════════════════════════════════════════════════ */

import Shell     from './shell.js';
import Auth      from './auth.js';
import Map       from './map.js';
import Discovery from './discovery.js';
import Gesture   from './gesture.js';
import Router    from './router.js';

/* ── Tiny DOM helpers ─────────────────────────────────────────────────── */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ── App State ────────────────────────────────────────────────────────── */
let _selectedCategory = 'all';
let _openNow          = false;
let _selectedPlan     = 'annual';
let _lastDiscovery    = null;

/* ══════════════════════════════════════════════════════════════════════════
   PAGE RENDERERS
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Auth Page ────────────────────────────────────────────────────────── */

function renderAuthPage() {
  return `
    <div class="page-surface">
      <div class="auth-wrap">
        <div class="auth-header">
          <span class="material-symbols-outlined auth-icon">explore</span>
          <h1 class="auth-title">Welcome to Wanderlost</h1>
          <p class="auth-subtitle">Discover extraordinary places loved by locals</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login">Log In</button>
          <button class="auth-tab" id="tab-register">Register</button>
        </div>

        <!-- LOGIN FORM -->
        <form id="login-form" class="auth-form">
          <div class="form-field">
            <label class="form-label" for="login-email">Email</label>
            <input class="form-input" type="email" id="login-email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="login-password">Password</label>
            <input class="form-input" type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" minlength="6" required />
          </div>
          <p id="login-error" class="form-error" role="alert"></p>
          <button type="submit" class="btn-primary">Log In</button>
          <div class="auth-footer-row">
            <button type="button" id="btn-forgot" class="btn-text">Forgot Password?</button>
          </div>
        </form>

        <!-- REGISTER FORM -->
        <form id="register-form" class="auth-form" style="display:none">
          <div class="form-field">
            <label class="form-label" for="reg-name">Full Name</label>
            <input class="form-input" type="text" id="reg-name" placeholder="Your name" autocomplete="name" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-email">Email</label>
            <input class="form-input" type="email" id="reg-email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-dob">Date of Birth</label>
            <input class="form-input" type="date" id="reg-dob" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-pass">Password</label>
            <input class="form-input" type="password" id="reg-pass" placeholder="Min 6 characters" autocomplete="new-password" minlength="6" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-pass2">Confirm Password</label>
            <input class="form-input" type="password" id="reg-pass2" placeholder="Re-enter password" autocomplete="new-password" minlength="6" required />
          </div>
          <p id="register-error" class="form-error" role="alert"></p>
          <button type="submit" class="btn-primary">Create Account</button>
        </form>

        <div class="divider">or</div>

        <button id="btn-google" class="btn-google">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  `;
}

/* ── Dashboard (signed in) ────────────────────────────────────────────── */

function renderDashboard() {
  const user      = Auth.getUser();
  const data      = Auth.getUserData() || {};
  const initial   = (user.displayName || user.email || '?')[0].toUpperCase();
  const premium   = data.plan === 'premium';
  const renewDate = data.membershipRenewalDate
    ? new Date(data.membershipRenewalDate.seconds * 1000)
        .toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : null;

  return `
    <div class="page-surface">
      <div class="dashboard-wrap">
        <div class="profile-header">
          ${user.photoURL
            ? `<img class="avatar" src="${user.photoURL}" alt="${user.displayName || 'Avatar'}" />`
            : `<div class="avatar avatar--initial">${initial}</div>`}
          <h1 class="profile-name">${user.displayName || 'Explorer'}</h1>
          <p class="profile-email">${user.email}</p>
          <div class="member-badge ${premium ? 'member-badge--premium' : ''}">
            <span class="material-symbols-outlined">${premium ? 'workspace_premium' : 'person'}</span>
            ${premium ? 'Premium Member' : 'Free Member'}
          </div>
          ${premium && renewDate ? `<p class="renewal-date">Renews ${renewDate}</p>` : ''}
        </div>

        <div class="dashboard-grid">
          <button class="dashboard-card" id="btn-history">
            <span class="material-symbols-outlined dashboard-card-icon">history</span>
            <span class="dashboard-card-label">History</span>
            <span class="dashboard-card-count">${data.totalDiscoveries || 0}</span>
          </button>
          <button class="dashboard-card" id="btn-itinerary">
            <span class="material-symbols-outlined dashboard-card-icon">bookmark</span>
            <span class="dashboard-card-label">Saved</span>
            <span class="dashboard-card-count">${data.savedPlacesCount || 0}</span>
          </button>
        </div>

        ${!premium ? `
        <button id="btn-join-premium" class="premium-cta">
          <span class="material-symbols-outlined">auto_awesome</span>
          <div class="premium-cta-text">
            <span class="premium-cta-title">Join Premium</span>
            <span class="premium-cta-sub">Unlimited discoveries &amp; more</span>
          </div>
          <span class="material-symbols-outlined">chevron_right</span>
        </button>` : ''}

        <div id="dashboard-content"></div>
      </div>
    </div>
  `;
}

/* ── Settings ─────────────────────────────────────────────────────────── */

function renderSettingsPage() {
  const auth    = Auth.isSignedIn();
  const premium = Auth.isPremium();
  const theme   = Shell.getTheme();
  const dist    = Shell.getDistUnit();

  return `
    <div class="page-surface">
      <div class="settings-wrap">
        <h1 class="settings-title">Settings</h1>

        ${auth ? `
        <div class="settings-group">
          <p class="settings-group-title">Account</p>
          <button id="btn-edit-profile" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">person</span>
            <span class="settings-item-text">Edit Profile</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
          <button id="btn-membership" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">card_membership</span>
            <span class="settings-item-text">Membership</span>
            <span class="settings-item-value">${premium ? 'Premium' : 'Free'}</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
        </div>` : ''}

        <div class="settings-group">
          <p class="settings-group-title">Preferences</p>
          <button id="btn-dist-unit" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">straighten</span>
            <span class="settings-item-text">Distance</span>
            <span class="settings-item-value">${dist === 'meters' ? 'Meters' : 'Feet'}</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
          <button id="btn-theme" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">${theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            <span class="settings-item-text">Theme</span>
            <span class="settings-item-value">${theme === 'dark' ? 'Dark' : 'Light'}</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
        </div>

        <div class="settings-group">
          <p class="settings-group-title">Support</p>
          <button id="btn-help" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">help</span>
            <span class="settings-item-text">Help Center &amp; Support</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
        </div>

        <div class="settings-group">
          <p class="settings-group-title">Legal</p>
          <button id="btn-terms" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">description</span>
            <span class="settings-item-text">Terms &amp; Conditions</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
          <button id="btn-privacy" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">shield</span>
            <span class="settings-item-text">Privacy Policy</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
          <button id="btn-safety" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">health_and_safety</span>
            <span class="settings-item-text">Safety &amp; Responsibility</span>
            <span class="material-symbols-outlined settings-item-chevron">chevron_right</span>
          </button>
        </div>

        ${auth ? `
        <div class="settings-group">
          <p class="settings-group-title">Account Actions</p>
          <button id="btn-sign-out" class="settings-item">
            <span class="material-symbols-outlined settings-item-icon">logout</span>
            <span class="settings-item-text">Log Out</span>
          </button>
          <button id="btn-delete-data" class="settings-item settings-item--danger">
            <span class="material-symbols-outlined settings-item-icon">delete_sweep</span>
            <span class="settings-item-text">Delete My Data</span>
          </button>
          <button id="btn-delete-account" class="settings-item settings-item--danger">
            <span class="material-symbols-outlined settings-item-icon">delete_forever</span>
            <span class="settings-item-text">Delete My Account</span>
          </button>
        </div>` : ''}

        <div class="settings-footer">
          <p>Wanderlost v4.0.0</p>
          <p>Made with ♥ for curious travelers</p>
        </div>
      </div>
    </div>
  `;
}

/* ── Legal sub-page template ──────────────────────────────────────────── */

function renderLegalPage(title, content) {
  return `
    <div class="page-surface">
      <div class="settings-wrap">
        <div class="subpage-header">
          <button id="btn-back" class="icon-btn" aria-label="Back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 class="subpage-title">${title}</h1>
        </div>
        <div class="legal-content">${content}</div>
      </div>
    </div>
  `;
}

function renderTermsPage() {
  return renderLegalPage('Terms &amp; Conditions', `
    <h3>1. Acceptance of Terms</h3>
    <p>By downloading, accessing, or using Wanderlost, you agree to be bound by these Terms and Conditions. If you do not agree, do not use the application.</p>

    <h3>2. The Service (Discovery, Not Curation)</h3>
    <p>Wanderlost is a recommendation engine that utilizes third-party algorithms to identify high-rated locations.<br>
    <strong>No Curation:</strong> We do not manually vet, visit, or curate these locations.<br>
    <strong>No Travel Guide:</strong> Wanderlost does not provide travel advice, safety ratings, or guided services.</p>

    <h3>3. User Responsibility &amp; Safety</h3>
    <p><strong>Self-Directed Travel:</strong> All travel undertaken as a result of a Discovery is at your own risk.<br>
    <strong>Self-Preservation:</strong> You are solely responsible for assessing the safety, legality, and accessibility of any location.<br>
    <strong>Awareness:</strong> You agree to maintain situational awareness and adhere to local laws.</p>

    <h3>4. Subscriptions &amp; Billing</h3>
    <p><strong>Free Tier:</strong> Users receive 3 free Discoveries per session. A Premium subscription is required for further access.<br>
    <strong>Premium Plans:</strong> $10.00/month or $100.00/year.<br>
    <strong>Renewals:</strong> Subscriptions auto-renew unless cancelled at least 24 hours before the period end.<br>
    <strong>Refunds:</strong> All billing is handled by the respective App Stores; Wanderlost does not issue direct refunds.</p>

    <h3>5. Account Security</h3>
    <p>You are responsible for maintaining the confidentiality of your account credentials. Wanderlost is not liable for unauthorized access resulting from your failure to secure your login details.</p>

    <h3>6. Limitation of Liability</h3>
    <p>To the maximum extent permitted by law, Wanderlost shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the app, reliance on its recommendations, or interactions with third-party locations.</p>

    <h3>7. Prohibited Use</h3>
    <p>You agree not to reverse engineer the discovery algorithm, use the app for illegal purposes, or circumvent the 3 Free Discoveries limit through technical manipulation.</p>

    <h3>8. Termination</h3>
    <p>We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account at any time via Settings.</p>

    <h3>9. Changes to Terms</h3>
    <p>Wanderlost may update these terms to reflect changes in law or app features. Continued use constitutes acceptance of updated terms.</p>

    <h3>10. Governing Law</h3>
    <p>These terms are governed by the laws of your local jurisdiction, without regard to conflict of law principles.</p>
  `);
}

function renderPrivacyPage() {
  return renderLegalPage('Privacy Policy', `
    <h3>1. Data We Collect</h3>
    <p><strong>Precise Location Data:</strong> To generate your neural map and find nearby spots, we collect your GPS coordinates in real-time.<br>
    <strong>Account Information:</strong> Name, email address, date of birth, and profile picture.<br>
    <strong>Usage Data:</strong> Number of discoveries used, to manage your free-tier limit and history.<br>
    <strong>Device Identifiers:</strong> Basic hardware info to ensure subscription security and app stability.</p>

    <h3>2. How Your Data Is Used</h3>
    <p><strong>Neural Map:</strong> To visualize nearby nodes (places) and calculate distances.<br>
    <strong>Tier Management:</strong> To enforce the 3 Free Discoveries limit for non-premium users.<br>
    <strong>Premium Features:</strong> To store your travel history, saved places, and custom category filters.<br>
    <strong>Communication:</strong> To send essential account updates or subscription receipts.</p>

    <h3>3. Data Sharing &amp; Third Parties</h3>
    <p>Wanderlost does not sell your personal data. We share information only with service providers necessary for app operation:<br>
    <strong>Map Services:</strong> Google Maps SDK (location data for mapping).<br>
    <strong>Authentication &amp; Database:</strong> Firebase (Google). Stores user accounts and discovery history.<br>
    <strong>Payment Processors:</strong> Apple Pay and Google Pay (card data never touches our servers).</p>

    <h3>4. User Control &amp; Compliance</h3>
    <p>In accordance with GDPR and CCPA, Wanderlost provides full control via Settings:<br>
    <strong>Access:</strong> View all profile data in Account section.<br>
    <strong>Withdrawal:</strong> Disable location services at any time via device settings.<br>
    <strong>Mandatory Deletion:</strong> "Delete My Account" and "Delete My Data" purge all personal records from our servers within 30 days.</p>

    <h3>5. Safety &amp; Liability Disclaimer</h3>
    <p>Wanderlost is a recommendation engine. We do not curate, guide, or verify the current safety or legality of any location.<br>
    <strong>Data Source:</strong> Recommendations filter for &gt;4.8 stars and high local review density.<br>
    <strong>User Responsibility:</strong> All travel is self-directed. Wanderlost is not liable for any incidents at recommended locations.</p>

    <h3>6. Children's Privacy</h3>
    <p>Wanderlost is not intended for users under the age of 13. We do not knowingly collect data from children.</p>

    <div style="margin-top:2rem">
      <button id="btn-link-terms" class="btn-text btn-text--accent">View Terms &amp; Conditions →</button>
    </div>
  `);
}

function renderSafetyPage() {
  return renderLegalPage('Safety &amp; Responsibility', `
    <p>Wanderlost is a discovery interface, not a travel guide. We provide data-driven recommendations based on public information; we do not verify the current physical condition, safety, or legality of any location. You are responsible for your own journey.</p>

    <h3>1. Self-Preservation (Physical Safety)</h3>
    <p><strong>The 80/20 Rule:</strong> While 80% of reviews are from locals, local comfort levels may differ from yours. Assess the environment upon arrival. If it feels wrong, leave.<br>
    <strong>Emergency Readiness:</strong> Always identify your closest exit or transit point. Wanderlost does not provide real-time hazard alerts.<br>
    <strong>Battery Management:</strong> Do not rely solely on the neural map if your device is below 20% power.</p>

    <h3>2. Self-Awareness (Environment)</h3>
    <p><strong>Eyes Up:</strong> The neural map is an abstraction. Do not walk while looking at the screen. Use Google Maps for active navigation.<br>
    <strong>Cultural Context:</strong> Being in a local spot means you are a guest in a community. Observe local customs and dress codes.<br>
    <strong>Time of Day:</strong> A 5-star rating at noon does not guarantee safety at midnight.</p>

    <h3>3. Self-Responsibility (Legal &amp; Liability)</h3>
    <p><strong>No Agency:</strong> Wanderlost does not act as an agent, guide, or insurer. We do not take responsibility for accidents at recommended locations.<br>
    <strong>Private Property:</strong> The map may show points near private areas. Never trespass.<br>
    <strong>Data Accuracy:</strong> Google Maps data can be outdated. The app is not liable for your travel costs if a location is closed or inaccessible.</p>

    <div class="legal-disclaimer">
      <p class="legal-disclaimer-label">Mandatory Legal Disclaimer</p>
      <p><strong>Disclaimer of Liability:</strong> By using Wanderlost, you acknowledge that all travel is undertaken at your own risk. Wanderlost and its affiliates expressly disclaim all liability for any loss, damage, injury, or inconvenience arising from the use of this app or the pursuit of its recommendations. You agree to hold Wanderlost harmless from any claims resulting from your personal travel decisions.</p>
    </div>
  `);
}

/* ── Edit Profile sub-page ────────────────────────────────────────────── */

function renderEditProfilePage() {
  const user = Auth.getUser();
  const data = Auth.getUserData() || {};
  return `
    <div class="page-surface">
      <div class="settings-wrap">
        <div class="subpage-header">
          <button id="btn-back" class="icon-btn" aria-label="Back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 class="subpage-title">Edit Profile</h1>
        </div>
        <form id="edit-profile-form">
          <div class="form-field">
            <label class="form-label" for="edit-name">Full Name</label>
            <input class="form-input" type="text" id="edit-name" value="${user.displayName || ''}" autocomplete="name" />
          </div>
          <div class="form-field">
            <label class="form-label" for="edit-email">Email</label>
            <input class="form-input" type="email" id="edit-email" value="${user.email || ''}" disabled />
          </div>
          <div class="form-field">
            <label class="form-label" for="edit-dob">Date of Birth</label>
            <input class="form-input" type="date" id="edit-dob" value="${data.dateOfBirth || ''}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="edit-pass">New Password</label>
            <input class="form-input" type="password" id="edit-pass" placeholder="Leave blank to keep current" autocomplete="new-password" />
          </div>
          <p id="edit-error" class="form-error" role="alert"></p>
          <p id="edit-success" class="form-success" role="status"></p>
          <button type="submit" class="btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  `;
}

/* ── Checkout page ────────────────────────────────────────────────────── */

function renderCheckoutPage(plan) {
  const price = plan === 'annual' ? '$100/year' : '$10/month';
  return `
    <div class="page-surface">
      <div class="checkout-wrap">
        <button id="btn-back" class="icon-btn" style="margin-bottom:var(--sp-4)" aria-label="Back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="checkout-header">
          <span class="material-symbols-outlined checkout-icon">lock</span>
          <h1 class="checkout-title">Secure Checkout</h1>
          <p class="checkout-plan">Wanderlost Premium · ${price}</p>
        </div>

        <div class="checkout-methods">
          <button id="btn-apple-pay" class="btn-payment btn-payment--apple">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Pay with Apple Pay
          </button>
          <button id="btn-google-pay" class="btn-payment btn-payment--google">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Pay with Google Pay
          </button>
        </div>

        <div class="divider">or pay with card</div>

        <form id="checkout-form">
          <div class="form-field">
            <label class="form-label" for="cc-name">Name on Card</label>
            <input class="form-input" type="text" id="cc-name" placeholder="John Doe" autocomplete="cc-name" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="cc-number">Card Number</label>
            <input class="form-input" type="text" id="cc-number" placeholder="4242 4242 4242 4242" autocomplete="cc-number" maxlength="19" inputmode="numeric" required />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="form-label" for="cc-expiry">Expiry</label>
              <input class="form-input" type="text" id="cc-expiry" placeholder="MM/YY" autocomplete="cc-exp" maxlength="5" inputmode="numeric" required />
            </div>
            <div class="form-field">
              <label class="form-label" for="cc-cvv">CVV</label>
              <input class="form-input" type="text" id="cc-cvv" placeholder="123" autocomplete="cc-csc" maxlength="4" inputmode="numeric" required />
            </div>
          </div>
          <p id="checkout-error" class="form-error" role="alert"></p>
          <button type="submit" class="btn-primary">
            <span class="material-symbols-outlined">lock</span>
            Complete Purchase
          </button>
        </form>

        <div class="checkout-security">
          <span class="material-symbols-outlined">verified_user</span>
          <span>256-bit SSL encrypted · Payment UI mockup</span>
        </div>
      </div>
    </div>
  `;
}

/* ── Premium Gate ─────────────────────────────────────────────────────── */

function renderPremiumGate() {
  return `
    <div class="gate-card">
      <button id="btn-gate-close" class="icon-btn gate-close" aria-label="Close">
        <span class="material-symbols-outlined">close</span>
      </button>
      <span class="material-symbols-outlined gate-icon">auto_awesome</span>
      <h2 class="gate-title">Unlock the possibilities</h2>
      <p class="gate-subtitle">Join a curated world of modern explorers and archive your journeys with precision.</p>

      <div class="gate-features">
        <div class="gate-feature"><span class="material-symbols-outlined">all_inclusive</span> Unlimited discoveries</div>
        <div class="gate-feature"><span class="material-symbols-outlined">filter_list</span> Filter by category</div>
        <div class="gate-feature"><span class="material-symbols-outlined">schedule</span> Open Now filter</div>
        <div class="gate-feature"><span class="material-symbols-outlined">history</span> Full discovery history</div>
        <div class="gate-feature"><span class="material-symbols-outlined">bookmark</span> Save places to trips</div>
        <div class="gate-feature"><span class="material-symbols-outlined">map</span> Build itineraries</div>
      </div>

      <div class="gate-plans">
        <button class="gate-plan gate-plan--popular selected" data-plan="annual">
          <span class="gate-plan-badge">Best Value</span>
          <span class="gate-plan-name">Annual</span>
          <span class="gate-plan-price">$100<small>/year</small></span>
          <span class="gate-plan-per">$8.33/month · Save 17%</span>
        </button>
        <button class="gate-plan" data-plan="monthly">
          <span class="gate-plan-name">Monthly</span>
          <span class="gate-plan-price">$10<small>/month</small></span>
          <span class="gate-plan-per">Cancel anytime</span>
        </button>
      </div>

      <button id="btn-checkout-proceed" class="btn-primary">Continue to Checkout</button>
      <p class="gate-disclaimer">Cancel anytime. No hidden fees.</p>
    </div>
  `;
}

/* ── Discovery sheet content ──────────────────────────────────────────── */

function renderDiscoveryCard(place) {
  const statusText  = place.isOpen === true ? 'Open' : place.isOpen === false ? 'Closed' : '';
  const statusClass = place.isOpen === true ? 'open' : place.isOpen === false ? 'closed' : '';

  return `
    <div class="discovery-card">
      <div class="discovery-meta">
        <span class="discovery-category">${place.category}</span>
        ${statusText
          ? `<span class="discovery-status ${statusClass}">● ${statusText}</span>`
          : ''}
      </div>

      <h2 class="discovery-name">${place.name}</h2>
      ${place.description ? `<p class="discovery-desc">${place.description}</p>` : ''}

      <div class="discovery-stats">
        ${place.rating
          ? `<span class="stat-pill stat-pill--gold">
              <span class="material-symbols-outlined filled">star</span>
              ${place.rating}
             </span>`
          : ''}
        <span class="stat-pill">
          <span class="material-symbols-outlined">straighten</span>
          ${place.distanceText}
        </span>
        ${place.priceLevel
          ? `<span class="stat-pill">
              <span class="material-symbols-outlined">payments</span>
              ${place.priceLevel}
             </span>`
          : ''}
      </div>

      <div class="discovery-address">
        <span class="material-symbols-outlined">location_on</span>
        ${place.address}
      </div>

      <div class="discovery-actions">
        <button class="btn-action btn-action--primary" id="btn-nav-maps"
          onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}','_blank')">
          <span class="material-symbols-outlined">directions</span>
          Google Maps
        </button>
        <button class="btn-action btn-action--secondary" id="btn-save">
          <span class="material-symbols-outlined">bookmark_add</span>
          Save
        </button>
      </div>
    </div>
  `;
}

function renderSheetLoading() {
  return `
    <div class="sheet-loading">
      <div class="loader-ring"></div>
      <p>Discovering local gems…</p>
    </div>
  `;
}

function renderHistoryList(discoveries) {
  if (!discoveries?.length) return `
    <div class="empty-state">
      <span class="material-symbols-outlined">explore_off</span>
      <p>No discoveries yet</p>
      <p class="empty-state-sub">Tap Discover on the map to start exploring</p>
    </div>`;

  return discoveries.map(d => {
    const date = d.discoveredAt?.toDate?.()
      ? d.discoveredAt.toDate().toLocaleDateString('en-US', { month:'short', day:'numeric' })
      : 'Recently';
    return `
      <div class="list-item">
        <div class="list-item-icon"><span class="material-symbols-outlined">location_on</span></div>
        <div class="list-item-body">
          <span class="list-item-name">${d.name}</span>
          <span class="list-item-meta">${d.category} · ${date}</span>
        </div>
        ${d.rating ? `<span class="list-item-rating">★ ${d.rating}</span>` : ''}
      </div>`;
  }).join('');
}

function renderTripsList(trips) {
  const emptyBtn = `<button id="btn-create-trip" class="btn-secondary" style="margin-top:var(--sp-4)">
    <span class="material-symbols-outlined">add</span> Create Trip
  </button>`;

  if (!trips?.length) return `
    <div class="empty-state">
      <span class="material-symbols-outlined">bookmark_border</span>
      <p>No saved trips yet</p>
      <p class="empty-state-sub">Save places during discovery to build your itinerary</p>
    </div>
    ${emptyBtn}`;

  return trips.map(t => `
    <div class="trip-card">
      <span class="material-symbols-outlined trip-card-icon">travel_explore</span>
      <div class="trip-card-info">
        <div class="trip-card-name">${t.name}</div>
        <div class="trip-card-count">${t.places?.length || 0} places</div>
      </div>
      <span class="material-symbols-outlined" style="color:var(--text-3)">chevron_right</span>
    </div>`
  ).join('') + emptyBtn;
}

/* ══════════════════════════════════════════════════════════════════════════
   EVENT BINDERS — called by Router after each page render
   ══════════════════════════════════════════════════════════════════════════ */

function bindAuthEvents() {
  const tabLogin = $('#tab-login');
  const tabReg   = $('#tab-register');
  const fLogin   = $('#login-form');
  const fReg     = $('#register-form');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');   tabReg.classList.remove('active');
    fLogin.style.display = '';          fReg.style.display = 'none';
  });

  tabReg?.addEventListener('click', () => {
    tabReg.classList.add('active');     tabLogin.classList.remove('active');
    fLogin.style.display = 'none';     fReg.style.display = '';
  });

  fLogin?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#login-error');
    errEl.textContent = '';
    try {
      await Auth.signIn($('#login-email').value.trim(), $('#login-password').value);
    } catch (ex) { errEl.textContent = friendlyError(ex.code); }
  });

  fReg?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#register-error');
    errEl.textContent = '';
    const pass = $('#reg-pass').value;
    if (pass !== $('#reg-pass2').value) { errEl.textContent = 'Passwords do not match.'; return; }
    try {
      await Auth.signUp($('#reg-email').value.trim(), pass, $('#reg-name').value.trim(), $('#reg-dob').value);
    } catch (ex) { errEl.textContent = friendlyError(ex.code); }
  });

  $('#btn-forgot')?.addEventListener('click', async () => {
    const email = $('#login-email')?.value.trim();
    if (!email) { alert('Enter your email first.'); return; }
    try {
      await Auth.resetPassword(email);
      alert('Password reset email sent! Check your inbox.');
    } catch (ex) { alert(friendlyError(ex.code)); }
  });

  $('#btn-google')?.addEventListener('click', async () => {
    try { await Auth.signInWithGoogle(); }
    catch (ex) { alert(friendlyError(ex.code)); }
  });
}

function bindDashboardEvents() {
  $('#btn-history')?.addEventListener('click', async () => {
    const el = $('#dashboard-content');
    el.innerHTML = `<div class="sheet-loading" style="padding:var(--sp-8) 0"><div class="loader-ring"></div></div>`;
    try {
      const history = await Auth.getDiscoveryHistory(30);
      el.innerHTML = `<p class="list-section-title">Discovery History</p>` + renderHistoryList(history);
    } catch { el.innerHTML = `<p class="form-error">Could not load history.</p>`; }
  });

  $('#btn-itinerary')?.addEventListener('click', async () => {
    const el = $('#dashboard-content');
    el.innerHTML = `<div class="sheet-loading" style="padding:var(--sp-8) 0"><div class="loader-ring"></div></div>`;
    try {
      const trips = await Auth.getTrips();
      el.innerHTML = `<p class="list-section-title">My Trips</p>` + renderTripsList(trips);
      $('#btn-create-trip')?.addEventListener('click', async () => {
        const name = prompt('Trip name:');
        if (!name?.trim()) return;
        try { await Auth.createTrip(name.trim()); $('#btn-itinerary')?.click(); }
        catch { alert('Could not create trip.'); }
      });
    } catch { el.innerHTML = `<p class="form-error">Could not load trips.</p>`; }
  });

  $('#btn-join-premium')?.addEventListener('click', openPremiumGate);
}

function bindSettingsEvents() {
  $('#btn-theme')?.addEventListener('click', () => {
    Shell.toggleTheme();
    Map.setTheme(Shell.getTheme() === 'dark');
    Router.navigate('settings');
  });

  $('#btn-dist-unit')?.addEventListener('click', () => {
    Shell.toggleDistUnit();
    Router.navigate('settings');
  });

  $('#btn-help')?.addEventListener('click', () => {
    window.location.href = 'mailto:wanderlostapp@gmail.com';
  });

  $('#btn-terms')?.addEventListener('click',   () => Router.navigate('terms'));
  $('#btn-privacy')?.addEventListener('click', () => Router.navigate('privacy'));
  $('#btn-safety')?.addEventListener('click',  () => Router.navigate('safety'));
  $('#btn-edit-profile')?.addEventListener('click', () => Router.navigate('edit-profile'));
  $('#btn-membership')?.addEventListener('click', openPremiumGate);

  $('#btn-sign-out')?.addEventListener('click', async () => {
    await Auth.signOut();
    Router.navigate('map');
  });

  $('#btn-delete-data')?.addEventListener('click', async () => {
    if (!confirm('Delete all your discoveries and trips? Your account stays.\n\nContinue?')) return;
    try { await Auth.deleteUserData(); alert('Data deleted.'); Router.navigate('settings'); }
    catch (e) { alert('Failed: ' + e.message); }
  });

  $('#btn-delete-account')?.addEventListener('click', async () => {
    if (!confirm('Permanently delete your account AND all data? This is irreversible.')) return;
    if (!confirm('FINAL WARNING: This cannot be undone. Confirm?')) return;
    try { await Auth.deleteAccount(); Router.navigate('map'); }
    catch (e) { alert('Could not delete account: ' + e.message); }
  });
}

function bindLegalEvents() {
  $('#btn-back')?.addEventListener('click', () => Router.navigate('settings'));
  $('#btn-link-terms')?.addEventListener('click', () => Router.navigate('terms'));
}

function bindEditProfileEvents() {
  $('#btn-back')?.addEventListener('click', () => Router.navigate('settings'));
  $('#edit-profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#edit-error');
    const sucEl = $('#edit-success');
    errEl.textContent = '';
    sucEl.textContent = '';
    try {
      await Auth.updateUserProfile({
        name:        $('#edit-name')?.value.trim(),
        dob:         $('#edit-dob')?.value,
        newPassword: $('#edit-pass')?.value || undefined,
      });
      sucEl.textContent = 'Changes saved!';
    } catch (e) { errEl.textContent = friendlyError(e.code) || e.message; }
  });
}

function bindCheckoutEvents() {
  $('#btn-back')?.addEventListener('click', () => Router.navigate('map'));
  $('#btn-apple-pay')?.addEventListener('click', () => alert('Apple Pay integration coming soon!'));
  $('#btn-google-pay')?.addEventListener('click', () => alert('Google Pay integration coming soon!'));

  const cardNum = $('#cc-number');
  cardNum?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    e.target.value = v.match(/.{1,4}/g)?.join(' ') || v;
  });

  const expiry = $('#cc-expiry');
  expiry?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2);
    e.target.value = v;
  });

  $('#checkout-form')?.addEventListener('submit', e => {
    e.preventDefault();
    alert('Payment processing is a UI mockup. Real integration coming soon!');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   DISCOVERY FLOW
   ══════════════════════════════════════════════════════════════════════════ */

async function triggerDiscovery() {
  if (Router.getCurrent() !== 'map') Router.navigate('map');

  const body = $('#sheet-body');
  if (body) body.innerHTML = renderSheetLoading();
  Gesture.open();

  const loc = Map.getUserLocation();
  if (!loc) {
    if (body) body.innerHTML = `<div class="sheet-loading">
      <span class="material-symbols-outlined">location_off</span>
      <p>Enable location access to discover places</p>
    </div>`;
    return;
  }

  const result = await Discovery.discover(loc, _selectedCategory, { openNow: _openNow });

  if (!result) {
    if (body) body.innerHTML = `<div class="sheet-loading">
      <span class="material-symbols-outlined">search_off</span>
      <p>No places found nearby. Try a different category.</p>
    </div>`;
    return;
  }

  if (result._needsPremium) {
    Gesture.dismiss();
    openPremiumGate();
    return;
  }

  showResult(result);
}

async function triggerNext() {
  const loc  = Map.getUserLocation();
  const body = $('#sheet-body');
  if (!loc || !body) return;

  body.innerHTML = renderSheetLoading();

  let result = await Discovery.discoverNext(loc);
  if (!result) result = await Discovery.discover(loc, _selectedCategory, { openNow: _openNow });

  if (!result) {
    body.innerHTML = `<div class="sheet-loading">
      <span class="material-symbols-outlined">search_off</span>
      <p>No more places found. Try another category.</p>
    </div>`;
    return;
  }

  if (result._needsPremium) {
    Gesture.dismiss();
    openPremiumGate();
    return;
  }

  showResult(result);
}

function showResult(result) {
  _lastDiscovery = result;
  const body = $('#sheet-body');
  if (body) body.innerHTML = renderDiscoveryCard(result);

  Map.panToDiscovery(result.location.lat, result.location.lng, result.name);
  updateFabBadge();

  $('#btn-save')?.addEventListener('click', saveCurrentPlace);
}

async function saveCurrentPlace() {
  if (!_lastDiscovery) return;
  if (!Auth.isSignedIn()) { alert('Sign in to save places to a trip.'); return; }
  if (!Auth.isPremium()) { Gesture.dismiss(); openPremiumGate(); return; }

  try {
    const trips = await Auth.getTrips();
    if (trips.length === 0) {
      const name = prompt('Create a trip name:', 'My Trip');
      if (!name) return;
      const id = await Auth.createTrip(name.trim());
      await Auth.addPlaceToTrip(id, _lastDiscovery);
    } else {
      // Simple trip picker
      const opts = trips.map((t, i) => `${i+1}. ${t.name}`).join('\n');
      const idx  = parseInt(prompt(`Save to which trip?\n${opts}\n\nEnter number:`)) - 1;
      if (idx >= 0 && idx < trips.length) await Auth.addPlaceToTrip(trips[idx].id, _lastDiscovery);
    }

    const btn = $('#btn-save');
    if (btn) { btn.innerHTML = '<span class="material-symbols-outlined">bookmark_added</span> Saved!'; btn.disabled = true; }
  } catch (e) {
    console.error('[App] Save failed:', e);
    alert('Could not save place. Try again.');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PREMIUM GATE
   ══════════════════════════════════════════════════════════════════════════ */

function openPremiumGate() {
  const gate = $('#premium-gate');
  if (!gate) return;
  gate.innerHTML = renderPremiumGate();
  gate.classList.add('gate--open');

  $('#btn-gate-close')?.addEventListener('click', closePremiumGate);

  gate.querySelectorAll('.gate-plan').forEach(plan => {
    plan.addEventListener('click', () => {
      gate.querySelectorAll('.gate-plan').forEach(p => p.classList.remove('selected'));
      plan.classList.add('selected');
      _selectedPlan = plan.dataset.plan;
    });
  });

  $('#btn-checkout-proceed')?.addEventListener('click', () => {
    closePremiumGate();
    Router.navigate('checkout', { plan: _selectedPlan });
  });

  // Click outside to close
  gate.addEventListener('click', e => { if (e.target === gate) closePremiumGate(); });
}

function closePremiumGate() {
  const gate = $('#premium-gate');
  if (!gate) return;
  gate.classList.remove('gate--open');
  setTimeout(() => { gate.innerHTML = ''; }, 350);
}

/* ── FAB badge ────────────────────────────────────────────────────────── */

function updateFabBadge() {
  const badge = $('#fab-badge');
  if (!badge) return;
  const premium   = Auth.isPremium();
  const remaining = Discovery.getFreeRemaining();

  if (premium) {
    badge.textContent = '∞';
    badge.className = 'fab-badge unlimited';
  } else {
    badge.textContent = remaining;
    badge.className   = 'fab-badge';
  }
  badge.style.display = premium || remaining > 0 ? 'flex' : 'none';
}

/* ── Error messages ───────────────────────────────────────────────────── */

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'This email is already registered.',
    'auth/invalid-email':          'Please enter a valid email.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/too-many-requests':      'Too many attempts. Wait a moment.',
    'auth/popup-closed-by-user':   'Sign-in popup closed.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/requires-recent-login':  'Please sign out and sign back in, then try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOTSTRAP
   ══════════════════════════════════════════════════════════════════════════ */

function registerRoutes() {
  Router.register({
    map: {
      render: null,
      onEnter: null,
    },
    account: {
      render: () => Auth.isSignedIn() ? renderDashboard() : renderAuthPage(),
      onEnter: () => Auth.isSignedIn() ? bindDashboardEvents() : bindAuthEvents(),
    },
    settings: {
      render: renderSettingsPage,
      onEnter: bindSettingsEvents,
    },
    'edit-profile': {
      render: renderEditProfilePage,
      onEnter: bindEditProfileEvents,
    },
    checkout: {
      render: params => renderCheckoutPage(params?.plan || _selectedPlan),
      onEnter: bindCheckoutEvents,
    },
    terms: {
      render: renderTermsPage,
      onEnter: bindLegalEvents,
    },
    privacy: {
      render: renderPrivacyPage,
      onEnter: bindLegalEvents,
    },
    safety: {
      render: renderSafetyPage,
      onEnter: bindLegalEvents,
    },
  });
}

function bindGlobalEvents() {
  // Bottom navbar
  $$('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => Router.navigate(btn.dataset.page));
  });

  // Menu button → Settings
  $('#btn-menu')?.addEventListener('click', () => Router.navigate('settings'));

  // Discover FAB
  $('#btn-discover')?.addEventListener('click', triggerDiscovery);

  // Open Now toggle
  const onBtn = $('#btn-open-now');
  onBtn?.addEventListener('click', () => {
    _openNow = !_openNow;
    onBtn.classList.toggle('active', _openNow);
    onBtn.setAttribute('aria-pressed', _openNow);
    Discovery.resetBatch();
  });

  // Category pills (free selection — gate only fires inside discover())
  $$('.pill[data-category]').forEach(pill => {
    pill.addEventListener('click', () => {
      $$('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _selectedCategory = pill.dataset.category;
      Discovery.resetBatch();
    });
  });

  // Sheet buttons
  $('#btn-sheet-close')?.addEventListener('click', () => Gesture.dismiss());
  $('#btn-sheet-next')?.addEventListener('click',  triggerNext);
  $('.sheet-backdrop')?.addEventListener('click',  () => Gesture.dismiss());

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      Gesture.dismiss();
      closePremiumGate();
      if (Router.getCurrent() !== 'map') Router.navigate('map');
    }
  });
}

function onAuthStateChange(user) {
  updateFabBadge();
  // Re-render account page if currently on it
  if (Router.getCurrent() === 'account') Router.navigate('account');
}

/* ── Google Maps bridge ───────────────────────────────────────────────── */
// This is the callback Google Maps fires when its API is loaded.
// The function is defined in index.html as a stub that sets __mapsReady;
// here we override it to call Map.init() directly once the module is loaded.
window.__mapReadyCb = () => {
  console.log('[App] Maps API ready → initialising map');
  Map.init();
};

// Also set the global callback Google Maps calls directly
window.__initMap = window.__mapReadyCb;

/* ── Boot ─────────────────────────────────────────────────────────────── */

function init() {
  Shell.init();
  registerRoutes();

  Auth.init();
  Auth.onAuthChange(onAuthStateChange);

  // Gesture system
  const sheet   = $('#discovery-sheet');
  const surface = $('#sheet-surface');
  const handle  = $('#sheet-handle-pill');
  if (sheet && surface && handle) {
    Gesture.init({ sheet, surface, handle, onDismiss: () => {} });
  }

  bindGlobalEvents();
  Shell.dismissSplash();

  // If Maps API already loaded before module init (race condition guard)
  if (window.__mapsReady) Map.init();

  updateFabBadge();
  console.log('[App] Wanderlost v4 initialised');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
