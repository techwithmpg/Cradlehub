# ChatGPT Live Context

For substantial future decisions or reviews, ChatGPT must:

1. identify the canonical CradleHub repository;
2. resolve the current accepted `main` SHA;
3. read `AI_CONTEXT.md` at that exact SHA;
4. read the active governance manifest from that same SHA;
5. inspect the relevant implementation;
6. inspect an unmerged stage/fix branch directly when reviewing its work;
7. treat completion reports as evidence, not proof; and
8. distinguish repository-recorded production evidence from independently live-verified production state.

After an accepted stage change, update `AI_CONTEXT.md`, the active status, decision log, known-issues register, and any affected governance document in the same reviewed change. Do not use pasted historical context or `.context/` mirrors as a substitute for live repository reads.
