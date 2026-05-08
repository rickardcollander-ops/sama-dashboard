/**
 * Lightweight zod-style runtime validation for API route bodies.
 *
 * We avoid pulling zod into the dependency graph for now (one extra package
 * for a small handful of validators). The shapes here cover the common cases
 * — when zod becomes broadly necessary across the codebase, swap this for
 * actual zod and the call-site changes are minimal because the API matches.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface Validator<T> {
  parse: (input: unknown) => ValidationResult<T>;
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}

export const v = {
  string(opts: { min?: number; max?: number; pattern?: RegExp } = {}): Validator<string> {
    return {
      parse(input) {
        if (typeof input !== "string") return fail("expected string");
        if (opts.min !== undefined && input.length < opts.min) {
          return fail(`expected string of length >= ${opts.min}`);
        }
        if (opts.max !== undefined && input.length > opts.max) {
          return fail(`expected string of length <= ${opts.max}`);
        }
        if (opts.pattern && !opts.pattern.test(input)) {
          return fail("string does not match pattern");
        }
        return { ok: true, data: input };
      },
    };
  },
  number(opts: { min?: number; max?: number; int?: boolean } = {}): Validator<number> {
    return {
      parse(input) {
        if (typeof input !== "number" || Number.isNaN(input)) return fail("expected number");
        if (opts.int && !Number.isInteger(input)) return fail("expected integer");
        if (opts.min !== undefined && input < opts.min) return fail(`expected >= ${opts.min}`);
        if (opts.max !== undefined && input > opts.max) return fail(`expected <= ${opts.max}`);
        return { ok: true, data: input };
      },
    };
  },
  boolean(): Validator<boolean> {
    return {
      parse(input) {
        if (typeof input !== "boolean") return fail("expected boolean");
        return { ok: true, data: input };
      },
    };
  },
  optional<T>(inner: Validator<T>): Validator<T | undefined> {
    return {
      parse(input) {
        if (input === undefined || input === null) return { ok: true, data: undefined };
        return inner.parse(input);
      },
    };
  },
  object<S extends Record<string, Validator<unknown>>>(
    schema: S,
  ): Validator<{ [K in keyof S]: S[K] extends Validator<infer U> ? U : never }> {
    return {
      parse(input) {
        if (typeof input !== "object" || input === null) return fail("expected object");
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(schema)) {
          const result = schema[key].parse((input as Record<string, unknown>)[key]);
          if (!result.ok) return fail(`${key}: ${result.error}`);
          if (result.data !== undefined) out[key] = result.data;
        }
        return {
          ok: true,
          data: out as { [K in keyof S]: S[K] extends Validator<infer U> ? U : never },
        };
      },
    };
  },
};

export async function parseJson<T>(req: Request, validator: Validator<T>): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON body");
  }
  return validator.parse(body);
}
