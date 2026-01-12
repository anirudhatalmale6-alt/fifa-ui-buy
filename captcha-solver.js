/**
 * 2Captcha Solver for FunCaptcha/Arkose Labs
 * API Key: 8b844af3255fd40f6ee4ddc5091cac5c
 */

const CAPTCHA_API_KEY = '8b844af3255fd40f6ee4ddc5091cac5c';
const CAPTCHA_API_URL = 'https://2captcha.com';

class CaptchaSolver {
  constructor() {
    this.apiKey = CAPTCHA_API_KEY;
  }

  log(message) {
    console.log('[2Captcha] ' + message);
  }

  // Show status notification
  showNotification(message, isError = false) {
    const existing = document.getElementById('captcha-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.id = 'captcha-notification';
    notif.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: ${isError ? '#dc3545' : '#28a745'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999999;
      font-family: sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
  }

  // Detect FunCaptcha/Arkose Labs on page
  detectFunCaptcha() {
    // Look for FunCaptcha iframe or container
    const funCaptchaIframe = document.querySelector('iframe[src*="funcaptcha"], iframe[src*="arkoselabs"], iframe[data-e2e="enforcement-frame"]');
    const funCaptchaContainer = document.querySelector('[id*="funcaptcha"], [class*="funcaptcha"], [data-callback]');
    const arkoseContainer = document.querySelector('[id*="arkose"], [class*="arkose"]');

    // Look for common captcha challenge elements
    const challengeFrame = document.querySelector('iframe[title*="challenge"], iframe[title*="verification"]');

    return funCaptchaIframe || funCaptchaContainer || arkoseContainer || challengeFrame;
  }

  // Get FunCaptcha public key from page
  getFunCaptchaKey() {
    // Try to find the public key in various places

    // Method 1: From data attribute
    const dataKey = document.querySelector('[data-pkey], [data-public-key]');
    if (dataKey) {
      return dataKey.getAttribute('data-pkey') || dataKey.getAttribute('data-public-key');
    }

    // Method 2: From iframe src
    const iframe = document.querySelector('iframe[src*="funcaptcha"], iframe[src*="arkoselabs"]');
    if (iframe) {
      const src = iframe.src;
      const pkeyMatch = src.match(/pkey=([A-Za-z0-9-]+)/);
      if (pkeyMatch) return pkeyMatch[1];
    }

    // Method 3: From script variables (search page scripts)
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      const keyMatch = content.match(/publicKey["']?\s*[:=]\s*["']([A-Za-z0-9-]+)["']/);
      if (keyMatch) return keyMatch[1];
    }

    // Method 4: From window object
    if (window.FUNCAPTCHA_PUBLIC_KEY) return window.FUNCAPTCHA_PUBLIC_KEY;
    if (window.arkose && window.arkose.publicKey) return window.arkose.publicKey;

    return null;
  }

  // Submit FunCaptcha to 2captcha
  async submitFunCaptcha(publicKey, pageUrl) {
    this.log('Submitting FunCaptcha to 2captcha...');
    this.showNotification('Solving captcha...');

    const params = new URLSearchParams({
      key: this.apiKey,
      method: 'funcaptcha',
      publickey: publicKey,
      pageurl: pageUrl,
      json: 1
    });

    try {
      const response = await fetch(`${CAPTCHA_API_URL}/in.php?${params}`);
      const data = await response.json();

      if (data.status === 1) {
        this.log('Captcha submitted, task ID: ' + data.request);
        return data.request;
      } else {
        throw new Error(data.request || 'Submit failed');
      }
    } catch (error) {
      this.log('Submit error: ' + error.message);
      this.showNotification('Captcha submit failed: ' + error.message, true);
      throw error;
    }
  }

  // Get captcha solution from 2captcha
  async getSolution(taskId) {
    this.log('Waiting for solution...');

    const maxAttempts = 60; // 5 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      await this.delay(5000); // Wait 5 seconds between checks

      const params = new URLSearchParams({
        key: this.apiKey,
        action: 'get',
        id: taskId,
        json: 1
      });

      try {
        const response = await fetch(`${CAPTCHA_API_URL}/res.php?${params}`);
        const data = await response.json();

        if (data.status === 1) {
          this.log('Solution received!');
          this.showNotification('Captcha solved!');
          return data.request;
        } else if (data.request === 'CAPCHA_NOT_READY') {
          this.log('Still solving... attempt ' + (i + 1));
          this.showNotification('Solving captcha... ' + (i * 5) + 's');
        } else {
          throw new Error(data.request || 'Get solution failed');
        }
      } catch (error) {
        if (error.message !== 'CAPCHA_NOT_READY') {
          this.log('Get solution error: ' + error.message);
          throw error;
        }
      }
    }

    throw new Error('Captcha solving timeout');
  }

