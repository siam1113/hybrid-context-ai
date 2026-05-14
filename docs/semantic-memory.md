# Semantic Memory

The semantic memory model converts DOM snapshots into application-level UI knowledge:

```json
{
  "elementId": "compose_0_abc12345",
  "semanticRole": "button",
  "businessMeaning": "compose email",
  "selectors": [{ "strategy": "aria", "value": "Compose", "confidence": 0.94 }],
  "confidence": 0.91,
  "visualPosition": { "x": 24, "y": 88, "width": 120, "height": 48 },
  "parentComponent": "mail_navigation",
  "relatedActions": ["click:compose email"],
  "fingerprint": "abc12345"
}
```

Selector confidence combines ARIA labels, role and test IDs, text similarity, visual hierarchy, DOM neighborhood, and interaction history. Raw CSS selectors are treated as fallback evidence rather than primary identity.
