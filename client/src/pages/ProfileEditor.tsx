import { FormEvent, useState } from "react";
import { PublicUserProfile } from "../types/profile";
import { supabase } from "../services/supabaseClient";

interface ProfileEditorProps {
  user: PublicUserProfile;
  onUpdated: () => void;
  onClose: () => void;
}

export function ProfileEditor({ user, onUpdated, onClose }: ProfileEditorProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [country, setCountry] = useState(user.country ?? "");
  const [age, setAge] = useState(user.age?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        country: country.trim() || null,
        age: age ? Number(age) : null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    onUpdated();
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Profile</h2>
        {errorMessage && <div className="error-banner"><span>{errorMessage}</span></div>}
        <form onSubmit={handleSave} className="auth-form">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <label>Bio</label>
          <input value={bio} onChange={(e) => setBio(e.target.value)} />
          <label>Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
          <label>Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <div className="modal-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
        <p className="username-note">
          Username: <strong>@{user.username}</strong> (permanent, cannot be changed)
        </p>
      </div>
    </div>
  );
}
