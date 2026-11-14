/** JSON-schema fragments shared by the controllers. */
export const str = (max = 200) => ({ type: "string", maxLength: max }) as const;
export const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;
