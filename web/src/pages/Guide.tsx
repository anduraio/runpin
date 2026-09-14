import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getApiKey } from "../api";

export default function Guide() {
  const loggedIn = Boolean(getApiKey());
  const ctaTo = loggedIn ? "/app" : "/login";
  const ctaLabel = loggedIn ? "Open Runpin" : "Get started";

  useEffect(() => {
    document.title = "Runpin — guide";
    return () => {
      document.title = "Runpin — durable jobs for AI agents & workflows";
    };
  }, []);

  return (
    <div className="landing guide-page">
      <div className="landing-grain" aria-hidden />

      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            Runpin
          </Link>
          <nav className="landing-nav-links">
            <Link to="/guide" aria-current="page">
              Guide
            </Link>
            <a href="/#how">How it works</a>
            <Link to={ctaTo} className="landing-btn landing-btn-primary">
              {ctaLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="guide-hero">
          <div className="landing-section-inner">
            <p className="landing-eyebrow">Guide</p>
            <h1>
              Long jobs.
              <br />
              <em>Without waiting in the request.</em>
            </h1>
            <p className="landing-subhead">
              Runpin is a durable queue. Enqueue work, get <strong>202</strong>,
              and come back when it is done. Your app still does the real work
              — Runpin holds the lease, retries, and the activity board.
            </p>
          </div>
        </section>

        <section className="landing-how" id="flow">
          <div className="landing-section-inner">
            <p className="landing-eyebrow">The shape</p>
            <h2>Enqueue, then run</h2>
            <ol className="landing-steps">
              <li>
                <span className="landing-step-num">1</span>
                <div>
                  <h3>Your app POSTs a job</h3>
                  <p>
                    <code>POST /v1/jobs</code> with a bearer token. Runpin
                    answers <strong>202</strong> and an id. The HTTP request
                    can end there.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">2</span>
                <div>
                  <h3>A worker claims it</h3>
                  <p>
                    The worker takes a lease, heartbeats while the job runs,
                    and fails + retries on timeout or a bad callback.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">3</span>
                <div>
                  <h3>You watch Activity</h3>
                  <p>
                    Waiting, running, and finished show up on the board. Cancel
                    anytime. Set a Routine if it should happen on a schedule.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="guide-body" id="api">
          <div className="landing-section-inner guide-prose">
            <p className="landing-eyebrow">API</p>
            <h2>Create a job</h2>
            <pre>
              <code>{`POST /v1/jobs
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "type": "echo",
  "payload": { "hello": "runpin" },
  "max_duration_sec": 3600,
  "idempotency_key": "optional-stable-key"
}`}</code>
            </pre>
            <p>
              Login to the UI with the same API key. All <code>/v1/*</code>{" "}
              routes require it. Statuses:{" "}
              <code>queued</code> → <code>running</code> →{" "}
              <code>succeeded</code> / <code>failed</code> /{" "}
              <code>cancelled</code>.
            </p>

            <h2>When another service does the work</h2>
            <p>
              Use type <code>http_callback</code>. Put a{" "}
              <code>callback_url</code> in the payload. The worker POSTs the
              rest of the payload to that URL. <strong>200</strong> + JSON
              becomes the job result. Anything else fails and retries (up to{" "}
              <code>max_attempts</code>).
            </p>
            <pre>
              <code>{`{
  "type": "http_callback",
  "payload": {
    "callback_url": "https://example.com/hooks/runpin",
    "action": "compute",
    "id": "abc"
  },
  "max_duration_sec": 3600
}`}</code>
            </pre>
            <p>
              The callback host receives{" "}
              <code>{`{ "action": "compute", "id": "abc" }`}</code> —{" "}
              <code>callback_url</code> is stripped. Point that URL at a
              process that is allowed to run as long as{" "}
              <code>max_duration_sec</code>, not a short serverless timeout.
            </p>

            <h2>Who does what</h2>
            <div className="landing-scar-grid">
              <div className="landing-scar-col">
                <h3>Runpin</h3>
                <ul>
                  <li>HTTP API and operator UI</li>
                  <li>Queue, lease, heartbeat, retry</li>
                  <li>Cron / Routines (UTC)</li>
                  <li>Activity board</li>
                </ul>
              </div>
              <div className="landing-scar-col landing-scar-after">
                <h3>Your app</h3>
                <ul>
                  <li>Enqueue with a bearer token</li>
                  <li>Do the real work (or handle the callback)</li>
                  <li>Keep your own records if you need them</li>
                  <li>Render results for your users</li>
                </ul>
              </div>
            </div>
            <p className="guide-note">
              Runpin has no tool shelf and no tool builder. <code>echo</code> is
              for smoke tests, <code>http_callback</code> hands work to a
              service you already run, and custom job types are registered over
              the API (<code>POST /v1/pack-drafts</code>).
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <span>
            Made with love by{" "}
            <a
              href="https://x.com/anduraio"
              target="_blank"
              rel="noopener noreferrer"
            >
              @anduraio
            </a>
          </span>
          <span>
            <Link to="/">Home</Link>
            {" · "}
            <Link to="/guide">Guide</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
