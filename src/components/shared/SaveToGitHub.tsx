import { useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';
import { createGitHubSave, GitHubSessionError } from '@/lib/githubApi';
import { getCurrentExportEnvelope } from '@/lib/githubImport';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import { ButtonControl, TextInput } from '@/components/shared/Controls';
import type { DemoId } from '@/types';

interface SaveToGitHubProps {
  demoId: DemoId;
}

export function SaveToGitHub({ demoId }: SaveToGitHubProps) {
  const { status, handleSessionExpired, setConnectOpen } = useGitHub();
  const [saveName, setSaveName] = useState('');
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
      const trimmedName = saveName.trim();
      const result = await createGitHubSave(envelope, trimmedName || undefined);
      copyToClipboard(result.url);
      showToast('Saved to GitHub', `${trimmedName || 'Unlisted Gist'} created and URL copied`);
      if (trimmedName) {
        setSaveName('');
      }
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
    <div className="flex flex-col gap-2">
      <TextInput
        value={saveName}
        onChange={setSaveName}
        placeholder="Save name (optional)"
        onSubmit={() => { if (!saving) void handleSave(); }}
      />
      <ButtonControl
        label={saving ? 'Saving...' : 'Save to GitHub'}
        onClick={() => { void handleSave(); }}
        disabled={saving || status === 'connecting'}
        variant="secondary"
      />
    </div>
  );
}
