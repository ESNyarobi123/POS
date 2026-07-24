import { redirect } from "next/navigation";

/** Prototype: land on login. After “sign in”, flow goes shift → POS. */
export default function HomePage() {
  redirect("/login");
}
