import { useCallback, useEffect, useState } from 'react';
import { createDetailsWidget } from '@livechat/agent-app-sdk';
import type { IDetailsWidget } from '@livechat/agent-app-sdk';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** True if value is known and should be displayed */
const hasKnownValue = (v: unknown): boolean =>
  v != null && String(v).trim() !== '';

/** Contact properties to display when selected, in order */
const CONTACT_PROPERTY_DISPLAY: Array<[string, string]> = [
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
    getCustomerProfile: () => ({
      id: 'dev-customer-id',
      name: 'Dev User',
      email: 'dev@example.com',
      source: 'chats',
      chat: { id: 'dev-chat', groupID: '0' },
    }),
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
 * - On select + "Update visitor": push name/email only for the highlighted live chat (profile.source === chats)
 */
const BANK_AFFILIATES = [
  { value: '', label: 'Select bank affiliate...' },
  { value: 'OceanFirst', label: 'OceanFirst' },
  { value: 'Phoenixville', label: 'Phoenixville' },
  { value: 'Bankers Bank', label: 'Bankers Bank' },
  { value: 'No Bank', label: 'No Bank' },
  { value: 'Flanagan State Bank', label: 'Flanagan State Bank' },
  { value: 'Washington State Bank', label: 'Washington State Bank' },
  { value: 'Community State Bank', label: 'Community State Bank' },
  { value: 'German American State Bank', label: 'German American State Bank' },
  { value: 'First Bank Hampton', label: 'First Bank Hampton' },
  { value: 'Republic Bank', label: 'Republic Bank' },
  { value: 'Prevail Bank', label: 'Prevail Bank' },
  { value: 'Fortifi Bank', label: 'Fortifi Bank' },
  { value: 'KeySavings Bank', label: 'KeySavings Bank' },
  { value: 'JW Cole', label: 'JW Cole' },
  { value: 'Smart Asset', label: 'Smart Asset' },
  { value: 'First State Bank', label: 'First State Bank' },
  { value: 'The AFCU', label: 'The AFCU' },
  { value: 'HEFCU', label: 'HEFCU' },
];

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
  /** From Agent App SDK — only `chats` is the highlighted live thread; other views must not call update_customer */
  source?: 'chats' | 'archives' | 'customers';
  chat?: { chat_id?: string; groupID?: string; id?: string };
}

/** Cache HubSpot contact by customer ID for persistence when switching chats */
const contactCache = new Map<string, HubSpotContact>();

