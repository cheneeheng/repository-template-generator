import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { items } from "~/schema.server";

export async function loader(_: LoaderFunctionArgs) {
  const all = await db.select().from(items);
  return json({ items: all });
}

export async function action({ request }: LoaderFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (name) await db.insert(items).values({ name });
  return json({ ok: true });
}

export default function Index() {
  const { items: itemList } = useLoaderData<typeof loader>();
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{{PROJECT_NAME}}</h1>
      <Form method="post">
        <input name="name" placeholder="Item name" required />
        <button type="submit">Add</button>
      </Form>
      <ul>
        {itemList.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  );
}
