import { useCallback, useEffect, useMemo, useState } from "react";
import "./DirectAssignmentAdmin.css";
import { supabase } from "./supabase";
import {
  assignPlayerDirectly,
  loadDirectAssignmentData,
  removeDirectAssignment,
  type AuctionDivision,
  type DirectAssignmentRecord,
} from "./directAssignmentDatabase";

function DirectAssignmentAdmin() {
  const [division, setDivision] = useState<AuctionDivision>("MEN");
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<DirectAssignmentRecord[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const data = await loadDirectAssignmentData(division);
      setPlayers(data.players);
      setTeams(data.teams);
      setAssignments(data.assignments);
      setErrorMessage("");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load direct assignments.");
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => {
    void refresh(true);
    const channel = supabase
      .channel(`direct-assign-${division}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: `division=eq.${division}` }, () => void refresh(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_players", filter: `division=eq.${division}` }, () => void refresh(false))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [division, refresh]);

  const player = useMemo(() => players.find((p) => String(p.id) === playerId) ?? null, [players, playerId]);
  const team = useMemo(() => teams.find((t) => String(t.id) === teamId) ?? null, [teams, teamId]);
  const value = Number(amount);
  const validValue = Number.isFinite(value) && value > 0;
  const after = team && validValue ? team.remaining - value : team?.remaining ?? null;

  const assign = async () => {
    if (!player || !team || !validValue) {
      setErrorMessage("Select a player, a team, and enter a valid amount.");
      return;
    }
    if (value > team.remaining) {
      setErrorMessage(`${team.name} only has ₹${team.remaining.toFixed(2)} Cr available.`);
      return;
    }
    if (!window.confirm(`Assign ${player.name} to ${team.name} for ₹${value.toFixed(2)} Cr?\n\nThe amount will be deducted from the team's CAP.`)) return;

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");
      await assignPlayerDirectly({ playerId: player.id, teamId: team.id, amount: value, division });
      setPlayerId("");
      setTeamId("");
      setAmount("");
      await refresh(false);
      setMessage(`${player.name} assigned to ${team.name}. ₹${value.toFixed(2)} Cr deducted.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to assign player.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assignment: DirectAssignmentRecord) => {
    if (!window.confirm(`Remove ${assignment.playerName} from ${assignment.teamName}?\n\n₹${assignment.amount.toFixed(2)} Cr will be refunded to the team's CAP.`)) return;
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");
      await removeDirectAssignment({ playerId: assignment.playerId, division });
      await refresh(false);
      setMessage(`${assignment.playerName} removed. CAP refunded by ₹${assignment.amount.toFixed(2)} Cr.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove assignment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="direct-loading">Loading Direct Assignment...</div>;

  return (
    <div className="direct-page">
      <header className="direct-header">
        <div>
          <p className="direct-kicker">AUCTION ADMIN</p>
          <h1>Direct Player Assignment</h1>
          <p>Assign retained/pre-selected players directly to teams. Their assigned value is deducted from the team CAP immediately.</p>
        </div>
        <div className="direct-division">
          <button className={division === "MEN" ? "active" : ""} onClick={() => setDivision("MEN")}>MEN</button>
          <button className={division === "WOMEN" ? "active" : ""} onClick={() => setDivision("WOMEN")}>WOMEN</button>
        </div>
      </header>

      {(message || errorMessage) && <div className={errorMessage ? "direct-message error" : "direct-message"}>{errorMessage || message}</div>}

      <section className="direct-cap-grid">
        {teams.map((t) => (
          <article className="direct-cap-card" key={t.id}>
            <span>{t.shortName}</span><strong>{t.name}</strong>
            <div><small>STARTING CAP</small><b>₹{t.startingPurse.toFixed(2)} Cr</b></div>
            <div><small>SPENT</small><b>₹{t.spent.toFixed(2)} Cr</b></div>
            <div className="remaining"><small>AVAILABLE CAP</small><b>₹{t.remaining.toFixed(2)} Cr</b></div>
          </article>
        ))}
      </section>

      <main className="direct-layout">
        <section className="direct-card">
          <p className="direct-kicker">ASSIGN PLAYER</p>
          <h2>Add Direct Assignment</h2>

          <div className="direct-form-grid">
            <div><label>PLAYER</label><select value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="">Select player</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name} • {p.role}</option>)}</select></div>
            <div><label>TEAM</label><select value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Select team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name} • ₹{t.remaining.toFixed(2)} Cr available</option>)}</select></div>
            <div><label>ASSIGNMENT VALUE (CR)</label><input type="number" min="0" step="0.05" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3.50" /></div>
          </div>

          <div className="direct-preview">
            <div><span>PLAYER</span><strong>{player?.name ?? "—"}</strong></div>
            <div><span>TEAM</span><strong>{team?.name ?? "—"}</strong></div>
            <div><span>COST</span><strong>{validValue ? `₹${value.toFixed(2)} Cr` : "—"}</strong></div>
            <div className={after !== null && after < 0 ? "negative" : ""}><span>CAP AFTER</span><strong>{after !== null ? `₹${after.toFixed(2)} Cr` : "—"}</strong></div>
          </div>

          <button className="direct-assign" disabled={saving || !player || !team || !validValue || (after !== null && after < 0)} onClick={() => void assign()}>{saving ? "ASSIGNING..." : "ASSIGN PLAYER & DEDUCT CAP"}</button>
          <p className="direct-note">Directly assigned players are removed from the live auction queue but remain in the team's squad.</p>
        </section>

        <section className="direct-card">
          <div className="direct-list-heading"><div><p className="direct-kicker">PRE-ASSIGNED</p><h2>Current Assignments</h2></div><strong>{assignments.length}</strong></div>
          {assignments.length === 0 ? <div className="direct-empty">No direct assignments yet.</div> : <div className="direct-list">
            {assignments.map((a) => <article className="direct-row" key={a.playerId}>
              <div><span>PLAYER</span><strong>{a.playerName}</strong></div>
              <div><span>TEAM</span><strong>{a.teamName}</strong></div>
              <div><span>CAP DEDUCTED</span><strong className="money">₹{a.amount.toFixed(2)} Cr</strong></div>
              <button disabled={saving} onClick={() => void remove(a)}>REMOVE / REFUND</button>
            </article>)}
          </div>}
        </section>
      </main>
    </div>
  );
}

export default DirectAssignmentAdmin;