/** LiveChat only allows updating the visitor for the active chat; docs: profile.source is chats | archives | customers */
function isHighlightedLiveChat(profile: CustomerProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.source == null) return true;
  return profile.source === 'chats';
}

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createBankAffiliate, setCreateBankAffiliate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const customerId = customerProfile?.id ?? null;
  const activeChatKey =
    customerProfile?.chat?.chat_id || customerProfile?.chat?.id || '';
  const canPushToLiveChatVisitor = isHighlightedLiveChat(customerProfile);

  // Get current chat's customer profile (SDK keeps one slot; use event payload when provided)
  useEffect(() => {
    const profile = widget.getCustomerProfile() as CustomerProfile | undefined;
    setCustomerProfile(
      profile
        ? {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            source: profile.source,
            chat: profile.chat,
          }
        : null
    );

    const handler = (p?: CustomerProfile) => {
      const next = p ?? (widget.getCustomerProfile() as CustomerProfile | undefined);
      setCustomerProfile(
        next
          ? {
              id: next.id,
              name: next.name,
              email: next.email,
              source: next.source,
              chat: next.chat,
            }
          : null
      );
    };
    widget.on('customer_profile', handler);
    return () => widget.off('customer_profile', handler);
  }, [widget]);

  // Reset search/contact state when switching customer or active chat (same visitor can have multiple chats)
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
  }, [customerId, activeChatKey]);

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
    if (!isHighlightedLiveChat(currentProfile)) {
      setError('Switch to the highlighted live chat (Chats view) to update only that visitor.');
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const chatIdVal = currentProfile?.chat?.chat_id || currentProfile?.chat?.id || '';
      const res = await fetch(`${API_BASE}/api/livechat/update-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: targetCustomerId,
          name: selectedContact.name,
          email: selectedContact.email,
          hubspotContactId: selectedContact.id,
          chatId: chatIdVal,
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

      // Notify other apps (e.g. Whereby widget) that a HubSpot contact was linked
      try {
        window.parent.postMessage(
          { type: 'hubspot-contact-linked', hubspotContactId: selectedContact.id, chatId: chatIdVal },
          '*',
        );
      } catch { /* cross-origin or sandboxed */ }

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

  const handleCreateContact = async () => {
    if (!createFirstName.trim() || !createLastName.trim() || !createEmail.trim()) return;
    const currentProfile = widget.getCustomerProfile() as CustomerProfile | undefined;
    const targetCustomerId = currentProfile?.id;
    if (!targetCustomerId || !isHighlightedLiveChat(currentProfile)) {
      setCreateError('Open a live chat (Chats view) to create and tag a contact.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const createRes = await fetch(`${API_BASE}/api/hubspot-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: createFirstName.trim(),
          lastName: createLastName.trim(),
          email: createEmail.trim(),
          bankAffiliate: createBankAffiliate || undefined,
        }),
      });
      const text = await createRes.text();
      let data: { id?: string; name?: string; email?: string; properties?: Record<string, string | number | undefined>; message?: string; error?: string } = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
      if (!createRes.ok) {
        throw new Error(data.message || data.error || text || 'Failed to create contact');
      }
      const newContact: HubSpotContact = {
        id: data.id,
        name: data.name || [createFirstName.trim(), createLastName.trim()].join(' '),
        email: data.email || createEmail.trim(),
        properties: data.properties || {},
      };

      // Auto-tag: push name/email + hubspot_contact_id to the LiveChat visitor
      const chatIdVal = currentProfile?.chat?.chat_id || currentProfile?.chat?.id || '';
      const tagRes = await fetch(`${API_BASE}/api/livechat/update-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: targetCustomerId,
          name: newContact.name,
          email: newContact.email,
          hubspotContactId: newContact.id,
          chatId: chatIdVal,
        }),
      });
      if (!tagRes.ok) {
        const tagText = await tagRes.text();
        let tagData: { message?: string; error?: string } = {};
        try { tagData = tagText ? JSON.parse(tagText) : {}; } catch { /* non-JSON */ }
        throw new Error(tagData.message || tagData.error || 'Contact created but failed to tag to chat');
      }

      // Update local state
      contactCache.set(targetCustomerId, newContact);
      setCustomerContact(newContact);
      setCustomerProfile((prev) =>
        prev ? { ...prev, name: newContact.name, email: newContact.email } : null
      );
      setCreateSuccess(true);
      setShowCreateForm(false);
      setCreateFirstName('');
      setCreateLastName('');
      setCreateEmail('');
      setCreateBankAffiliate('');
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create contact.');
    } finally {
      setCreating(false);
    }
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
          <h3 className="contact-detail-name">
            {selectedContact.id ? (
              <a
                href={`https://app.hubspot.com/contacts/3307963/record/0-1/${selectedContact.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selectedContact.name}
              </a>
            ) : (
              selectedContact.name
            )}
          </h3>
          {selectedContact.email && (
            <p className="contact-detail-email">{selectedContact.email}</p>
          )}
          {customerId && (
            <>
              <button
                type="button"
                className="update-button"
                onClick={handleUpdateVisitor}
                disabled={updating || !canPushToLiveChatVisitor}
                title={
                  !canPushToLiveChatVisitor
                    ? 'Open the live chat thread in Chats (highlighted chat) to push HubSpot name/email to that visitor only.'
                    : undefined
                }
              >
                {updating ? 'Updating...' : 'Update visitor in LiveChat'}
              </button>
              {!canPushToLiveChatVisitor && (
                <p className="hint">
                  Select the live chat you want to update (Chats view). Updates apply to the highlighted thread only.
                </p>
              )}
              {updateSuccess && (
                <p className="update-success">Updated! Customer details have been saved.</p>
              )}
            </>
          )}
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
      {customerId && (
        <div className="create-contact-section">
          {createSuccess && (
            <p className="update-success">Contact created and tagged to this chat!</p>
          )}
          {!showCreateForm ? (
            <button
              type="button"
              className="create-toggle-button"
              onClick={() => { setShowCreateForm(true); setCreateError(null); }}
            >
              + Create New Contact
            </button>
          ) : (
            <div className="create-form">
              <h4 className="create-form-title">Create New Contact</h4>
              <input
                type="text"
                className="create-input"
                placeholder="First Name"
                value={createFirstName}
                onChange={(e) => setCreateFirstName(e.target.value)}
              />
              <input
                type="text"
                className="create-input"
                placeholder="Last Name"
                value={createLastName}
                onChange={(e) => setCreateLastName(e.target.value)}
              />
              <input
                type="email"
                className="create-input"
                placeholder="Email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
              <select
                className="create-select"
                value={createBankAffiliate}
                onChange={(e) => setCreateBankAffiliate(e.target.value)}
              >
                {BANK_AFFILIATES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {createError && <p className="error">{createError}</p>}
              <div className="create-form-actions">
                <button
                  type="button"
                  className="create-submit-button"
                  onClick={handleCreateContact}
                  disabled={creating || !createFirstName.trim() || !createLastName.trim() || !createEmail.trim()}
                >
                  {creating ? 'Creating...' : 'Create & Tag to Chat'}
                </button>
                <button
                  type="button"
                  className="create-cancel-button"
                  onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
