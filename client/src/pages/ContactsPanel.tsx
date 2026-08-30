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
  };
}

/**
 * NOTE ON THE SECURITY MODEL: adding a contact stores their unique
 * account id, never their username or display name. If someone later
 * creates a different account with a similar-looking name, it will NOT
 * be treated as known — only the exact original account (by id) is
 * recognized. This is what makes "known" status meaningful even though
 * names, bios, and photos are all just editable text.
 */
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

    // Look up by username first (friendlier), falling back to treating
    // the input as a raw user id.
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
      setStatusMessage("No user found with that username or id.");
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
    setStatusMessage("Contact added.");
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
    <div className="contacts-panel">
      <h3>Known Contacts</h3>
      <form onSubmit={handleAdd} className="add-contact-form">
        <input
          type="text"
          placeholder="Enter their @username to add as known"
          value={lookupInput}
          onChange={(e) => setLookupInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      {statusMessage && <p className="contact-status">{statusMessage}</p>}

      {contacts.length === 0 ? (
        <p className="empty-state">No known contacts yet.</p>
      ) : (
        <ul className="user-list">
          {contacts.map((contact) => (
            <li key={contact.id} className="user-list-item">
              <span className="user-name">{contact.displayName}</span>
              <span className="user-status">@{contact.username}</span>
              <button onClick={() => handleRemove(contact.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
