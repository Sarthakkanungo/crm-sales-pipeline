import { formatCount } from "../../../shared/format";
import { useDealStore } from "../store/dealStore";

interface LiveChangesPillProps {
  onRefresh: () => void;
}

export function LiveChangesPill({ onRefresh }: LiveChangesPillProps) {
  const backgroundChanges = useDealStore((state) => state.backgroundChanges);
  const staleRows = useDealStore(
    (state) => Object.values(state.liveMarks).filter((mark) => !mark.matchesView).length
  );
  const pending = backgroundChanges + staleRows;

  if (pending === 0) {
    return null;
  }

  return (
    <div className="live-pill" role="status">
      Teammates changed {formatCount(pending)} deal{pending === 1 ? "" : "s"} that affect
      this view. Rows stay where they are until you refresh.
      <button type="button" className="link-button" onClick={onRefresh}>
        Refresh view
      </button>
    </div>
  );
}
