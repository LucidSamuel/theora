let container: HTMLDivElement | null = null;

type ToastTone = 'success' | 'error';

function getContainer(): HTMLDivElement {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.id = 'theora-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, subOrTone?: string, duration = 2600): void {
  const tone: ToastTone = subOrTone === 'error' ? 'error' : 'success';
  const sub = subOrTone === 'error' ? undefined : subOrTone;
  const icon = tone === 'error' ? '!' : '✓';
  const c = getContainer();
  const el = document.createElement('div');
  el.className = `theora-toast theora-toast--${tone}`;
  el.innerHTML = `
    <span class="theora-toast__icon">${icon}</span>
    <div class="theora-toast__body">
      <div class="theora-toast__msg">${message}</div>
      ${sub ? `<div class="theora-toast__sub">${sub}</div>` : ''}
    </div>
  `;
  c.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('theora-toast--visible'));
  });

  setTimeout(() => {
    el.classList.remove('theora-toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, duration);
}

export function showDownloadToast(filename: string): void {
  const c = getContainer();
  const el = document.createElement('div');
  el.className = 'theora-toast';
  el.innerHTML = `
    <span class="theora-toast__icon">↓</span>
    <div class="theora-toast__body">
      <div class="theora-toast__msg">File downloaded</div>
      <div class="theora-toast__sub">${filename}</div>
    </div>
  `;
  c.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('theora-toast--visible'));
  });

  setTimeout(() => {
    el.classList.remove('theora-toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2600);
}
