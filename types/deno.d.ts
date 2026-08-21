/* The Deno globals the analyze function uses, and only those.
 *
 * This used to be a heredoc buried inside .github/workflows/ci.yml, which
 * meant the one file describing our runtime contract lived somewhere nobody
 * reads and nothing else could use. The type-check runs on this machine now,
 * so the shim has to live where a person can find it.
 *
 * Deliberately minimal: it declares what the function actually calls, so a
 * new Deno API used without thought fails the check rather than silently
 * type-checking against a full runtime definition we never verified.
 */
declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (req: Request) => Response | Promise<Response>): void;
};
