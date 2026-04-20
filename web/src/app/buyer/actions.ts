"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AuthFormState = {
  error?: string;
  ok?: string;
};

async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { supabase: null };
  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
  return { supabase };
}

export async function signInBuyer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const pack = await supabaseServer();
  if (!pack.supabase) {
    return {
      error:
        "Set Supabase env vars: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY).",
    };
  }
  const supabase = pack.supabase;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/buyer/dashboard.html");
}

export async function signUpBuyer(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const pack = await supabaseServer();
  if (!pack.supabase) {
    return {
      error:
        "Set Supabase env vars: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY).",
    };
  }
  const supabase = pack.supabase;

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const business_name = String(formData.get("business_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const business_type = String(formData.get("business_type") ?? "").trim();
  const ein_tax_id = String(formData.get("ein_tax_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!first_name || !last_name || !business_name || !email || !password) {
    return { error: "Please fill in all required fields." };
  }
  if (password !== confirm) return { error: "Passwords do not match." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name,
        business_name,
        business_type: business_type || null,
        ein_tax_id: ein_tax_id || null,
        ...(phone ? { phone } : {}),
        role: "buyer",
      },
    },
  });
  if (error) return { error: error.message };

  const user = data.user;
  if (data.session && user) {
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        first_name,
        last_name,
        phone: phone || null,
        display_name: `${first_name} ${last_name}`.trim(),
        role: "buyer",
        status: "pending",
      })
      .eq("id", user.id);
    if (profileErr) return { error: profileErr.message };

    const { error: insErr } = await supabase.from("buyer_profiles").insert({
      profile_id: user.id,
      business_name,
      business_type: business_type || null,
      ein_tax_id: ein_tax_id || null,
    });
    if (insErr) return { error: insErr.message };
    redirect("/buyer/dashboard.html");
  }

  return {
    ok: "Account created. Check your email to confirm, then sign in.",
  };
}

export async function signOutBuyer() {
  const pack = await supabaseServer();
  if (!pack.supabase) redirect("/buyer/index.html");
  await pack.supabase.auth.signOut();
  redirect("/buyer/index.html");
}
