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

## Local compiler API

The local API wires `ContextCompilerService`, `SemanticDomProcessor`, and `InMemorySemanticIndex` together. It starts with a seeded Gmail-style map and also accepts new snapshots:

```bash
curl -X POST http://localhost:8080/semantic/compile \
  -H 'content-type: application/json' \
  -d '{"applicationId":"demo","pageId":"home","urlPattern":"https://example.test/*","vocabulary":{"submit":"submit form"},"root":{"tagName":"button","textContent":"Submit","attributes":{"aria-label":"Submit"}}}'
```

Compiled maps can be listed with `GET /semantic/maps?applicationId=demo` and queried with `GET /semantic/query?applicationId=demo&q=submit%20form`.

## Target resolution

Execution primitives do not hard-code selectors. They ask semantic memory to resolve business meanings such as `email recipient`, then use the highest-confidence selector candidate. This keeps flow graphs stable when low-level DOM selectors change.
