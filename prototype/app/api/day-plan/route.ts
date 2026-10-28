// MODULE 7 · Owner: Person B (uses Person C's office + route data)
// POST { tasks[], userLocation } -> one single-trip itinerary

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";
import { DEMO_OFFICES } from "@/lib/demo";

export async function POST(req: Request) {
  const { tasks, userLocation } = await req.json();

  const prompt = `An Indian daily-wage worker has these pending government tasks:
${JSON.stringify(tasks)}

Nearby offices: ${JSON.stringify(DEMO_OFFICES)}
They start from: ${JSON.stringify(userLocation)}

Plan ONE day so all of it finishes in a single trip. Respect real constraints:
government offices work 10am-5pm with a 1-2pm lunch, banks get crowded after 11am,
and each wrong order costs another day's wages.

Return JSON:
{ "ordered": [{ "task": string, "office": string, "arriveBy": string, "travel": string }],
  "totalHours": number, "totalFare": number }`;

  const { data } = await callModel<any>(
    { prompt, json: true },
    {
      ordered: [
        { task: "बैंक में आधार लिंक", office: "Punjab National Bank, Rampur", arriveBy: "10:00", travel: "पैदल 10 मिनट" },
        { task: "आय प्रमाण पत्र नवीनीकरण", office: "Tehsil Office, Sitapur", arriveBy: "11:30", travel: "बस 42, ₹15, 38 मिनट" },
        { task: "राशन कार्ड में नाम जोड़ना", office: "Block Development Office", arriveBy: "14:30", travel: "ऑटो ₹20, 12 मिनट" },
      ],
      totalHours: 6,
      totalFare: 70,
    },
  );

  return NextResponse.json(data);
}
