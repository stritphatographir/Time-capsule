# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Time Capsule serves people writing to their future selves and people creating capsules for friends or loved ones. These audiences have equal priority.

Specific age groups, occasions, and recipient access needs remain undecided.

## Product Purpose

Let people write a letter for a chosen future date. The core journey is to compose a capsule, seal it, wait, and open it. An optional prediction captures what the writer thinks will be true by then, so it can be revisited alongside the letter.

## Operating Context

The current project is a local web prototype with a documented defense demo. The website has four pages.

- `index.html` introduces Time Capsule and offers a 10-second example.
- `create.html` takes a title, letter, opening date and time, and optional prediction.
- `dashboard.html` lists capsules and shows each capsule’s opening time and status.
- `capsule.html` shows the countdown and lets the reader break the seal when the capsule is ready. It then shows the letter and any prediction.

The sample letter runs entirely in the browser. The defense demo then uses Swagger to show capsule creation and editing, recipient management, and scheduled opening. The README provides the local startup commands for the website and the API.

## Capabilities and Constraints

### Current implementation, verified from repository source

- The static HTML, CSS, and JavaScript frontend uses the FastAPI backend in `Time-capsule backend/` to create, list, view, and open new capsules. The API uses a shared list without sign-in and clears its records on restart.
- The form supports a title of up to 100 characters, a letter of up to 5,000 characters, and a prediction of up to 160 characters. It converts the selected local date and time to a timestamp for the API. The API’s default opening window starts one minute ahead and extends up to 50 years.
- The API uses sealed, ready, and opened states. It refuses early opening and withholds the letter, prediction, and any song until someone explicitly breaks the seal after the scheduled time.
- Older browser-saved capsules and original sample links are still readable. Their contents are stored in the browser or sample JSON, with the countdown enforced in the interface.
- The API lets users edit sealed capsules and add or remove recipient records while a capsule is sealed. The website has no recipient entry or delivery workflow.
- The current form offers a prediction field. Song metadata is still supported by the API and capsule reader. Photos have no attachment workflow.

### Open decisions

- Whether the local prototype will move to a public release and which attachment types that release should support.
- Recipient identity, access permissions, invitations, delivery, and notifications.
- Authentication, durable storage, privacy enforcement, retention, and recovery requirements.
- The rules for editing or deleting capsules in a public release.
- Deployment target and any required accessibility standard or supported languages.

## Brand Commitments

The existing product name is **Time Capsule**. The English interface uses “capsule,” “sealed,” “ready,” “opened,” and “Break the seal.”

## Evidence on Hand

- `README.md` documents local setup and the defense demo.
- The HTML pages and `js/` implement the website and the sample capsule.
- `capsules.json` contains the original example letters.
- `Time-capsule backend/app/` and `Time-capsule backend/tests/` show the capsule and recipient workflows, including when the API reveals a prediction.

## Product Principles

- Give capsules for future selves and loved ones equal weight in product decisions.
- Make the chosen opening date and the capsule's state clear throughout the journey.
- Preserve the distinction between composing, waiting, and intentionally opening a capsule.
- Describe privacy, storage, attachments, and recipient delivery according to what the implementation actually supports.
