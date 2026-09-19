#!/usr/bin/env node
/**
 * Fills the database with sample tasks, a two-week menu and two grocery lists
 * so the app can be tried out before real data goes in.
 *
 *   node scripts/db/seed-demo.mjs
 *
 * It DELETES every task, meal and grocery cycle in the household first, so do
 * not run it once you are using the app for real. It needs an admin account to
 * exist already: run `npm run db:seed` first.
 */
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: [".env.local"], override: false, quiet: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const q = (text, params) => pool.query(text, params);

const hh = (await q("select * from households order by id limit 1")).rows[0];
const admin = (await q("select * from users where role='admin' limit 1")).rows[0];

// employee
let emp = (await q("select * from users where role='employee' limit 1")).rows[0];
if (!emp) {
  emp = (await q(
    "insert into users (household_id,name,email,password_hash,role) values ($1,$2,$3,$4,'employee') returning *",
    [hh.id, "Grace Dlamini", "grace@example.com", await bcrypt.hash("household2026", 10)]
  )).rows[0];
}
console.log("employee:", emp.name);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (base, n) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const todayIso = iso(today);
const isoDay = (s) => { const d = new Date(s + "T00:00:00Z").getUTCDay(); return d === 0 ? 7 : d; };
let monday = todayIso; while (isoDay(monday) !== 1) monday = shift(monday, -1);

await q("delete from recipes where household_id=$1", [hh.id]);
await q("delete from tasks where household_id=$1", [hh.id]);
await q("delete from meals where household_id=$1", [hh.id]);

