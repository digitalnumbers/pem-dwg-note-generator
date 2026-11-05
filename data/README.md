# Hardware data (v0.9, confirmed-only)

| File | Rows | Content |
|---|---|---|
| hardware_ms21208.csv | 35 | Helical inserts 4-40, 6-32, 8-32, 10-24, 10-32, 1/4-20, 1/4-28; 1D-3D |
| hardware_m45938_1.csv | 46 | Clinch nuts 2-56 through 1/4-20 incl. 1/4-28; carbon, CRES, aluminum dashes |
| hardware_m63540_1.csv | 100 | Flush-head studs 2-56 through 1/4-20; carbon and CRES |
| hardware_pem_sp.csv | 11 | PEM SP (PEM 300) clinch nuts 4-40, 8-32, 10-32, 1/4-20; commercial only, no mil PN |
| hardware_pem_fh4.csv | 35 | PEM FH4 flush-head studs 4-40, 8-32, 10-32, 1/4-20; commercial only, no mil PN |
| materials.csv | 4 | 5052-H32, 6061-T6, A304, A1008 CS Type B hardness and compatibility |
| sources.csv | 20 | Source IDs referenced in each row |

Rules
- `note_pn` / `note_cage` are what the drawing note prints (current mil PN, CAGE 80205). `legacy_pn` / `legacy_cage` are kept for reference.
- Exception: rows with `commercial_only` = Y (SP nuts, FH4 studs) print the PEM catalog PN and PEM CAGE 46384, because PEM's MIL cross reference lists no military PN for SP, FH4 or FHP. The app uses them only when no mil part is rated for the substrate (A304), or when the user selects them.
- Every row is CONFIRMED against the spec or standard. Cross-source checks: insert FP/FB/H match NASM33537 and Heli-Coil and pass the NASM33537 formulas. Stud dash grid matches vendor listings.
- Blank cells are values that are illegible or defective in the source; nothing was guessed. Vendor values appear only in `*_vendor_ref` columns and must not be used in notes.
- Stud length L follows the PEM FH datum: overall length from the top (flush) face of the head.
- Stud `unthreaded_S_max` is MIL-S-63540/1A Table I "S MAX": the maximum unthreaded length under the head (renamed from `head_height_max` in v0.7). The spec gives no head thickness.
- Hardware larger than 1/4 is out of scope for now. 5-40 inserts are excluded because no drill recommendation was confirmed. M63540/1-57 (listed by PEM but not in MIL-S-63540/1A) is excluded.

Commercial-only PEM rows (SP, FH4)
- Source: PEM bulletin SS, Fasteners For Use In Stainless Steel Sheets, rev 10/13/26. SP dimensions pg SS-3, FH4 pg SS-10, material pg SS-15, performance pg SS-23/24, Dos and Don'ts pg SS-27. Checked against the page images.
- SP: rated for stainless sheet HRB 90 / HB 192 or less. Shank code chosen as the longest shank whose recommended minimum sheet thickness fits; PEM publishes no maximum sheet thickness. Performance values are PEM averages in 304 stainless, stored in `*_avg` columns, not spec minimums.
- FH4: hardened 400-series stainless, rated for stainless sheet HRB 92 / HB 202 or less. Sheet thickness range .040-.095 (1/4-20: .062-.117); PEM notes performance may be reduced in thicker sheets. Length L is overall from the flush head face (PEM drawing). Requires the PEM special anvil with raised ring. FHP (A286) is not included.
- Only 4-40, 8-32, 10-32 and 1/4-20 are included (app scope). Finish suffixes are omitted.

Material notes
- A304: ASTM A240 maximum 92 HRB exceeds every M45938/1 and M63540/1 limit. FH4 (92) is at its limit and compliant; SP (90) is below the A240 maximum, so the app warns to confirm sheet hardness or use a helical insert.
- A1008 CS Type B: 70 HRB or less is a typical value from the nonmandatory ASTM A1008 Table X3.1, not a spec limit. Carbon steel mil nuts (85) and studs (80) have margin and are auto-selected; CRES (70) is at its limit.

Open items
- MIL-N-45938/1B Amendment 1 (1997) has not been reviewed. NASM45938/1 and NASM63540/1 current revisions are paywalled and not reviewed.
- 10-24 insert tapped-hole minimum minor diameter is defective in the source PDF.
- Nut shank tolerance header is partly illegible.

Commercial PEM reference (reference only, never printed in the note)
- `commercial_pem_pn` and `commercial_pem_basis` columns in all three hardware CSVs. Matched on thread, material, shank or length, and hole size from the PEM CL and FH data sheets. PEM's MIL cross reference maps the families (45938/1 to CLA/CLS/CLSS, 63540/1 to FH/FHS) but not dash numbers, so the basis column lists dimension differences.
- For commercial-only rows, `commercial_pem_pn` equals `note_pn`.
- Blank for all inserts (no PEM helical insert) and for nuts without a matching PEM shank length (M45938/1-1A, -19A, -20A).
