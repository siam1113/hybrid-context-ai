# Flow Memory

Flows are reusable DAGs that encode deterministic application behavior. They are selected by intent examples and enriched with runtime assertions.

```mermaid
stateDiagram-v2
  [*] --> open_compose_modal
  open_compose_modal --> fill_email_recipient
  fill_email_recipient --> fill_email_subject
  fill_email_subject --> fill_email_body
  fill_email_body --> upload_attachment
  upload_attachment --> submit_form
  submit_form --> email_sent_successfully
  email_sent_successfully --> [*]
```

A Gmail-style attachment flow is represented as primitives rather than live LLM decisions. The LLM may choose this flow or request missing context, but it does not decide every click at runtime.
