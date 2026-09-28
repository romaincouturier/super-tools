# Architecture rules

- Preparation-questionnaire reminder templates use `{{questionnaire_link}}` as a protected CTA placeholder, rendered server-side as an email-safe button plus fallback link, because editable templates must not inject arbitrary HTML.