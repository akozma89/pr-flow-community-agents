import fs from "fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AgentSchema } from "./schema.mjs";

const jsonSchema = zodToJsonSchema(AgentSchema, "PRFlowAgent");
fs.writeFileSync("schema.json", JSON.stringify(jsonSchema, null, 2));
console.log("schema.json generated successfully.");