const tasks = [
  ["Tidy the playroom", null, "recurring", emp.id, "daily", true, 1, null, null, null],
  ["Unpack the dishwasher", null, "recurring", emp.id, "daily", true, 1, null, null, null],
  ["Wash and fold the laundry", "Kids' clothes go in the top drawers.", "recurring", emp.id, "weekly", true, 1, [1,3,5], null, null],
  ["Bath time", null, "recurring", emp.id, "daily", true, 1, null, null, "17:30"],
  ["Water the garden", null, "recurring", emp.id, "weekly", true, 1, [3], null, null],
  ["Change the bedding", null, "recurring", emp.id, "monthly", true, 1, null, 1, null],
  ["Pay the transport money", null, "recurring", admin.id, "weekly", false, 1, [5], null, null],
];
for (const [title, notes, kind, who, freq, wdo, interval, weekdays, monthDay, time] of tasks) {
  await q(
    `insert into tasks (household_id,title,notes,kind,assigned_to,created_by,frequency,working_days_only,interval,weekdays,month_day,time_of_day,start_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [hh.id, title, notes, kind, who, admin.id, freq, wdo, interval, weekdays, monthDay, time, shift(monday, -28)]
  );
}
await q(
  `insert into tasks (household_id,title,kind,assigned_to,created_by,due_date) values ($1,$2,'once',$3,$4,$5)`,
  [hh.id, "Book the paediatrician", admin.id, admin.id, todayIso]
);
await q(
  `insert into tasks (household_id,title,kind,assigned_to,created_by,due_date) values ($1,$2,'once',$3,$4,$5)`,
  [hh.id, "Pack the bag for the party", emp.id, admin.id, shift(todayIso, 1)]
);
console.log("tasks seeded");

const menu = [
  [0, "lunch", "Cheese and tomato toasties", null, "same_day"],
  [0, "dinner", "Lasagne", "Assemble and refrigerate, bake on the day.", "day_before"],
  [1, "lunch", "Pasta salad", null, "same_day"],
  [1, "dinner", "Roast chicken and veg", "Save half for Wednesday's wraps.", "same_day"],
  [2, "lunch", "Chicken wraps", "Use Tuesday's leftover roast chicken.", "same_day"],
  [2, "dinner", "Beef stew", "Slow cooker, start by 11:00.", "same_day"],
  [3, "lunch", "Fish fingers and mash", null, "same_day"],
  [3, "dinner", "Chicken pie", "Pastry is in the freezer.", "day_before"],
  [4, "lunch", "Toasted sandwiches", null, "same_day"],
  [4, "dinner", "Pizza night", "Dough from the freezer.", "same_day"],
];
const lasagne = (await q(
  "insert into recipes (household_id,title,summary,servings,prep_minutes,ingredients,method,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
  [
    hh.id,
    "Lasagne",
    "Assembles the day before, bakes in 35 minutes",
    "4 to 6",
    60,
    [
      "1 kg beef mince",
      "2 onions, finely chopped",
      "2 tins chopped tomatoes",
      "250 g lasagne sheets",
      "500 ml white sauce",
      "200 g grated cheddar",
    ].join("\n"),
    [
      "Heat the oven to 180 degrees.",
      "Fry the onions until soft, then add the mince and brown it all over.",
      "Stir in the tomatoes, season, and simmer for twenty minutes until thick.",
      "Layer mince, sheets and white sauce twice, finishing with sauce and cheese.",
      "Cover and refrigerate if making it the day before. Bake 35 minutes.",
    ].join("\n\n"),
    admin.id,
  ]
)).rows[0];

for (const week of [0, 7]) {
  for (const [offset, slot, dish, notes, timing] of menu) {
    await q(
      `insert into meals (household_id,date,slot,dish,notes,prep_timing,recipe_id,sort_order) values ($1,$2,$3,$4,$5,$6,$7,0)`,
      [hh.id, shift(monday, offset + week), slot, dish, notes, timing, dish === "Lasagne" ? lasagne.id : null]
    );
  }
  // Friday lunch shows three different plates; Saturday shows a slot left empty.
  const fri = shift(monday, 4 + week);
  const sat = shift(monday, 5 + week);
  const plates = [
    ["Chicken mayo sandwiches", "Emma", "Crusts off.", 1],
    ["Pasta salad", "Liam", "No tomato.", 2],
  ];
  for (const [dish, forWhom, note, order] of plates) {
    await q(
      "insert into meals (household_id,date,slot,dish,for_whom,notes,prep_timing,sort_order) values ($1,$2,'lunch',$3,$4,$5,'same_day',$6)",
      [hh.id, fri, dish, forWhom, note, order]
    );
  }
  await q(
    "insert into meals (household_id,date,slot,dish,notes,prep_timing,sort_order) values ($1,$2,'lunch',$3,$4,'same_day',0)",
    [hh.id, sat, "Toasties", "Everyone eats out tonight, so no dinner is planned."]
  );
}
console.log("menu and recipe seeded");

// grocery: a previous locked cycle with items, ready to order
function nextWeekday(from, wd) { let d = from; do { d = shift(d, 1); } while (isoDay(d) !== wd); return d; }
let lockDate = todayIso; while (isoDay(lockDate) !== hh.grocery_lock_weekday) lockDate = shift(lockDate, -1);
const prevLock = shift(lockDate, -7);
const prevOrder = nextWeekday(prevLock, hh.grocery_order_weekday);
const curOrder = nextWeekday(lockDate, hh.grocery_order_weekday);

await q("delete from grocery_cycles where household_id=$1", [hh.id]);
const prev = (await q(
  "insert into grocery_cycles (household_id,order_date,locks_at) values ($1,$2,$3) returning *",
  [hh.id, prevOrder, new Date(prevLock + "T16:00:00Z")]
)).rows[0];
const cur = (await q(
  "insert into grocery_cycles (household_id,order_date,locks_at) values ($1,$2,$3) returning *",
  [hh.id, curOrder, new Date(lockDate + "T16:00:00Z")]
)).rows[0];

const prevItems = [
  ["Bananas", "1 bunch", "fresh", emp.id],
  ["Chicken breasts", "1 kg", "fresh", emp.id],
  ["Baby spinach", "2 packs", "fresh", admin.id],
  ["Cheddar", "500 g", "fresh", emp.id],
  ["Lasagne sheets", "1 box", "pantry", emp.id],
  ["Tinned tomatoes", "4", "pantry", emp.id],
  ["Oats", "1 kg", "pantry", admin.id],
  ["Dishwasher tablets", null, "household", emp.id],
  ["Bin bags", "1 roll", "household", emp.id],
  ["Oat milk", "2 L", "fresh", emp.id],
];
for (const [name, qty, cat, by] of prevItems) {
  await q(
    "insert into grocery_items (cycle_id,name,quantity,category,added_by) values ($1,$2,$3,$4,$5)",
    [prev.id, name, qty, cat, by]
  );
}
const curItems = [
  ["Full cream milk", "4 L", "fresh", emp.id],
  ["Brown bread", "2 loaves", "fresh", emp.id],
  ["Washing powder", null, "household", admin.id],
];
for (const [name, qty, cat, by] of curItems) {
  await q(
    "insert into grocery_items (cycle_id,name,quantity,category,added_by) values ($1,$2,$3,$4,$5)",
    [cur.id, name, qty, cat, by]
  );
}
// one carried-over item from an earlier week
await q(
  "insert into grocery_items (cycle_id,name,quantity,category,added_by,carry_count) values ($1,$2,$3,$4,$5,1)",
  [prev.id, "Nappies size 4", "1 jumbo pack", "baby", admin.id]
);
console.log("groceries seeded; prev order", prevOrder, "current order", curOrder);

await pool.end();
