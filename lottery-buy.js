/**
 * Lottery Buy Automation
 * Shows BUY button overlay on lottery applications page
 * Clicks: Random Selection Draw -> Continue -> Auto Buy
 */

(function() {
  console.log('[FIFA Buy] Lottery page detected:', window.location.href);

  // Run on lottery applications page AND account page
  const currentUrl = window.location.href.toLowerCase();
  const isLotteryPage = currentUrl.includes('lotteryapplications') || currentUrl.includes('lottery');
  const isAccountPage = currentUrl.includes('/account') && !currentUrl.includes('lotteryapplications');

  if (!isLotteryPage && !isAccountPage) {
    return;
  }

  console.log('[FIFA Buy] Page type:', isLotteryPage ? 'Lottery' : 'Account');

  let buyStarted = false;

  // Create overlay with BUY button
  function createOverlay() {
    if (document.getElementById('fifa-buy-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'fifa-buy-overlay';
    overlay.innerHTML = `
      <style>
        #fifa-buy-overlay {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 999999;
          font-family: Arial, sans-serif;
        }
        #fifa-buy-overlay .overlay-box {
          background: linear-gradient(135deg, #1a472a 0%, #0d2818 100%);
          border: 2px solid #2d6a4f;
          border-radius: 12px;
          padding: 15px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          min-width: 180px;
        }
        #fifa-buy-overlay .overlay-title {
          color: #40c463;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          text-align: center;
        }
        #fifa-buy-overlay .overlay-status {
          color: #fff;
          font-size: 11px;
          margin-bottom: 10px;
          text-align: center;
          min-height: 16px;
        }
        #fifa-buy-overlay .buy-btn {
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #40c463 0%, #2ea043 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        #fifa-buy-overlay .buy-btn:hover {
          background: linear-gradient(135deg, #56d975 0%, #40c463 100%);
          transform: scale(1.02);
        }
        #fifa-buy-overlay .buy-btn:disabled {
          background: #555;
          cursor: not-allowed;
          transform: none;
        }
        #fifa-buy-overlay .buy-btn.running {
          background: linear-gradient(135deg, #f0ad4e 0%, #ec971f 100%);
        }
      </style>
      <div class="overlay-box">
        <div class="overlay-title">FIFA LOTTERY BUY</div>
        <div class="overlay-status" id="fifa-buy-status">Ready</div>
        <button class="buy-btn" id="fifa-buy-btn">BUY</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('fifa-buy-btn').addEventListener('click', startBuyProcess);
  }

  function updateStatus(text) {
    const status = document.getElementById('fifa-buy-status');
    if (status) status.textContent = text;
    console.log('[FIFA Buy] ' + text);
  }

  function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = 'position:fixed;top:80px;right:20px;background:#1a472a;color:white;padding:16px 24px;border-radius:8px;z-index:999999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  async function startBuyProcess() {
    if (buyStarted) return;
    buyStarted = true;

    const btn = document.getElementById('fifa-buy-btn');
    if (btn) {
      btn.textContent = 'BUYING...';
      btn.classList.add('running');
      btn.disabled = true;
    }

    updateStatus('Starting buy process...');

    try {
      // Step 1: Click Random Selection Draw
      await clickRandomSelectionDraw();
      await delay(1500);

      // Step 2: Click Continue
      await clickContinue();
      await delay(2000);

      // Step 3: Auto buy (handled by other scripts or manual)
      updateStatus('Proceeding to checkout...');

    } catch (error) {
      console.error('[FIFA Buy] Error:', error);
      updateStatus('Error: ' + error.message);
    }
  }

  async function clickRandomSelectionDraw() {
    updateStatus('Looking for Random Selection Draw...');

    // FIFA-SPECIFIC: Look for stx-ballot-selection-details div with role="button"
    // The HTML structure is: div[id*="stx-ballot-selection-details"][role="button"] > ... > p.stx-ballot-name > "Random Selection Draw"
    const ballotSelections = document.querySelectorAll('div[id*="stx-ballot-selection-details"][role="button"]');
    console.log('[FIFA Buy] Found', ballotSelections.length, 'ballot selection elements');

    for (const selection of ballotSelections) {
      const ballotName = selection.querySelector('.stx-ballot-name, p[class*="stx-ballot-name"]');
      if (ballotName) {
        const text = (ballotName.textContent || '').trim().toLowerCase();
        console.log('[FIFA Buy] Ballot name:', text);
        if (text.includes('random selection draw')) {
          console.log('[FIFA Buy] Found Random Selection Draw ballot, clicking...');
          selection.click();
          showNotification('Clicked Random Selection Draw');
          updateStatus('Selected Random Draw');
          return true;
        }
      }
    }

    // Fallback: Look for p.stx-ballot-name containing "Random Selection Draw" and click parent role="button"
    const ballotNames = document.querySelectorAll('p.stx-ballot-name, .stx-ballot-name');
    for (const el of ballotNames) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text.includes('random selection draw')) {
        console.log('[FIFA Buy] Found Random Selection Draw via ballot name, looking for parent button...');
        const clickable = el.closest('[role="button"]') || el.closest('div[id*="stx-ballot"]');
        if (clickable) {
          clickable.click();
          showNotification('Clicked Random Selection Draw');
          updateStatus('Selected Random Draw');
          return true;
        }
      }
    }

    // Fallback 2: Any element with role="button" containing random selection text
    const roleButtons = document.querySelectorAll('[role="button"]');
    for (const btn of roleButtons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('random selection draw') && !text.includes('first come')) {
        console.log('[FIFA Buy] Found role=button with Random Selection Draw');
        btn.click();
        showNotification('Clicked Random Selection Draw');
        updateStatus('Selected Random Draw');
        return true;
      }
    }

    // Look for p-card or similar card elements
    const cards = document.querySelectorAll('.p-card, [class*="card"], [class*="option"]');
    for (const card of cards) {
      const text = (card.textContent || '').toLowerCase();
      if (text.includes('random selection') || text.includes('random draw')) {
        console.log('[FIFA Buy] Found card with Random Selection');
        card.click();
        showNotification('Clicked Random Selection card');
        updateStatus('Selected Random Draw');
        return true;
      }
    }

    updateStatus('Random Selection not found - may be pre-selected');
    return false;
  }

  async function clickContinue() {
    updateStatus('Looking for Continue button...');

    // Try multiple selectors for Continue button
    const selectors = [
      'button[aria-label="Continue"]',
      'button.stx-p-button[data-pc-name="button"]',
      'button:contains("Continue")',
      '.p-button'
    ];

    // Look for buttons with "Continue" text
    const buttons = document.querySelectorAll('button, a.p-button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'continue' || text.includes('continue')) {
        if (!btn.disabled) {
          console.log('[FIFA Buy] Found Continue button');
          btn.click();
          showNotification('Clicked Continue');
          updateStatus('Continuing to next step...');
          return true;
        }
      }
    }

    // Look for span.p-button-label with Continue
    const buttonLabels = document.querySelectorAll('span.p-button-label');
    for (const label of buttonLabels) {
      const text = (label.textContent || '').trim().toLowerCase();
      if (text === 'continue') {
        const btn = label.closest('button') || label.closest('a');
        if (btn && !btn.disabled) {
          console.log('[FIFA Buy] Found Continue via p-button-label');
          btn.click();
          showNotification('Clicked Continue');
          updateStatus('Continuing to next step...');
          return true;
        }
      }
    }

    // Try aria-label
    const continueBtn = document.querySelector('button[aria-label="Continue"]');
    if (continueBtn && !continueBtn.disabled) {
      continueBtn.click();
      showNotification('Clicked Continue');
      updateStatus('Continuing to next step...');
      return true;
    }

    updateStatus('Continue button not found or disabled');
    return false;
  }

  // Create overlay when page loads
  setTimeout(createOverlay, 1000);

  // Re-create overlay if removed (SPA navigation)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('fifa-buy-overlay')) {
      const url = window.location.href.toLowerCase();
      if (url.includes('lotteryapplications') || url.includes('lottery')) {
        createOverlay();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
