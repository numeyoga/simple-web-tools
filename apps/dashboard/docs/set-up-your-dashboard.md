# Set up your dashboard

The quickest way to see how it works is **Load the sample** (on the empty screen, or under
**Administration, Settings**): 4 templates and 12 applications on addresses that cannot resolve.

## How the pieces fit

- A **template** describes one kind of application: its **environments** (for example DEV, TEST,
  PROD), its **metadata fields** (a cluster, a namespace, an owner...) and its **links**, each with a
  **pattern**.
- An **application** is made from a template. For each environment it holds the values of the
  metadata fields. Its links are the patterns of the template, filled in.
- A **tag** groups links (CI / CD, Monitoring, Docs...). It has a label and an icon.

## Templates

Open **Administration, Templates**.

1. **New template** adds one with two environments (DEV, PROD) and an Owner field. Give it a name
   and a description.
2. **Environments**: a label (shown) and a key (what `{env}` stands for). Change the key of an
   environment and the applications that use the template keep their data. Move them to change
   the order of the tabs; a template keeps at least one.
3. **Links**: a name, a **tag**, a **pattern** and a **scope**. The scope says whether the address is
   meant to differ per environment or to be the same in all of them (a repository, a code quality
   page); it is a hint, both are filled in the same way.
4. A template that applications use cannot be deleted: delete or change those applications first.

### Patterns

| Write            | To get                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `{env}`          | the key of the environment                                         |
| `{slug}`         | the slug of the application                                        |
| `{jiraKey}`      | its Jira key                                                       |
| `{meta.cluster}` | the value of the field whose key is `cluster`, in that environment |

Example: `https://console.{meta.cluster}.example.invalid/k8s/ns/{meta.namespace}`. The earlier
way, `{cluster}`, still works. The screen lists the placeholders the template offers.

### Metadata fields

Open **Administration, Metadata fields**, choose a template. A field has a label, a **key**
(letters, digits and underscores: the name used in patterns), and a type: text, text in mono, list
(with its choices separated by commas) or date. Renaming a key keeps the values; deleting a field
deletes its values. `env`, `slug`, `jiraKey` and `meta` cannot be used as keys.

## Tags

Open **Administration, Tags**. Renaming a key carries the links along. Deleting a tag keeps its
links, shown under "Unknown tag", so you can fix them; links without a tag are listed last.

## Applications

**New application** asks for a name, a slug (made from the name until you edit it; it is what
`{slug}` stands for, and it is unique), a template and an optional Jira key. It opens at once; press
**Edit** and fill in the metadata of each environment to complete its links.

## A link that cannot be opened

It is shown with the reason, and its open and copy buttons are disabled:

- **To fill in**: the pattern still has a placeholder with no value (for example `{meta.cluster}`).
  The environment tab counts these links.
- **Not a web address**: the address resolves to something that is not `http` or `https`
  (`javascript:`, `data:`, `file:`...). These are never opened.
- **Not a complete web address**: there is no `https://` at the start, or no host. Put the scheme
  in the pattern or in the value of the field.
- **No address**: the pattern is empty.
