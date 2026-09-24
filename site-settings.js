(() => {
  const apply = (settings) => {
    const whatsapp = settings.whatsapp ? `https://wa.me/${settings.whatsapp}` : '';
    document.querySelectorAll('[data-site-whatsapp]:not(#product-contact)').forEach((link) => {
      if (!whatsapp) { link.hidden = true; return; }
      link.href = whatsapp;
    });
    document.querySelectorAll('[data-site-instagram]').forEach((link) => {
      if (!settings.instagram) { link.hidden = true; return; }
      link.href = settings.instagram;
    });
    document.querySelectorAll('[data-site-address]').forEach((node) => { node.textContent = settings.address || ''; node.hidden = !settings.address; });
    document.querySelectorAll('[data-site-phone]').forEach((node) => { node.textContent = settings.displayPhone || ''; node.hidden = !settings.displayPhone; });
    document.querySelectorAll('[data-site-hours]').forEach((node) => {
      const weekday = settings.weekdayOpen && settings.weekdayClose ? `Seg–Sex: ${settings.weekdayOpen}–${settings.weekdayClose}` : '';
      const saturday = settings.saturdayOpen && settings.saturdayClose ? `Sáb: ${settings.saturdayOpen}–${settings.saturdayClose}` : '';
      node.textContent = [weekday, saturday].filter(Boolean).join(' · '); node.hidden = !node.textContent;
    });
  };
  fetch('/api/site-settings', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((settings) => settings && apply(settings)).catch(() => {});
})();
