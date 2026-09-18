import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  time,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- enums -- */

export const userRole = pgEnum("user_role", ["admin", "employee"]);
export const taskKind = pgEnum("task_kind", ["once", "recurring"]);
export const taskFrequency = pgEnum("task_frequency", [
  "daily",
  "weekly",
  "monthly",
]);
export const mealSlot = pgEnum("meal_slot", ["lunch", "dinner"]);
export const prepTiming = pgEnum("prep_timing", ["same_day", "day_before"]);
export const groceryStatus = pgEnum("grocery_status", [
  "pending",
  "ordered",
  "unavailable",
  "dropped",
]);
export const groceryCategory = pgEnum("grocery_category", [
  "fresh",
  "pantry",
  "household",
  "baby",
  "other",
]);
export const notificationKind = pgEnum("notification_kind", [
  "employee_grocery_reminder",
  "admin_order_reminder",
]);

/**
 * What happened on a single date, when it differs from the usual pattern.
 * `working` is the only one that counts as a working day; the rest are ways of
 * being away, kept apart so sick days can be counted separately from leave.
 */
export const workdayStatus = pgEnum("workday_status", [
  "working",
  "sick",
  "leave",
  "off",
]);

/* ----------------------------------------------------------- households -- */

export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  /** ISO weekdays that are working days by default: 1 = Monday … 7 = Sunday. */
  workingWeekdays: smallint("working_weekdays")
    .array()
    .notNull()
    .default([1, 2, 3, 4, 5]),
  /** ISO weekday the grocery list locks on. */
  groceryLockWeekday: smallint("grocery_lock_weekday").notNull().default(5),
  groceryLockTime: time("grocery_lock_time").notNull().default("18:00"),
  /** ISO weekday the admin places the order on. */
  groceryOrderWeekday: smallint("grocery_order_weekday").notNull().default(1),
  reminderTime: time("reminder_time").notNull().default("09:00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ---------------------------------------------------------------- users -- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("employee"),
    /** What they do here, e.g. "Nanny", "Cleaner". Free text, shown as a chip. */
    jobTitle: text("job_title"),
    /** Set when someone leaves. Their history stays; they cannot sign in. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("users_email_unique").on(t.email)],
);

/* --------------------------------------------------- workday overrides --- */

/**
 * One person's single date that departs from the usual working weekdays: a
 * Saturday that was worked, a weekday off sick, a day of leave. Attendance is
 * per person, so two people can be off on different days. Dates that follow
 * the usual pattern have no row.
 */
export const workdayOverrides = pgTable(
  "workday_overrides",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: workdayStatus("status").notNull().default("off"),
    note: text("note"),
    recordedBy: integer("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("workday_overrides_user_date_unique").on(t.userId, t.date),
    index("workday_overrides_household_date_idx").on(t.householdId, t.date),
  ],
);

/* ---------------------------------------------------------------- tasks -- */

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    kind: taskKind("kind").notNull(),
    assignedTo: integer("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Once-off tasks only. */
    dueDate: date("due_date"),
    /** Recurring tasks only. */
    frequency: taskFrequency("frequency"),
    /** Skip dates that are not working days (recurring tasks). */
    workingDaysOnly: boolean("working_days_only").notNull().default(true),
    /** Repeat every N days/weeks/months. */
    interval: smallint("interval").notNull().default(1),
    /** ISO weekdays for a weekly rule: 1 = Monday … 7 = Sunday. */
    weekdays: smallint("weekdays").array(),
    /** Day of month for a monthly rule. */
    monthDay: smallint("month_day"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    timeOfDay: time("time_of_day"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tasks_household_idx").on(t.householdId)],
);

export const taskCompletions = pgTable(
  "task_completions",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date").notNull(),
    completedBy: integer("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("task_completions_task_date_unique").on(t.taskId, t.occurrenceDate),
    index("task_completions_date_idx").on(t.occurrenceDate),
  ],
);

/** A single occurrence the admin cancelled without changing the rule. */
export const taskSkips = pgTable(
  "task_skips",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("task_skips_task_date_unique").on(t.taskId, t.occurrenceDate)],
);

/* ---------------------------------------------------------------- meals -- */

/**
 * The household's own cookbook. A meal can point at one of these so the person
 * cooking has the method to hand rather than being told a dish name.
 */
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** A short line for the list, e.g. "Freezes well, feeds four". */
    summary: text("summary"),
    servings: text("servings"),
    prepMinutes: smallint("prep_minutes"),
    /** One ingredient per line, kept as text so quantities stay free-form. */
    ingredients: text("ingredients"),
    method: text("method"),
    /** An outside link, for when the recipe lives somewhere else. */
    sourceUrl: text("source_url"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("recipes_household_idx").on(t.householdId)],
);

/**
 * One dish. A slot can hold several of them, because a household often eats
 * different lunches on the same day — so each row can say who it is for.
 * An empty slot has no rows at all, which is why nothing shows for it.
 */
export const meals = pgTable(
  "meals",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: mealSlot("slot").notNull(),
    dish: text("dish").notNull(),
    /** The recipe to follow, when one has been written down. */
    recipeId: integer("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    /** Free text, e.g. "Emma" or "the grown-ups". Empty means everyone. */
    forWhom: text("for_whom"),
    notes: text("notes"),
    prepTiming: prepTiming("prep_timing").notNull().default("same_day"),
    /** Order within the slot, as the admin arranged it. */
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("meals_household_date_idx").on(t.householdId, t.date),
    index("meals_date_idx").on(t.date),
  ],
);

/** One row per meal per prep date, so day-before prep can be ticked. */
export const mealCompletions = pgTable(
  "meal_completions",
  {
    id: serial("id").primaryKey(),
    mealId: integer("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    completedBy: integer("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("meal_completions_meal_unique").on(t.mealId)],
);

/* ------------------------------------------------------------ groceries -- */

export const groceryCycles = pgTable(
  "grocery_cycles",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    /** The date the admin places this cycle's order. */
    orderDate: date("order_date").notNull(),
    locksAt: timestamp("locks_at", { withTimezone: true }).notNull(),
    unlockedByAdmin: boolean("unlocked_by_admin").notNull().default(false),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("grocery_cycles_household_order_date_unique").on(
      t.householdId,
      t.orderDate,
    ),
  ],
);

export const groceryItems = pgTable(
  "grocery_items",
  {
    id: serial("id").primaryKey(),
    cycleId: integer("cycle_id")
      .notNull()
      .references(() => groceryCycles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity"),
    category: groceryCategory("category").notNull().default("other"),
    note: text("note"),
    addedBy: integer("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    status: groceryStatus("status").notNull().default("pending"),
    /** The item this one was carried over from, when out of stock. */
    carriedFromItemId: integer("carried_from_item_id"),
    carryCount: smallint("carry_count").notNull().default(0),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("grocery_items_cycle_idx").on(t.cycleId)],
);

/* --------------------------------------------------------- notifications -- */

export const notificationLog = pgTable(
  "notification_log",
  {
    id: serial("id").primaryKey(),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    sentForDate: date("sent_for_date").notNull(),
    recipientUserId: integer("recipient_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("notification_log_kind_date_recipient_unique").on(
      t.kind,
      t.sentForDate,
      t.recipientUserId,
    ),
  ],
);

/* ------------------------------------------------------------ relations -- */

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  tasks: many(tasks),
  meals: many(meals),
  groceryCycles: many(groceryCycles),
  workdayOverrides: many(workdayOverrides),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  assignedTasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  household: one(households, {
    fields: [tasks.householdId],
    references: [households.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  completions: many(taskCompletions),
  skips: many(taskSkips),
}));

export const taskCompletionsRelations = relations(
  taskCompletions,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskCompletions.taskId],
      references: [tasks.id],
    }),
    completedByUser: one(users, {
      fields: [taskCompletions.completedBy],
      references: [users.id],
    }),
  }),
);

