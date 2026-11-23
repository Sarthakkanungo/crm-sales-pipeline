import { useToastStore } from "./toastStore";

export function Toasts() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <section className="toast-region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <p>{toast.message}</p>

          <div className="toast-actions">
            {toast.actions.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={() => {
                  dismiss(toast.id);
                  action.run();
                }}
              >
                {action.label}
              </button>
            ))}

            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
