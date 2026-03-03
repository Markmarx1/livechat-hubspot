import { useEffect, useState } from 'react';
import { createDetailsWidget } from '@livechat/agent-app-sdk';
import type { IDetailsWidget } from '@livechat/agent-app-sdk';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** Contact properties to display when selected, in order */
const CONTACT_PROPERTY_DISPLAY: Array<[string, string]> = [
  ['customer_first_name', 'Customer First Name'],
  ['customer_last_name', 'Customer Last Name'],
  ['firstname', 'First Name'],
  ['lastname', 'Last Name'],
  ['email', 'Email'],
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
function App() {
  const [widget, setWidget] = useState<IDetailsWidget | null>(null);
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);

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
    return <div className="loading">Connecting to LiveChat...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h2>HubSpot Contact Lookup</h2>
        <p className="subtitle">
          {standalone ? 'Dev mode — install in LiveChat to use with real chats' : 'Search and insert contact details'}
        </p>
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
  name: string;
  email: string;
  properties: Record<string, string | number | undefined>;
}

function ContactLookup({ widget }: ContactLookupProps) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<HubSpotContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<HubSpotContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Get current chat's customer ID (required for update_customer)
  useEffect(() => {
    const profile = widget.getCustomerProfile();
    setCustomerId(profile?.id ?? null);

    const handler = () => setCustomerId(widget.getCustomerProfile()?.id ?? null);
    widget.on('customer_profile', handler);
    return () => widget.off('customer_profile', handler);
  }, [widget]);

  const handleSearch = async () => {
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
  };

  const handleSelectContact = (contact: HubSpotContact) => {
    setSelectedContact(contact);
    setError(null);
  };

  const handleUpdateVisitor = async () => {
    if (!selectedContact || !customerId) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/livechat/update-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update customer.');
    } finally {
      setUpdating(false);
    }
  };

  const handleBackToList = () => {
    setSelectedContact(null);
    setError(null);
  };

  if (selectedContact) {
    const props = selectedContact.properties || {};
    const displayProps = CONTACT_PROPERTY_DISPLAY.filter(
      ([key]) => props[key] !== undefined && props[key] !== null && props[key] !== ''
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
          {customerId && (
            <button
              type="button"
              className="update-button"
              onClick={handleUpdateVisitor}
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Update visitor in LiveChat'}
            </button>
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
      <div className="search-box">
        <input
          type="text"
          placeholder="Search by name..."
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
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
