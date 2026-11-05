# Hardware data (v0.7, confirmed-only)

| File | Rows | Content |
|---|---|---|
| hardware_ms21208.csv | 35 | Helical inserts 4-40, 6-32, 8-32, 10-24, 10-32, 1/4-20, 1/4-28; 1D-3D |
| hardware_m45938_1.csv | 46 | Clinch nuts 2-56 through 1/4-20 incl. 1/4-28; carbon, CRES, aluminum dashes |
| hardware_m63540_1.csv | 100 | Flush-head studs 2-56 through 1/4-20; carbon and CRES |
| materials.csv | 3 | 5052-H32, 6061-T6, A304 hardness and compatibility |
| sources.csv | 15 | Source IDs referenced in each row |

Rules
- `note_pn` / `note_cage` are what the drawing note prints (current mil PN, CAGE 80205). `legacy_pn` / `legacy_cage` are kept for reference.
- Every row is CONFIRMED against the spec or standard. Cross-source checks: insert FP/FB/H match NASM33537 and Heli-Coil and pass the NASM33537 formulas. Stud dash grid matches vendor listings.
- Blank cells are values that are illegible or defective in the source; nothing was guessed. Vendor values appear only in `*_vendor_ref` columns and must not be used in notes.
- Stud length L follows the PEM FH datum: overall length from the top (flush) face of the head.
- Stud `unthreaded_S_max` is MIL-S-63540/1A Table I "S MAX": the maximum unthreaded length under the head (renamed from `head_height_max` in v0.7). The spec gives no head thickness.
- Hardware larger than 1/4 is out of scope for now. 5-40 inserts are excluded because no drill recommendation was confirmed. M63540/1-57 (listed by PEM but not in MIL-S-63540/1A) is excluded.

Open items
- MIL-N-45938/1B Amendment 1 (1997) has not been reviewed. NASM45938/1 and NASM63540/1 current revisions are paywalled and not reviewed.
- 10-24 insert tapped-hole minimum minor diameter is defective in the source PDF.
- Nut shank tolerance header is partly illegible.

Commercial PEM reference (reference only, never printed in the note)
- `commercial_pem_pn` and `commercial_pem_basis` columns in all three hardware CSVs. Matched on thread, material, shank or length, and hole size from the PEM CL and FH data sheets. PEM publishes no official mil-to-PEM mapping, so the basis column lists dimension differences.
- Blank for all inserts (no PEM helical insert) and for nuts without a matching PEM shank length (M45938/1-1A, -19A, -20A).
