#!/usr/bin/env node
/**
 * Creates (or resets the password of) the single GOALS owner account.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-owner.mjs owner@example.com
 *
 * The password is read from OWNER_PASSWORD or asked for interactively. The secret
 * key is only used here, on your machine; the app itself never needs it.
 * Afterwards, authorize the email in the database (README › Autorizar al propietario).
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = (process.argv[2] ?? process.env.OWNER_EMAIL ?? "").trim().toLowerCase();

if (!url || !secret || !email) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-owner.mjs <email>");
  process.exit(1);
}

let password = process.env.OWNER_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Contraseña (mín. 12 caracteres): ");
  rl.close();
}
if (!password || password.length < 12) {
  console.error("La contraseña debe tener al menos 12 caracteres.");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error("No se pudo consultar Supabase:", listError.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email?.toLowerCase() === email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) {
    console.error("No se pudo actualizar la contraseña:", error.message);
    process.exit(1);
  }
  console.log(`Contraseña actualizada para ${email}.`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("No se pudo crear el usuario:", error.message);
    process.exit(1);
  }
  console.log(`Usuario ${email} creado.`);
}
console.log("Recuerda autorizarlo en la base de datos si aún no lo está (README › Autorizar al propietario).");
