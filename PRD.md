# Super Tools — Product Requirements Document (PRD)

> Reverse-engineered from the codebase — March 2026

---

## 1. Executive Summary

**Super Tools** is a multi-module SaaS platform for training organizations, consultants, and service providers. It combines formation management, CRM, mission tracking, content marketing, AI-powered coaching, quote generation, support ticketing, event management, and professional networking into a single PWA.

**Stack**: React 18 + TypeScript + Vite + Tailwind CSS + Supabase (PostgreSQL, Auth, Edge Functions, Storage)

---

## 2. Modules & Features

### 2.1 Formations (Training Management) — 95%

**Purpose**: Manage training sessions (presentiel, inter-entreprises, classe virtuelle, e-learning) with full participant lifecycle.

#### Entities
| Table | Role |
|-------|------|
| `formation_configs` | Catalog templates (name, duration, price, program URL, WooCommerce product ID) |
| `formation_formulas` | 3 pricing/delivery models per config: solo, communaute, coachee |
| `trainings` | Formation instances (dates, location, format, assigned trainer) |
| `training_participants` | Learners with formula assignment |
| `training_schedules` | Day-by-day timetables |
| `training_live_meetings` | Collective e-learning sessions (meeting URL, scheduled time) |
| `training_coaching_slots` | 1:1 coaching availability (available/booked/completed) |
| `questionnaire_besoins` | Needs assessment (public token-based form) |
| `evaluations` | Post-training evaluations (participant, sponsor, trainer, cold) |
| `attendance_signatures` | Digital signature records |
| `training_documents` | Supports, programs |
| `training_media` | Photos/videos |

#### Workflows
1. **Creation** — From scratch or duplicate existing. Attach to catalog or standalone. Define dates, schedules, trainer, max participants.
2. **E-Learning** — Formulas with `learndash_course_id`, WooCommerce coupon generation for free access, live meetings, coaching slots with quota (`coaching_sessions_count`).
3. **Participant Lifecycle** — Add (bulk or individual) → auto-send needs survey → track attendance (signature pad) → auto-send evaluations → send thank-you emails with documents.
4. **Questionnaires & Evaluations** — Public token-based forms. Multi-section: identity, positioning, objectives, adaptations, accessibility, RGPD. Evaluation types: participant, sponsor, trainer, cold.
5. **Documents** — Certificate generation (variables: name, date, duration, signatures), attendance sheets (PDF), convention files (PDF + signing).

#### Business Rules
- Unique email per formation (`UNIQUE(training_id, email)`)
- Needs survey flags: if `necessite_amenagement=true`, trainer must validate
- Coaching quota per formula must not be exceeded
- Questionnaire submission statuses: `non_envoye → envoye → complete`

#### Unfinished
- Coaching slot reservation UI (backend ready, frontend ~40%)
- Live meeting reminder automation (structure in place, scheduler incomplete)
- Full e-learning onboarding orchestration (coupon generation works, full flow ~60%)

---

### 2.2 CRM (Opportunity Pipeline) — 80%

**Purpose**: Kanban-based sales pipeline with AI-powered opportunity extraction and commercial coaching.

#### Entities
| Table | Role |
|-------|------|
| `crm_columns` | Kanban columns (OPEN, WON, LOST, etc.) |
| `crm_cards` | Opportunities (contact, value, status, confidence) |
| `crm_tags` / `crm_card_tags` | Categorization (N:M) |
| `crm_comments` | Activity log |
| `crm_attachments` | Files |
| `crm_card_emails` | Outbound email tracking (open tracking) |
| `crm_email_templates` | Email templates |
| `crm_scheduled_emails` | Scheduled sending |

#### Workflows
1. **Opportunity Tracking** — Create cards manually or via AI extraction (`crm-extract-opportunity` Edge Function). Kanban drag-drop. Contact fields, estimated value, acquisition source, confidence score (0-100).
2. **Commercial Status** — TODAY (active) or WAITING (scheduled follow-up with mandatory date + text).
3. **AI Commercial Coaching** — `commercial-challenge` Edge Function generates health score, pipeline analysis, contextual coaching.
4. **Email Integration** — Send from card, track opens via pixel, template selection, scheduled sending.
5. **Quote Integration** — Each card can generate associated quotes (draft → generated → sent → signed).
6. **Mission Link** — `linked_mission_id` FK to missions.

