import { Oso } from "oso-cloud";

if (!process.env.OSO_API_KEY) {
  console.warn("OSO_API_KEY is not set. Authorization will not be enforced.");
}

export const oso = new Oso('https://cloud.osohq.com', process.env.OSO_API_KEY || "dummy_api_key_for_dev");