# Handoff Protocol

Every substantial stage or fix handoff must be concise and state:

- task/stage and authorization;
- branch, baseline SHA, and head SHA;
- authorized scope and files changed;
- active decisions made;
- tests/evidence actually run;
- unresolved issues and production impact;
- next permitted action; and
- explicitly not-authorized next actions.

Do not create cumulative command diaries. Keep detailed evidence in Git history and dedicated reports. Historical `.context` handoffs remain evidence and are not the active handoff system.
