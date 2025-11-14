import * as v from "valibot";

/**
 * Schema for get-modular-tools arguments
 */
export const getToolsSchema = v.object({
  group: v.string(),
});

/**
 * Schema for call-modular-tool arguments
 */
export const callToolSchema = v.object({
  group: v.string(),
  name: v.string(),
  args: v.record(v.string(), v.any()),
});

/**
 * Schema for get-category-tools arguments
 */
export const getCategoryToolsSchema = v.object({
  category: v.string(),
});

/**
 * Schema for call-category-tool arguments
 */
export const callCategoryToolSchema = v.object({
  category: v.string(),
  name: v.string(),
  args: v.record(v.string(), v.any()),
});
