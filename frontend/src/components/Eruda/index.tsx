import { ReactNode, Suspense, lazy } from "react";

const Eruda = lazy(() =>
  import("./eruda-provider").then((c) => ({ default: c.Eruda }))
);

export const ErudaProvider = (props: { children: ReactNode }) => {
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return props.children;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Eruda>{props.children}</Eruda>
    </Suspense>
  );
};