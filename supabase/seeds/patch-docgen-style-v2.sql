-- =============================================================================
-- Patch: Style v2 — Cover page date line, confidential footer, section
--        numbering counters, status badges, priority labels
--
-- Applies to: SOW, NDA, MSA document types
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- PREREQUISITE: patch-docgen-cover-logo.sql must be run FIRST.
--   If you haven't run that patch yet, the simplest path is to re-run
--   the full seed files instead (they include both the logo fix + style v2):
--     seed-docgen.sql, seed-docgen-nda.sql, seed-docgen-msa.sql
--
-- After running this patch, open existing documents and click "Compile"
-- to regenerate compiled_html with the new styles.
-- =============================================================================

-- ─── SOW ──────────────────────────────────────────────────────────────────────

UPDATE document_types
SET
  html_template = REPLACE(
    REPLACE(
      html_template,
      -- 1. Replace tagline in header row with date line
      '<p class="cover-tagline">Pouring the Foundation for Your Success</p>',
      '<p class="cover-date-line">{{document_date}} &bull; Statement of Work</p>'
    ),
    -- 2. Insert cover-bottom before closing cover-body
    '      </div>
    </div>
  </div>',
    '      </div>
      <div class="cover-bottom">
        <p class="cover-tagline">Pouring the Foundation for Your Success</p>
        <p class="cover-confidential">Confidential &bull; Foundation Stone Advisors, LLC &bull; Orange Park, FL</p>
      </div>
    </div>
  </div>'
  ),
  css_styles = REPLACE(
    REPLACE(
      REPLACE(
        css_styles,
        -- 3. Add cover-date-line / cover-bottom / cover-confidential classes
        '.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }',
        '.cover-date-line { font-size: 11px; color: rgba(255,255,255,0.65); margin: 0; letter-spacing: 0.3px; }
.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }
.cover-confidential { font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0; letter-spacing: 0.2px; }
.cover-bottom { margin-top: auto; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.15); }'
      ),
      -- 4. Add section counter-reset + h2::before to body-content
      '.body-content { padding: 32px 8px; }',
      '.body-content { padding: 32px 8px; counter-reset: section; }
.section h2::before { counter-increment: section; content: "A" counter(section) ". "; color: var(--fsa-accent); }'
    ),
    -- 5. Add badges + priority labels before @media print
    '/* ── Print ── */',
    '/* ── Status Badges ── */
.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 2px; }
.badge-live, .badge-active { background: #16a34a; color: #fff; }
.badge-connected, .badge-complete, .badge-done { background: #2563eb; color: #fff; }
.badge-pending, .badge-in-progress { background: #d97706; color: #fff; }
.badge-review { background: #7c3aed; color: #fff; }
.badge-planned, .badge-not-started { background: #6b7280; color: #fff; }

/* ── Priority Labels ── */
.priority-label { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
.priority-immediate { background: #dc2626; color: #fff; }
.priority-high { background: #ea580c; color: #fff; }
.priority-medium { background: #d97706; color: #fff; }

/* ── Print ── */'
  )
WHERE slug = 'sow';


-- ─── NDA ──────────────────────────────────────────────────────────────────────

UPDATE document_types
SET
  html_template = REPLACE(
    REPLACE(
      html_template,
      '<p class="cover-tagline">Pouring the Foundation for Your Success</p>',
      '<p class="cover-date-line">{{effective_date}} &bull; Non-Disclosure Agreement</p>'
    ),
    '      </div>
    </div>
  </div>',
    '      </div>
      <div class="cover-bottom">
        <p class="cover-tagline">Pouring the Foundation for Your Success</p>
        <p class="cover-confidential">Confidential &bull; Foundation Stone Advisors, LLC &bull; Orange Park, FL</p>
      </div>
    </div>
  </div>'
  ),
  css_styles = REPLACE(
    REPLACE(
      REPLACE(
        css_styles,
        '.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }',
        '.cover-date-line { font-size: 11px; color: rgba(255,255,255,0.65); margin: 0; letter-spacing: 0.3px; }
.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }
.cover-confidential { font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0; letter-spacing: 0.2px; }
.cover-bottom { margin-top: auto; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.15); }'
      ),
      '.body-content { padding: 32px 8px; }',
      '.body-content { padding: 32px 8px; counter-reset: section; }
.section:not(.preamble) h2::before { counter-increment: section; content: counter(section) ". "; color: var(--fsa-accent); }'
    ),
    '/* ── Print ── */',
    '/* ── Status Badges ── */
.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 2px; }
.badge-live, .badge-active { background: #16a34a; color: #fff; }
.badge-connected, .badge-complete, .badge-done { background: #2563eb; color: #fff; }
.badge-pending, .badge-in-progress { background: #d97706; color: #fff; }
.badge-review { background: #7c3aed; color: #fff; }
.badge-planned, .badge-not-started { background: #6b7280; color: #fff; }

/* ── Priority Labels ── */
.priority-label { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
.priority-immediate { background: #dc2626; color: #fff; }
.priority-high { background: #ea580c; color: #fff; }
.priority-medium { background: #d97706; color: #fff; }

/* ── Print ── */'
  )
WHERE slug = 'nda';


-- ─── MSA ──────────────────────────────────────────────────────────────────────

UPDATE document_types
SET
  html_template = REPLACE(
    REPLACE(
      html_template,
      '<p class="cover-tagline">Pouring the Foundation for Your Success</p>',
      '<p class="cover-date-line">{{effective_date}} &bull; Master Service Agreement</p>'
    ),
    '      </div>
    </div>
  </div>',
    '      </div>
      <div class="cover-bottom">
        <p class="cover-tagline">Pouring the Foundation for Your Success</p>
        <p class="cover-confidential">Confidential &bull; Foundation Stone Advisors, LLC &bull; Orange Park, FL</p>
      </div>
    </div>
  </div>'
  ),
  css_styles = REPLACE(
    REPLACE(
      REPLACE(
        css_styles,
        '.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }',
        '.cover-date-line { font-size: 11px; color: rgba(255,255,255,0.65); margin: 0; letter-spacing: 0.3px; }
.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }
.cover-confidential { font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0; letter-spacing: 0.2px; }
.cover-bottom { margin-top: auto; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.15); }'
      ),
      '.body-content { padding: 32px 8px; }',
      '.body-content { padding: 32px 8px; counter-reset: section; }
.section:not(.preamble) h2::before { counter-increment: section; content: counter(section) ". "; color: var(--fsa-accent); }'
    ),
    '/* ── Print ── */',
    '/* ── Status Badges ── */
.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 2px; }
.badge-live, .badge-active { background: #16a34a; color: #fff; }
.badge-connected, .badge-complete, .badge-done { background: #2563eb; color: #fff; }
.badge-pending, .badge-in-progress { background: #d97706; color: #fff; }
.badge-review { background: #7c3aed; color: #fff; }
.badge-planned, .badge-not-started { background: #6b7280; color: #fff; }

/* ── Priority Labels ── */
.priority-label { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
.priority-immediate { background: #dc2626; color: #fff; }
.priority-high { background: #ea580c; color: #fff; }
.priority-medium { background: #d97706; color: #fff; }

/* ── Print ── */'
  )
WHERE slug = 'msa';