#### Business Rules
- WAITING requires `waiting_next_action_date IS NOT NULL AND waiting_next_action_text IS NOT NULL`
- `next_action_type`: email, phone, rdv_physique, rdv_visio
- Confidence score: 0-100, AI-generated

#### Unfinished
- AI extraction pipeline needs reliability refinement
- Email template UX polish
- Advanced forecasting dashboards

---

### 2.3 Missions (Project Tracking & Profitability) — 85%

**Purpose**: Track consulting missions with profitability, contacts, activities, and documentation.

#### Entities
| Table | Role |
|-------|------|
| `missions` | Projects (title, status, dates, daily rate, total days) |
| `mission_contacts` | Stakeholders with roles |
| `mission_activities` | Time entries / deliverables (hours, amounts) |
| `mission_documents` | Project files |
| `mission_media` | Photos |
| `mission_pages` | Rich content notes (Tiptap editor) |

#### Workflows
1. **Lifecycle** — `not_started → in_progress → completed` (or cancelled). Kanban board view.
2. **Financial Tracking** — `daily_rate × total_days = total_amount` (generated column). `consumed_amount = SUM(activities.amount)`. Real-time P&L per mission.
3. **Logistics** — Track train_booked, hotel_booked. Google Calendar integration for activities.
4. **Documentation** — Rich text pages, image uploads, SVG support for diagrams.
5. **Follow-up** — Testimonial request tracking, waiting next action (date + text).

#### Business Rules
- `total_amount = daily_rate × total_days` (GENERATED ALWAYS AS)
- `consumed_amount` computed on-read from activities sum
- Status workflow enforced: not_started → in_progress → completed/cancelled

#### Unfinished
- Invoice PDF generation (templates exist, rendering incomplete)
- Advanced profitability forecasting

---

### 2.4 Content Marketing — 75%

**Purpose**: Editorial calendar with peer review workflow.

#### Entities
| Table | Role |
|-------|------|
| `content_cards` | Editorial items (type, status, deadline) |
| `content_reviews` | Peer review instances |
| `review_comments` | Threaded comments with proposed corrections |
| `review_images` | Annotated screenshots |

#### Workflows
1. **Kanban Board** — Columns: Idees, En cours, Relecture, Approuve, Publie. Drag-drop.
2. **Review** — Request from teammates, threaded comments, proposed corrections, image annotations.
3. **Newsletters** — Group content, track publishing.

#### Unfinished
- Advanced scheduling
- Publishing platform integration

---

### 2.5 Quotes / Devis (French Legal Compliance) — 70%

**Purpose**: Generate legally compliant French business quotes with PDF, signature, and email workflow.

#### Entities
| Table | Role |
|-------|------|
| `quote_settings` | Singleton: company details, legal info, payment terms, bank details |
| `quotes` | Quote instances (line items as JSONB, totals, signatures) |

#### Workflows
1. **Generation** — Create from CRM card. Line items with product, quantity, unit price, VAT rate. Auto-calculate HT, VAT, TTC. IP cession clause with rate calculation.
2. **Legal Settings** — SIREN, VAT number, legal form, share capital, RCS, APE, training declaration number, insurance, payment terms, late penalties, recovery indemnity.
3. **Lifecycle** — `draft → generated → sent → signed → expired/cancelled`. Email tracking. Client signature capture (signature pad). PDF storage.
4. **Extras** — Loom video embedding for sales walkthrough. SIREN API lookup. Travel expense calculator.

#### Business Rules
- Quote number: `{prefix}-{year}-{seq:4d}` (e.g., D-2026-0001), auto-incremented
- Expiry: default +30 days from issue_date
- VAT per line item, configurable rate
- IP cession: optional, at `rights_transfer_rate` % of HT total

#### Unfinished
- Mobile signature UX
- Signed PDF storage workflow

---

### 2.6 Support Ticketing — 75%

**Purpose**: Internal bug reports and feature requests.

#### Entities
- `support_tickets` — Title, description, priority (low/medium/high/critical), status, assignee
- `support_attachments` — Screenshots, files

