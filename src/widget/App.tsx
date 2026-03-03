import { useCallback, useEffect, useState } from 'react';
import { createDetailsWidget } from '@livechat/agent-app-sdk';
import type { IDetailsWidget } from '@livechat/agent-app-sdk';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** True if value is known and should be displayed */
const hasKnownValue = (v: unknown): boolean =>
  v != null && String(v).trim() !== '';

/** Contact properties to display when selected, in order */
const CONTACT_PROPERTY_DISPLAY: Array<[string, string]> = [
  ['customer_first_name', 'Customer First Name'],
  ['customer_last_name', 'Customer Last Name'],
  ['firstname', 'First Name'],
  ['lastname', 'Last Name'],
  ['email', 'Email'],
  ['bd_client', 'BD Client'],
  ['ia_client', 'IA Client'],
  ['date_of_birth', 'Date of birth'],
  ['security_question_1', 'Security Question 1'],
  ['security_answer_1', 'Security Answer 1'],
  ['security_question_2', 'Security Question 2'],
  ['security_answer_2', 'Security Answer 2'],
  ['total_assets', 'Total assets'],
  ['future_opportunity', 'Future Opportunity'],
  ['future_opportunity_notes', 'Future opportunity notes'],
  ['addepar_contact_link', 'Addepar Contact Link'],
];

/** Mock widget for standalone/dev mode when not running inside LiveChat */
function createMockWidget(): IDetailsWidget {
  return {
    getCustomerProfile: () => ({ id: 'dev-customer-id', name: 'Dev User', email: 'dev@example.com' }),
    putMessage: () => Promise.resolve(),
    sendMessage: () => Promise.resolve(),
    on: () => {},
    off: () => {},
    modifySection: () => Promise.resolve(),
  } as unknown as IDetailsWidget;
}

/**
 * HubSpot Contact Lookup Widget
 *
 * - Search contacts by name
 * - Display name, email, and configurable properties
 * - On select: update the visitor's name and email in LiveChat (customer properties) via update_customer API
 */
const THEME_KEY = 'hubspot-lookup-theme';

function App() {
  const [widget, setWidget] = useState<IDetailsWidget | null>(null);
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.body.dataset.theme = darkMode ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    } catch { /* ignore */ }
  }, [darkMode]);

  useEffect(() => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Standalone mode')), 2000)
    );

    Promise.race([createDetailsWidget(), timeout])
      .then((w) => {
        setWidget(w);
        setStandalone(false);
        setReady(true);
      })
      .catch(() => {
        console.warn('LiveChat SDK unavailable — running in standalone/dev mode');
        setWidget(createMockWidget());
        setStandalone(true);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-content">
            <h2>HubSpot Contact Lookup</h2>
          </div>
          <label className="theme-toggle" title={darkMode ? 'Dark mode' : 'Light mode'}>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              aria-label="Toggle dark mode"
            />
            <span className="theme-slider" />
          </label>
        </header>
        <div className="loading">Connecting to LiveChat...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h2>HubSpot Contact Lookup</h2>
          <p className="subtitle">
            {standalone ? 'Dev mode — install in LiveChat to use with real chats' : 'Search and insert contact details'}
          </p>
        </div>
        <label className="theme-toggle" title={darkMode ? 'Dark mode' : 'Light mode'}>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
            aria-label="Toggle dark mode"
          />
          <span className="theme-slider" />
        </label>
      </header>
      <main className="main">
        {widget && (
          <ContactLookup widget={widget} />
        )}
      </main>
    </div>
  );
}

interface ContactLookupProps {
  widget: IDetailsWidget;
}

interface HubSpotContact {
  id?: string;
  name: string;
  email: string;
  properties: Record<string, string | number | undefined>;
}

interface HubSpotNote {
  id: string;
  body: string;
  timestamp: string;
  pinned?: boolean;
}

interface CustomerProfile {
  id: string;
  name?: string;
  email?: string;
}

/** Cache HubSpot contact by customer ID for persistence when switching chats */
const contactCache = new Map<string, HubSpotContact>();

