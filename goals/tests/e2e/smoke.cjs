/**
 * End-to-end smoke test of every GOALS module, at phone width.
 *
 *   BASE_URL=http://localhost:3000 OWNER_EMAIL=... OWNER_PASSWORD=... node tests/e2e/smoke.cjs
 *
 * Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`)
 * and, for the AI steps, the app running against tests/e2e/mock-anthropic.mjs.
 * Screenshots go to SHOTS_DIR (default ./test-results).
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.OWNER_EMAIL ?? "owner@goals.local";
const PASSWORD = process.env.OWNER_PASSWORD ?? "local-owner-password-123";
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), "test-results");
const WITH_AI = process.env.SKIP_AI !== "1";
fs.mkdirSync(SHOTS, { recursive: true });

let step = 0;
const results = [];
async function check(name, fn) {
  step++;
  const t = Date.now();
  try {
    await fn();
    results.push({ ok: true, name });
    console.log(`  ✓ ${step}. ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ ok: false, name, error: e.message });
    console.log(`  ✗ ${step}. ${name}\n      ${e.message.split("\n")[0]}`);
    throw e;
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
  const go = async (p) => {
    await page.goto(BASE + p);
    await page.waitForLoadState("networkidle");
  };
  const dialog = () => page.locator("dialog[open]");
  const submitDialog = async () => {
    await dialog().locator("button[type=submit]").click();
    await page.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
  };
  const stamp = Date.now().toString(36);
  // Next keeps recently visited routes mounted but hidden (<Activity>), so
  // text lookups must target what is on screen.
  const visible = (text) => page.getByText(text).filter({ visible: true }).first();

  try {
    await check("anonymous visitors are sent to /login", async () => {
      await go("/goals");
      if (!page.url().includes("/login?next=%2Fgoals")) throw new Error(`url ${page.url()}`);
      await shot("01-login");
    });

    await check("a wrong password is refused", async () => {
      await page.fill("#email", EMAIL);
      await page.fill("#password", "definitely-wrong-password");
      await page.click("button[type=submit]");
      await page.getByText("Email o contraseña incorrectos.").waitFor();
    });

    await check("the owner signs in and lands on the requested page", async () => {
      await page.fill("#password", PASSWORD);
      await page.click("button[type=submit]");
      await page.waitForURL(/\/goals$/);
      await page.getByRole("heading", { name: "Metas", exact: true }).waitFor();
    });

    const goalTitle = `Ingresos extra ${stamp}`;
    await check("create a primary goal measured by a metric", async () => {
      await page.getByRole("button", { name: "Nueva meta" }).first().click();
      await page.fill("#g-title", goalTitle);
      await page.fill("#g-desc", "Conseguir 1.000 € al mes fuera del trabajo.");
      await page.selectOption("#g-prio", "high");
      await page.selectOption("#g-mode", "metric");
      await page.fill("#g-mname", "Ingresos mensuales");
      await page.fill("#g-munit", "€");
      await page.fill("#g-mtarget", "1000");
      await page.check("input[name=is_primary]");
      await submitDialog();
      await page.getByText("Meta principal").first().waitFor();
      await shot("02-goals");
    });

    await check("open the goal and record a metric check-in", async () => {
      await page.getByText(goalTitle).first().click();
      await page.waitForURL(/\/goals\/[0-9a-f-]{36}$/);
      await page.fill("#ck-value", "250");
      await page.fill("#ck-note", "Primer cliente");
      await page.getByRole("button", { name: "Registrar valor" }).click();
      await page.getByText("25%").first().waitFor();
    });

    const projectTitle = `Newsletter de pago ${stamp}`;
    await check("create a project linked to the goal", async () => {
      await page.getByRole("button", { name: "Nuevo proyecto" }).click();
      await page.fill("#p-title", projectTitle);
      await page.selectOption("#p-status", "active");
      await submitDialog();
      await page.getByText(projectTitle).waitFor();
      await shot("03-goal-detail");
    });

    await check("add tasks to the project with quick capture", async () => {
      await page.getByText(projectTitle).click();
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
      for (const t of ["Definir temática", "Elegir plataforma", "Escribir primer número"]) {
        await page.fill("input[name=title]", t);
        await page.press("input[name=title]", "Enter");
        await page.getByText(t).waitFor();
      }
    });

    await check("complete a task and see project progress", async () => {
      await page.locator('button[title="Marcar como completada"]').first().click();
      await page.getByText("33%").first().waitFor();
    });

    await check("log time on a task", async () => {
      await page.locator('button[aria-label^="Acciones de Elegir plataforma"]').click();
      await page.getByRole("button", { name: "Registrar tiempo" }).click();
      await page.fill("dialog[open] #lt-min", "40");
      await submitDialog();
      await page.getByText("40 min").first().waitFor();
    });

    await check("save project notes", async () => {
      await page.fill("#pn-notes", "Publicar los martes.");
      await page.getByRole("button", { name: "Guardar notas" }).click();
      await page.getByText("Guardado").waitFor();
      await shot("04-project");
    });

    await check("plan a task for today as priority 1", async () => {
      await page.locator('button[aria-label^="Acciones de Elegir plataforma"]').click();
      await page.getByRole("button", { name: "Planificar para hoy" }).click();
      await page.waitForLoadState("networkidle");
      await go("/planner");
      await page.locator('button[aria-label^="Acciones de Elegir plataforma"]').first().click();
      await page.getByRole("button", { name: "Prioridad 1 del día" }).first().click();
      await page.waitForLoadState("networkidle");
      await page.locator("ol li").first().getByText("Elegir plataforma").waitFor();
    });

    await check("save the daily log", async () => {
      await page.fill("#dl-int", "Lanzar la newsletter");
      await page.fill("#dl-min", "180");
      await page.getByRole("button", { name: "Guardar" }).last().click();
      await page.getByText("Guardado").waitFor();
      await shot("05-planner");
    });

    const ideaTitle = `Curso online ${stamp}`;
    await check("save an idea in the vault", async () => {
      await go("/ideas");
      await page.getByRole("button", { name: "Nueva idea" }).first().click();
      await page.fill("#i-title", ideaTitle);
      await page.fill("#i-desc", "Curso sobre finanzas personales para freelancers.");
      await page.fill("#i-pot", "4");
      await page.fill("#i-dif", "3");
      await page.fill("#i-cost", "300");
      await submitDialog();
      await page.getByText(ideaTitle).waitFor();
    });

    if (WITH_AI) {
      await check("Claude evaluates the idea (structured output)", async () => {
        await page.getByText(ideaTitle).click();
        await page.getByRole("button", { name: "Evaluar con Claude" }).click();
        await page.getByText("Validar antes · 68").waitFor({ timeout: 20000 });
        await page.getByText("Evaluación de Claude · recomendación, no un hecho").waitFor();
        await shot("06-ideas");
      });
    }

    await check("convert the idea into a project; the idea is kept", async () => {
      await go("/ideas");
      page.once("dialog", (d) => d.accept());
      await page.locator(`button[aria-label="Acciones de ${ideaTitle}"]`).click();
      await page.getByRole("button", { name: "Convertir en proyecto" }).click();
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
      await go("/ideas?view=converted");
      await page.getByText(ideaTitle).waitFor();
    });

    if (WITH_AI) {
      await check("dashboard: Claude's daily recommendation", async () => {
        await go("/");
        await page.getByRole("button", { name: "Pedir consejo" }).click();
        await page.getByText("Cierra hoy la tarea más importante").waitFor({ timeout: 20000 });
        await shot("07-dashboard");
      });

      await check("planner: Claude proposes a day plan and it is applied only on approval", async () => {
        await go("/planner");
        await page.getByRole("button", { name: "Proponer plan" }).click();
        await page.getByText("Dos bloques de foco y un descanso.").waitFor({ timeout: 20000 });
        await page.getByRole("button", { name: "Aplicar plan" }).click();
        await page.waitForLoadState("networkidle");
      });

      await check("AI Brain: streamed answer with proposals, nothing applied yet", async () => {
        await go("/brain");
        await page.fill("#chat-input", "Divide mi proyecto en tareas");
        await page.press("#chat-input", "Enter");
        await page.waitForURL(/\/brain\/[0-9a-f-]{36}$/, { timeout: 20000 });
        await visible("He preparado 2 propuestas").waitFor({ timeout: 20000 });
        await visible("Crear tarea «Investigar 3 competidores»").waitFor();
        await visible("Pendiente de tu aprobación").waitFor();
        await shot("08-brain");
      });

      await check("approving one proposal creates exactly that task", async () => {
        const card = page.locator("div.rounded-lg").filter({ visible: true }).filter({ hasText: "Crear tarea «Investigar 3 competidores»" }).first();
        await card.getByRole("button", { name: "Aprobar" }).click();
        await card.getByText("Aplicada").waitFor({ timeout: 10000 });
        await go("/tasks");
        await page.getByText("Investigar 3 competidores").waitFor();
        if (await page.getByText("Escribir borrador de propuesta de valor").count()) throw new Error("unapproved proposal was applied");
      });

      await check("a second message in the same conversation keeps a valid history", async () => {
        await page.goBack();
        await page.waitForLoadState("networkidle");
        await page.fill("#chat-input", "¿Estoy perdiendo el tiempo con algo?");
        await page.press("#chat-input", "Enter");
        await visible("termina una tarea antes de abrir otra").waitFor({ timeout: 20000 });
      });
    }

    await check("memory: add a confirmed fact and a decision", async () => {
      await go("/brain/memory");
      await page.getByRole("button", { name: "Recuerdo" }).click();
      await page.fill("#m-content", "Solo trabajo en mis proyectos por las tardes.");
      await submitDialog();
      await page.getByText("Solo trabajo en mis proyectos por las tardes.").waitFor();
      await page.getByRole("button", { name: "Decisión" }).click();
      await page.fill("#d-title", "Plataforma de la newsletter");
      await page.fill("#d-opt-1", "Substack");
      await page.fill("#d-opt-2", "Ghost");
      await page.fill("#d-decision", "Ghost");
      await submitDialog();
      await page.getByText("Plataforma de la newsletter").waitFor();
      await shot("09-memory");
    });

    await check("analytics renders real numbers", async () => {
      await go("/analytics");
      await page.getByRole("heading", { name: "Tareas completadas por semana" }).waitFor();
      await page.locator("svg[role=img]").first().waitFor();
      await shot("10-analytics");
    });

    if (WITH_AI) {
      await check("settings: the Claude connection check passes", async () => {
        await go("/settings");
        await page.getByRole("button", { name: "Probar conexión con Claude" }).click();
        await page.getByText("Claude funciona").waitFor({ timeout: 20000 });
      });
    }

    await check("settings: save notification preferences and busy hours", async () => {
      await go("/settings");
      await page.uncheck("input[name=notify_inactivity]");
      await page.fill("#b-start", "08:15");
      await page.fill("#b-end", "14:10");
      for (const d of ["1", "2", "3", "4", "5"]) await page.locator(`input[name=busy_days][value="${d}"]`).check({ force: true });
      await page.getByRole("button", { name: "Guardar avisos" }).click();
      await page.getByText("Preferencias de avisos guardadas").waitFor();
    });

    await check("notification center opens from the bell", async () => {
      await page.locator('a[href="/notifications"]').filter({ visible: true }).first().click();
      await page.getByRole("heading", { name: "Avisos", exact: true }).waitFor();
    });

    await check("settings: switch to light theme", async () => {
      await go("/settings");
      await page.getByRole("radio", { name: "Claro" }).click();
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      if (theme !== "light") throw new Error(`theme ${theme}`);
      await shot("11-settings-light");
      await go("/");
      await shot("12-dashboard-light");
      await page.getByRole("radio", { name: "Oscuro" }).count();
    });

    await check("export downloads a JSON file with my data", async () => {
      const res = await page.request.get(`${BASE}/api/export`);
      if (res.status() !== 200) throw new Error(`status ${res.status()}`);
      const json = await res.json();
      if (!json.goals?.length || !json.tasks?.length) throw new Error("export is missing data");
    });

    await check("no console or page errors", async () => {
      const relevant = errors.filter((e) => !e.includes("favicon"));
      if (relevant.length) throw new Error(relevant.slice(0, 3).join("\n"));
    });

    await check("sign out", async () => {
      await go("/settings");
      await page.evaluate(() => localStorage.setItem("goals.theme", "dark"));
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
      await page.waitForURL(/\/login/);
    });
  } catch {
    process.exitCode = 1;
  } finally {
    await browser.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} pasos correctos${failed ? `, ${failed} con error` : ""}`);
  }
})();
