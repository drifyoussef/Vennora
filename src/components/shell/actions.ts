"use server";

import { signOut } from "@/core/auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/connexion" });
}
