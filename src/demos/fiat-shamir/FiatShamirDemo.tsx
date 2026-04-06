import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SelectControl, SliderControl, ButtonControl, ControlCard, ControlNote } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
import { derivePublicKey, forgePredictableProof, simulateProof, simulateStatement, type FiatShamirMode, type ImportedTranscriptTrace } from './logic';
import { renderFiatShamir } from './renderer';

export function FiatShamirDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const [secret, setSecret] = useState(9);
  const [nonce, setNonce] = useState(12);
  const [verifierSeed, setVerifierSeed] = useState(17);
  const [mode, setMode] = useState<FiatShamirMode>('fs-correct');
  const [importedTrace, setImportedTrace] = useState<ImportedTranscriptTrace | null>(null);
  const [pipelineHash, setPipelineHash] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const statement = simulateStatement(secret);

  // Attack mode bridge
  const { currentDemoAction } = useAttack();
  useAttackActions(currentDemoAction, useMemo(() => ({
    SET_MODE: (payload) => setMode(payload as FiatShamirMode),
  }), [setMode]));

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'fiat-shamir' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      mode?: FiatShamirMode;
      secret?: number;
      nonce?: number;
      verifierSeed?: number;
      trace?: ImportedTranscriptTrace;
      pipelineHash?: string;
      forgeryComplete?: boolean;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('fs');
    const decoded = decodeState<{
      mode?: FiatShamirMode;
      secret?: number;
      nonce?: number;
      verifierSeed?: number;
      trace?: ImportedTranscriptTrace;
      pipelineHash?: string;
      forgeryComplete?: boolean;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (payload.mode) setMode(payload.mode);
    // If forgeryComplete was serialized, restore to broken mode
    if (payload.forgeryComplete && !payload.mode) setMode('fs-broken');
    if (typeof payload.secret === 'number') setSecret(payload.secret);
    if (typeof payload.nonce === 'number') setNonce(payload.nonce);
    if (typeof payload.verifierSeed === 'number') setVerifierSeed(payload.verifierSeed);
    if (payload.trace?.source === 'pipeline') setImportedTrace(payload.trace);
    if (typeof payload.pipelineHash === 'string') setPipelineHash(payload.pipelineHash);
  }, []);

  const proof = useMemo(
    () => simulateProof(mode, statement, secret, nonce, verifierSeed),
    [mode, nonce, secret, statement, verifierSeed]
  );
  const forged = useMemo(() => forgePredictableProof(statement, derivePublicKey(secret), mode), [mode, secret, statement]);

  const buildShareState = useCallback(() => ({
    mode,
    secret,
    nonce,
    verifierSeed,
    trace: importedTrace ?? undefined,
    pipelineHash: pipelineHash ?? undefined,
    forgeryComplete: mode === 'fs-broken' ? true : undefined,
  }), [importedTrace, mode, nonce, pipelineHash, secret, verifierSeed]);

  // URL sync effect
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'fiat-shamir') return;
    setSearchParams({ fs: encodeState(buildShareState()) });
  }, [buildShareState]);

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('fs');
    url.hash = `fiat-shamir|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'fiat-shamir');
    url.searchParams.set('fs', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-fiat-shamir.png', showDownloadToast);
  };


  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'fiat-shamir',
      timestamp: new Date().toISOString(),
      mode,
      secret,
      nonce,
      verifierSeed,
      statement,
      publicKey: derivePublicKey(secret),
      importedTrace,
      proof: { commitment: proof.commitment, challenge: proof.challenge, response: proof.response, valid: proof.valid },
      forgedTranscript: forged ? { commitment: forged.commitment, challenge: forged.challenge, response: forged.response, valid: forged.valid } : null,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Protocol state, proof transcript & forgery data');
  };

  useEffect(() => {
    setEntry('fiat-shamir', {
      title: importedTrace ? 'Imported pipeline transcript' : 'Transcript binding',
      body: importedTrace
        ? importedTrace.detail
        : mode === 'fs-broken'
          ? `Broken mode omits the commitment from the hash, so the challenge ${proof.challenge} is predictable and a forged transcript can verify.`
          : `Mode ${mode} binds the challenge to ${mode === 'interactive' ? 'verifier randomness' : 'the full transcript'}, preventing the forged proof path.`,
      nextSteps: importedTrace
        ? ['Inspect the imported challenge path', 'Exit linked trace to return to the toy protocol', 'Compare this with the polynomial opening stage']
        : ['Switch to broken mode', 'Change the nonce', 'Compare the forged proof banner'],
    });
  }, [importedTrace, mode, proof.challenge, setEntry]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderFiatShamir(ctx, frame, proof, forged, mode, theme, importedTrace);
  }, [forged, importedTrace, mode, proof, theme]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    fitCameraToBounds(camera, canvas, {
      minX: 40,
      minY: 40,
      maxX: width - 40,
      maxY: height - 36,
    }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  return (
    <DemoLayout
      onEmbedPlay={() => {
        if (importedTrace) {
          setImportedTrace(null);
          return;
        }
        setMode((prev) => (prev === 'fs-broken' ? 'fs-correct' : 'fs-broken'));
      }}
      embedPlaying={!importedTrace && mode === 'fs-broken'}
      onEmbedReset={() => { setMode('fs-correct'); setSecret(9); setNonce(12); setVerifierSeed(17); setImportedTrace(null); }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {importedTrace ? (
          <>
            <ControlGroup label="Linked Trace">
              <ControlCard>
                <span className="control-kicker">Source</span>
                <div className="control-value">Proof Pipeline</div>
                <div className="control-caption">This is the exact transcript handoff from the pipeline challenge stage.</div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">Transcript inputs</span>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                  {importedTrace.transcriptInputs.join(' | ') || '(fixed challenge)'}
                </div>
              </ControlCard>
              <ControlNote tone={importedTrace.predictable ? 'error' : 'success'}>
                {importedTrace.predictable ? 'This challenge is predictable because the transcript is incomplete.' : 'This challenge is bound to the commitment and public output.'}
              </ControlNote>
              {pipelineHash && (
                <ButtonControl label="Back to Pipeline" onClick={() => { window.location.hash = pipelineHash; }} variant="secondary" />
              )}
              <ButtonControl label="Exit linked trace" onClick={() => setImportedTrace(null)} variant="secondary" />
            </ControlGroup>

            <ControlGroup label="Share">
              <ShareSaveDropdown
                demoId="fiat-shamir"
                onCopyShareUrl={handleCopyShareUrl}
                onCopyHashUrl={handleCopyHashUrl}
                onCopyEmbed={handleCopyEmbed}
                onExportPng={handleExportPng}
                onCopyAudit={handleCopyAuditSummary}
              />
            </ControlGroup>
          </>
        ) : (
          <>
            <ControlGroup label="Protocol Mode">
              <SelectControl
                label="Challenge source"
                value={mode}
                options={[
                  { value: 'interactive', label: 'Interactive verifier' },
                  { value: 'fs-correct', label: 'Fiat-Shamir correct' },
                  { value: 'fs-broken', label: 'Fiat-Shamir broken' },
                ]}
                onChange={(value) => setMode(value as FiatShamirMode)}
              />
            </ControlGroup>

            <ControlGroup label="Transcript Inputs">
              <SliderControl label="Secret" value={secret} min={2} max={15} onChange={setSecret} />
              <SliderControl label="Nonce" value={nonce} min={2} max={20} onChange={setNonce} />
              <SliderControl label="Verifier seed" value={verifierSeed} min={1} max={40} onChange={setVerifierSeed} />
              <ControlCard>
                <span className="control-kicker">Public statement</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  y = {derivePublicKey(secret)}, s = {statement}
                </div>
              </ControlCard>
            </ControlGroup>

            <ControlGroup label="Forgery">
              <ButtonControl label="Jump To Broken Mode" onClick={() => setMode('fs-broken')} />
              <ControlNote>
                In broken mode, the prover can predict the challenge before choosing the commitment and back-solve a convincing transcript.
              </ControlNote>
              {forged && (
                <ControlCard tone="error">
                  <span className="control-kicker">Forged transcript</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    (t, c, z) = ({forged.commitment}, {forged.challenge}, {forged.response})
                  </div>
                </ControlCard>
              )}
            </ControlGroup>

            <ButtonControl label="Reset to Defaults" onClick={() => {
              setMode('fs-correct'); setSecret(9); setNonce(12); setVerifierSeed(17); setImportedTrace(null);
              showToast('Reset to defaults');
            }} variant="secondary" />

            <ControlGroup label="Share">
              <ShareSaveDropdown
                demoId="fiat-shamir"
                onCopyShareUrl={handleCopyShareUrl}
                onCopyHashUrl={handleCopyHashUrl}
                onCopyEmbed={handleCopyEmbed}
                onExportPng={handleExportPng}
                onCopyAudit={handleCopyAuditSummary}
              />
            </ControlGroup>
          </>
        )}
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:fiat-shamir" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Fiat-Shamir" />
    </DemoLayout>
  );
}
