import { redirect } from "next/navigation";

/** Serves the same entry as the original static site (preview launcher). */
export default function Home() {
  redirect("/index.html");
}