function ContactLookup({ widget }: ContactLookupProps) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<HubSpotContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<HubSpotContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerContact, setCustomerContact] = useState<HubSpotContact | null>(null);
  const [customerContactLoading, setCustomerContactLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [notes, setNotes] = useState<{ pinned: HubSpotNote | null; recent: HubSpotNote[] } | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const customerId = customerProfile?.id ?? null;

  // Get current chat's customer profile
  useEffect(() => {
    const profile = widget.getCustomerProfile() as CustomerProfile | undefined;
    setCustomerProfile(profile ? { id: profile.id, name: profile.name, email: profile.email } : null);

    const handler = () => {
      const p = widget.getCustomerProfile() as CustomerProfile | undefined;
      setCustomerProfile(p ? { id: p.id, name: p.name, email: p.email } : null);
    };
    widget.on('customer_profile', handler);
    return () => widget.off('customer_profile', handler);
  }, [widget]);

  // Reset search/contact state when switching to a different chat (but keep cached contact)
  useEffect(() => {
    setQuery('');
    setContacts([]);
    setSelectedContact(null);
    setError(null);
    setUpdateSuccess(false);
    // Restore from cache if we have it for this customer
    if (customerId) {
      const cached = contactCache.get(customerId);
      setCustomerContact(cached ?? null);
    } else {
      setCustomerContact(null);
    }
  }, [customerId]);

  // Auto-fetch HubSpot contact when customer has email (cache for persistence)
  useEffect(() => {
    const email = customerProfile?.email?.trim();
    const cid = customerId;
    if (!email || !cid) {
      if (!cid) setCustomerContact(null);
      return;
    }
    const cached = contactCache.get(cid);
    if (cached) {
      setCustomerContact(cached);
      setCustomerContactLoading(false);
      return;
    }
    let cancelled = false;
    setCustomerContactLoading(true);
    setCustomerContact(null);
    fetch(`${API_BASE}/api/hubspot-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: email }),
    })
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;
        let data: { results?: HubSpotContact[] } = {};
        try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
        const results = data.results || [];
        const match = results.find((r) => r.email?.toLowerCase() === email.toLowerCase()) ?? results[0];
        if (match) {
          contactCache.set(cid, match);
          setCustomerContact(match);
        } else {
          setCustomerContact(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerContact(null);
      })
      .finally(() => {
        if (!cancelled) setCustomerContactLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerId, customerProfile?.email]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/hubspot-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query.trim() }),
      });
      const text = await res.text();
      let data: { results?: unknown[]; message?: string; error?: string } = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }
      if (!res.ok) {
        throw new Error(data.message || data.error || text || 'Search failed');
      }
      setContacts((data.results as HubSpotContact[]) || []);
      setSelectedContact(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Connect HubSpot (see CONFIGURE_HUBSPOT.md).');
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Auto-search when user types 4+ characters (debounced), then on each additional character
  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) {
      setContacts([]);
      return;
    }
    const t = setTimeout(() => handleSearch(), 300);
    return () => clearTimeout(t);
  }, [query, handleSearch]);

  const handleSelectContact = (contact: HubSpotContact) => {
    setSelectedContact(contact);
    setError(null);
  };

  const handleUpdateVisitor = async () => {
    if (!selectedContact) return;
    const currentProfile = widget.getCustomerProfile() as CustomerProfile | undefined;
    const targetCustomerId = currentProfile?.id;
    if (!targetCustomerId) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/livechat/update-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: targetCustomerId,
          name: selectedContact.name,
          email: selectedContact.email,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let data: { message?: string; error?: string } = {};
        try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }
        throw new Error(data.message || data.error || text || 'Failed to update customer');
      }
      setUpdateSuccess(true);
      setError(null);
      setCustomerProfile((prev) =>
        prev ? { ...prev, name: selectedContact.name, email: selectedContact.email } : null
      );
      contactCache.set(targetCustomerId, selectedContact);
      setCustomerContact(selectedContact);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update customer.');
    } finally {
      setUpdating(false);
    }
  };

  const handleBackToList = () => {
    setSelectedContact(null);
    setNotes(null);
    setError(null);
  };

  // Fetch notes when viewing a contact with HubSpot id
  useEffect(() => {
    const contactId = selectedContact?.id;
    if (!contactId) {
      setNotes(null);
      return;
    }
    let cancelled = false;
    setNotesLoading(true);
    setNotes(null);
    const pinnedVal = selectedContact?.properties?.hs_pinned_engagement_id;
    const pinnedId = pinnedVal != null ? String(pinnedVal).trim() || undefined : undefined;
    fetch(`${API_BASE}/api/hubspot-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, pinnedNoteId: pinnedId || undefined }),
    })
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;
        let data: { pinned?: HubSpotNote | null; recent?: HubSpotNote[] } = {};
        try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
        setNotes({ pinned: data.pinned ?? null, recent: data.recent ?? [] });
      })
      .catch(() => {
        if (!cancelled) setNotes({ pinned: null, recent: [] });
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedContact?.id]);

  if (selectedContact) {
    const props = selectedContact.properties || {};
    const displayProps = CONTACT_PROPERTY_DISPLAY.filter(
      ([key]) => hasKnownValue(props[key])
    );

    return (
      <div className="contact-lookup">
        <button type="button" className="back-button" onClick={handleBackToList}>
          ← Back to list
        </button>
        <div className="contact-detail">
          <h3 className="contact-detail-name">{selectedContact.name}</h3>
          {selectedContact.email && (
            <p className="contact-detail-email">{selectedContact.email}</p>
          )}
          {customerId && (
            <>
              <button
                type="button"
                className="update-button"
                onClick={handleUpdateVisitor}
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Update visitor in LiveChat'}
              </button>
              {updateSuccess && (
                <p className="update-success">Updated! Customer details have been saved.</p>
              )}
            </>
          )}
          <div className="contact-properties">
            {displayProps.map(([key, label]) => {
              const val = props[key];
              return (
              <div key={key} className="property-row">
                <span className="property-label">{label}</span>
                <span className="property-value">
                  {key === 'addepar_contact_link' && val ? (
                    <a href={String(val)} target="_blank" rel="noopener noreferrer">
                      {String(val)}
                    </a>
                  ) : (
                    String(val ?? '')
                  )}
                </span>
              </div>
            );
            })}
            {displayProps.length === 0 && (
              <p className="empty">No additional properties available.</p>
            )}
          </div>
          {selectedContact.id && (
            <div className="contact-notes">
              <h4 className="notes-title">Notes</h4>
              {notesLoading ? (
                <p className="notes-loading">Loading notes...</p>
              ) : notes ? (
                <>
                  {notes.pinned && (
                    <div className="note-item note-pinned">
                      <span className="note-badge">Pinned</span>
                      <div
                        className="note-body"
                        dangerouslySetInnerHTML={{ __html: notes.pinned.body || '' }}
                      />
                      {notes.pinned.timestamp && (
                        <span className="note-date">
                          {new Date(notes.pinned.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                  {notes.recent.map((n) => (
                    <div key={n.id} className="note-item">
                      <div
                        className="note-body"
                        dangerouslySetInnerHTML={{ __html: n.body || '' }}
                      />
                      {n.timestamp && (
                        <span className="note-date">
                          {new Date(n.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {!notes.pinned && notes.recent.length === 0 && (
                    <p className="empty">No notes for this contact.</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="contact-lookup">
      {!customerId && (
        <p className="hint">Open a chat to update the visitor&apos;s name and email from HubSpot.</p>
      )}
      {customerId && customerProfile?.email && (
        <div className="customer-info-section">
          {customerContactLoading ? (
            <p className="customer-info-loading">Loading client info...</p>
          ) : customerContact ? (
            <div className="customer-info-card">
              <h4 className="customer-info-title">Client info</h4>
              <div className="customer-info-detail">
                <strong>{customerContact.name}</strong>
                {customerContact.email && <span>{customerContact.email}</span>}
              </div>
              {(hasKnownValue(customerContact.properties?.bd_client) || hasKnownValue(customerContact.properties?.ia_client)) && (
                <div className="customer-info-meta">
                  {hasKnownValue(customerContact.properties?.bd_client) && (
                    <span>BD Client: {String(customerContact.properties?.bd_client)}</span>
                  )}
                  {hasKnownValue(customerContact.properties?.ia_client) && (
                    <span>IA Client: {String(customerContact.properties?.ia_client)}</span>
                  )}
                </div>
              )}
              <button
                type="button"
                className="customer-info-expand"
                onClick={() => handleSelectContact(customerContact)}
              >
                View full details
              </button>
            </div>
          ) : null}
        </div>
      )}
      <div className="search-box">
        <input
          type="text"
          placeholder="Search by name (4+ characters)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button type="button" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="contact-list">
        {contacts.length === 0 && !loading && query && !error && (
          <p className="empty">No contacts found.</p>
        )}
        {contacts.map((c, i) => (
          <button
            key={`${c.email}-${c.name}-${i}`}
            type="button"
            className="contact-item"
            onClick={() => handleSelectContact(c)}
          >
            <strong>{c.name}</strong>
            <span>{c.email}</span>
            {(hasKnownValue(c.properties?.bd_client) || hasKnownValue(c.properties?.ia_client)) && (
              <span className="contact-item-meta">
                {hasKnownValue(c.properties?.bd_client) && (
                  <span>BD Client: {String(c.properties?.bd_client)}</span>
                )}
                {hasKnownValue(c.properties?.ia_client) && (
                  <span>IA Client: {String(c.properties?.ia_client)}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
