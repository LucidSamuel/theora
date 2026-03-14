import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { ControlGroup, SelectControl, SliderControl, ButtonControl } from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { derivePublicKey, forgePredictableProof, simulateProof, simulateStatement, type FiatShamirMode } from './logic';
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
  const statement = simulateStatement(secret);

  const proof = useMemo(
    () => simulateProof(mode, statement, secret, nonce, verifierSeed),
    [mode, nonce, secret, statement, verifierSeed]
  );
  const forged = useMemo(() => forgePredictableProof(statement, derivePublicKey(secret), mode), [mode, secret, statement]);

  useEffect(() => {
    setEntry('fiat-shamir', {
      title: 'Transcript binding',
      body: mode === 'fs-broken'
        ? `Broken mode omits the commitment from the hash, so the challenge ${proof.challenge} is predictable and a forged transcript can verify.`
        : `Mode ${mode} binds the challenge to ${mode === 'interactive' ? 'verifier randomness' : 'the full transcript'}, preventing the forged proof path.`,
      nextSteps: ['Switch to broken mode', 'Change the nonce', 'Compare the forged proof banner'],
    });
  }, [mode, proof.challenge, setEntry]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderFiatShamir(ctx, frame, proof, forged, mode, theme);
  }, [forged, mode, proof, theme]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="w-[320px] shrink-0 overflow-y-auto demo-sidebar">
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
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Public key y = {derivePublicKey(secret)}, statement = {statement}
          </div>
        </ControlGroup>

        <ControlGroup label="Forgery">
          <ButtonControl label="Jump To Broken Mode" onClick={() => setMode('fs-broken')} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            In broken mode, the prover can predict the challenge before choosing the commitment and back-solve a convincing transcript.
          </div>
          {forged && (
            <div className="rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--surface-element)' }}>
              forged `(t, c, z)` = ({forged.commitment}, {forged.challenge}, {forged.response})
            </div>
          )}
        </ControlGroup>
      </div>

      <div className="flex-1 relative min-w-0 overflow-hidden demo-canvas-area">
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:fiat-shamir" />
      </div>
    </div>
  );
}