export const taskSkipsRelations = relations(taskSkips, ({ one }) => ({
  task: one(tasks, { fields: [taskSkips.taskId], references: [tasks.id] }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  household: one(households, {
    fields: [recipes.householdId],
    references: [households.id],
  }),
  meals: many(meals),
}));

export const mealsRelations = relations(meals, ({ one, many }) => ({
  household: one(households, {
    fields: [meals.householdId],
    references: [households.id],
  }),
  recipe: one(recipes, {
    fields: [meals.recipeId],
    references: [recipes.id],
  }),
  completions: many(mealCompletions),
}));

export const mealCompletionsRelations = relations(
  mealCompletions,
  ({ one }) => ({
    meal: one(meals, {
      fields: [mealCompletions.mealId],
      references: [meals.id],
    }),
    completedByUser: one(users, {
      fields: [mealCompletions.completedBy],
      references: [users.id],
    }),
  }),
);

export const groceryCyclesRelations = relations(
  groceryCycles,
  ({ one, many }) => ({
    household: one(households, {
      fields: [groceryCycles.householdId],
      references: [households.id],
    }),
    items: many(groceryItems),
  }),
);

export const groceryItemsRelations = relations(groceryItems, ({ one }) => ({
  cycle: one(groceryCycles, {
    fields: [groceryItems.cycleId],
    references: [groceryCycles.id],
  }),
  addedByUser: one(users, {
    fields: [groceryItems.addedBy],
    references: [users.id],
  }),
}));

/* ---------------------------------------------------------------- types -- */

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WorkdayOverride = typeof workdayOverrides.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type MealCompletion = typeof mealCompletions.$inferSelect;
export type GroceryCycle = typeof groceryCycles.$inferSelect;
export type GroceryItem = typeof groceryItems.$inferSelect;
export type NewGroceryItem = typeof groceryItems.$inferInsert;

export type UserRole = (typeof userRole.enumValues)[number];
export type WorkdayStatus = (typeof workdayStatus.enumValues)[number];
export type MealSlot = (typeof mealSlot.enumValues)[number];
export type PrepTiming = (typeof prepTiming.enumValues)[number];
export type GroceryStatus = (typeof groceryStatus.enumValues)[number];
export type GroceryCategory = (typeof groceryCategory.enumValues)[number];
export type TaskFrequency = (typeof taskFrequency.enumValues)[number];
