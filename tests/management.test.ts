import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import handler from "../api/management.mjs";

describe("router de gestión", () => {
  it("responde 404 para acciones desconocidas", async () => {
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: "",
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end: vi.fn(function (this: typeof res, value: string) {
        this.body = value;
      }),
    };

    await handler({ query: { action: "desconocida" } } as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe("not_found");
  });

  it("mantiene el despliegue dentro del máximo de 12 funciones públicas", () => {
    const routeFiles = readdirSync(join(process.cwd(), "api"), {
      recursive: true,
      withFileTypes: true,
    }).filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".mjs") &&
        !entry.parentPath.includes(`${join("api", "_lib")}`),
    );

    expect(routeFiles).toHaveLength(12);
  });
});
