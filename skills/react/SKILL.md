---
name: react
description: Use when working on React components and React-facing TypeScript patterns (events, wrapper APIs, component contracts, Formik, TanStack).
---

# React Conventions

## Activation

This skill activates when:
- Working on React components (`.tsx`)
- Designing component props and callback contracts
- Handling React event flows
- Wrapping third-party React components
- Using Formik or TanStack in React code

For broad TypeScript casting/null/generic policy, apply `@refactoring` and read `skills/refactoring/typescript.md`.

## 1. React Events

Do not fabricate `React.ChangeEvent`, `KeyboardEvent`, etc. from plain objects.

Use event types only for real DOM/component events.

Prefer data-first callbacks in your component API:

```ts
// Preferred
type ToggleProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
};

// Avoid for wrapper APIs unless forwarding raw events directly
type ToggleProps = {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};
```

## 2. Wrapper Components

When wrapping third-party components:
- Omit props you control internally
- Re-expose a smaller, clearer API
- Avoid leaking third-party complexity through your wrappers

```ts
type MyToggleProps = Omit<
  React.ComponentProps<typeof Toggle>,
  "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
};
```

## 3. Component-Level Type Safety Patterns

When resolving React + TS errors:
1. Explain mismatch in plain language
2. Identify root cause at component boundary (props, callback shape, inferred generics)
3. Change component contracts toward explicit, value-shaped APIs
4. Keep adapters local when integrating awkward third-party component types

Prefer explicit prop contracts over ad-hoc inline object shapes for reusable components.

## Appendices

For library-specific patterns, see:
- `formik.md` - Formik form handling patterns
- `tanstack.md` - TanStack Query, Table, and Router patterns
