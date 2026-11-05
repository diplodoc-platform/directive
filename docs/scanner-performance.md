# Boundary scanner performance contract

Task: DOCSTOOLS-6943, finding 4.

Native delimiter discovery must preserve absolute UTF-16 source coordinates,
current list/quote line offsets, native fence/HTML rules, opaque block boundaries,
and malformed-container recovery. It must not change the real host's arrays,
tokens, environment, options, or tokenize method. Registered handlers and
unregistered custom block rules do not execute during discovery.

## State and configuration

Construct native scanner defaults from an empty source; bind the already indexed
host source through sparse copy-on-write line arrays. Native scanner writes stay
local. The internal overlay supports the numeric assignments/restoration used by
native rules; it is not a general mutable-array replacement. Each invocation owns its closing line, recursive scope stack, tokens, and
environment. Reentrant discovery on the same cached scanner uses another state
and another invocation record. Cleanup runs on exceptions too.

Cache only scanner setup, with a fresh comparison of host constructor, block
State/tokenize/ruler identities, all ordered rules and their actual callback
identities, enablement and copied alt chains, opaque recognizer identities and
input mode, and scalar/function options. Options object replacement invalidates
the cache. Object-valued and accessor options disable reuse because identity
cannot prove their contents unchanged. No source, token, environment, or mutable
per-scan scope is cached across calls.

## Additive opaque input capability

Existing four-argument `registerBlockBoundary` calls keep stable frozen snapshot
semantics. Their snapshots remain readable and unchanged after the callback and
subsequent host parses. This compatibility path retains full line-array copying.

The optional fifth argument `{input: 'scoped'}` opts into synchronous read-only
line-array views. Reads use absolute indexes, including native list/quote offsets.
Normal array enumeration and descriptors remain available on demand; enumeration
materializes keys only when explicitly requested. Writes, defining/deleting
properties, prototype changes, and freezing the view
are rejected. Array access after return or throw is rejected. Recognizers may
copy values explicitly during the callback; they may not retain live views or
perform asynchronous work. The input object remains frozen. No actual host or
mutable scanner field is passed to the callback.

The performance claim covers native rules and owners explicitly opting into this
scoped capability. It does not silently weaken the existing snapshot API.
Transform Table adoption must use the new published types and runtime together;
local validation overlays are not product dependency-pin changes.

## Acceptance

- Failure-first N/2N tests count scanner constructors, source characters supplied
  to native State constructors, and automatically copied line-array cells.
- Native and scoped opaque independent containers have bounded setup and source
  indexing. Stable default snapshots remain a separate compatibility test.
- Exercise lists/quotes, nesting, lazy continuation, tables, fences, HTML,
  exceptions, reentrant recognizers, and input immutability/lifetime.
- Change host options, constructors, rule callbacks/order/alt/enablement and
  boundary registrations between parses; require fresh matching configuration.
- Run strict packed consumer tests on native MarkdownIt 12, 13, 14, 15 and a mixed
  root-13/aliased-15 graph. Compare actual old/new tokens and HTML, not only source
  unit results. Timing measurements supplement deterministic work counts.

## Local archived comparison (2026-11-05)

The baseline archive built from `56b4382` and the candidate archive were compared
on native 12.3.2, 13.0.2, 14.1.0 and 15.0.3, plus root-13/aliased-15 hosts.
Across 918 comparisons, complete token JSON, rendered HTML and environment were
identical for native, default snapshot and scoped opaque fixtures, including
HTML-option changes between parses.

For 20/40/80 independent opaque containers, baseline discovery constructed
20/40/80 scanner parsers, indexed 13,200/52,800/211,200 source characters and
copied 19,360/77,120/307,840 line-array cells. Scoped discovery constructed one
scanner parser and indexed/copied zero whole-document characters/cells in each
case. These counters measure discovery overhead; the host still indexes its
input normally and each scanner visits its container's content. They do not
claim linear time for arbitrarily deep nested containers or arbitrary callbacks.

Manual native-15 scoped timings (seven warm samples) were 1.34/2.72/8.91 ms
before and 0.89/1.88/4.01 ms after for 40/80/160 containers. Timings are local
supporting observations, not a CI or production latency guarantee. Default
snapshot callbacks intentionally retain full snapshot copying; consumers need
an explicit scoped opt-in to obtain the opaque-recognizer allocation benefit.

The separate local Transform Table opt-in was tested with normal npm-installed
archive overrides for the reviewed Notes and Tabs companions and one common
Directive package. Eight complete public token/result comparisons passed,
including nested Cuts with fenced markers inside YFM tables. At 20/40/80
independent Notes containing tables, baseline discovery indexed
20,400/81,600/326,400 characters and copied 32,160/128,320/512,640 cells; scoped
Table discovery indexed/copied zero whole-document characters/cells.

The existing duplicated-Directive dependency graph remains a negative control:
its module-local opaque registries cannot communicate across physical copies,
and nested Cut/table output remains incorrect in both baseline and candidate.
This scanner change does not repair dependency alignment. The prepared common
archive override graph is a local integration check, not publication or changed
product pins.
