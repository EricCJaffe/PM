import { redirect } from "next/navigation";

export default function TemplatesRedirect() {
  redirect("/projects?tab=templates");
}
