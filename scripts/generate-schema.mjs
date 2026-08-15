import fs from "fs";
import { z } from "zod";
import { AgentSchema } from "./schema.mjs";

// Zod 4 ships its own JSON Schema converter. The previous `zod-to-json-schema`
// dependency only understands Zod 3 internals: against a Zod 4 schema it does
// not throw, it silently emits an empty `{"PRFlowAgent": {}}` definition — a
// published schema that validates anything, which is worse than none at all.
const definition = z.toJSONSchema(AgentSchema, { target: "draft-7" });
delete definition.$schema;

// Guard against regressing to that empty-stub state. A no-op schema is a silent
// failure, so fail loudly instead of writing it.
if (!definition.properties || Object.keys(definition.properties).length === 0) {
  console.error(
    "schema.json generation produced an empty definition — refusing to publish a no-op schema.",
  );
  process.exit(1);
}

const jsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $ref: "#/definitions/PRFlowAgent",
  definitions: { PRFlowAgent: definition },
};

fs.writeFileSync("schema.json", `${JSON.stringify(jsonSchema, null, 2)}\n`);
console.log("schema.json generated successfully.");
