# Observed friction

15 October 2026. Only problems actually encountered in this polish pass are recorded.

| Task | Steps | Expected | Actual | Severity | Workaround | Suggestion |
| --- | --- | --- | --- | --- | --- | --- |
| Resume the current source safely | Inspect the older `understudy-app` checkout and compare release/remote state | A clean current checkout | The older checkout was at an earlier commit with substantial unrelated uncommitted source/UI changes | Medium, source hygiene | Preserved it intact; used the clean `understudy-release` checkout and a separate disposable D1 judge clone | Identify the release SHA before resuming work across several checkouts |

The full Node 22 suite, typecheck, lint, build and isolated D1/HTTP judge workflows passed; no new product failure is claimed. The Node SQLite experimental warning is expected runtime output, not a failed check. The older dependency review remains dated historical information, not a fresh zero-advisory assertion.

Owner confirmation required: personal SDK/tool feedback, any hosted signed-out access claim, physical Echo/Alexa+ distribution and institutional usefulness. The local `/demo` route avoids the hosted owner's login and does not imply those validations. No Bedrock call or AWS Builder claim was added.
