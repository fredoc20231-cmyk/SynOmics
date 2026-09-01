import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./a11y";
import { adminAction, adminPending, adminUsers, type PublicUser } from "./api";
import { RuntimeIdentityPanel } from "./RuntimeIdentityPanel";

type AdminTab = "pending" | "users" | "runtime";

export function AdminPanel({
  onClose,
  mode,
  thinking,
}: {
  onClose: () => void;
  mode?: string;
  thinking?: string;
}) {
  const [tab, setTab] = useState<AdminTab>("pending");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true, onClose);

  async function load() {
    setError("");
    try {
      const res = tab === "pending" ? await adminPending() : await adminUsers();
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    }
  }

  useEffect(() => {
    void load();
  }, [tab]);

  async function run(userId: string, action: string) {
    setError("");
    try {
      await adminAction(userId, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  const pendingOnly = tab === "pending";

  return (
    <div className="slide-panel" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="slide-panel-card glass-panel"
        style={{ width: "min(1100px, 100%)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-panel-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="admin-panel-title" className="font-serif text-[20px]">Admin</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="screen-tabs mb-4" role="tablist">
          <button type="button" className={`screen-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
            Pending Approvals
          </button>
          <button type="button" className={`screen-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
            Users
          </button>
          <button type="button" className={`screen-tab ${tab === "runtime" ? "active" : ""}`} onClick={() => setTab("runtime")}>
            Runtime
          </button>
        </div>
        {error && <p className="auth-error mb-2">{error}</p>}
        {tab === "runtime" ? (
          <RuntimeIdentityPanel mode={mode} thinking={thinking} />
        ) : (
        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-[var(--muted-foreground)]">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Organization</th>
                <th className="p-2">Role</th>
                <th className="p-2">Status</th>
                <th className="p-2">Registration date</th>
                <th className="p-2">Profile</th>
                <th className="p-2">Intended use</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td className="p-2 text-[var(--muted-foreground)]" colSpan={9}>
                    No accounts in this view.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--border-main)] align-top">
                    <td className="p-2">{user.name || user.profile.display_name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.organization || user.profile.organization}</td>
                    <td className="p-2">{user.role}</td>
                    <td className="p-2">{user.status}</td>
                    <td className="p-2">{user.created_at || ""}</td>
                    <td className="p-2">{[user.profile.title, user.profile.specialty].filter(Boolean).join(" / ")}</td>
                    <td className="p-2">{user.intended_use || user.profile.intended_use}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button className="black-btn !h-8" type="button" onClick={() => void run(user.id, "approve")}>
                          Approve
                        </button>
                        <button className="deny-btn !h-8" type="button" onClick={() => void run(user.id, "reject")}>
                          Reject
                        </button>
                        {!pendingOnly && (
                          <>
                            <button className="ghost-btn" type="button" onClick={() => void run(user.id, "activate")}>
                              Activate
                            </button>
                            <button className="ghost-btn" type="button" onClick={() => void run(user.id, "suspend")}>
                              Suspend
                            </button>
                            <button className="ghost-btn" type="button" onClick={() => void run(user.id, "promote")}>
                              Promote to Admin
                            </button>
                            <button className="ghost-btn" type="button" onClick={() => void run(user.id, "demote")}>
                              Demote to User
                            </button>
                            <button className="ghost-btn" type="button" onClick={() => void run(user.id, "revoke_sessions")}>
                              Revoke Sessions
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
