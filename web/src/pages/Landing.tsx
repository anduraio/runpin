import { Link } from "react-router-dom";
import { getApiKey } from "../api";

export default function Landing() {
  const loggedIn = Boolean(getApiKey());
  const ctaTo = loggedIn ? "/app" : "/login";
  const ctaLabel = loggedIn ? "Open Runpin" : "Get started";

  return (
    <div className="landing">
      <div className="landing-grain" aria-hidden />

      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#top" className="landing-logo">
            Runpin
          </a>
          <nav className="landing-nav-links">
            <Link to="/guide">Guide</Link>
            <a href="#how">How it works</a>
            <Link to={ctaTo} className="landing-btn landing-btn-primary">
              {ctaLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Durable jobs for AI agents &amp; workflows</p>
            <h1>
              Long jobs.
              <br />
              <em>Out of the request.</em>
            </h1>
            <p className="landing-subhead">
              Runpin is the queue and worker behind your app. POST a job, get
              back 202, and let a worker hold the lease — retries, timeouts, and
              an honest Activity board included.
            </p>
            <div className="landing-hero-ctas">
              <Link
                to={ctaTo}
                className="landing-btn landing-btn-primary landing-btn-lg"
              >
                {ctaLabel}
              </Link>
              <a href="#how" className="landing-btn landing-btn-ghost landing-btn-lg">
                How it works
              </a>
            </div>
          </div>

          <div className="landing-hero-mock" aria-hidden>
            <div className="landing-mock-card landing-mock-tools">
              <div className="landing-mock-chrome">
                <span />
                <span />
                <span />
                <em>Activity</em>
              </div>
              <div className="landing-mock-body">
                <div className="landing-tool-row">
                  <div>
                    <p className="landing-mock-title">callback → your app</p>
                    <p className="landing-tool-desc">worker holds the lease</p>
                  </div>
                  <span className="landing-pill landing-pill-run">Running</span>
                </div>
                <div className="landing-tool-row">
                  <div>
                    <p className="landing-mock-title">nightly export</p>
                    <p className="landing-tool-desc">Routine · 02:00 UTC</p>
                  </div>
                  <span className="landing-pill landing-pill-routine">Waiting</span>
                </div>
                <div className="landing-tool-row">
                  <div>
                    <p className="landing-mock-title">echo · smoke test</p>
                    <p className="landing-tool-desc">attempt 1 of 3</p>
                  </div>
                  <span className="landing-pill landing-pill-ok">Finished</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-how" id="how">
          <div className="landing-section-inner">
            <p className="landing-eyebrow">How it works</p>
            <h2>Enqueue, run, observe.</h2>
            <ol className="landing-steps">
              <li>
                <span className="landing-step-num">1</span>
                <div>
                  <h3>POST a job</h3>
                  <p>
                    <code>POST /v1/jobs</code> with a bearer key. Runpin answers{" "}
                    <strong>202</strong> and an id — your request can end there,
                    so nothing waits on the slow path.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">2</span>
                <div>
                  <h3>A worker claims it</h3>
                  <p>
                    The worker takes a lease, heartbeats while the job runs, and
                    retries with backoff until <code>max_attempts</code> — or
                    fails it with the real error.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-step-num">3</span>
                <div>
                  <h3>Watch Activity</h3>
                  <p>
                    Waiting, running, and finished show up on one board. Cancel
                    mid-run, or let a Routine enqueue the same job on a schedule.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="landing-usecases" id="use-cases">
          <div className="landing-section-inner">
            <p className="landing-eyebrow">What builders use it for</p>
            <h2>One queue for the long stuff</h2>
            <div className="landing-cards">
              <article className="landing-card">
                <span className="landing-card-tag">Vercel</span>
                <h3>Escape serverless limits</h3>
                <p>
                  Kick off work that outlives a function timeout, then pick the
                  result up later by id.
                </p>
              </article>
              <article className="landing-card">
                <span className="landing-card-tag">Webhooks</span>
                <h3>Call back into your app</h3>
                <p>
                  With <code>http_callback</code>, the worker POSTs the payload
                  to your URL and stores whatever comes back.
                </p>
              </article>
              <article className="landing-card">
                <span className="landing-card-tag">Routines</span>
                <h3>Run it on a schedule</h3>
                <p>
                  Cron in UTC enqueues the same job type; pause or resume
                  whenever you like.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-compare" id="compare">
          <div className="landing-section-inner">
            <p className="landing-eyebrow">Before &amp; after</p>
            <h2>Waiting on the request vs queued work</h2>
            <div className="landing-scar-grid">
              <div className="landing-scar-col">
                <h3>Before</h3>
                <ul>
                  <li>Your function sits on a slow call</li>
                  <li>The request times out and the work is lost</li>
                  <li>You retry by hand, or guess what happened</li>
                  <li>Nobody can see the queue</li>
                </ul>
              </div>
              <div className="landing-scar-col landing-scar-after">
                <h3>With Runpin</h3>
                <ul>
                  <li>You enqueue and return 202</li>
                  <li>A worker holds the lease and heartbeats</li>
                  <li>Failures retry with backoff, then fail honestly</li>
                  <li>Activity shows what really happened</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-final">
          <div className="landing-section-inner landing-final-inner">
            <h2>Ready when you are</h2>
            <p>
              Enqueue a job, walk away, and come back to a result. That&apos;s
              the whole idea.
            </p>
            <div className="landing-hero-ctas">
              <Link
                to={ctaTo}
                className="landing-btn landing-btn-primary landing-btn-lg"
              >
                {ctaLabel}
              </Link>
            </div>
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
            <Link to="/guide">Guide</Link>
            {" · "}
            Runpin
          </span>
        </div>
      </footer>
    </div>
  );
}
