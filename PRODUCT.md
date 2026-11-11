# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Time Capsule serves people writing to their future selves and people creating capsules for friends or loved ones. These audiences have equal priority.

Specific age groups, occasions, and recipient access needs remain undecided.

## Product Purpose

Let people write a letter for a chosen future date. The core journey is to compose a capsule, seal it, wait, and open it.

## Operating Context

The current project is a local web prototype. The website has four pages.

- `index.html` introduces Time Capsule, summarizes the capsule list, and shows a letter from the past when available.
- `create.html` takes a title, letter, opening date and time, and an optional song.
- `dashboard.html` lists capsules and lets readers filter by status.
- `capsule.html` shows the countdown and lets the reader break the seal when the capsule is ready. It also requests historical events for the opening date.

FastAPI serves the website at `/app/`. Swagger documents capsule creation and editing, recipient management, and scheduled opening.

## Capabilities and Constraints

### Current implementation, verified from repository source

- The static HTML, CSS, and JavaScript frontend uses the API for new capsules, bundled JSON for examples, and browser storage for older saves at their original address.
- The form supports a title of up to 100 characters, a letter of up to 5,000 characters, and optional song metadata from iTunes. It converts the selected local date and time to a timestamp. The server validates the opening window, which by default starts one minute ahead and extends up to 50 years.
- FastAPI uses sealed, ready, and opened states. It refuses early opening and withholds the letter and any song until someone explicitly breaks the seal after the scheduled time. API records use a shared in-memory list and are cleared on restart.
- The API lets users edit sealed capsules and add or remove recipient records while a capsule is sealed. The website has no recipient entry or delivery workflow.
- Song metadata is supported by the API and capsule reader. Photos have no attachment workflow.

### Open decisions

- Whether the local prototype will move to a public release and which attachment types that release should support.
- Recipient identity, access permissions, invitations, delivery, and notifications.
- Authentication, durable storage, privacy enforcement, retention, and recovery requirements.
- The rules for editing or deleting capsules in a public release.
- Deployment target and any required accessibility standard or supported languages.

## Brand Commitments

The existing product name is **Time Capsule**. The English interface uses “capsule,” “sealed,” “ready,” “opened,” and “Break the seal.”

## Evidence on Hand

- `README.md` describes the project and how to run it.
- The HTML pages and `js/` implement the website and the sample capsule.
- `capsules.json` contains the original example letters.
- `Time-capsule backend/app/` and `Time-capsule backend/tests/` show the capsule and recipient workflows, including when the API reveals capsule contents.

## Product Principles

- Give capsules for future selves and loved ones equal weight in product decisions.
- Make the chosen opening date and the capsule's state clear throughout the journey.
- Preserve the distinction between composing, waiting, and intentionally opening a capsule.
- Describe privacy, storage, attachments, and recipient delivery according to what the implementation actually supports.
