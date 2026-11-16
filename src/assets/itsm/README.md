# ITSM logos

Drop each ITSM's official logo here, named after the platform in lower case:

- `servicenow.svg` (or `.png`)
- `autotask.svg` (or `.png`)
- `jira.svg` (or `.png`)
- `xurrent.svg` (or `.png`)

The incident panel's **Create ticket** button and the Incidents overview's
**Incident Notifications** card pick them up automatically (see
`src/app/components/itsm.ts`). Until a file is here, they show the generic
ticket icon.

Square marks work best — the button draws them at 16 × 16 px.
