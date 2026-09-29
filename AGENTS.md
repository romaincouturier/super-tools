# Architecture rules

- Preparation-questionnaire reminder templates use `{{questionnaire_link}}` as a protected CTA placeholder, rendered server-side as an email-safe button plus fallback link, because editable templates must not inject arbitrary HTML.
- Evaluation templates must never contain Google Forms URLs; participant and sponsor links are tokenized SuperTools URLs generated at send time, because external forms bypass evaluation tracking.