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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className="modal" style={{ maxWidth: "440px" }}>
        <div className="info-modal-header">
          <div className="info-modal-title-group">
            <h2 id="edit-profile-title">Account Profile</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close profile modal">
            &times;
          </button>
        </div>

        {errorMessage && (
          <div className="error-banner">
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="auth-form">
          <div>
            <label htmlFor="profile-display-name">Display Name</label>
            <input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              required
            />
          </div>

          <div>
            <label htmlFor="profile-bio">Bio</label>
            <input
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio or status"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="profile-country">Country</label>
              <input
                id="profile-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. US, IN, DE"
              />
            </div>
            <div>
              <label htmlFor="profile-age">Age</label>
              <input
                id="profile-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age"
                min="1"
                max="120"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-black" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: "20px",
            padding: "10px 12px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          Unique Handle: <strong style={{ color: "var(--color-black)" }}>@{user.username}</strong>
        </div>
      </div>
    </div>
  );
}
