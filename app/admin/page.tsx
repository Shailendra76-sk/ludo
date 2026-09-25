"use client";

import { useEffect, useState } from "react";
import type { AdminGameRow, AdminUserRow, AdminDashboardStats } from "@/lib/types";

type Setting = { key: string; value: Record<string, unknown> };
type Report = {
  id: number;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter_username: string;
  target_username: string | null;
  room_id: string | null;
  game_id: string | null;
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [games, setGames] = useState<AdminGameRow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const endpoints = [
      "/api/admin/dashboard",
      "/api/admin/users",
      "/api/admin/games",
      "/api/admin/reports",
      "/api/admin/settings",
    ];

    const data = await Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Access denied.");
        return body;
      }),
    );

    setStats(data[0] as AdminDashboardStats);
    setUsers((data[1].users ?? []) as AdminUserRow[]);
    setGames((data[2].games ?? []) as AdminGameRow[]);
    setReports((data[3].reports ?? []) as Report[]);
    setSettings((data[4].settings ?? []) as Setting[]);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load admin panel."));
  }, []);

  async function action(userId: string, body: Record<string, unknown>) {
    const response = await fetch("/api/admin/users/" + userId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Action failed.");
    await load();
  }

  async function reportAction(reportId: number, status: string) {
    const response = await fetch("/api/admin/reports/" + reportId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Action failed.");
    await load();
  }

  async function saveSetting(key: string, value: Record<string, unknown>) {
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Setting update failed.");
    await load();
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-white">
        <div className="rounded-3xl bg-red-400/10 p-6">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6">
          <p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">
            Ludo Play • Admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Control Center</h1>
        </header>

        {stats && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/[.05] p-4">
                <div className="text-xs text-slate-400">{key}</div>
                <div className="mt-1 text-2xl font-black">{String(value)}</div>
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
            <h2 className="text-xl font-black">Players</h2>
            <div className="mt-3 space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/20 p-3">
                  <div>
                    <b>{user.username}</b>
                    <div className="text-xs text-slate-400">
                      {user.email} · {user.gamesPlayed} games · rating {user.rating} · {user.role}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.role === "player" && (
                      <button
                        onClick={() => action(user.id, { action: "role", role: "admin" }).catch((e) => setError(e.message))}
                        className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs text-sky-200"
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      onClick={() => action(user.id, { action: "suspend" }).catch((e) => setError(e.message))}
                      className="rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-200"
                    >
                      Revoke sessions
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
            <h2 className="text-xl font-black">Games</h2>
            <div className="mt-3 space-y-2">
              {games.map((game) => (
                <div key={game.id} className="rounded-2xl bg-black/20 p-3">
                  <div className="font-bold">{game.id}</div>
                  <div className="text-xs text-slate-400">
                    {game.status} · {game.playerCount}P · {game.mode} · v{game.stateVersion} ·{" "}
                    {new Date(game.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
          <h2 className="text-xl font-black">Settings</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {settings.map((setting) => (
              <div key={setting.key} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <b>{setting.key}</b>
                  <button
                    onClick={() => {
                      const next =
                        setting.key === "game"
                          ? {
                              ...setting.value,
                              turnTimeSeconds:
                                Number(setting.value.turnTimeSeconds ?? 15) === 15 ? 30 : 15,
                            }
                          : {
                              ...setting.value,
                              welcomeMessage:
                                String(setting.value.welcomeMessage ?? "Welcome to Ludo Play") ===
                                "Welcome to Ludo Play"
                                  ? "Welcome to Ludo Play!"
                                  : "Welcome to Ludo Play",
                            };
                      saveSetting(setting.key, next).catch((e) => setError(e.message));
                    }}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >
                    Update
                  </button>
                </div>
                <pre className="mt-2 overflow-x-auto text-xs text-slate-400">
                  {JSON.stringify(setting.value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
          <h2 className="text-xl font-black">Reports</h2>
          <div className="mt-3 space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="rounded-2xl bg-black/20 p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <b>#{report.id} · {report.reason}</b>
                  <span className="text-xs text-slate-400">{report.status}</span>
                </div>
                <div className="mt-1 text-sm text-slate-300">{report.details}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => reportAction(report.id, "reviewing").catch((e) => setError(e.message))} className="rounded-lg bg-white/10 px-3 py-2 text-xs">
                    Review
                  </button>
                  <button onClick={() => reportAction(report.id, "resolved").catch((e) => setError(e.message))} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                    Resolve
                  </button>
                  <button onClick={() => reportAction(report.id, "dismissed").catch((e) => setError(e.message))} className="rounded-lg bg-white/10 px-3 py-2 text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
