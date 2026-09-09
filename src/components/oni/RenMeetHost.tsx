import type { ComponentProps } from "react";

import { KeiMeetHostCubism5 } from "./KeiMeetHostCubism5";

type RenMeetHostProps = ComponentProps<typeof KeiMeetHostCubism5>;

// Compatibility wrapper for older imports. Keep the proven Cubism 5 renderer,
// but render the iframe at its native card size. The model itself now performs
// the same full-body fit used by the Join Live2D instead of CSS-upscaling a
// low-resolution canvas and cropping it on mobile.
export function RenMeetHost(props: RenMeetHostProps) {
  return (
    <div className="h-full [&_iframe]:!scale-100">
      <KeiMeetHostCubism5 {...props} />
    </div>
  );
}
