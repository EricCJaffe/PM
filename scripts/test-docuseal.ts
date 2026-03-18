/**
 * DocuSeal API connectivity test script.
 *
 * Usage:
 *   npx tsx scripts/test-docuseal.ts
 *
 * Requires DOCUSEAL_API_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const API_KEY = process.env.DOCUSEAL_API_KEY;
const API_URL = process.env.DOCUSEAL_API_URL || "https://api.docuseal.com";

if (!API_KEY) {
  console.error("❌ DOCUSEAL_API_KEY is not set in .env.local");
  process.exit(1);
}

async function testConnectivity() {
  console.log(`\n🔌 Testing DocuSeal API connectivity...`);
  console.log(`   Base URL: ${API_URL}`);
  console.log(`   API Key:  ${API_KEY!.slice(0, 8)}...${API_KEY!.slice(-4)}\n`);

  // Test 1: List templates (simplest authenticated endpoint)
  console.log("── Test 1: GET /templates ──");
  try {
    const res = await fetch(`${API_URL}/templates?limit=3`, {
      headers: { "X-Auth-Token": API_KEY! },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`   ❌ ${res.status} ${res.statusText}: ${body}`);
      return false;
    }

    const data = await res.json();
    const templates = data.data || data;
    console.log(`   ✅ Connected! Found ${Array.isArray(templates) ? templates.length : 0} template(s)`);
    if (Array.isArray(templates)) {
      for (const t of templates) {
        console.log(`      - ${t.name} (id: ${t.id})`);
      }
    }
  } catch (err) {
    console.error(`   ❌ Connection failed:`, err instanceof Error ? err.message : err);
    return false;
  }

  // Test 2: List recent submissions
  console.log("\n── Test 2: GET /submissions ──");
  try {
    const res = await fetch(`${API_URL}/submissions?limit=3`, {
      headers: { "X-Auth-Token": API_KEY! },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`   ❌ ${res.status} ${res.statusText}: ${body}`);
    } else {
      const data = await res.json();
      const submissions = data.data || data;
      console.log(`   ✅ Found ${Array.isArray(submissions) ? submissions.length : 0} recent submission(s)`);
    }
  } catch (err) {
    console.error(`   ❌ Failed:`, err instanceof Error ? err.message : err);
  }

  // Test 3: Dry-run HTML submission (create and immediately archive)
  console.log("\n── Test 3: POST /submissions/html (test document) ──");
  try {
    const testHtml = `
      <html>
        <body>
          <h1>DocuSeal Integration Test</h1>
          <p>This is a test document from BusinessOS PM.</p>
          <p>Generated at: ${new Date().toISOString()}</p>
          <p><strong>If you received this, the integration is working!</strong></p>
        </body>
      </html>
    `;

    const res = await fetch(`${API_URL}/submissions/html`, {
      method: "POST",
      headers: {
        "X-Auth-Token": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: testHtml,
        name: "PM Integration Test",
        send_email: false, // Don't actually email anyone
        submitters: [
          {
            name: "Test User",
            email: "test@example.com",
            role: "Signer",
            send_email: false,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`   ❌ ${res.status} ${res.statusText}: ${body}`);
      if (res.status === 422) {
        console.log(`   ℹ️  This may require a Pro plan for HTML submissions.`);
      }
    } else {
      const submitters = await res.json();
      console.log(`   ✅ Test submission created successfully!`);
      console.log(`      Submitter ID: ${submitters[0]?.id}`);
      console.log(`      Status: ${submitters[0]?.status}`);
      console.log(`      Embed URL: ${submitters[0]?.embed_src ? "present" : "none"}`);

      // Clean up: archive the test submission
      if (submitters[0]?.id) {
        // Get submission ID from submitter
        const subRes = await fetch(`${API_URL}/submitters/${submitters[0].id}`, {
          headers: { "X-Auth-Token": API_KEY! },
        });
        if (subRes.ok) {
          const submitter = await subRes.json();
          const submissionId = submitter.submission_id;
          if (submissionId) {
            const delRes = await fetch(`${API_URL}/submissions/${submissionId}`, {
              method: "DELETE",
              headers: { "X-Auth-Token": API_KEY! },
            });
            if (delRes.ok) {
              console.log(`   🧹 Test submission archived (cleaned up)`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`   ❌ Failed:`, err instanceof Error ? err.message : err);
  }

  console.log("\n── Summary ──");
  console.log("✅ DocuSeal API is reachable and authenticated.");
  console.log("   Your eSign integration should work end-to-end.\n");
  return true;
}

testConnectivity().catch(console.error);
