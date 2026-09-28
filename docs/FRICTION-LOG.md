# Observed friction

## Cross-origin test response comes from the framework

Task: verify the MCP endpoint rejects foreign-origin requests.
Steps: POST JSON to the local demo endpoint with a foreign Origin header.
Expected: the route's JSON 403 and no-store headers.
Actual: Vinext rejected the request earlier with plain Forbidden; the route did not execute.
Severity: Minor, affected the test assertion.
Workaround: assert rejection separately from the route-owned response shape.
Suggestion: document framework origin filtering and how to distinguish it from application guards.

## Preview tools unavailable for Alexa+ track

Task: determine a qualifying demonstration route.
Steps: read the hackathon rules and current Alexa+ FAQ.
Expected: clarity on whether Alexa+ Category SDK, MCP Toolkit, CLI or Web Simulator access was necessary.
Actual: the FAQ states these are limited to selected partners and unavailable to participants.
Severity: Important for choosing the integration path.
Workaround: use the explicitly permitted self-hosted MCP server with a custom frontend.
Suggestion: repeat this access limitation and the alternative route in individual setup guides.

These entries distinguish direct local observations from documentation findings. They do not claim tests against unavailable Alexa+ tools.
