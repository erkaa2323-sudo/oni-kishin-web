# ONI Rig transparent assets

Place final transparent PNG or WebP sprites in this folder. The runtime switches from the legacy raster only when all required layers are present, so partial uploads cannot break the production character.

Required base filenames:

- `hair-back`
- `body`
- `torso`
- `arm-left`
- `arm-right`
- `face-base`
- `eye-left`
- `eye-right`
- `pupil-left`
- `pupil-right`
- `mouth-neutral`
- `horn-left`
- `horn-right`
- `hair-front`
- `hair-side-left`
- `hair-side-right`
- `accessories`

Use one extension per sprite: `.png` or `.webp`. Every image must share the same transparent canvas size and character alignment so layers stack without positional correction.
