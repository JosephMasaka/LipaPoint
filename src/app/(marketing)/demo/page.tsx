import { redirect } from "next/navigation";

/**
 * The public "open a demo workspace" flow is retired: prospects request a
 * demo and we provision a walkthrough instead of handing out shared,
 * password-less logins. This route stays as a permanent redirect so old
 * links, adverts and bookmarks land somewhere useful rather than 404ing.
 */
export default function DemoPickerPage() {
  redirect("/demo-request");
}
