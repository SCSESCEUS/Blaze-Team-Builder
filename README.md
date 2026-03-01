# Blaze-Team-Builder

Web app for forming competition teams at Blaze Robotics Academy.

Portable static web app for forming robotics competition teams from student profile cards.

## What It Does

- Imports student responses from a CSV export, including common Google Forms headers
- Shows each student as a draggable profile card
- Collapses assigned student cards to just the student name and move control, with click-to-expand details
- Lets you create, edit, and delete teams
- Lets you create separate time slots, then drag teams into those slots
- Lets you add, edit, and delete students manually
- Exports the current team roster to CSV
- Stores the board in `localStorage`, so refreshes do not wipe the current setup
- Includes a manual "move to team" dropdown on every card for touch devices or non-drag workflows

## Run It

Open [index.html](/Users/bowen/Documents/Playground/index.html) directly in a browser.

If you prefer serving it locally:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## Expected CSV Columns

The importer looks for flexible header matches around these fields:

- `Name`
- `Age`
- `Grade`
- `School`
- `Classes Taken At Our Facility`
- `Competition Experience`
- `Time Preference 1`
- `Time Preference 2`
- `Time Preference 3`
- `Anticipated Time Commitment`
- `Special Request`

It ignores unrelated columns like timestamps.

## Porting Notes

The app is split into plain files:

- [index.html](/Users/bowen/Documents/Playground/index.html)
- [styles.css](/Users/bowen/Documents/Playground/styles.css)
- [app.js](/Users/bowen/Documents/Playground/app.js)

Because there are no framework dependencies, you can either:

1. Drop these files into another site as-is.
2. Move the logic in [app.js](/Users/bowen/Documents/Playground/app.js) into a component in a larger app later.

## Sample CSV

See [sample-students.csv](/Users/bowen/Documents/Playground/sample-students.csv) for a template you can adapt.
