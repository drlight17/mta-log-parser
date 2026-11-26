# User prompts

***
[2026-11-26 09:38:42 UTC]

ok. As project is analized do fix all issues found by you (security, bugs, dead/legacy code).
Cleanup code.
For now don't split code into new files - work with already created.
Don't leave too many comments in code.
Comments must be in english, no russian.
All my promts write into file in root of project 'user_prompts.md' with '***' divider between each promts block with current date time in divider.
Don't push any commits to repo without my command!
Dev container is stopped by me.

***
[2026-11-26 11:29:59 UTC]

/review uncommitted

Then selected: "Fix all except compose" (fix both auth issues and harden default SECRET_KEY handling, but do not touch the compose files).

***
[2026-11-26 11:33:16 UTC]

ok, commit these changes to https://github.com/drlight17/mta-log-parser/tree/v.1.8.6 branch. Don't forget to add changes description .

***
[2026-11-26 11:40:13 UTC]

Fix this: Werkzeug safe_join() allows Windows special device names (closes dependabot #10)

***
[2026-11-26 11:51:34 UTC]

push this commit to 1.8.6 branch. Remember: we pushing all commits to this branch when i command to push commit.

***
[2026-11-26 11:56:42 UTC]

provide variables in .env for user defined parser regexps override (closes [#25](https://github.com/drlight17/mta-log-parser/issues/25), [#28](https://github.com/drlight17/mta-log-parser/issues/28))

***
[2026-11-26 12:35:24 UTC]

push
