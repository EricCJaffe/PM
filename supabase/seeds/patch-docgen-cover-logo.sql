-- =============================================================================
-- Patch: Fix cover page for SOW, NDA, MSA document types
--   1. Replace margin hack with min-height: 100vh (fills the full page)
--   2. Add html/body margin reset
--   3. Add FSA logo to cover page (served from /FSA_logo_white.png)
--   4. Add .cover-header-row + .cover-logo CSS
-- Run this in Supabase SQL Editor. Safe to re-run.
-- =============================================================================

UPDATE document_types
SET
  -- Fix cover-page CSS: remove -8px margin hack, use 100vh, fix body reset
  css_styles = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          css_styles,
          -- 1. Fix cover-page rule
          '.cover-page { background: var(--fsa-navy); color: #fff; padding: 0; margin: -8px -8px 0 -8px; min-height: 500px; display: flex; flex-direction: column; }',
          '.cover-page { background: var(--fsa-navy); color: #fff; padding: 0; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }'
        ),
        -- 2. Fix cover-accent (add flex-shrink: 0)
        '.cover-accent { height: 6px; background: linear-gradient(90deg, var(--fsa-accent), var(--fsa-slate)); }',
        '.cover-accent { height: 6px; background: linear-gradient(90deg, var(--fsa-accent), var(--fsa-slate)); flex-shrink: 0; }'
      ),
      -- 3. Fix cover-body padding (was 60px top, now 48px)
      '.cover-body { padding: 60px 48px 48px; flex: 1; display: flex; flex-direction: column; }',
      '.cover-body { padding: 48px 48px 48px; flex: 1; display: flex; flex-direction: column; }
.cover-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.cover-logo { width: 110px; height: auto; opacity: 0.9; flex-shrink: 0; margin-left: 24px; }'
    ),
    -- 4. Fix cover-tagline bottom margin (now handled by cover-header-row)
    '.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0 0 32px 0; }',
    '.cover-tagline { font-size: 12px; font-style: italic; color: rgba(255,255,255,0.6); margin: 0; }'
  ),

  -- Add logo to cover page HTML: wrap company+tagline in cover-header-row flex row
  html_template = REPLACE(
    html_template,
    '    <div class="cover-body">
      <p class="cover-company">Foundation Stone Advisors, LLC</p>
      <p class="cover-tagline">Pouring the Foundation for Your Success</p>
      <div class="cover-divider"></div>',
    '    <div class="cover-body">
      <div class="cover-header-row">
        <div>
          <p class="cover-company">Foundation Stone Advisors, LLC</p>
          <p class="cover-tagline">Pouring the Foundation for Your Success</p>
        </div>
        <img src="/FSA_logo_white.png" class="cover-logo" alt="Foundation Stone Advisors">
      </div>
      <div class="cover-divider"></div>'
  )

WHERE slug IN ('sow', 'nda', 'msa');
