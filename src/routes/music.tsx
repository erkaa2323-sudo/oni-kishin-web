import { createFileRoute, redirect } from "@tanstack/react-router";

/** MUSIC is now part of the combined ONI AI + MUSIC chamber. */
export const Route = createFileRoute("/music")({
  beforeLoad: () => {
    throw redirect({ to: "/oni-ai", replace: true });
  },
});
