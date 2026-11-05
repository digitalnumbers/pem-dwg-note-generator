# Hardware data (v0.11, confirmed-only)

| File | Rows | Content |
|---|---|---|
| hardware_ms21208.csv | 35 | Helical inserts 4-40, 6-32, 8-32, 10-24, 10-32, 1/4-20, 1/4-28; 1D-3D |
| hardware_m45938_1.csv | 46 | Clinch nuts 2-56 through 1/4-20 incl. 1/4-28; carbon, CRES, aluminum dashes |
| hardware_m63540_1.csv | 100 | Flush-head studs 2-56 through 1/4-20; carbon and CRES |
| hardware_pem_sp.csv | 11 | PEM SP (PEM 300) clinch nuts 4-40, 8-32, 10-32, 1/4-20; commercial only, no mil PN |
| hardware_pem_fh4.csv | 35 | PEM FH4 flush-head studs 4-40, 8-32, 10-32, 1/4-20; commercial only, no mil PN |
| materials.csv | 4 | 5052-H32, 6061-T6, A304, A1008 CS Type B hardness, compatibility and standard stock thicknesses |
| sources.csv | 28 | Source IDs referenced in each row |

Rules
- `note_pn` / `note_cage` are what the drawing note prints (current mil PN, CAGE 80205). `legacy_pn` / `legacy_cage` are kept for reference.
- Exception: rows with `commercial_only` = Y (SP nuts, FH4 studs) print the PEM catalog PN and PEM CAGE 46384, because PEM's MIL cross reference lists no military PN for SP, FH4 or FHP. The app uses them only when no mil part is rated for the substrate (A304), or when the user selects them.
- Every row is CONFIRMED against the spec or standard. Cross-source checks: insert FP/FB/H match NASM33537 and Heli-Coil and pass the NASM33537 formulas. Stud dash grid matches vendor listings.
- Blank cells are values that are illegible or defective in the source; nothing was guessed. Vendor values appear only in `*_vendor_ref` columns and must not be used in notes.
- Stud length L follows the PEM FH datum: overall length from the top (flush) face of the head.
- Stud `unthreaded_S_max` is MIL-S-63540/1A Table I "S MAX": the maximum unthreaded length under the head (renamed from `head_height_max` in v0.7). The spec gives no head thickness.
- Hardware larger than 1/4 is out of scope for now. 5-40 inserts are excluded because no drill recommendation was confirmed. M63540/1-57 (listed by PEM but not in MIL-S-63540/1A) is excluded.

Hardware material rule (v0.10)
- CRES hardware only. The app never offers carbon steel or aluminum nuts and studs. Those rows stay in `hardware_m45938_1.csv` and `hardware_m63540_1.csv` (and their `m45938_carbon`, `m45938_aluminum`, `m63540_carbon` columns in `materials.csv`) as a complete record of the spec, but are filtered out in the app.
- Allowed: mil CRES (M45938/1-xxC, M63540/1-xxC) and PEM hardened stainless SP and FH4 (commercial only). Auto-select uses mil CRES whenever it is rated, including at its limit, and uses SP or FH4 only when no mil CRES part is rated.

Standard stock thicknesses (v0.11)
- `materials.csv` columns: `std_thk_in` (ascending decimal inches, semicolon separated), `std_thk_labels` (gauge or form for each value, same order), `std_thk_basis`, `std_thk_sources`.
- 5052-H32: sheet .020, .025, .032, .040, .050, .063, .080, .090, .100, .125, .190 and plate .250, .375 (Chatham Steel); .160 (Continental Steel); .500 (SendCutSend). Aluminum is ordered by decimal thickness, not gauge.
- 6061-T6: sheet .025 through .190 (Chatham Steel). Plate .250, .313, .375, .500, .625, .750, 1.000 is stocked as 6061-T651 (Chatham Steel).
- A304: stainless sheet gauges 28 GA .015 through 7 GA .1874 as decimal values (Chatham Steel sheet table, Type 304/304L 2B), and plate 1/4 through 1 in (Chatham Steel plate table). 3/16 plate is listed once, as 7 GA .1874.
- A1008 CS Type B: Manufacturers' Standard Gauge nominal values 24 GA .0239 through 10 GA .1345 (Shaw Steel gauge chart; Russel Metals lists 10 GA as .1344). Stock range 24 GA to 10 GA per Westfield Steel. Cold rolled sheet is not stocked as plate, so thicker A1008 requirements are shown as non-standard.
- Lists are capped at 1.000 in (app scope). Gauge decimals are nominal; mill tolerance applies.
- App use: every "Set thickness to" suggestion snaps to the smallest standard thickness that meets the requirement (FH4 above its maximum: the largest standard thickness inside the PEM range). If no standard thickness works, the exact value is offered and labeled non-standard. An entry within .0005 in of a standard value counts as standard (for example .060 matches 16 GA .0598).