  // Apply the solution to the page
  applySolution(solution) {
    this.log('Applying solution to page...');

    // Method 1: Try to find callback function
    if (window.funcaptchaCallback) {
      window.funcaptchaCallback(solution);
      return true;
    }

    // Method 2: Try to set hidden input
    const tokenInput = document.querySelector('input[name*="fc-token"], input[name*="funcaptcha"], input[name*="verification-token"]');
    if (tokenInput) {
      tokenInput.value = solution;
      return true;
    }

    // Method 3: Dispatch custom event
    const event = new CustomEvent('funcaptcha-solved', { detail: { token: solution } });
    document.dispatchEvent(event);

    // Method 4: Try to find and call verify callback
    const verifyCallbacks = ['verifyCallback', 'onVerify', 'captchaCallback', 'onSuccess'];
    for (const cb of verifyCallbacks) {
      if (typeof window[cb] === 'function') {
        window[cb](solution);
        return true;
      }
    }

    this.log('Could not find callback, solution: ' + solution.substring(0, 50) + '...');
    return false;
  }

  // Main solve function
  async solve() {
    this.log('Starting captcha detection...');

    const captchaElement = this.detectFunCaptcha();
    if (!captchaElement) {
      this.log('No FunCaptcha detected on page');
      this.showNotification('No captcha detected', true);
      return false;
    }

    this.log('FunCaptcha detected!');

    const publicKey = this.getFunCaptchaKey();
    if (!publicKey) {
      this.log('Could not find FunCaptcha public key');
      this.showNotification('Could not find captcha key', true);
      return false;
    }

    this.log('Public key: ' + publicKey);

    try {
      const taskId = await this.submitFunCaptcha(publicKey, window.location.href);
      const solution = await this.getSolution(taskId);
      const applied = this.applySolution(solution);

      if (applied) {
        this.showNotification('Captcha solved and applied!');
      } else {
        this.showNotification('Captcha solved - check console for token');
        console.log('[2Captcha] Solution token:', solution);
      }

      return solution;
    } catch (error) {
      this.showNotification('Captcha solving failed: ' + error.message, true);
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create global instance
window.captchaSolver = new CaptchaSolver();

// Auto-detect and show solve button if captcha found
(function() {
  const checkForCaptcha = () => {
    const solver = window.captchaSolver;
    if (solver.detectFunCaptcha()) {
      // Add solve button if not exists
      if (!document.getElementById('captcha-solve-btn')) {
        const btn = document.createElement('button');
        btn.id = 'captcha-solve-btn';
        btn.textContent = '🔓 SOLVE CAPTCHA';
        btn.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 25px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          z-index: 9999999;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;
        btn.onclick = () => solver.solve();
        document.body.appendChild(btn);
        console.log('[2Captcha] Solve button added');
      }
    }
  };

  // Check on load and periodically
  setTimeout(checkForCaptcha, 2000);
  setInterval(checkForCaptcha, 5000);
})();

console.log('[2Captcha] Captcha solver loaded. Use window.captchaSolver.solve() or click the SOLVE CAPTCHA button.');
