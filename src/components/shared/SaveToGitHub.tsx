import { useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';
import { createPublicGist, getCurrentExportEnvelope } from '@/lib/githubImport';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import { ButtonControl } from '@/components/shared/Controls';
import type { DemoId } from '@/types';

interface SaveToGitHubProps {
  demoId: DemoId;
}

export function SaveToGitHub({ demoId }: SaveToGitHubProps) {
  const { status, getToken, setConnectOpen } = useGitHub();
  const [saving, setSaving] = useState(false);

  if (status !== 'connected') {
    return (
      <ButtonControl
        label="Save to GitHub"
        onClick={() => setConnectOpen(true)}
        variant="secondary"
      />
    );
  }

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    const envelope = getCurrentExportEnvelope(demoId);
    if (!envelope) {
      showToast('No state to save', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await createPublicGist(envelope, token);
      copyToClipboard(result.url);
      showToast('Saved to GitHub', 'Public Gist created and URL copied');
    } catch (err) {
      if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
        showToast('Token expired — reconnect GitHub', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ButtonControl
      label={saving ? 'Saving...' : 'Save to GitHub'}
      onClick={handleSave}
      disabled={saving}
      variant="secondary"
    />
  );
}
