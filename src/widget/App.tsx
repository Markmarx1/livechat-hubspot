import { useEffect, useState } from 'react';
import { createDetailsWidget } from '@livechat/agent-app-sdk';
import type { IDetailsWidget } from '@livechat/agent-app-sdk';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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

function ContactLookup({ widget }: ContactLookupProps) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Array<{ name: string; email: string }>>([]);
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Search failed');
      }
      setContacts(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Connect HubSpot (see CONFIGURE_HUBSPOT.md).');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = async (contact: { name: string; email: string }) => {
    if (!customerId) {
      setError('Open a chat to update the visitor\'s name and email.');
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/livechat/update-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          name: contact.name,
          email: contact.email,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update customer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update customer.');
    } finally {
      setUpdating(false);
    }
  };

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
        {contacts.map((c) => (
          <button
            key={c.email}
            type="button"
            className="contact-item"
            onClick={() => handleSelectContact(c)}
            disabled={!customerId || updating}
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
