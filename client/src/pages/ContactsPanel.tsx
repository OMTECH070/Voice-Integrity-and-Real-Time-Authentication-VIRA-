import { FormEvent, useEffect, useState } from "react";
import { PublicUserProfile } from "../types/profile";
import { supabase } from "../services/supabaseClient";

interface ContactsPanelProps {
  ownUserId: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  age: number | null;
  country: string | null;
  avatar_url: string | null;
  created_at: string;
}

function rowToProfile(row: ProfileRow): PublicUserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    age: row.age,
    country: row.country,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at).getTime(),
    role: "user",
  };
}

export function ContactsPanel({ ownUserId }: ContactsPanelProps) {
  const [contacts, setContacts] = useState<PublicUserProfile[]>([]);
  const [lookupInput, setLookupInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadContacts() {
    const { data: contactRows, error } = await supabase
      .from("contacts")
      .select("contact_user_id")
      .eq("owner_id", ownUserId);

    if (error || !contactRows || contactRows.length === 0) {
      setContacts([]);
      return;
    }

    const ids = contactRows.map((row) => row.contact_user_id);
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    setContacts((profileRows ?? []).map((row) => rowToProfile(row as ProfileRow)));
  }

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownUserId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    const trimmed = lookupInput.trim();
    if (!trimmed) return;

    const byUsername = await supabase
      .from("profiles")
      .select("*")
      .eq("username", trimmed.toLowerCase())
      .maybeSingle();

    let targetRow: ProfileRow | null = (byUsername.data as ProfileRow) ?? null;

    if (!targetRow) {
      const byId = await supabase.from("profiles").select("*").eq("id", trimmed).maybeSingle();
      targetRow = (byId.data as ProfileRow) ?? null;
    }

    if (!targetRow) {
      setStatusMessage("No user found with that username or ID.");
      return;
    }

    if (targetRow.id === ownUserId) {
      setStatusMessage("You cannot add yourself.");
      return;
    }

    const { error: insertError } = await supabase
      .from("contacts")
      .insert({ owner_id: ownUserId, contact_user_id: targetRow.id });

    if (insertError) {
      setStatusMessage(
        insertError.code === "23505" ? "Already in your contacts." : insertError.message
      );
      return;
    }

    setLookupInput("");
    setStatusMessage("Contact added successfully.");
    loadContacts();
  }

  async function handleRemove(contactUserId: string) {
    await supabase
      .from("contacts")
      .delete()
      .eq("owner_id", ownUserId)
      .eq("contact_user_id", contactUserId);
    setContacts((prev) => prev.filter((c) => c.id !== contactUserId));
  }

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter @username or user ID..."
          value={lookupInput}
          onChange={(e) => setLookupInput(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "13px" }}
        />
        <button type="submit" className="btn-black">
          Add Contact
        </button>
      </form>
      {statusMessage && (
        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          {statusMessage}
        </p>
      )}

      {contacts.length === 0 ? (
        <p className="empty-list-notice">No contacts added yet.</p>
      ) : (
        <ul className="people-list-minimal">
          {contacts.map((contact) => (
            <li key={contact.id} className="person-row-minimal">
              <div className="person-left-meta">
                <div className="person-avatar-minimal">
                  <span>{(contact.displayName || contact.username || "U").charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="person-name-text">{contact.displayName}</div>
                  <div className="person-handle-text">@{contact.username}</div>
                </div>
              </div>
              <button
                onClick={() => handleRemove(contact.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-danger)",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
