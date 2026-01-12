/**
 * 2Captcha Solver for FIFA Slider/Puzzle Captcha
 * Supports: GeeTest, Slider puzzles, Image puzzles
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
      max-width: 300px;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    if (!isError) setTimeout(() => notif.remove(), 5000);
  }

  // Detect any captcha on page
  detectCaptcha() {
    // Look for FIFA verification page
    const verificationText = document.body.innerText.includes('Verification Required');
    const sliderText = document.body.innerText.includes('Slide right to complete');
    const puzzleImage = document.querySelector('img[src*="puzzle"], img[src*="captcha"]');

    // Look for slider elements
    const slider = document.querySelector('[class*="slider"], [class*="slide"], button[aria-label*="slide"]');

    // GeeTest
    const geetest = document.querySelector('[class*="geetest"], [id*="geetest"]');

    // Generic captcha container
    const captchaContainer = document.querySelector('[class*="captcha"], [id*="captcha"]');

    return verificationText || sliderText || puzzleImage || slider || geetest || captchaContainer;
  }

  // Get the captcha image as base64
  async getCaptchaImageBase64() {
    // Try to find the puzzle image
    const images = document.querySelectorAll('img');
    for (const img of images) {
      // Look for the main puzzle image (usually larger than 100px)
      if (img.width > 100 && img.height > 50) {
        const src = img.src;
        if (src.startsWith('data:')) {
          return src.split(',')[1];
        }
        // Fetch and convert to base64
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          this.log('Could not fetch image: ' + e.message);
        }
      }
    }
    return null;
  }

  // Take screenshot of captcha area
  async getScreenshot() {
    // For slider captcha, we need to capture the visual
    const captchaArea = document.querySelector('[class*="captcha"], [class*="verification"]') || document.body;

    // Use html2canvas if available, otherwise return null
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(captchaArea);
      return canvas.toDataURL('image/png').split(',')[1];
    }

    return null;
  }

  // Submit image captcha to 2captcha (coordinates method for slider)
  async submitImageCaptcha(imageBase64) {
    this.log('Submitting image captcha to 2captcha...');
    this.showNotification('Uploading captcha image...');

    const formData = new FormData();
    formData.append('key', this.apiKey);
    formData.append('method', 'base64');
    formData.append('body', imageBase64);
    formData.append('coordinatescaptcha', '1'); // For click coordinates
    formData.append('json', '1');

    try {
      const response = await fetch(`${CAPTCHA_API_URL}/in.php`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.status === 1) {
        this.log('Captcha submitted, task ID: ' + data.request);
        return data.request;
      } else {
        throw new Error(data.request || 'Submit failed');
      }
    } catch (error) {
      this.log('Submit error: ' + error.message);
      this.showNotification('Submit failed: ' + error.message, true);
      throw error;
    }
  }

  // Submit slider captcha (using canvas method)
  async submitSliderCaptcha() {
    this.log('Submitting slider captcha...');
    this.showNotification('Analyzing slider puzzle...');

    // For slider captchas, 2captcha needs the background and slider images
    const images = Array.from(document.querySelectorAll('img'));

    // Find puzzle background (larger image)
    let bgImage = null;
    let sliderImage = null;

    for (const img of images) {
      if (img.width > 200) {
        bgImage = img;
      } else if (img.width > 30 && img.width < 100) {
        sliderImage = img;
      }
    }

    if (!bgImage) {
      throw new Error('Could not find puzzle image');
    }

    // Get base64 of main image
    const imageBase64 = await this.imageToBase64(bgImage.src);

    // Use normal image captcha method - 2captcha workers will determine slider position
    const formData = new FormData();
    formData.append('key', this.apiKey);
    formData.append('method', 'base64');
    formData.append('body', imageBase64);
    formData.append('json', '1');
    formData.append('textinstructions', 'Find the x-coordinate where the puzzle piece fits. Return only the number.');

    try {
      const response = await fetch(`${CAPTCHA_API_URL}/in.php`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.status === 1) {
        this.log('Slider captcha submitted, task ID: ' + data.request);
        return data.request;
      } else {
        throw new Error(data.request || 'Submit failed');
      }
    } catch (error) {
      this.log('Submit error: ' + error.message);
      throw error;
    }
  }

  async imageToBase64(src) {
    if (src.startsWith('data:')) {
      return src.split(',')[1];
    }

    const response = await fetch(src);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  // Get solution from 2captcha
  async getSolution(taskId) {
    this.log('Waiting for solution...');

    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await this.delay(5000);

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
          this.log('Solution received: ' + data.request);
          this.showNotification('Captcha solved!');
          return data.request;
        } else if (data.request === 'CAPCHA_NOT_READY') {
          this.showNotification('Solving... ' + (i * 5) + 's');
        } else {
          throw new Error(data.request);
        }
      } catch (error) {
        if (!error.message.includes('NOT_READY')) {
          throw error;
        }
      }
    }
    throw new Error('Timeout');
  }

  // Move slider to solved position
  moveSlider(xPosition) {
    this.log('Moving slider to position: ' + xPosition);

    // Find the slider button
    const sliderBtn = document.querySelector('button[class*="slider"], [class*="slide"] button, button[aria-label*="slide"]') ||
                      document.querySelector('button') ||
                      document.querySelector('[draggable="true"]');

    if (!sliderBtn) {
      this.log('Could not find slider button');
      return false;
    }

    const sliderTrack = sliderBtn.parentElement;
    const trackRect = sliderTrack.getBoundingClientRect();
    const btnRect = sliderBtn.getBoundingClientRect();

    // Calculate target position
    const startX = btnRect.left + btnRect.width / 2;
    const startY = btnRect.top + btnRect.height / 2;
    const endX = trackRect.left + parseInt(xPosition);

    // Simulate mouse events
    this.simulateSlide(sliderBtn, startX, startY, endX, startY);

    return true;
  }

  simulateSlide(element, startX, startY, endX, endY) {
    // Mouse down
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY
    }));

    // Mouse move (simulate drag)
    const steps = 20;
    const dx = (endX - startX) / steps;

    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: startX + dx * i,
          clientY: startY
        }));
      }, i * 20);
    }

    // Mouse up
    setTimeout(() => {
      document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY
      }));
    }, steps * 20 + 100);
  }

  // Main solve function
  async solve() {
    this.log('Starting captcha detection...');

    if (!this.detectCaptcha()) {
      this.log('No captcha detected');
      this.showNotification('No captcha detected on page', true);
      return false;
    }

    this.log('Captcha detected!');
    this.showNotification('Captcha detected, solving...');

    try {
      const taskId = await this.submitSliderCaptcha();
      const solution = await this.getSolution(taskId);

      // Try to apply solution (move slider)
      if (solution && !isNaN(parseInt(solution))) {
        this.moveSlider(solution);
        this.showNotification('Slider moved to position ' + solution);
      } else {
        this.showNotification('Solution: ' + solution);
        console.log('[2Captcha] Full solution:', solution);
      }

      return solution;
    } catch (error) {
      this.showNotification('Failed: ' + error.message, true);
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create global instance
window.captchaSolver = new CaptchaSolver();

// Add solve button when captcha detected
(function() {
  const addSolveButton = () => {
    const solver = window.captchaSolver;

    if (solver.detectCaptcha() && !document.getElementById('captcha-solve-btn')) {
      const btn = document.createElement('button');
      btn.id = 'captcha-solve-btn';
      btn.innerHTML = '🔓 SOLVE CAPTCHA';
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
      btn.onclick = () => {
        btn.disabled = true;
        btn.textContent = '⏳ Solving...';
        solver.solve().finally(() => {
          btn.disabled = false;
          btn.innerHTML = '🔓 SOLVE CAPTCHA';
        });
      };
      document.body.appendChild(btn);
      console.log('[2Captcha] Solve button added');
    }
  };

  setTimeout(addSolveButton, 2000);
  setInterval(addSolveButton, 3000);
})();

console.log('[2Captcha] Slider captcha solver loaded');
