import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoAside, DemoCanvasArea, DemoLayout, DemoSidebar } from '@/components/shared/DemoLayout';
import { ButtonControl, ControlCard, ControlGroup, ControlNote, SelectControl } from '@/components/shared/Controls';
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
import { exportCanvasPng } from '@/lib/canvas';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { showDownloadToast, showToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import {
  buildMatchingGame,
  countChangedBytes,
  createOriginalProof,
  getStatementCatalog,
  rerandomizeProof,
  scoreMatchingGame,
  verifiedSameStatement,
} from './logic';
import { renderRerandomization } from './renderer';

interface UrlState {
  statementIndex?: number;
  nonce?: number;
  gameSeed?: number;
  guesses?: Record<string, string>;
}

export function RerandomizationDemo(): JSX.Element {
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const { currentDemoAction } = useAttack();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const [statementIndex, setStatementIndex] = useState(0);
  const [nonce, setNonce] = useState(1);
  const [gameSeed, setGameSeed] = useState(5);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hashState = getHashState();
    const decodedHash = hashState?.demo === 'rerandomization' ? decodeStatePlain<UrlState>(hashState.state) : null;
    const payload = decodedHash ?? decodeState<UrlState>(getSearchParam('rr'));
    if (!payload) return;
    if (typeof payload.statementIndex === 'number') setStatementIndex(Math.max(0, Math.min(2, payload.statementIndex)));
    if (typeof payload.nonce === 'number') setNonce(Math.max(1, payload.nonce));
    if (typeof payload.gameSeed === 'number') setGameSeed(Math.max(1, payload.gameSeed));
    if (payload.guesses && typeof payload.guesses === 'object') setGuesses(payload.guesses);
  }, []);

  const buildShareState = useCallback(() => ({ statementIndex, nonce, gameSeed, guesses }), [gameSeed, guesses, nonce, statementIndex]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'rerandomization') return;
    setSearchParams({ rr: encodeState(buildShareState()) });
  }, [buildShareState]);

  const statements = getStatementCatalog();
  const original = useMemo(() => createOriginalProof(statementIndex), [statementIndex]);
  const rerandomized = useMemo(() => rerandomizeProof(original, nonce), [nonce, original]);
  const changedBytes = useMemo(() => countChangedBytes(original, rerandomized), [original, rerandomized]);
  const matchingGame = useMemo(() => buildMatchingGame(gameSeed), [gameSeed]);
  const score = useMemo(() => scoreMatchingGame(matchingGame, guesses), [guesses, matchingGame]);
  const allGuessed = matchingGame.shuffled.every((card) => guesses[card.id] && guesses[card.id] !== '');

  useAttackActions(currentDemoAction, useMemo(() => ({
    RERANDOMIZE: (payload) => {
      if (payload && typeof payload === 'object') {
        const data = payload as { statementIndex?: unknown; nonce?: unknown; gameSeed?: unknown };
        if (typeof data.statementIndex === 'number' && Number.isFinite(data.statementIndex)) {
          setStatementIndex(Math.max(0, Math.min(2, data.statementIndex)));
        }
        if (typeof data.nonce === 'number' && Number.isFinite(data.nonce)) {
          setNonce(Math.max(1, data.nonce));
        } else {
          setNonce((value) => value + 1);
        }
        if (typeof data.gameSeed === 'number' && Number.isFinite(data.gameSeed)) {
          setGameSeed(Math.max(1, data.gameSeed));
        }
      } else {
        setNonce((value) => value + 1);
      }
      setGuesses({});
      setRevealed(false);
    },
  }), [currentDemoAction]));

  useEffect(() => {
    setEntry('rerandomization', {
      title: 'Rerandomized proof transcript',
      body: `Every component of the proof changes after rerandomization, but the verifier still checks the same public statement. That breaks naive linkability based on proof bytes alone.`,
      nextSteps: ['Rerandomize the same proof again', 'Try the matching game without looking at the statement labels', 'Compare how many bytes changed across commitment, evaluation, and IPA pieces'],
    });
  }, [setEntry]);

  const handleDraw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
    renderRerandomization(
      ctx,
      frame,
      original,
      rerandomized,
      changedBytes,
      matchingGame.shuffled,
      matchingGame.shuffled.map((card) => {
        const guess = guesses[card.id];
        if (!guess) return 'Guess pending';
        const originalProof = matchingGame.originals.find((candidate) => candidate.id === guess);
        return originalProof ? `Guess: ${originalProof.statementLabel}` : 'Guess pending';
      }),
      theme,
      worldMouse.x,
      worldMouse.y,
    );
  }, [camera, changedBytes, guesses, interaction.mouseX, interaction.mouseY, matchingGame, original, rerandomized, theme]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    fitCameraToBounds(camera, canvas, { minX: 20, minY: 20, maxX: 960, maxY: 710 }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the same proof and matching game');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('rr');
    url.hash = `rerandomization|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'rerandomization');
    url.searchParams.set('rr', encodeState(buildShareState()));
    url.hash = '';
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-rerandomization.png', showDownloadToast);
  }, [camera, handleFitToView]);


  const handleAuditJson = useCallback(() => {
    copyToClipboard(JSON.stringify({
      demo: 'rerandomization',
      statement: original.statementLabel,
      statementHash: original.statementHash,
      originalProofHash: original.proofHash,
      rerandomizedProofHash: rerandomized.proofHash,
      changedBytes,
      score,
    }, null, 2));
    showToast('Audit JSON copied');
  }, [changedBytes, original.proofHash, original.statementHash, original.statementLabel, rerandomized.proofHash, score]);

  return (
    <DemoLayout onEmbedFitToView={handleFitToView}>
      <DemoSidebar width="compact">
        <ControlGroup label="Statement" ariaLabel="Statement selection">
          <SelectControl
            label="Public statement"
            value={String(statementIndex)}
            options={statements.map((statement, index) => ({ value: String(index), label: statement.label }))}
            onChange={(value) => setStatementIndex(Number(value))}
          />
          <ButtonControl label="Rerandomize again" onClick={() => setNonce((value) => value + 1)} />
        </ControlGroup>

        <ControlGroup label="Matching Game" ariaLabel="Matching game controls">
          {matchingGame.shuffled.map((card, index) => {
            const guess = guesses[card.id];
            const isCorrect = guess === card.originalId;
            const correctOriginal = matchingGame.originals.find((p) => p.id === card.originalId);
            return (
              <div key={card.id}>
                <SelectControl
                  label={`Rerandomized proof ${index + 1}`}
                  value={guess ?? ''}
                  options={[
                    { value: '', label: 'Choose original proof' },
                    ...matchingGame.originals.map((proof) => ({ value: proof.id, label: proof.statementLabel })),
                  ]}
                  onChange={(value) => { setGuesses((current) => ({ ...current, [card.id]: value })); setRevealed(false); }}
                />
                {revealed && guess && guess !== '' && (
                  <div style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: isCorrect ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {isCorrect ? '\u2713 Correct' : '\u2717 Wrong'}
                    </span>
                    {!isCorrect && correctOriginal && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        \u2014 answer: {correctOriginal.statementLabel.slice(0, 40)}{correctOriginal.statementLabel.length > 40 ? '\u2026' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="control-button-row">
            <ButtonControl label="Shuffle game" onClick={() => { setGameSeed((value) => value + 1); setGuesses({}); setRevealed(false); }} />
            <ButtonControl label="Clear guesses" onClick={() => { setGuesses({}); setRevealed(false); }} variant="secondary" />
          </div>
          {allGuessed && !revealed && (
            <ButtonControl label="Reveal answers" onClick={() => setRevealed(true)} variant="secondary" />
          )}
        </ControlGroup>

        <ShareSaveDropdown
          demoId="rerandomization"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleAuditJson}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={handleDraw} camera={camera} onCanvas={(canvas) => { canvasElRef.current = canvas; }} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:rerandomization" onReset={handleFitToView} />
      </DemoCanvasArea>

      <DemoAside width="narrow">
        <ControlGroup label="Linkability Check" ariaLabel="Linkability check results">
          <ControlCard>
            <div className="control-kicker">Same statement</div>
            <div className="control-value" style={{ color: verifiedSameStatement(original, rerandomized) ? '#22c55e' : '#ef4444' }}>
              {verifiedSameStatement(original, rerandomized) ? 'Verified' : 'Broken'}
            </div>
            <div className="control-caption">{original.statementLabel}</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Bytes changed</div>
            <div className="control-value" style={{ color: '#a78bfa' }}>{changedBytes}</div>
            <div className="control-caption">Across commitment, evaluation, and IPA proof bytes</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Matching score</div>
            <div className="control-value">{score.correct} / {score.total}</div>
            <div className="control-caption">Higher scores mean the rerandomization is still visually linkable</div>
          </ControlCard>
        </ControlGroup>

        <ControlNote>
          The statement hash stays fixed, but every proof component is rerandomized. That is the intuition behind unlinkable proof presentation: verifiers accept the same claim without being able to correlate transcripts by bytes alone.
        </ControlNote>
      </DemoAside>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Proof Rerandomization" />
    </DemoLayout>
  );
}
