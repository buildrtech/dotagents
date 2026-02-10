---
name: typescript-react
description: Use when working on TypeScript/React code - enforces type safety, proper event handling, and library-specific patterns for Formik and TanStack.
---

# TypeScript & React Conventions

## Activation

This skill activates when:
- Working on `.ts` or `.tsx` files
- Encountering TypeScript errors or warnings
- Writing React components or hooks
- Using Formik or TanStack libraries
- Wrapping third-party React components
- User requests TypeScript or React help

When you see a TypeScript error or warning:
1. **Explain the mismatch** in plain language
2. **Fix the types, signatures, or control flow** so the error goes away without unsafe casts
3. Use a narrow, documented cast **only** when interacting with a third-party API whose types are wrong or incomplete

Never silence the type system just to make red squiggles disappear.

---

## 1. Casting & Escape Hatches

Do **not** use these to "fix" errors:
- `as any`
- `as unknown as T`
- `@ts-ignore` / `@ts-expect-error` (except with a clear justification comment)
- Non-null assertion (`foo!`) except in well-justified, rare cases

If you think you *must* cast:
1. Try to change the types instead (prop types, generics, discriminated unions)
2. If it's truly unavoidable **interop** (e.g. a wrong third-party type), put the cast in the smallest possible adapter:

```ts
// Third-party library typing is wrong; adapt once here.
function adaptFoo(raw: unknown): OurType {
  return raw as OurType;
}
```

**Rule:** If you are about to write `as unknown as SomeType`, stop. Propose a type-safe alternative instead.

---

## 2. Null/Undefined and Control Flow

Treat `strictNullChecks` as **on**.

Prefer **control flow** over assertions:

```ts
if (!user) return null;        // good
const id = user!.id;           // only if you've proven above it can't be null
```

For optional values, narrow with `if`, `switch`, or `in` checks instead of casting.

---

## 3. Discriminated Unions

Model variants as **discriminated unions**:

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; size: number };
```

Handle with `switch (shape.kind)` instead of casting to the "arm you want".

Do **not** break unions by casting to one of the member types without a check.

---

## 4. Generics

Prefer providing generic params over casting results:

```ts
const result = parseThing<MyType>(input); // good
const result = parseThing(input) as MyType; // avoid
```

Let inference work when it's good enough; don't over-annotate just to add types everywhere.

---

## 5. React Events

Do **not** fabricate `React.ChangeEvent`, `KeyboardEvent`, etc. from plain objects.

Only use those types for **real React events** coming from the DOM or components that forward them.

Prefer simple, data-first callbacks:

```ts
// preferred:
onChange?: (value: boolean) => void;
onSelectUser?: (userId: string) => void;

// avoid unless you actually pass through real events:
onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
```

---

## 6. Wrapper Components

When wrapping third-party components:

- Don't pass through props you manage internally
- If you control `checked`, `value`, etc., **omit or override** them in your wrapper's props

```ts
type MyToggleProps = Omit<
  React.ComponentProps<typeof Toggle>,
  "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
};
```

Keep wrapper APIs **simple and explicit**, not thin re-exports of complex types that then require casts.

---

## 7. Handling TypeScript Errors

When making changes or responding to a TS error/warning:

1. **Quote or paraphrase the error** (for human readers)
2. Identify the **root cause**:
   - "X expects `ChangeEvent`, but we only have a boolean"
   - "Query data is `unknown` because the generic parameter is missing"
3. Propose a **type-safe change**:
   - Change props from event-shaped to value-shaped
   - Add/adjust generic arguments
   - Refine a union or add proper null narrowing
4. Only if it's due to bad third-party types:
   - Introduce a small adapter function with a **single cast**
   - Add a comment explaining why this cast is safe

**Never** jump straight to `as any`, `as unknown as T`, or `@ts-ignore` to silence the error.

---

## Appendices

For library-specific patterns, see:
- `formik.md` - Formik form handling patterns
- `tanstack.md` - TanStack Query, Table, and Router patterns

Read these when working with those libraries.
