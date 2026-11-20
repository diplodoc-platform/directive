# Shared boundary ownership across installed copies

The actual Viewer graph legitimately installs byte-identical Directive archives in
native markdown-it 13 and 15 peer cohorts. Handler tables already belong to each
parser instance. Opaque boundary registrations must also belong to that instance:
module-local WeakMaps lose a registration when a different installed copy owns the
container scanner. This breaks nested Cut boundaries in the real Viewer plugin
array; forcing peers or requiring one physical package is not the repair.

## Versioned host protocol

Use one own, non-enumerable, non-writable, non-configurable property keyed by
`Symbol.for('@diplodoc/directive/boundary-host/v1')`. Its value has own data fields
`version: 1`, `registrations: Map`, and `wrappedRule: function | undefined`.
The state is per parser; the global symbol only names the protocol. No process
registry, host collection, ambient current parser or cross-host merging is added.

All copies read the same own state. Inherited state is ignored without invoking
accessors; creating a child parser's state shadows it with a fresh own map.
Malformed own descriptors, unsupported versions, accessor fields, invalid map
brands and invalid registration records fail explicitly rather than being silently
replaced or used. Registration and wrapper fields are checked through own data
descriptors without executing foreign getters. A non-extensible parser without
state fails before registration.

The installer marker stores the actual installed wrapper callback identity.
Repeated installations from either copy skip wrapping only while that exact rule
remains installed. A replaced rule receives a new wrapper; inherited markers do
not authorize skipping setup. Existing handler tables and conflict policy remain
unchanged. A malformed own protocol is validated before the upstream installer
can mutate rules or registries.

## Preserved boundary contract

Every registration still requires the exact currently enabled native block-rule
callback. Replacement/disable/re-registration invalidate the scanner configuration
through the existing rule and registration identity checks. Default recognizers
receive frozen retained snapshots; explicit scoped recognizers receive read-only
views valid only during the synchronous callback. No scanner cache or invocation
state is shared between hosts. Source indexing and copy bounds remain unchanged.

## Acceptance before adoption

Failure-first coverage uses two independently loaded copies, both installer and
registration orders, native 13/15 hosts, snapshot/scoped recognizers, hostile own
handler collisions, inherited/malformed protocol state, rule replacement and
re-registration. The old archive's same-copy positive/cross-copy negative control
must reproduce the failure. Rebuilt installed archives must pass the actual Viewer
plugin-array nested/equal/Note table cases, preserve Notes list paragraphs and
constructor literals, and retain the existing deterministic scanner work tests.
Normal full hooks, typecheck, lint and the packed native host matrix remain gates.
Root reviews the final diff before commit/push. No peer coercion, source alias,
dependency/version change or publication is included.
