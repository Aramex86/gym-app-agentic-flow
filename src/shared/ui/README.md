# shared/ui/atoms — generic, business-free UI primitives.
# Boundary test: can you describe the component WITHOUT mentioning users/orders/projects?
# Yes -> atom/molecule here. No -> it belongs to a feature (or graduates later).

# shared/ui/molecules — generic COMPOSITIONS of atoms (DataTable, FormRow).
# Molecules never import from entities/features — data comes in via props.

# shared/ui/organisms — DOES NOT EXIST in FSAA.
# A large composition is a feature. See docs: https://aramex86.github.io/fsaa/