#### Workflow
- Submit from any page (screenshot auto-capture). Kanban: `nouveau → en_cours → en_attente → resolu → ferme`. AI-suggested related tickets.

---

### 2.7 Events — 60%

**Purpose**: Track presentations, conferences, webinars with logistics and CFP deadlines.

#### Entities
- `events` — Title, date, location, type (internal/external), status
- `event_media` — Images, video links
- `event_cfp` — Call for Papers (deadline, URL, days left auto-calculated)

#### Workflow
- Create events, track logistics (train/hotel/room/restaurant), CFP deadlines, media gallery, cancellation with reason.

#### Unfinished
- Attendee management, reminders

---

### 2.8 Reseau (Professional Network) — v0.1 80%

**Purpose**: AI-assisted professional network mapping and relationship maintenance.

#### Entities
| Table | Role |
|-------|------|
| `user_positioning` | One-liner pitch, key skills, target client |
| `network_contacts` | Name, context, warmth (hot/warm/cold), LinkedIn, last contact |
| `network_actions` | Planned actions — v0.2 (type, message_draft, scheduled_week) |
| `network_conversation` | Chat history (onboarding & cartography) |
| `network_cooling_tracking` | Cooling thresholds per warmth level |

#### Workflows
1. **Onboarding** — AI asks 3 blocks: identity, value proposition, target client. Claude reformulates, user validates. Stores positioning.
2. **Cartography** — Sequential questionnaire about existing contacts. AI extracts names, context, warmth. User validates.
3. **Dashboard** — Contact list with warmth badges, positioning card, stats, cooling alerts.

#### Business Rules
- Onboarding is one-time (`onboarding_completed_at` immutable once set)
- Warmth: hot/warm/cold enum only
- Cooling thresholds configurable (e.g., 30d hot, 60d warm, 90d cold)

#### Unfinished (v0.2)
- Action generation (suggest LinkedIn messages, emails, calls)
- Weekly action scheduling
- Email/Slack integration for send

---

### 2.9 OKR — 50%

- Basic CRUD, Kanban view, progress tracking per quarter.
- **Unfinished**: Forecasting, alignment visualization, reporting.

---

### 2.10 Arena (Collaborative Discussion) — 70%

- Multi-party debate with AI facilitation. Participants submit arguments. AI suggests experts (`arena-suggest-experts`). Multi-turn orchestration (`arena-orchestrator`). Final synthesis.
- **Unfinished**: Advanced moderation, publication features.

---

### 2.11 Admin & Monitoring — 85%

- User management, audit logs (hourly DB snapshots), scheduled email dashboard, failed email retry queue, inbound email parsing (Resend webhook → CRM extraction), daily screenshots, DB size/query monitoring, cron health.

---

## 3. External Integrations

| Integration | Usage |
|-------------|-------|
| **WooCommerce / LearnDash** | Product IDs in `formation_configs`. Coupon generation (`generate-woocommerce-coupon`). Webhook creates LearnDash enrollments on order. |
| **Google Calendar** | OAuth tokens in `google_calendar_tokens`. Mission activities & training invites sync. |
| **Resend** | Inbound webhook → `inbound_emails`. Outbound transactional & marketing emails. Open/click/bounce tracking. |
| **Claude AI / OpenAI** | CRM extraction, commercial coaching, content assist, network assistant, quiz generation, evaluation analysis. |
| **SIREN API** | French company lookup for quote generation. |
| **Google Maps** | Training location embed, directions links. |
| **Loom** | Sales video embed in quotes, script stored in `quotes.loom_script`. |

---

## 4. Email System

20+ email types orchestrated via `scheduled_emails` table:

| Category | Types |
|----------|-------|
| Formation | `needs_survey`, `evaluation_reminder`, `training_documents`, `elearning_access`, `live_reminder`, `coaching_reminder` |
| CRM | Card emails, template-based sends |
| Support | Ticket notifications |
| Network | v0.2 action emails |

Auto-scheduling on events (e.g., participant added → needs survey). Manual force-send via `force-send-scheduled-email`. Failed emails stored with retry count.

---

## 5. Auth & Permissions (RLS)

All RLS policies use `auth.uid()` for multi-tenant isolation.

