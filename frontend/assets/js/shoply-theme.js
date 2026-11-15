/**
 * Applies browser-persisted storefront content saved from the admin demo.
 */
(function () {
  function applyStorefrontSettings() {
    if (!window.CEStore) return;
    const settings = CEStore.getSettings();
    const storeName = String(settings.storeName || 'Bloom & Blossom').trim();
    const headline = document.querySelector('.hero-text h1');
    const description = document.querySelector('.hero-text > p');
    const announcementText = document.querySelector('.announce .announce-text, .announce .container span:not(.announce-sparkle)');
    const root = document.documentElement;

    if (settings.brandColor && settings.brandColor !== '#202522') {
      root.style.setProperty('--primary', settings.brandColor);
    }
    if (settings.accentColor && settings.accentColor !== '#B8A58B') {
      root.style.setProperty('--accent-gold', settings.accentColor);
    }

    document.querySelectorAll('.logo').forEach(logo => {
      logo.innerHTML = `${storeName}<span>.</span>`;
      logo.setAttribute('aria-label', `${storeName} home`);
    });

    const copyright = document.querySelector('.footer-bottom > span');
    if (copyright) copyright.textContent = `© ${new Date().getFullYear()} ${storeName} Floral Boutique. All rights reserved.`;

    if (headline && settings.homepageTitle) {
      headline.innerHTML = settings.homepageTitle.includes('<em>')
        ? settings.homepageTitle
        : settings.homepageTitle.replace(/([^\s]+[\s]*)$/, '<em>$1</em>');
    }
    if (description && settings.homepageDescription) {
      description.textContent = settings.homepageDescription;
    }
    if (announcementText && settings.announcement) {
      announcementText.textContent = settings.announcement.replace(/^✦\s*/, '');
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = '#fbf9f6';
    document.title = `${storeName} — Thoughtful flowers, handcrafted & delivered fresh`;
  }

  applyStorefrontSettings();
})();
