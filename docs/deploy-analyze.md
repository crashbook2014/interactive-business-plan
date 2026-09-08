# Deploying the `analyze` edge function

The app's whole AI surface is one function. This is how it goes out, why it
has to go out as a set, and what is waiting behind it right now.

**Nothing in this file has been run from the agent sandbox.** Supabase is
denied by the environment's egress policy and the MCP deploy tool is
approval-gated, so every deploy since version 6 has needed a human. What *is*
verified here is the bundle itself: `test/deploy-bundle.test.js` reads the
imports out of the entrypoint, checks each file exists, parses, and really
exports the names the entrypoint binds. Run it before you deploy.

---

## What is waiting to go out

Production runs **version 6**. Three things have shipped to `main` since and
are inert until this function is redeployed:

| In the repo | What it does | What a reader sees today |
|---|---|---|
| The **contract answer tier** for «اسأل سؤالك» | A question answered from the reader's own contract, with every quoted span checked for containment in the document they sent | The tier never comes back, so answers stay general |
| **`obligations`** on the contract-review schema | "وش التزمت فيه أنت" for a pasted contract | Only the four built-in samples show obligations |
| **`topic`** on every finding | Puts the clause a reader is disputing at the top of their result | Ordering by severity only, for pasted contracts |

The client is written so that a v6 response still renders correctly — that is
asserted in `test/contract-review.test.js` against the literal v6 shape — so
there is no rush and no breakage. But none of the three exists for a real
contract until this is done.

---

## The set that must travel together

`analyze/index.ts` imports three files from `_shared` **at module load**. If
any of them is missing from the upload, the function does not boot, and it
fails on the first real request rather than at deploy time — the dashboard
will say the deploy succeeded.

```
analyze/index.ts          ← the entrypoint
_shared/corpus.json       ← the 29-row verified legal register
_shared/grade.mjs         ← grades an ask answer
_shared/review-contract.mjs ← grades a contract review
```

This has already gone wrong once on this project: a deploy sent `corpus.json`
without the entrypoint. That one was rejected outright and production was
untouched, which was luck. Run the bundle test rather than relying on it:

```
node test/deploy-bundle.test.js
```

It prints the exact file list to upload, and fails if a shared module stops
parsing, loses an export the entrypoint binds, or if `corpus.json` is not
valid JSON.

---

## Deploying

Either route is fine; both send the same four files.

**Supabase CLI**, from the repository root:

```
supabase functions deploy analyze --project-ref <your-project-ref>
```

The CLI resolves the relative imports itself, so `_shared` travels
automatically. This is the safer route for exactly that reason.

**MCP / dashboard:** upload all four files explicitly, with
`entrypoint_path: index.ts`. There is no automatic resolution here — the file
list above is the whole contract.

`verify_jwt` stays as the function already has it. Do not change it as part of
a content deploy.

---

## After deploying

The function's own tests cannot see production, so this is the manual check:

1. **It boots.** Any request at all. A function that fails to import returns a
   boot error rather than the function's own JSON.
2. **A real contract still analyses.** The path that was already working must
   still work; the schema grew, and a schema change is exactly what breaks a
   working path.
3. **Obligations appear.** Paste a contract with a notice period the reader
   must serve. "وش التزمت فيه أنت" should render underneath the flags. If the
   findings come back but the section does not, the model is not filling the
   new array — that is a prompt problem, not a deploy problem.
4. **The contract tier answers.** In «اسأل سؤالك», tick the third box (send my
   contract's text) and ask something the contract answers — "how much notice
   must I give?". The answer should be headed «جواب من نص عقدك أنت» and show
   the span it read. If it comes back as «معلومة عامة», the model chose the
   unverified tier, which is allowed; if it comes back refused with reason
   `quote`, the model paraphrased instead of quoting and the prompt needs a
   nudge.
5. **The legal register is still unverified since v6.** Its 29 rows were
   hand-transcribed into a deploy call. The function booting proves the JSON
   parses, not that an article number survived transit. Ask a question that
   returns a *verified* answer with a citation and check the article against
   the source. This is worth doing once and has never been done.

## Rolling back

Supabase keeps previous versions. Redeploying the previous commit's four files
is the rollback; there is no state to migrate and no schema change in the
database, because everything above is request-shaped.