| Role | Access |
|------|--------|
| **Authenticated** | Read/write own entities across all modules. View all tickets. |
| **Admin** | Manage all users' entities, configure settings, monitoring, audit. |
| **Public/Anon** | Token-based access only: questionnaires, evaluations, complaint forms. |

**Security notes**: RLS policies with `USING (true)` for anon are unsafe — all public forms must validate token. CORS headers in Edge Functions should restrict to production domain.

---

## 6. Technical Architecture

### Frontend
- React 18.3 + React Router 6.30
- TanStack Query v5.83 (24h persistent cache via IndexedDB)
- Tailwind CSS v3.4 + shadcn/ui
- Tiptap v3 (rich text editor)
- React Hook Form + Zod validation
- @dnd-kit (Kanban drag-drop)
- PWA: Service Worker (Vite PWA plugin), offline support

### Backend
- Supabase PostgreSQL + Auth (email/password, MFA via TOTP)
- 116 Deno-based Edge Functions
- Supabase Storage (S3-compatible) — 10 buckets
- Real-time via PostgreSQL listen/notify

### Code Structure
```
src/
├── components/    # React UI components by feature
├── pages/         # Page components
├── hooks/         # 84+ React Query/custom hooks
├── lib/           # Utilities, Edge Function clients
├── types/         # TypeScript interfaces
├── i18n/          # French/English
└── index.css      # Tailwind

supabase/
├── migrations/    # 500+ SQL migrations
└── functions/     # 116 Edge Functions
```

---

## 7. Routes

| Route | Page |
|-------|------|
| `/` | Landing (public) |
| `/auth` | Login/signup |
| `/dashboard` | Overview |
| `/formations` | Training list |
| `/formations/new` | Create training |
| `/formations/:id` | Training detail (participants, schedules) |
| `/formations/:id/edit` | Edit training |
| `/besoins` | Needs survey summary |
| `/evaluations` | Evaluation dashboard |
| `/crm` | CRM Kanban |
| `/crm/reports` | Sales reporting |
| `/missions` | Mission Kanban |
| `/missions/:missionId` | Mission detail |
| `/contenu` | Content marketing board |
| `/events` | Event list |
| `/events/new` / `:id` / `:id/edit` | Event CRUD |
| `/reseau` | Network module |
| `/okr` | OKR |
| `/micro-devis` | Quick quote |
| `/devis-workflow` | Quote wizard |
| `/support` | Ticketing |
| `/statistiques` | Analytics |
| `/arena` | Collaborative discussion |
| `/arena/setup` / `:id/discussion` / `:id/results` | Arena flows |
| `/catalogue` | Catalog management |
| `/admin` | Admin panel |
| `/monitoring` | System health |
| `/questionnaire/:token` | Public needs survey |
| `/evaluation/:token` | Public evaluation |
| `/reclamation/:token` | Public complaint |
| `/learner-access` | Public e-learning access |
| `/learner-portal` | E-learning dashboard |
| `/lms-courses` | Course listing |
| `/lms-course-builder/:id` | Course editor |
| `/lms-course-player/:id` | Course player |

---

## 8. Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `training-documents` | Supports, programs |
| `training-media` | Training images/videos |
| `mission-documents` | Project files (SVG support) |
| `mission-media` | Project photos |
| `crm-attachments` | Opportunity files (public) |
| `certificate-storage` | Generated certificates |
| `devis-pdfs` | Quote PDFs |
| `review-images` | Review screenshots |
| `event-media` | Event images/videos |
| `app-screenshots` | Documentation screenshots |

---

## 9. Module Completion Summary

| Module | Status | Key Gap |
|--------|--------|---------|
| Formations | 95% | Coaching UI, e-learning automation |
| CRM | 80% | Forecasting, email template UX |
| Missions | 85% | Invoice PDF generation |
| Content | 75% | Scheduling, publishing integration |
| Quotes | 70% | Signed PDF storage, mobile UX |
| Support | 75% | SLA tracking, automation |
| Events | 60% | Attendee management, reminders |
| Network | 80% (v0.1) | Action generation (v0.2) |
| OKR | 50% | Forecasting, alignment |
| Arena | 70% | Moderation, publication |
| Admin | 85% | Advanced analytics |
