import { useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';
import { createGitHubSave, GitHubSessionError } from '@/lib/githubApi';
import { getCurrentExportEnvelope } from '@/lib/githubImport';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import { ButtonControl } from '@/components/shared/Controls';
import type { DemoId } from '@/types';

interface SaveToGitHubProps {
  demoId: DemoId;
}

export function SaveToGitHub({ demoId }: SaveToGitHubProps) {
  const { status, handleSessionExpired, setConnectOpen } = useGitHub();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (status !== 'connected') {
      setConnectOpen(true);
      return;
    }

    const envelope = getCurrentExportEnvelope(demoId);
    if (!envelope) {
      showToast('No state to save', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await createGitHubSave(envelope);
      copyToClipboard(result.url);
      showToast('Saved to GitHub', 'Unlisted Gist created and URL copied');
    } catch (err) {
      if (err instanceof GitHubSessionError) {
        await handleSessionExpired('GitHub session expired — reconnect to save again');
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
      onClick={() => { void handleSave(); }}
      disabled={saving || status === 'connecting'}
      variant="secondary"
    />
  );
}
