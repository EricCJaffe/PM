# ONBOARDING_RUNBOOK.md — Customer Onboarding

> The repeatable sequence from signed contract to first productive session.
> White-glove onboarding means this runs with a human guide — but it must be
> documented so any team member can run it, not just the founder.
>
> One runbook per vertical. Add new verticals as they launch.

---

## Onboarding principles

1. **First value in first session** — the customer should see something working before they leave the onboarding call
2. **Document everything** — every customer question is a product gap or a doc gap
3. **Their language, not ours** — use CLIENT_CONTEXT.md from the first minute
4. **Set expectations explicitly** — what happens this week, what happens next week, what they do vs what we do
5. **No surprises** — timeline, access, training, support — all stated upfront

---

## Universal onboarding sequence (all verticals)

### Before the onboarding call (day 0)

**Team tasks:**
- [ ] Signed contract received and filed
- [ ] Org created in Mission Control database
- [ ] Vertical pack assigned (`vertical` field set)
- [ ] Admin user account created and invite sent
- [ ] Onboarding call scheduled (90 min for first session)
- [ ] `CLIENT_CONTEXT.md` started — fill in what you know from the sales process
- [ ] Pre-call questionnaire sent (see template below)

**Pre-call questionnaire to send:**
```
Before our onboarding call, please take 10 minutes to answer these:

1. Who are the 2-3 people who will use this most day-to-day?
2. What's the one thing you most want to stop doing manually?
3. What does your team currently use to manage [projects / services / ministry / programs]?
4. Are there any tools we absolutely must connect to?
5. What would make you say "this was worth it" in 90 days?
```

---

### Onboarding call — session 1 (90 minutes)

**Goal:** Customer leaves with something working and knows what to do next.

**Agenda:**
1. Introductions and expectations (10 min)
2. Tour of core platform — their data, their vertical (20 min)
3. First workflow walkthrough — the one they said was most broken (30 min)
4. Live configuration — set up their first project or process together (20 min)
5. Next steps and homework (10 min)

**What to configure live:**
- Org name, logo, primary users
- First project in their vertical
- First workflow end-to-end (even a simple one)
- Notification settings

**What to leave for session 2:**
- Integrations (requires their credentials — do async)
- Custom workflows beyond the standard pack
- Full team rollout (admin first, then team)

**End of call checklist:**
- [ ] At least one workflow is running
- [ ] Admin knows how to add team members
- [ ] Next session scheduled (within 7 days)
- [ ] Homework assigned (see below)

**Customer homework after session 1:**
```
Before our next call:
1. Add your other team members (instructions sent separately)
2. Create 3 real projects from your current work
3. Write down any questions that come up as you explore
4. Try to complete [specific workflow] on your own — we'll review it together
```

---

### Session 2 (60 minutes, within 7 days)

**Goal:** Full team is onboarded, core workflows are running, integrations connected.

**Agenda:**
1. Review homework — what worked, what was confusing (15 min)
2. Team member onboarding — walk through with full team (20 min)
3. Integrations — connect their existing tools (15 min)
4. Q&A and troubleshooting (10 min)

**Integrations to connect (by priority):**
- [ ] Email (for notifications)
- [ ] Calendar (for scheduling)
- [ ] Their existing PM tool (if migrating)
- [ ] Accounting/billing (if in scope)

**End of session 2 checklist:**
- [ ] All team members have accounts and have logged in
- [ ] Core integrations connected
- [ ] Customer can run their top 3 workflows without help
- [ ] 30-day check-in scheduled

---

### 30-day check-in (30 minutes)

**Goal:** Catch issues before they become reasons to churn. Identify expansion opportunities.

**Questions to ask:**
- What's working well?
- What did you stop using and why?
- What's still happening manually that you expected to be automated?
- What would you want to add?
- Who else in your network has this problem?

**Actions to take:**
- [ ] Log feedback in `CLIENT_CONTEXT.md`
- [ ] Add feature requests to `TASKS.md` with client attribution
- [ ] If struggling: schedule additional training session
- [ ] If thriving: ask for a referral or testimonial

---

## Vertical-specific additions

### Agency OS onboarding additions

**Additional session 1 topics:**
- GitHub integration setup
- Claude Code workflow walkthrough
- PROMPT_LIBRARY.md introduction — show them how to save patterns

**Additional session 2 topics:**
- First project run-through with full CLAUDE.md system
- Preflight script walkthrough
- Handoff protocol practice

**First workflow to configure live:**
Client intake → PROJECT_INIT.md interview → project creation

---

### Church OS onboarding additions

**Additional pre-call questions:**
```
4b. How many services do you hold per week?
4c. Do you have multiple campuses or locations?
4d. What does your current volunteer management look like?
4e. How do you communicate with your congregation today?
```

**Additional session 1 topics:**
- Service planning workflow
- Ministry team structure setup
- Event and calendar configuration

**Additional session 2 topics:**
- Giving integration (Tithe.ly, Pushpay, or Stripe)
- Volunteer coordination workflow
- Communication templates

**First workflow to configure live:**
Weekly service planning → team assignments → communication

---

### Nonprofit OS onboarding additions

**Additional pre-call questions:**
```
4b. Do you manage grants or restricted funding?
4c. How many active programs or services do you run?
4d. What does volunteer recruitment look like today?
4e. Do you have a board that needs reporting?
```

**Additional session 1 topics:**
- Program management setup
- Donor/constituent record structure
- Impact tracking configuration

**Additional session 2 topics:**
- Grant tracking workflow
- Board reporting template
- Volunteer management

**First workflow to configure live:**
Program enrollment → service delivery → impact tracking

---

## Onboarding quality checklist

Before marking a customer as "onboarded":

- [ ] All team members have logged in at least once
- [ ] At least 3 real projects or programs created
- [ ] At least 2 core workflows completed end-to-end
- [ ] Primary integration connected (email at minimum)
- [ ] Customer has asked at least one question we answered (engagement signal)
- [ ] `CLIENT_CONTEXT.md` updated with learnings from sessions
- [ ] 30-day check-in scheduled
- [ ] Feedback logged in product backlog

---

## Common onboarding failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Customer goes quiet after session 1 | Homework too hard / no quick win | Simplify homework, schedule session 2 sooner |
| Team members not logging in | Admin didn't send invites | Follow up with admin directly, send invite instructions again |
| "This isn't what we expected" | Misalignment in sales process | Review CLIENT_CONTEXT.md, adjust configuration |
| Integration blocked | IT/security approval needed | Identify earlier in sales process, add to pre-call checklist |
| Customer using old system in parallel | Not enough confidence yet | More training, identify their most hated manual task and automate it first |

---

## Last updated
[YYYY-MM-DD] — Update after every onboarding to capture what you learned.