Commercial-only PEM rows (SP, FH4)
- Source: PEM bulletin SS, Fasteners For Use In Stainless Steel Sheets, rev 10/13/26. SP dimensions pg SS-3, FH4 pg SS-10, material pg SS-15, performance pg SS-23/24, Dos and Don'ts pg SS-27. Checked against the page images.
- SP: rated for stainless sheet HRB 90 / HB 192 or less. Shank code chosen as the longest shank whose recommended minimum sheet thickness fits; PEM publishes no maximum sheet thickness. Performance values are PEM averages in 304 stainless, stored in `*_avg` columns, not spec minimums.
- FH4: hardened 400-series stainless, rated for stainless sheet HRB 92 / HB 202 or less. Sheet thickness range .040-.095 (1/4-20: .062-.117); PEM notes performance may be reduced in thicker sheets. Length L is overall from the flush head face (PEM drawing). Requires the PEM special anvil with raised ring. FHP (A286) is not included.
- Only 4-40, 8-32, 10-32 and 1/4-20 are included (app scope). Finish suffixes are omitted.

Material notes
- A304: ASTM A240 maximum 92 HRB exceeds every M45938/1 and M63540/1 limit. FH4 (92) is at its limit and compliant; SP (90) is below the A240 maximum, so the app warns to confirm sheet hardness or use a helical insert.
- A1008 CS Type B: 70 HRB or less is a typical value from the nonmandatory ASTM A1008 Table X3.1, not a spec limit. CRES nuts and studs (70) are at their limit and are auto-selected under the CRES-only rule, with a note to confirm actual sheet hardness.

Open items
- MIL-N-45938/1B Amendment 1 (1997) has not been reviewed. NASM45938/1 and NASM63540/1 current revisions are paywalled and not reviewed.
- 10-24 insert tapped-hole minimum minor diameter is defective in the source PDF.
- Nut shank tolerance header is partly illegible.

Commercial PEM reference (reference only, never printed in the note)
- `commercial_pem_pn` and `commercial_pem_basis` columns in all three hardware CSVs. Matched on thread, material, shank or length, and hole size from the PEM CL and FH data sheets. PEM's MIL cross reference maps the families (45938/1 to CLA/CLS/CLSS, 63540/1 to FH/FHS) but not dash numbers, so the basis column lists dimension differences.
- For commercial-only rows, `commercial_pem_pn` equals `note_pn`.
- In hardware_ms21208.csv, `commercial_pem_pn` holds the Heli-Coil commercial PN (1185 coarse / 1191 fine, plain finish) cross-referenced from the MS122xxx/MS124xxx PN (S-HCXREF).
- Blank for all inserts (no PEM helical insert) and for nuts without a matching PEM shank length (M45938/1-1A, -19A, -20A).
- `pem_fh_performance.csv` (v1.6): PEM FH/FHS flush-head stud averages from the FH data sheet pg FH-29 (installation force, push-out, torque-out, pull-thru, test sheet and HRB). Mil M63540/1 studs show the matching FH (carbon) or FHS (CRES) row in the aluminum test sheet for aluminum substrates, else the steel test sheet. FH4 rows use their own `pushout_avg_lb`, `torqueout_avg_inlb`, `pullthru_avg_lb`. These are PEM averages, not spec minimums.
