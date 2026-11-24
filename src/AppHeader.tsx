import { SimulationSummary } from "./features/deals/components/SimulationPanel";
import { getPermissions, ROLE_LABELS } from "./features/session/permissions";
import { useSession } from "./features/session/sessionStore";
import { getInitials } from "./shared/format";

interface AppHeaderProps {
  isSimOpen: boolean;
  onToggleSim: () => void;
  onOpenHelp: () => void;
}

export function AppHeader({ isSimOpen, onToggleSim, onOpenHelp }: AppHeaderProps) {
  const session = useSession();
  const permissions = getPermissions(session);

  return (
    <header className="top-header">
      <div className="brand">
        <div className="brand-logo">S</div>
        <div>
          <h1>Sales Pipeline</h1>
          <span>{permissions.canViewTeam ? "Team pipeline" : "My pipeline"}</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="sim-toggle"
          aria-expanded={isSimOpen}
          onClick={onToggleSim}
        >
          Simulator <SimulationSummary />
        </button>

        <button type="button" className="shortcut-button" onClick={onOpenHelp}>
          Keyboard shortcuts <kbd>?</kbd>
        </button>

        <div className="user-profile">
          <div className="user-avatar">{getInitials(session.userName)}</div>
          <div className="user-info">
            <strong>{session.userName}</strong>
            <span>{ROLE_LABELS[session.role]}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
