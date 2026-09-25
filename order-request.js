(() => {
  const dialog = document.getElementById('order-dialog');
  const form = document.getElementById('order-form');
  const feedback = document.getElementById('order-feedback');
  if (!dialog || !form || !feedback) return;

  document.querySelectorAll('[data-order-open]').forEach((button) => button.addEventListener('click', () => {
    feedback.textContent = '';
    form.reset();
    dialog.showModal();
    form.elements.name.focus();
  }));
  document.querySelectorAll('[data-order-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    feedback.textContent = '';
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/order-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error();
      form.reset();
      feedback.textContent = 'Pedido enviado. Em breve entraremos em contato.';
    } catch {
      feedback.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.';
    } finally {
      submit.disabled = false;
    }
  });
})();
