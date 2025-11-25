import React from 'react';

const sections = [
  { id: 'product', label: 'Product' },
  { id: 'verticals', label: 'Verticals' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'security', label: 'Security' },
  { id: 'for-engineers', label: 'For engineers' }
];

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = React.useState<string>('product');

  React.useEffect(() => {
    const handler = () => {
      const offsets = sections.map((s) => {
        const el = document.getElementById(s.id);
        if (!el) return { id: s.id, top: Number.POSITIVE_INFINITY };
        const rect = el.getBoundingClientRect();
        return { id: s.id, top: Math.abs(rect.top - 96) }; // offset by nav height
      });
      const closest = offsets.reduce((acc, cur) => (cur.top < acc.top ? cur : acc), offsets[0]);
      setActiveSection(closest.id);
    };
    handler();
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <div className="page">
      <header className="nav">
        <div className="nav-left" onClick={() => scrollTo('top')}>
          <div className="logo-orb" />
          <div className="logo-wordmark">
            <span className="logo-main">EscrowGrid</span>
            <span className="logo-tagline">Tokenization rails for institutional escrow</span>
          </div>
        </div>
        <nav className="nav-links">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`nav-link ${activeSection === s.id ? 'nav-link--active' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="nav-cta">
          <a href="#for-engineers" className="nav-pill">
            Request sandbox access
          </a>
        </div>
      </header>

      <main id="top" className="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <div className="eyebrow">API-first · Multi-vertical · Compliance-aware</div>
            <h1 id="hero-title">
              Escrow rails for
              <span className="hero-gradient"> tokenized real-world flows.</span>
            </h1>
            <p className="hero-subtitle">
              EscrowGrid is a tokenization-as-a-service platform that lets banks, funds, and enterprises
              issue, manage, and reconcile escrowed claims across construction and trade finance — without
              becoming a marketplace.
            </p>
            <div className="hero-actions">
              <a href="#for-engineers" className="btn btn-primary">
                Explore the API
              </a>
              <a href="#architecture" className="btn btn-ghost">
                See how it fits your stack
              </a>
            </div>
            <dl className="hero-metrics" aria-label="EscrowGrid at a glance">
              <div>
                <dt>Jurisdictions</dt>
                <dd>US, EU/UK, SG, UAE ready rule packs</dd>
              </div>
              <div>
                <dt>Verticals</dt>
                <dd>Construction &amp; trade finance out of the box</dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>DB ledger + optional on-chain attestations</dd>
              </div>
            </dl>
          </div>
          <div className="hero-panel">
            <div className="hero-orbit">
              <div className="hero-orbit-ring hero-orbit-ring--outer" />
              <div className="hero-orbit-ring hero-orbit-ring--inner" />
              <div className="hero-orbit-node hero-orbit-node--construction">Construction escrow</div>
              <div className="hero-orbit-node hero-orbit-node--trade">Trade finance</div>
              <div className="hero-orbit-node hero-orbit-node--policies">Policies</div>
              <div className="hero-orbit-core">
                <span>EscrowGrid</span>
                <span className="hero-orbit-core-sub">Institutional tokenization fabric</span>
              </div>
            </div>
            <div className="hero-code-card" aria-label="Live escrow position creation example">
              <div className="hero-code-header">
                <span className="hero-code-status-dot" />
                <span>POST /positions</span>
                <span className="hero-code-status">201 Created · 98ms</span>
              </div>
              <pre className="hero-code">
{`curl https://api.escrowgrid.io/positions \\
  -H "X-API-KEY: <institution-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "assetId": "ast_constr_alpha",
    "holderReference": "SUBCONTRACTOR_123",
    "currency": "USD",
    "amount": 100000
  }'`}
              </pre>
              <div className="hero-code-footer">
                <span>Policy gate · Ledger write · Optional on-chain emit</span>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="section">
          <div className="section-header">
            <h2>Purpose-built tokenization infra, not a marketplace.</h2>
            <p>
              EscrowGrid gives you a programmable substrate for real-world assets that can sit in escrow:
              construction draws, retainage, letters of credit, and invoice flows. You keep the client
              relationship, balance sheet, and front-end — we give you rails that regulators and engineers
              can both understand.
            </p>
          </div>
          <div className="grid-3">
            <article className="card">
              <h3>Composable escrow primitives</h3>
              <p>
                Model escrowed claims as positions with explicit lifecycles and immutable event trails.
                Templates for construction escrow, retainage, invoices, and LCs ship ready to use — without
                locking you into our opinionated UX.
              </p>
            </article>
            <article className="card">
              <h3>Policy engine wired in</h3>
              <p>
                Encode regional and institutional rules — amounts, currencies, counterparties — as policies
                that are evaluated on every position create and transition. No more scattered &quot;if
                (region === ...)&quot; branches.
              </p>
            </article>
            <article className="card">
              <h3>Dual ledger design</h3>
              <p>
                A battle-tested Postgres ledger acts as the primary system of record, with an optional
                EVM-compatible adapter for on-chain attestations per-template and per-chain.
              </p>
            </article>
          </div>
        </section>

        <section id="verticals" className="section section--contrast">
          <div className="section-header">
            <h2>Optimized for construction &amp; trade finance from day one.</h2>
            <p>
              Tokenization is only useful when it respects the operational reality of the vertical. EscrowGrid
              ships with first-class support for construction and trade finance flows that your ops and legal
              teams already recognize.
            </p>
          </div>
          <div className="grid-2">
            <article className="card card--glass">
              <h3>Construction</h3>
              <ul className="list">
                <li>Programmable escrow for draws and retainage.</li>
                <li>Per-project templates with region-aware policy envelopes.</li>
                <li>Role-safe APIs for sponsors, GCs, and subs.</li>
                <li>Clean audit trails for funding, inspections, and releases.</li>
              </ul>
            </article>
            <article className="card card--glass">
              <h3>Trade finance</h3>
              <ul className="list">
                <li>Invoice and LC templates with tenor, country, and bank constraints.</li>
                <li>Escrowed positions that align with your existing credit workflows.</li>
                <li>Policy-bound issuance by region, asset class, and counterparty risk.</li>
                <li>Ledger and API surface designed for downstream securitization.</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="architecture" className="section">
          <div className="section-header">
            <h2>Drop-in architecture for modern institutional stacks.</h2>
            <p>
              EscrowGrid exposes a clean HTTP API and ships as a containerized service. Point it at your
              Postgres, wire it into your auth, and start issuing positions without rewiring your core
              banking system.
            </p>
          </div>
          <div className="architecture-grid">
            <div className="architecture-diagram" aria-label="High-level architecture diagram">
              <div className="arch-column">
                <h3>Your systems</h3>
                <ul className="list">
                  <li>Core banking &amp; GL</li>
                  <li>LOS / LMS</li>
                  <li>Treasury &amp; funding</li>
                  <li>Internal portals</li>
                </ul>
              </div>
              <div className="arch-column arch-column--center">
                <h3>EscrowGrid API</h3>
                <ul className="list list--pill">
                  <li>Authentication &amp; tenancy</li>
                  <li>Asset templates &amp; assets</li>
                  <li>Positions &amp; lifecycle</li>
                  <li>Policies &amp; rule packs</li>
                  <li>Ledger &amp; audit</li>
                  <li>Observability &amp; SLOs</li>
                </ul>
              </div>
              <div className="arch-column">
                <h3>Data &amp; rails</h3>
                <ul className="list">
                  <li>Postgres source-of-truth ledger</li>
                  <li>Optional on-chain attestations</li>
                  <li>Metrics endpoints &amp; logs</li>
                  <li>Backup &amp; restore hooks</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="section section--contrast">
          <div className="section-header">
            <h2>Security &amp; compliance woven into the fabric.</h2>
            <p>
              From API key models to audit logs, EscrowGrid is engineered as institutional infrastructure,
              not a demo. We give your security and risk teams the primitives they expect from a core system.
            </p>
          </div>
          <div className="grid-3">
            <article className="card card--outline">
              <h3>Tenant isolation</h3>
              <p>
                Root keys, institution-scoped API keys, and explicit roles ensure that data never bleeds
                across tenants. All access is logged at the API and audit layer.
              </p>
            </article>
            <article className="card card--outline">
              <h3>Immutable trails</h3>
              <p>
                Every lifecycle transition is captured as a ledger event plus a structured audit log entry,
                giving you narrative-grade traceability for internal and external reviews.
              </p>
            </article>
            <article className="card card--outline">
              <h3>Operational hardening</h3>
              <p>
                Health and readiness probes, metrics endpoints, backup scripts, and rate limiting are built
                in — so your SRE team can slot EscrowGrid into existing playbooks.
              </p>
            </article>
          </div>
        </section>

        <section id="for-engineers" className="section">
          <div className="section-header">
            <h2>Engineered for teams who care about the details.</h2>
            <p>
              Your engineers get a well-factored TypeScript backend, clear domain boundaries, and tests that
              prove the behavior. Your product teams get a predictable surface to ship new flows on.
            </p>
          </div>
          <div className="engineer-grid">
            <article className="card card--glass">
              <h3>API surface</h3>
              <p>Core endpoints you work with every day:</p>
              <ul className="list">
                <li>`/institutions`, `/api-keys` for tenancy and access.</li>
                <li>`/asset-templates`, `/assets` for structuring tokenized programs.</li>
                <li>`/positions`, `/positions/:id/transition` for lifecycle control.</li>
                <li>`/ledger-events`, `/metrics`, `/ready` for ops and monitoring.</li>
              </ul>
            </article>
            <article className="card card--glass engineer-code-card">
              <h3>Developer experience</h3>
              <pre>
{`# Run the stack locally (API + Postgres + admin)
docker compose up --build

# Discover the API port
docker compose ps  # look for taas-api PORTS

# Smoke-test readiness
curl \"http://localhost:<API_PORT>/ready\"`}
              </pre>
              <p>
                EscrowGrid ships as a Docker-native service with an internal admin console, so integration
                and experimentation feel like working with a modern SaaS product — even when you deploy it in
                your own cloud.
              </p>
            </article>
          </div>
          <div className="cta-band">
            <div>
              <h3>Ready to explore EscrowGrid for your institution?</h3>
              <p>
                Share a bit about your stack and target regions, and we&apos;ll provision a sandbox tenant
                with construction and trade finance templates pre-wired.
              </p>
            </div>
            <a href="mailto:founders@escrowgrid.io?subject=EscrowGrid%20sandbox%20request" className="btn btn-primary">
              Request a sandbox
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-main">
          <div>
            <div className="logo-wordmark">
              <span className="logo-main">EscrowGrid</span>
              <span className="logo-tagline">TAAS infra for escrowable real-world assets</span>
            </div>
          </div>
          <div className="footer-columns">
            <div>
              <h4>Product</h4>
              <ul className="list">
                <li>Construction escrow</li>
                <li>Trade finance rails</li>
                <li>Policy engine</li>
                <li>Ledger &amp; audit</li>
              </ul>
            </div>
            <div>
              <h4>For teams</h4>
              <ul className="list">
                <li>Risk &amp; compliance</li>
                <li>Engineering</li>
                <li>Treasury &amp; capital markets</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} EscrowGrid. All rights reserved.</span>
          <span>Made for institutional builders, not marketplaces.</span>
        </div>
      </footer>
    </div>
  );
};

