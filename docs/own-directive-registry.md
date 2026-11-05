# Own directive registrations

Handler names are keys owned by the installed registry. An inherited property
must never count as a registration or a conflict. Registry normalization retains
existing own entries and removes prototypes; repeated installation retains the
registered callbacks. Internal leaf/container tables follow the same contract.

Acceptance examples:

- `Ruby uses :constructor symbol.` remains literal when no handler is registered.
- Unknown `:toString`, `:hasOwnProperty`, `:__proto__` and their block forms remain
  ordinary Markdown.
- An explicitly registered `constructor` inline, leaf or container handler runs
  exactly as registered after reinstalling the Directive plugin.
- Existing own upstream registrations survive normalization; inherited handlers
  do not run. Real own-entry conflicts still report errors.

Directive names retain the existing upstream grammar and normalization. This
repair does not change the scanner's delimiter or opaque boundary behavior.

Own property descriptors, including non-enumerable handlers and accessors, are
preserved without evaluating getters during normalization. The packed gate also
loads two physically separate copies of the archive into one native parser,
reinstalls both, and checks that original handlers and conflict checks survive.
This covers registry preservation; it does not claim that opaque boundary
registrations are shared between independent runtimes.
