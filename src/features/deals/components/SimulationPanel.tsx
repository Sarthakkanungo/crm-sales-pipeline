import { useEffect, useId, useRef } from "react";
import { useStore } from "zustand";
import { ROLE_LABELS, type Role } from "../../session/permissions";
import { setRole, useSession } from "../../session/sessionStore";
import { simulateEditOnVisibleDeal } from "../actions/simulationActions";
import {
  DEFAULT_SIM_CONFIG,
  simConfigStore,
  updateSimConfig,
} from "../services/simConfig";

interface SimulationPanelProps {
  onClose: () => void;
}

function toNumber(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function SimulationSummary() {
  const config = useStore(simConfigStore);

  return (
    <span className="sim-summary">
      {config.minDelayMs}–{config.maxDelayMs} ms · {Math.round(config.failureRate * 100)}%
      fail · {config.teammateEditsPerMinute}/min
    </span>
  );
}

export function SimulationPanel({ onClose }: SimulationPanelProps) {
  const config = useStore(simConfigStore);
  const session = useSession();
  const failurePercent = Math.round(config.failureRate * 100);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (panelRef.current?.contains(target) || target.closest(".sim-toggle")) {
        return;
      }

      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      className="sim-popover"
      role="region"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="sim-popover-header">
        <div>
          <h2 id={titleId}>Simulator</h2>
          <p>Test controls for the fake server. Changes apply to the very next request.</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="close-button"
          aria-label="Close simulator"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="sim-field">
        <span className="sim-field-title">Signed in as</span>
        <div className="segmented" role="group" aria-label="Signed in as">
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
            <button
              key={role}
              type="button"
              aria-pressed={session.role === role}
              onClick={() => setRole(role)}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <p className="sim-help">
          Login is out of scope, so switch roles here. A representative sees and
          changes only their own deals. A manager sees the whole team. The fake
          server enforces this too, not just the screen.
        </p>
      </div>

      <div className="sim-field">
        <span className="sim-field-title">Network delay</span>
        <div className="sim-delay-inputs">
          <label>
            <span>Min (ms)</span>
            <input
              type="number"
              min={0}
              step={100}
              value={config.minDelayMs}
              onChange={(event) =>
                updateSimConfig({ minDelayMs: toNumber(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Max (ms)</span>
            <input
              type="number"
              min={0}
              step={100}
              value={config.maxDelayMs}
              onChange={(event) =>
                updateSimConfig({ maxDelayMs: toNumber(event.target.value) })
              }
            />
          </label>
        </div>
        <p className="sim-help">
          Every load and save waits a random time in this range. Raise Min to 3000
          to have time to create a conflict.
        </p>
      </div>

      <label className="sim-field">
        <span className="sim-field-title">Failed saves: {failurePercent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={failurePercent}
          onChange={(event) =>
            updateSimConfig({ failureRate: toNumber(event.target.value) / 100 })
          }
        />
        <span className="sim-help">
          Chance that a save fails. Set 100% to see rollback, "Not saved" and Retry.
        </span>
      </label>

      <label className="sim-field">
        <span className="sim-field-title">
          Teammate edits per minute: {config.teammateEditsPerMinute}
        </span>
        <input
          type="range"
          min={0}
          max={120}
          value={config.teammateEditsPerMinute}
          onChange={(event) =>
            updateSimConfig({ teammateEditsPerMinute: toNumber(event.target.value) })
          }
        />
        <span className="sim-help">
          Teammates move random deals, mostly ones on your screen. Rows flash and stay
          in place. 0 turns this off.
        </span>
      </label>

      <div className="sim-actions">
        <button type="button" onClick={simulateEditOnVisibleDeal}>
          Teammate edits a deal on screen
        </button>
        <button type="button" onClick={() => updateSimConfig(DEFAULT_SIM_CONFIG)}>
          Reset to brief defaults
        </button>
      </div>

      <p className="sim-help sim-tip">
        To test a conflict: open a deal, choose a new stage and press Move, then press
        "Simulate a teammate edit" in the deal panel before the save finishes.
      </p>
    </section>
  );
}
