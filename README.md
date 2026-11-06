# PEM DWG Note Generator

Static web app (GitHub Pages ready) that builds ASME Y14.5-style drawing notes and a live, to-scale cross section for:

- Helical threaded inserts: MS21208 (inactive) replaced by MS122xxx / MS124xxx per NASM33537
- Self-clinching nuts: M45938/1 (MIL-N-45938/1B, now NASM45938/1)
- Self-clinching flush-head studs: M63540/1 (MIL-S-63540/1A, now NASM63540/1)
- Stainless-sheet clinch hardware with no mil PN (commercial only): PEM SP nuts and PEM FH4 studs, used for A304

Threads in v1: 4-40, 8-32, 10-32, 1/4-20. Substrates: 5052-H32, 6061-T6, A304 (annealed), A1008 CS Type B.

## How it works
- Every value printed in a note comes straight from a CSV row in `data/`. Nothing is computed into the note.
- Note symbols (v1.4), for pasting into SolidWorks notes: `<HOLE-SINK>` countersink, `<HOLE-DEPTH>` depth, `Ø` diameter, `°` degree. Per ASME Y14.5, the symbol precedes its dimension with no space.
- Countersinks are always called out with diameter and included angle (ASME Y14.5-2018 4.5.12). Inserts print `<HOLE-SINK>Ø.230-.260 X 120°`, with the angle from `csink_angle` (NASM33537). The angle tolerance is not printed; the drawing title block covers it.
- Values are shown with at most 3 decimal places (half-up rounding, so drill #7 .2010 prints as .201). A clinch hole nominal with more places has both limits rounded inward to stay inside the spec range.
- Clinch nut and stud holes (v1.7) print the standard drill and its decimal, the same style as inserts: `4X DRILL #3 (Ø.213) THRU`. Drills come from `data/clinch_drills.csv`; where no standard inch drill falls inside the spec range (.163 and .344 holes) the app shows an info line.
- Selections that break a spec rule are flagged, with one-click fixes, but still allowed.
- Blind insert holes must keep MIN DEPTH plus the 118 deg drill point inside the material.
- Clinch hardware is CRES only. Carbon steel and aluminum rows stay in the CSVs as a spec record but the app never offers them.
- Auto-select uses mil CRES whenever it is rated for the substrate. A304 exceeds the mil CRES limits, so the app uses PEM FH4 studs (rated to 92 HRB) and PEM SP nuts (rated to 90 HRB, with a warning to confirm sheet hardness). These print the PEM PN and CAGE 46384 and are tagged "Commercial PN, no mil equivalent".
- Thickness suggestions snap to standard sheet and plate stock for the selected material (gauge values for A304 and A1008, decimal sheet and plate for aluminum), stored in `data/materials.csv` with sources. Non-standard entries show the nearest standard thicknesses.
- For mil parts, the equivalent commercial PEM part number is shown grayed out for reference only and is never copied into the note.
- Stud spec values include PEM push-out, torque-out and pull-thru averages (`data/pem_fh_performance.csv`; FH4 values from its own CSV). These are PEM averages for reference, not spec minimums.
- The selection lives in the URL hash, so a link reproduces a note.

## Run locally
```
python3 -m http.server 8000
# open http://localhost:8000
node tests/notes.test.mjs   # golden-note tests
```

## Add hardware
Add rows to the matching CSV in `data/` with `in_app_scope=Y` and a `sources` entry from `data/sources.csv`. See `data/README.md` for column rules.

## Disclaimer
Drafting aid only. Verify every note against the current governing specification before release.
