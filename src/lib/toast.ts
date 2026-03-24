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

function buildToastElement(icon: string, message: string, sub?: string, tone: ToastTone = 'success'): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `theora-toast theora-toast--${tone}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'theora-toast__icon';
  iconSpan.textContent = icon;

  const body = document.createElement('div');
  body.className = 'theora-toast__body';

  const msg = document.createElement('div');
  msg.className = 'theora-toast__msg';
  msg.textContent = message;
  body.appendChild(msg);

  if (sub) {
    const subDiv = document.createElement('div');
    subDiv.className = 'theora-toast__sub';
    subDiv.textContent = sub;
    body.appendChild(subDiv);
  }

  el.appendChild(iconSpan);
  el.appendChild(body);
  return el;
}

function showAndDismiss(el: HTMLDivElement, duration: number): void {
  const c = getContainer();
  c.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('theora-toast--visible'));
  });

  setTimeout(() => {
    el.classList.remove('theora-toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, duration);
}

export function showToast(message: string, subOrTone?: string, duration = 2600): void {
  const tone: ToastTone = subOrTone === 'error' ? 'error' : 'success';
  const sub = subOrTone === 'error' ? undefined : subOrTone;
  const icon = tone === 'error' ? '!' : '✓';
  const el = buildToastElement(icon, message, sub, tone);
  showAndDismiss(el, duration);
}

export function showDownloadToast(filename: string): void {
  const el = buildToastElement('↓', 'File downloaded', filename);
  showAndDismiss(el, 2600);
}
